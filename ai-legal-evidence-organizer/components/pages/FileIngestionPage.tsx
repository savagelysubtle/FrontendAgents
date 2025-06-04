import React, { useState, useCallback, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { EvidenceFile, Tag, PolicyReference, AiOrganizationPlan } from '../../types';
import { summarizeEvidenceText } from '../../services/geminiService';
// import { mcpWriteFile, mcpRenameFile } from '../../services/mcpService'; // Replaced by McpClient via context
import LoadingSpinner from '../ui/LoadingSpinner';
import { DEFAULT_TAG_COLOR, FILE_TYPES_SUPPORTED } from '../../constants';
import { v4 as uuidv4 } from 'uuid';
import Modal from '../ui/Modal';
import AiOrganizationReviewModal from '../modals/AiOrganizationReviewModal';

type BatchItemStatus = 'pending' | 'uploading_to_mcp' | 'adding_to_app' | 'summarizing' | 'generating_name' | 'ready_for_review' | 'finalizing' | 'completed' | 'error' | 'queued_for_organized_upload';

interface BatchQueueItem {
  id: string;
  originalFile: File;
  status: BatchItemStatus;
  appFileId?: string;
  mcpPathAttempted?: string; // Store the path we tried to write to on MCP
  contentForSummaryAndMcp?: string; // This will be used for summary, policy extraction, and MCP write
  summaryText?: string;
  suggestedName?: string;
  finalName: string;
  tags: Tag[];
  errorMessage?: string;
  extractedPolicies?: PolicyReference[];
}

const FileIngestionPage: React.FC = () => {
  const {
    addFile: addFileToContext, updateFile, addTag: addContextTag, tags: contextTags,
    setIsLoading: setAppIsLoading, setError: setAppError, addAuditLogEntry, apiKey,
    extractPolicyReferencesFromFile,
    mcpClient, isMcpClientLoading // Get McpClient from context
  } = useAppContext();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [currentStep, setCurrentStep] = useState<'SELECT_FILES' | 'PROCESSING_BATCH' | 'REVIEW_BATCH'>('SELECT_FILES');

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [currentItemForReview, setCurrentItemForReview] = useState<BatchQueueItem | null>(null);
  const [reviewModalName, setReviewModalName] = useState('');
  const [reviewModalTags, setReviewModalTags] = useState<Tag[]>([]);
  const [newTagNameInModal, setNewTagNameInModal] = useState('');

  // State to track if a directory was selected
  const [isDirectoryUpload, setIsDirectoryUpload] = useState(false);

  // State for AI Folder Organization
  const [isAiOrganizing, setIsAiOrganizing] = useState<boolean>(false);
  const [aiOrganizationSuggestions, setAiOrganizationSuggestions] = useState<AiOrganizationPlan | null>(null);
  const [isAiReviewModalOpen, setIsAiReviewModalOpen] = useState<boolean>(false);

  const filesToOrganizeForModal = React.useMemo(() => {
    return selectedFiles.map(file => ({
      originalPath: file.webkitRelativePath,
      name: file.name,
      size: file.size,
      type: file.type,
    }));
  }, [selectedFiles]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      setSelectedFiles(files);
      // Check if webkitRelativePath is present on the first file to determine if it's a directory upload
      if (files.length > 0 && files[0].webkitRelativePath) {
        setIsDirectoryUpload(true);
        const rootDir = files[0].webkitRelativePath.split('/')[0];
        addAuditLogEntry('DIRECTORY_SELECTION_CHANGED', `${files.length} files selected from directory: ${rootDir}`);
      } else {
        setIsDirectoryUpload(false);
        addAuditLogEntry('FILE_SELECTION_CHANGED', `${files.length} files selected.`);
      }
    }
  };

  const openReviewModal = (item: BatchQueueItem) => {
    setCurrentItemForReview(item);
    setReviewModalName(item.finalName || item.suggestedName || item.originalFile.name);
    setReviewModalTags(item.tags || []); // Ensure tags is an array
    setNewTagNameInModal('');
    setIsReviewModalOpen(true);
    addAuditLogEntry('REVIEW_MODAL_OPENED', `Reviewing file: ${item.originalFile.name}`);
  };

  const updateQueueItem = useCallback((itemId: string, updates: Partial<BatchQueueItem>) => {
    setBatchQueue(prev => prev.map(item => item.id === itemId ? { ...item, ...updates } : item));
  }, []);

  const processFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      if (file.type.startsWith('text/')) {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      } else if (file.type.startsWith('image/')) {
        // For images, if McpClient expects base64 for content:
        // reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]); // Get base64 part
        // reader.onerror = (e) => reject(e);
        // reader.readAsDataURL(file);
        // For now, use a placeholder as McpClient.writeFile takes string.
        resolve(`[Image data for ${file.name}]`);
      } else if (FILE_TYPES_SUPPORTED.some(type => file.name.toLowerCase().endsWith(type))) {
        resolve(`[Simulated extracted text from ${file.name}] Example policy references: C3-16.00, AP1-2-1.`);
      } else {
        resolve(`[Content for ${file.name} of type ${file.type}]`);
      }
    });
  };

  // ### Refactored Single Item Processing Logic ###
  const processSingleQueueItem = useCallback(async (item: BatchQueueItem) => {
    try {
      updateQueueItem(item.id, { status: 'uploading_to_mcp', errorMessage: undefined });
      addAuditLogEntry('FILE_PROCESS_ATTEMPT', `Processing item ID: ${item.id}, File: ${item.originalFile.name}`);

      let mcpPath: string;
      if (item.originalFile.webkitRelativePath) {
        mcpPath = `/uploads/${item.originalFile.webkitRelativePath}`;
      } else {
        mcpPath = `/uploads/${Date.now()}_${item.originalFile.name}`;
      }
      mcpPath = mcpPath.replace(/\/\//g, '/');

      const fileContentForProcessing = item.contentForSummaryAndMcp || await processFileContent(item.originalFile);
      updateQueueItem(item.id, { mcpPathAttempted: mcpPath, contentForSummaryAndMcp: fileContentForProcessing });

      const newEvidenceFileEntry = await addFileToContext(
        {
          name: item.finalName || item.originalFile.name,
          type: item.originalFile.name.split('.').pop()?.toLowerCase() as EvidenceFile['type'] || 'unknown',
          content: fileContentForProcessing,
          metadata: {
            source: 'Batch Upload',
            size: item.originalFile.size,
            createdAt: new Date().toISOString(),
          }
        },
        mcpPath,
        item.originalFile.name,
        fileContentForProcessing
      );

      if (!newEvidenceFileEntry) {
        throw new Error(`Failed to add file ${item.originalFile.name} to app database, likely due to MCP server issue during write.`);
      }

      // Re-fetch file from context to ensure all properties (like referencedPolicies) are up-to-date
      // This assumes getFileById is available and AppContext provides it.
      // For simplicity in this refactor, we'll rely on newEvidenceFileEntry, but in a real scenario, re-fetching is safer.
      // const contextFile = getFileById(newEvidenceFileEntry.id);
      // For now, we assume newEvidenceFileEntry contains what we need or addFileToContext has updated it adequately.


      updateQueueItem(item.id, { appFileId: newEvidenceFileEntry.id, extractedPolicies: newEvidenceFileEntry.referencedPolicies || [] });

      if (apiKey) {
        updateQueueItem(item.id, { status: 'summarizing' });
        const summary = await summarizeEvidenceText(fileContentForProcessing);
        updateQueueItem(item.id, { summaryText: summary });
        if (newEvidenceFileEntry.id) {
          updateFile(newEvidenceFileEntry.id, { summary: summary });
        }
      } else {
        updateQueueItem(item.id, { summaryText: "API Key not set - Summary skipped." });
      }

      updateQueueItem(item.id, { status: 'generating_name' });
      const dateStr = new Date().toISOString().split('T')[0];
      const fileType = item.originalFile.name.split('.').pop()?.toLowerCase() || 'bin';
      let suggested = `Document_${dateStr}.${fileType}`;
      if (item.summaryText && !item.summaryText.startsWith("API Key not set")) {
        const firstLine = item.summaryText.split('\n')[0].replace(/[^a-zA-Z0-9\s-]/g, '').substring(0, 30).trim().replace(/\s+/g, '_');
        if (firstLine) suggested = `${firstLine}_${dateStr}.${fileType}`;
      }
      updateQueueItem(item.id, { suggestedName: suggested, finalName: suggested }); // Ensure finalName is also set here initially

      updateQueueItem(item.id, { status: 'ready_for_review' });
      addAuditLogEntry('FILE_PROCESSED_BATCH', `File "${item.originalFile.name}" processed, ready for review. App ID: ${newEvidenceFileEntry.id}. Policies found: ${newEvidenceFileEntry.referencedPolicies?.length || 0}`);

    } catch (err: any) {
      console.error(`Error processing ${item.originalFile.name} (ID: ${item.id}):`, err);
      updateQueueItem(item.id, { status: 'error', errorMessage: err.message || 'An unknown error occurred' });
      addAuditLogEntry('FILE_PROCESS_BATCH_ERROR', `Error processing ${item.originalFile.name} (ID: ${item.id}): ${err.message}`, 'error');
    }
  }, [addFileToContext, apiKey, summarizeEvidenceText, updateFile, updateQueueItem, addAuditLogEntry, processFileContent]);
  // ### End of Refactored Logic ###

  const handleStartBatchProcessing = async () => {
    if (selectedFiles.length === 0) {
      setAppError("Please select at least one file.");
      return;
    }
    if (!apiKey) {
      setAppError("Gemini API Key is not set. Please configure it in Settings.");
      return;
    }
    if (isMcpClientLoading || !mcpClient || !mcpClient.ready) {
      setAppError(`MCP Client is not ready. Status: ${isMcpClientLoading ? 'Loading config...' : (mcpClient?.getInitializationError() || 'Unknown error')}. Please wait or check MCP server connection in Settings.`);
      return;
    }


    const newBatchQueue: BatchQueueItem[] = selectedFiles.map(file => ({
      id: uuidv4(),
      originalFile: file,
      status: 'pending',
      finalName: file.name,
      tags: [],
    }));
    setBatchQueue(newBatchQueue);
    setCurrentStep('PROCESSING_BATCH');
    setAppIsLoading(true);
    setAppError(null);

    // Process items sequentially for now, could be parallelized with Promise.all if appropriate
    for (const item of newBatchQueue) {
      // Ensure mcpClient is still valid before processing each item
      if (isMcpClientLoading || !mcpClient || !mcpClient.ready) {
        const mcpError = `MCP Client is not ready. Status: ${isMcpClientLoading ? 'Loading config...' : (mcpClient?.getInitializationError() || 'Unknown error')}`;
        updateQueueItem(item.id, { status: 'error', errorMessage: mcpError });
        addAuditLogEntry('FILE_PROCESS_BATCH_ERROR', `Skipping ${item.originalFile.name}: ${mcpError}`, 'error');
        continue; // Skip this item
      }
      await processSingleQueueItem(item);
    }

    // Check if all items are in 'error' or 'ready_for_review' or 'completed'
    // This global isLoading might need adjustment if processing is long
    // setAppIsLoading(false); // Potentially move this or refine based on all items' status
    // For now, we'll let individual items manage their spinners if any, and review button appears.
  };

  const handleRetryProcessItem = useCallback(async (itemId: string) => {
    const itemToRetry = batchQueue.find(item => item.id === itemId);
    if (itemToRetry && itemToRetry.status === 'error') {
      addAuditLogEntry('FILE_PROCESS_RETRY_ATTEMPT', `Retrying file: ${itemToRetry.originalFile.name} (ID: ${itemId})`);
      // Re-check MCP client status before retry
      if (isMcpClientLoading || !mcpClient || !mcpClient.ready) {
          const mcpError = `MCP Client is not ready for retry. Status: ${isMcpClientLoading ? 'Loading config...' : (mcpClient?.getInitializationError() || 'Unknown error')}`;
          updateQueueItem(itemToRetry.id, { status: 'error', errorMessage: mcpError }); // Update message if needed
          addAuditLogEntry('FILE_PROCESS_RETRY_FAIL', `Retry for ${itemToRetry.originalFile.name} aborted: ${mcpError}`, 'error');
          setAppError(mcpError + ". Please check MCP status in header and try again.");
          return;
      }
      await processSingleQueueItem(itemToRetry);
    }
  }, [batchQueue, processSingleQueueItem, addAuditLogEntry, mcpClient, isMcpClientLoading, setAppError, updateQueueItem]);

  const handleSaveReviewModal = async () => {
    if (!currentItemForReview || !currentItemForReview.appFileId || !mcpClient || !mcpClient.ready) {
        setAppError("Cannot save review: Item or MCP Client not available.");
        return;
    }

    setAppIsLoading(true);
    updateQueueItem(currentItemForReview.id, { status: 'finalizing', finalName: reviewModalName, tags: reviewModalTags });

    try {
        let finalMcpPath = currentItemForReview.mcpPathAttempted || '';
        const appFileBeforeRename = useAppContext().getFileById(currentItemForReview.appFileId);

        if (appFileBeforeRename && reviewModalName !== appFileBeforeRename.name && appFileBeforeRename.mcpPath) {
            const oldMcpPath = appFileBeforeRename.mcpPath;
            // Construct new MCP path carefully
            let newMcpPath = oldMcpPath; // Default to old path
            if (appFileBeforeRename.mcpPath.includes('/')) { // Path has directory structure
                 newMcpPath = oldMcpPath.substring(0, oldMcpPath.lastIndexOf('/') + 1) + reviewModalName;
            } else { // Root level file in uploads (should be rare with new folder structure)
                 newMcpPath = `/uploads/${reviewModalName}`; // Or however you want to handle this case
            }

            const renameSuccess = await mcpClient.renameFile(oldMcpPath, newMcpPath);
            if (renameSuccess) {
                finalMcpPath = newMcpPath;
                addAuditLogEntry('FILE_RENAMED_MCP_BATCH', `File ${appFileBeforeRename.name} MCP path renamed from ${oldMcpPath} to ${newMcpPath}`);
            } else {
                setAppError(`Failed to rename file on MCP server for ${appFileBeforeRename.name}. Using original MCP path for app record.`);
                addAuditLogEntry('FILE_RENAMED_MCP_FAILED_BATCH', `MCP rename failed for ${oldMcpPath} to ${newMcpPath}`);
                // finalMcpPath remains appFileBeforeRename.mcpPath (which is currentItemForReview.mcpPathAttempted)
            }
        }

        updateFile(currentItemForReview.appFileId, {
            name: reviewModalName,
            tags: reviewModalTags,
            summary: currentItemForReview.summaryText, // Summary might already be set
            mcpPath: finalMcpPath, // Update mcpPath in app state if rename was successful
        });

        updateQueueItem(currentItemForReview.id, { status: 'completed', mcpPathAttempted: finalMcpPath });
        addAuditLogEntry('FILE_FINALIZED_BATCH', `File "${reviewModalName}" (App ID: ${currentItemForReview.appFileId}) finalized and saved. MCP Path: ${finalMcpPath}`);
    } catch (error: any) {
        setAppError(`Error finalizing file ${reviewModalName}: ${error.message}`);
        updateQueueItem(currentItemForReview.id, { status: 'error', errorMessage: `Finalization error: ${error.message}` });
    } finally {
        setAppIsLoading(false);
        setIsReviewModalOpen(false);
        setCurrentItemForReview(null);
    }
  };

  const handleAddTagInModal = () => {
    if (newTagNameInModal.trim() === '') return;
    const existingTag = contextTags.find(t => t.name.toLowerCase() === newTagNameInModal.trim().toLowerCase());
    let tagToAdd: Tag;
    if (existingTag) {
        tagToAdd = existingTag;
    } else {
        tagToAdd = addContextTag({ name: newTagNameInModal.trim(), color: DEFAULT_TAG_COLOR, criteria: 'other' });
    }

    if (!reviewModalTags.find(t => t.id === tagToAdd.id)) {
        setReviewModalTags(prev => [...prev, tagToAdd]);
    }
    setNewTagNameInModal('');
  };

  const removeTagFromModal = (tagId: string) => {
    setReviewModalTags(prev => prev.filter(t => t.id !== tagId));
  };


  const resetBatch = () => {
    setSelectedFiles([]);
    setBatchQueue([]);
    setCurrentStep('SELECT_FILES');
    setAppError(null);
  };

  const allItemsProcessed = batchQueue.every(item => item.status === 'completed' || item.status === 'error' || item.status === 'ready_for_review');

  // Automatically move to review step if all items are processed (and some are ready for review)
  useEffect(() => {
    if (currentStep === 'PROCESSING_BATCH' && batchQueue.length > 0 && batchQueue.every(item => item.status === 'ready_for_review' || item.status === 'completed' || item.status === 'error')) {
      if (batchQueue.some(item => item.status === 'ready_for_review')) {
        setCurrentStep('REVIEW_BATCH');
        addAuditLogEntry('BATCH_PROCESSING_REVIEW_READY', 'All files processed, batch moved to review stage.');
      } else if (batchQueue.every(item => item.status === 'completed' || item.status === 'error')) {
        // If all are completed or error, and none ready_for_review (e.g. auto-finalized or all failed)
        setCurrentStep('REVIEW_BATCH'); // Still go to review to see errors/completed items
        addAuditLogEntry('BATCH_PROCESSING_FINISHED_NO_REVIEW_NEEDED', 'All files finalized or failed, batch moved to review stage.');
      }
      // setAppIsLoading(false); // Moved from handleStartBatch as processing is truly done here
    }
  }, [batchQueue, currentStep, addAuditLogEntry]);

  useEffect(() => {
    // If all items are completed or error, setAppIsLoading to false
    if (batchQueue.length > 0 && batchQueue.every(item => item.status === 'completed' || item.status === 'error')) {
      setAppIsLoading(false);
    } else if (currentStep === 'PROCESSING_BATCH' && batchQueue.some(item => item.status !== 'completed' && item.status !== 'error' && item.status !== 'ready_for_review')) {
      // If still processing items that are not yet done/error/reviewable
      setAppIsLoading(true);
    } else if (currentStep !== 'PROCESSING_BATCH' && currentStep !== 'SELECT_FILES') {
      // For REVIEW_BATCH or other future states, if not all are done/error, might still be loading if review causes processing
      // For now, assume loading is false if not in PROCESSING_BATCH unless specific actions in review set it true.
      setAppIsLoading(false);
    } else if (currentStep === 'SELECT_FILES') {
      setAppIsLoading(false);
    }

  }, [batchQueue, currentStep, setAppIsLoading]);

  const getStatusColor = (status: BatchItemStatus) => {
    if (status === 'completed') return 'text-green-500';
    if (status === 'error') return 'text-red-500';
    if (status === 'ready_for_review') return 'text-blue-500';
    if (status === 'queued_for_organized_upload') return 'text-purple-500';
    if (['uploading_to_mcp', 'adding_to_app', 'summarizing', 'generating_name', 'finalizing'].includes(status)) return 'text-yellow-500';
    return 'text-textSecondary';
  };

  const getStatusText = (itemStatus: BatchItemStatus, errorMessage?: string) => {
    switch (itemStatus) {
      case 'pending': return 'Pending...';
      case 'queued_for_organized_upload': return 'Queued for AI-organized upload...';
      case 'uploading_to_mcp': return 'Preparing file for evidence room...';
      case 'adding_to_app': return 'Registering file in system...';
      case 'summarizing': return 'Generating AI summary...';
      case 'generating_name': return 'Suggesting a file name...';
      case 'ready_for_review': return 'Ready for your review.';
      case 'finalizing': return 'Finalizing...';
      case 'completed': return 'Completed';
      case 'error': return `Error: ${errorMessage || 'Unknown error'}`;
      default: return 'Unknown status';
    }
  };

  const handleStartAiOrganizationProcess = async () => {
    if (selectedFiles.length === 0 || !isDirectoryUpload) {
      setAppError("Please select a folder to organize.");
      return;
    }
    if (!apiKey) {
      setAppError("Gemini API Key is not set. Please configure it in Settings.");
      return;
    }
    if (isMcpClientLoading || !mcpClient || !mcpClient.ready) {
      setAppError(`MCP Client is not ready. Status: ${isMcpClientLoading ? 'Loading config...' : (mcpClient?.getInitializationError() || 'Unknown error')}. Please wait or check MCP server connection in Settings.`);
      return;
    }

    addAuditLogEntry('AI_ORGANIZATION_START', `Attempting to organize folder with ${selectedFiles.length} files.`);
    setIsAiOrganizing(true);
    setAppIsLoading(true);
    setAppError(null);

    try {
      console.log("Files to organize for AI:", filesToOrganizeForModal);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call to Gemini

      const uniqueBaseName = `AI_Organized_Case_${Date.now()}`;
      const newMcpBaseDir = `/uploads/${uniqueBaseName}`;

      const mockSuggestions: AiOrganizationPlan = {
        newMcpBaseDirectory: newMcpBaseDir,
        directoriesToCreateOnMcp: [
          `${newMcpBaseDir}/Evidence_Documents`,
          `${newMcpBaseDir}/Correspondence`,
          `${newMcpBaseDir}/Pleadings`
        ],
        fileOperations: filesToOrganizeForModal.map((file, index) => {
          const extension = file.name.split('.').pop() || 'file';
          let category = 'Miscellaneous';
          if (index % 3 === 0) category = 'Evidence_Documents';
          else if (index % 3 === 1) category = 'Correspondence';
          else category = 'Pleadings';
          return {
            originalRelativePath: file.originalPath, // This is key to map back to selectedFile
            newRelativePathInOrganizedFolder: `${category}/Organized_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0,50)}_${index}.${extension}`
          };
        }).slice(0, 5), // Mock for first 5 files if many are selected
        aiRationale: "Suggested organization based on common legal case structures, categorizing by document type."
      };
      setAiOrganizationSuggestions(mockSuggestions);
      setIsAiReviewModalOpen(true);
      addAuditLogEntry('AI_ORGANIZATION_SUGGESTIONS_RECEIVED', `AI suggestions received for ${filesToOrganizeForModal.length} files.`);

    } catch (error: any) {
      console.error("Error during AI organization process:", error);
      setAppError(`Error during AI organization: ${error.message}`);
      addAuditLogEntry('AI_ORGANIZATION_ERROR', `Error: ${error.message}`, 'error');
    } finally {
      setIsAiOrganizing(false);
      // setAppIsLoading(false); // Modal will control this or be closed
    }
  };

  const handleAiPlanApplied = async (appliedPlan: AiOrganizationPlan) => {
    setIsAiReviewModalOpen(false);
    addAuditLogEntry('AI_ORGANIZATION_PLAN_APPLIED', `User approved AI plan. New base: ${appliedPlan.newMcpBaseDirectory}. Preparing to upload ${appliedPlan.fileOperations.length} files.`);
    setAppError(null);
    setAppIsLoading(true);

    const newBatchQueue: BatchQueueItem[] = [];

    for (const op of appliedPlan.fileOperations) {
      const originalSelectedFile = selectedFiles.find(sf => sf.webkitRelativePath === op.originalRelativePath);
      if (originalSelectedFile) {
        const newMcpPath = `${appliedPlan.newMcpBaseDirectory}/${op.newRelativePathInOrganizedFolder}`.replace(/\/\//g, '/');
        const newFileName = op.newRelativePathInOrganizedFolder.includes('/')
          ? op.newRelativePathInOrganizedFolder.substring(op.newRelativePathInOrganizedFolder.lastIndexOf('/') + 1)
          : op.newRelativePathInOrganizedFolder;

        newBatchQueue.push({
          id: uuidv4(),
          originalFile: originalSelectedFile, // Keep original for content reading by processSingleQueueItem
          status: 'queued_for_organized_upload', // New status
          finalName: newFileName, // Use the new name from the plan
          tags: [], // Start with empty tags for newly organized files
          mcpPathAttempted: newMcpPath, // This is the key: the new organized path
          // contentForSummaryAndMcp: will be read by processSingleQueueItem from originalFile
        });
      } else {
        addAuditLogEntry('AI_ORGANIZATION_FILE_MAP_WARN', `Could not map AI op for ${op.originalRelativePath} back to a selected file. Skipping.`, 'warning');
      }
    }

    setBatchQueue(newBatchQueue);
    setSelectedFiles([]); // Clear original selection
    setAiOrganizationSuggestions(null);
    setCurrentStep('PROCESSING_BATCH');
    addAuditLogEntry('AI_ORGANIZATION_BATCH_CREATED', `${newBatchQueue.length} files queued for upload to new organized structure.`);

    if (newBatchQueue.length === 0) {
        setAppIsLoading(false);
        setAppError("No files were mapped for AI-organized upload. Please check logs.");
        return;
    }

    for (const item of newBatchQueue) {
      if (isMcpClientLoading || !mcpClient || !mcpClient.ready) {
        const mcpError = `MCP Client is not ready. Status: ${isMcpClientLoading ? 'Loading config...' : (mcpClient?.getInitializationError() || 'Unknown error')}`;
        updateQueueItem(item.id, { status: 'error', errorMessage: mcpError });
        addAuditLogEntry('FILE_PROCESS_BATCH_ERROR', `Skipping ${item.originalFile.name}: ${mcpError}`, 'error');
        continue;
      }
      await processSingleQueueItem(item); // This will now use item.mcpPathAttempted (the new path)
    }
    // setAppIsLoading(false) will be handled by the useEffect watching batchQueue and currentStep
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-semibold text-textPrimary">Batch File Ingestion</h2>
        {batchQueue.length > 0 && (
            <button onClick={resetBatch} className="text-sm bg-gray-200 dark:bg-gray-700 text-textPrimary px-3 py-1.5 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">
                Reset & Start New Batch
            </button>
        )}
      </div>

      { (isMcpClientLoading || (mcpClient && !mcpClient.ready)) && (
        <div className="p-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-500 text-yellow-700 dark:text-yellow-300 rounded-md">
          MCP Client Status: {isMcpClientLoading ? 'Initializing...' : (mcpClient?.getInitializationError() || 'Not ready.')} File operations via MCP may fail.
        </div>
      )}
      {!apiKey && (
        <div className="p-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-500 text-yellow-700 dark:text-yellow-300 rounded-md">
          Warning: Gemini API Key is not set. AI features will not work. Please go to Settings to configure it.
        </div>
      )}


      {currentStep === 'SELECT_FILES' && (
        <div className="space-y-4 bg-surface p-6 rounded-lg shadow-modern-md dark:shadow-modern-md-dark border border-border">
          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium text-textSecondary mb-1">
              Select Files or a Folder (PDF, DOCX, TXT, Images)
            </label>
            <input
              id="file-upload"
              type="file"
              multiple
              // Add webkitdirectory attribute to allow folder selection
              // @ts-ignore because webkitdirectory is non-standard but widely supported
              webkitdirectory=""
              directory=""
              onChange={handleFileChange}
              className="block w-full text-sm text-textSecondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-light file:text-primary hover:file:bg-primary-light/80 dark:file:bg-primary-dark dark:file:text-primary-light dark:hover:file:bg-primary-dark/80 cursor-pointer"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
            />
            <p className="mt-1 text-xs text-textSecondary">
              To select a folder, click and choose a directory. All files within will be selected.
              To select individual files, click and select files as usual.
            </p>
          </div>
          {selectedFiles.length > 0 && (
            <div className="mt-4">
              <h4 className="text-textPrimary font-medium">
                {isDirectoryUpload ? `Files from selected directory` : `Selected files`} ({selectedFiles.length}):
              </h4>
              <ul className="list-disc list-inside text-textSecondary max-h-32 overflow-y-auto">
                {selectedFiles.map(file => <li key={file.webkitRelativePath || file.name}>{file.webkitRelativePath || file.name} ({Math.round(file.size / 1024)} KB)</li>)}
              </ul>
            </div>
          )}
          <button
            onClick={handleStartBatchProcessing}
            disabled={selectedFiles.length === 0 || (!mcpClient?.ready && !isMcpClientLoading) }
            className="w-full bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            { !mcpClient?.ready && !isMcpClientLoading ? 'MCP Client Not Ready' : `Start Batch Processing (${selectedFiles.length} files)`}
          </button>
          {/* New Button for AI Organization */}
          {isDirectoryUpload && selectedFiles.length > 0 && (
            <button
              onClick={handleStartAiOrganizationProcess}
              disabled={isAiOrganizing || (!mcpClient?.ready && !isMcpClientLoading)}
              className="mt-2 w-full bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {isAiOrganizing ? <><LoadingSpinner size='sm' /> <span className='ml-2'>Analyzing Folder...</span></> : 'Analyze and Organize Folder with AI'}
            </button>
          )}
        </div>
      )}

      {(currentStep === 'PROCESSING_BATCH' || currentStep === 'REVIEW_BATCH') && batchQueue.length > 0 && (
        <div className="space-y-4 bg-surface p-6 rounded-lg shadow-modern-md dark:shadow-modern-md-dark border border-border">
          <h3 className="text-xl font-semibold text-textPrimary mb-2">
            {currentStep === 'PROCESSING_BATCH' ? 'Processing Batch...' : 'Review Batch Results'}
            ({batchQueue.filter(i => i.status === 'completed').length} / {batchQueue.length} Completed)
          </h3>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {batchQueue.map(item => (
              <div key={item.id} className={`p-3 border rounded-md flex justify-between items-center ${item.status === 'error' ? 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-700' : 'bg-background border-border'}`}>
                <div>
                  <p className="font-medium text-textPrimary">{item.originalFile.name}</p>
                  <p className={`text-xs ${getStatusColor(item.status)}`}>{getStatusText(item.status, item.errorMessage)}</p>
                  {item.status === 'ready_for_review' && (
                    <>
                      <p className="text-xs text-textSecondary mt-1">Suggested Name: {item.suggestedName}</p>
                      {item.extractedPolicies && item.extractedPolicies.length > 0 && (
                          <p className="text-xs text-blue-500 mt-0.5">Policies: {item.extractedPolicies.map(p => p.policyNumber).join(', ')}</p>
                      )}
                       <p className="text-xs text-textSecondary mt-0.5">MCP Path Attempted: {item.mcpPathAttempted}</p>
                    </>
                  )}
                   {item.status === 'completed' && (
                    <>
                        <p className="text-xs text-textSecondary mt-1">Final Name: {item.finalName}</p>
                        <p className="text-xs text-textSecondary mt-0.5">MCP Path: {item.mcpPathAttempted}</p>
                    </>
                  )}
                </div>
                {currentStep === 'REVIEW_BATCH' && item.status === 'ready_for_review' && (
                  <button
                    onClick={() => openReviewModal(item)}
                    className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md whitespace-nowrap"
                  >
                    Review & Finalize
                  </button>
                )}
                {currentStep === 'REVIEW_BATCH' && item.status === 'completed' && (
                     <span className="text-sm text-green-500">✓ Finalized</span>
                )}
                {currentStep === 'REVIEW_BATCH' && item.status === 'error' && (
                     <span className="text-sm text-red-500" title={item.errorMessage}>✗ Error</span>
                )}
                 { (item.status !== 'ready_for_review' && item.status !== 'completed' && item.status !== 'error') && <LoadingSpinner size="sm"/> }
              </div>
            ))}
          </div>
          {currentStep === 'REVIEW_BATCH' && !allItemsProcessed && (
             <p className="text-center text-textSecondary mt-4">Please review and finalize each file marked "Ready for Review".</p>
          )}
           {currentStep === 'REVIEW_BATCH' && allItemsProcessed && (
             <p className="text-center text-green-600 dark:text-green-400 mt-4 font-semibold">All files have been processed or marked with an error.</p>
          )}
        </div>
      )}

      {isReviewModalOpen && currentItemForReview && (
        <Modal
            title={`Review: ${currentItemForReview.originalFile.name}`}
            isOpen={isReviewModalOpen}
            onClose={() => setIsReviewModalOpen(false)}
            footer={
                <div className="flex justify-end gap-2">
                    <button onClick={() => setIsReviewModalOpen(false)} className="px-4 py-2 border border-border rounded-md text-textPrimary hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
                    <button onClick={handleSaveReviewModal} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark" disabled={!mcpClient?.ready}>
                        { !mcpClient?.ready ? 'MCP Not Ready' : 'Save Changes'}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                <div>
                    <label htmlFor="modalFileName" className="block text-sm font-medium text-textSecondary">Filename</label>
                    <input type="text" id="modalFileName" value={reviewModalName} onChange={(e) => setReviewModalName(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
                    <p className="text-xs text-textSecondary mt-1">
                        Suggested: {currentItemForReview.suggestedName} <br/>
                        Original Path: {currentItemForReview.originalFile.webkitRelativePath || currentItemForReview.originalFile.name}
                    </p>
                </div>
                {currentItemForReview.summaryText && (
                    <div>
                        <h4 className="text-sm font-medium text-textSecondary">AI Summary:</h4>
                        <div className="mt-1 p-2 bg-background rounded-md max-h-32 overflow-y-auto text-xs border border-border">
                            <pre className="whitespace-pre-wrap">{currentItemForReview.summaryText}</pre>
                        </div>
                    </div>
                )}
                {currentItemForReview.extractedPolicies && currentItemForReview.extractedPolicies.length > 0 && (
                     <div>
                        <h4 className="text-sm font-medium text-textSecondary">Extracted Policies:</h4>
                        <div className="mt-1 text-xs text-textSecondary">
                            {currentItemForReview.extractedPolicies.map(p => p.policyNumber).join(', ')}
                        </div>
                    </div>
                )}
                <div>
                    <h4 className="text-sm font-medium text-textSecondary">Tags:</h4>
                    <div className="flex flex-wrap gap-1 my-1">
                        {reviewModalTags.map(tag => (
                            <span key={tag.id} className={`px-2 py-0.5 text-xs rounded-full text-white ${tag.color || DEFAULT_TAG_COLOR} flex items-center`}>
                            {tag.name}
                            <button onClick={() => removeTagFromModal(tag.id)} className="ml-1 text-white hover:text-opacity-75 text-xs">&times;</button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input type="text" value={newTagNameInModal} onChange={(e) => setNewTagNameInModal(e.target.value)} placeholder="New or existing tag name"
                            className="flex-grow px-3 py-1.5 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-xs" />
                        <button onClick={handleAddTagInModal} className="bg-secondary text-white px-3 py-1 rounded-md hover:bg-secondary-dark text-xs">Add Tag</button>
                    </div>
                     <div className="mt-1 text-xs text-textSecondary">Available context tags: {contextTags.map(t => t.name).join(', ') || 'None'}</div>
                </div>
            </div>
        </Modal>
      )}

      {isAiReviewModalOpen && aiOrganizationSuggestions && filesToOrganizeForModal && (
        <AiOrganizationReviewModal
          isOpen={isAiReviewModalOpen}
          onClose={() => {
            setIsAiReviewModalOpen(false);
            setAppIsLoading(false); // Explicitly set loading false when modal is closed without applying
            addAuditLogEntry('AI_ORGANIZATION_MODAL_CLOSED', 'AI Review Modal closed by user.');
          }}
          originalFiles={filesToOrganizeForModal}
          suggestions={aiOrganizationSuggestions}
          onApplyComplete={handleAiPlanApplied}
        />
      )}

    </div>
  );
};

export default FileIngestionPage;
