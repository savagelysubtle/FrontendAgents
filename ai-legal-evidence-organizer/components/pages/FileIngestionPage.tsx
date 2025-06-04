
import React, { useState, useCallback, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { EvidenceFile, Tag, PolicyReference } from '../../types';
import { summarizeEvidenceText } from '../../services/geminiService';
// import { mcpWriteFile, mcpRenameFile } from '../../services/mcpService'; // Replaced by McpClient via context
import LoadingSpinner from '../ui/LoadingSpinner';
import { DEFAULT_TAG_COLOR, FILE_TYPES_SUPPORTED } from '../../constants';
import { v4 as uuidv4 } from 'uuid';
import Modal from '../ui/Modal';

type BatchItemStatus = 'pending' | 'uploading_to_mcp' | 'adding_to_app' | 'summarizing' | 'generating_name' | 'ready_for_review' | 'finalizing' | 'completed' | 'error';

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
      addAuditLogEntry('FILE_SELECTION_CHANGED', `${event.target.files.length} files selected.`);
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

  const updateQueueItem = (itemId: string, updates: Partial<BatchQueueItem>) => {
    setBatchQueue(prev => prev.map(item => item.id === itemId ? { ...item, ...updates } : item));
  };

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

    for (const item of newBatchQueue) {
      try {
        updateQueueItem(item.id, { status: 'uploading_to_mcp' });
        const mcpPath = `/uploads/${Date.now()}_${item.originalFile.name}`; // Target MCP path
        const fileContentForProcessing = await processFileContent(item.originalFile); 
        updateQueueItem(item.id, { mcpPathAttempted: mcpPath, contentForSummaryAndMcp: fileContentForProcessing });

        // addFileToContext now handles the mcpClient.writeFile call
        const newEvidenceFileEntry = await addFileToContext(
          { 
            name: item.originalFile.name, // Initial name, can be changed in review
            type: item.originalFile.name.split('.').pop()?.toLowerCase() as EvidenceFile['type'] || 'unknown',
            content: fileContentForProcessing, // Content for app state (summary, policy extraction)
            metadata: {
              source: 'Batch Upload',
              size: item.originalFile.size,
              createdAt: new Date().toISOString(),
            }
          }, 
          mcpPath, // The path where McpClient will attempt to write
          item.originalFile.name, // Original name for MCP logging/reference if path is a directory
          fileContentForProcessing // Content for McpClient to write
        );

        if (!newEvidenceFileEntry) { // addFileToContext returns null if MCP write failed
            throw new Error(`Failed to add file ${item.originalFile.name} to app, likely due to MCP server issue.`);
        }
        
        // Policies are now extracted within addFileToContext or by updateFile if content changes
        const contextFile = useAppContext().getFileById(newEvidenceFileEntry.id); // Re-fetch to get policies
        updateQueueItem(item.id, { appFileId: newEvidenceFileEntry.id, extractedPolicies: contextFile?.referencedPolicies || [] });
        
        if (apiKey) { // Only attempt summary if API key is present
            updateQueueItem(item.id, { status: 'summarizing' });
            const summary = await summarizeEvidenceText(fileContentForProcessing);
            updateQueueItem(item.id, { summaryText: summary });
            if (newEvidenceFileEntry.id) {
                updateFile(newEvidenceFileEntry.id, { summary: summary }); 
            }
        } else {
            updateQueueItem(item.id, { summaryText: "API Key not set - Summary skipped."});
        }


        updateQueueItem(item.id, { status: 'generating_name' });
        const dateStr = new Date().toISOString().split('T')[0];
        const fileType = item.originalFile.name.split('.').pop()?.toLowerCase() || 'bin';
        let suggested = `Document_${dateStr}.${fileType}`;
        if (item.summaryText && !item.summaryText.startsWith("API Key not set")) {
          const firstLine = item.summaryText.split('\n')[0].replace(/[^a-zA-Z0-9\s-]/g, '').substring(0, 30).trim().replace(/\s+/g, '_');
          if (firstLine) suggested = `${firstLine}_${dateStr}.${fileType}`;
        }
        updateQueueItem(item.id, { suggestedName: suggested, finalName: suggested });

        updateQueueItem(item.id, { status: 'ready_for_review' });
        addAuditLogEntry('FILE_PROCESSED_BATCH', `File "${item.originalFile.name}" processed, ready for review. App ID: ${newEvidenceFileEntry.id}. Policies found: ${contextFile?.referencedPolicies?.length || 0}`);

      } catch (err: any) {
        console.error(`Error processing ${item.originalFile.name}:`, err);
        updateQueueItem(item.id, { status: 'error', errorMessage: err.message });
        addAuditLogEntry('FILE_PROCESS_BATCH_ERROR', `Error processing ${item.originalFile.name}: ${err.message}`);
      }
    }
    setAppIsLoading(false);
    setCurrentStep('REVIEW_BATCH');
  };
  
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
            // Construct new MCP path carefully, assuming a flat structure in /uploads/ for this demo
            const newMcpPath = oldMcpPath.substring(0, oldMcpPath.lastIndexOf('/') + 1) + reviewModalName;
            
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

  const allFilesReviewedOrError = batchQueue.every(item => item.status === 'completed' || item.status === 'error');


  const getStatusColor = (status: BatchItemStatus) => {
    if (status === 'completed') return 'text-green-500';
    if (status === 'error') return 'text-red-500';
    if (status === 'ready_for_review') return 'text-blue-500';
    if (['uploading_to_mcp', 'adding_to_app', 'summarizing', 'generating_name', 'finalizing'].includes(status)) return 'text-yellow-500';
    return 'text-textSecondary';
  };
  
  const getStatusText = (item: BatchItemStatus, errorMessage?: string) => {
    switch(item) {
        case 'pending': return 'Pending...';
        case 'uploading_to_mcp': return 'Writing to MCP Server...';
        case 'adding_to_app': return 'Registering file & checking policies...';
        case 'summarizing': return 'AI Analyzing Document...';
        case 'generating_name': return 'Generating Name...';
        case 'ready_for_review': return 'Ready for Review';
        case 'finalizing': return 'Saving changes...';
        case 'completed': return 'Completed';
        case 'error': return `Error: ${errorMessage?.substring(0,100) || 'Unknown error'}`;
        default: return item;
    }
  };


  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-semibold text-textPrimary">Batch File Ingestion</h2>
        {batchQueue.length > 0 && (
            <button onClick={resetBatch} className="text-sm bg-gray-200 dark:bg-gray-700 text-textPrimary px-3 py-1.5 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">
                Start New Batch
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
        <div className="space-y-4 bg-surface p-6 rounded-lg shadow border border-border">
          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium text-textSecondary mb-1">
              Select Files (PDF, DOCX, TXT, Images)
            </label>
            <input
              id="file-upload"
              type="file"
              multiple
              onChange={handleFileChange}
              className="block w-full text-sm text-textSecondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-light file:text-primary hover:file:bg-primary-light/80 dark:file:bg-primary-dark dark:file:text-primary-light dark:hover:file:bg-primary-dark/80 cursor-pointer"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
            />
          </div>
          {selectedFiles.length > 0 && (
            <div className="mt-4">
              <h4 className="text-textPrimary font-medium">Selected files ({selectedFiles.length}):</h4>
              <ul className="list-disc list-inside text-textSecondary max-h-32 overflow-y-auto">
                {selectedFiles.map(file => <li key={file.name}>{file.name} ({Math.round(file.size / 1024)} KB)</li>)}
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
        </div>
      )}

      {(currentStep === 'PROCESSING_BATCH' || currentStep === 'REVIEW_BATCH') && batchQueue.length > 0 && (
        <div className="space-y-4 bg-surface p-6 rounded-lg shadow border border-border">
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
                    className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md"
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
          {currentStep === 'REVIEW_BATCH' && !allFilesReviewedOrError && (
             <p className="text-center text-textSecondary mt-4">Please review and finalize each file marked "Ready for Review".</p>
          )}
           {currentStep === 'REVIEW_BATCH' && allFilesReviewedOrError && (
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
                    <p className="text-xs text-textSecondary mt-1">Suggested: {currentItemForReview.suggestedName}</p>
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

    </div>
  );
};

export default FileIngestionPage;
