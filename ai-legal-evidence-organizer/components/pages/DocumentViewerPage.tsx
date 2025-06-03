import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../contexts/AppContext';
import { EvidenceFile, Tag, Annotation, WcatCase, PolicyReference } from '../../types';
import LoadingSpinner from '../ui/LoadingSpinner';
import Modal from '../ui/Modal';
import { DEFAULT_TAG_COLOR } from '../../constants';
// import { mcpReadFile, mcpDeleteFileOrDirectory } from '../../services/mcpService'; // Replaced

const DocumentViewerPage: React.FC = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const { 
    getFileById, updateFile, deleteFile: deleteFileFromContext, 
    tags, addTag, addTagToFile, removeTagFromFile, 
    addAuditLogEntry, isLoading: isAppLoadingGlobally, setIsLoading: setAppIsLoadingGlobally, setError,
    findRelevantWcatCases, extractPolicyReferencesFromFile,
    mcpClient, isMcpClientLoading // Get McpClient
  } = useAppContext();
  
  const [file, setFile] = useState<EvidenceFile | null | undefined>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedTagForAdding, setSelectedTagForAdding] = useState<string>('');

  const [newAnnotationText, setNewAnnotationText] = useState('');
  const [relevantWcatCases, setRelevantWcatCases] = useState<WcatCase[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState<boolean>(false); // For local loading like file content

  useEffect(() => {
    const loadFileAndContext = async () => {
      if (fileId) {
        setIsLoadingLocal(true);
        let foundFile = getFileById(fileId);

        if (foundFile) {
          // Auto-load content from MCP if not present and McpClient is ready
          if (!foundFile.content && foundFile.type !== 'img' && foundFile.mcpPath && mcpClient && mcpClient.isReady()) {
            try {
              addAuditLogEntry('DOC_VIEW_MCP_READ_START', `Reading ${foundFile.name} from ${foundFile.mcpPath}`);
              const mcpFile = await mcpClient.readFile(foundFile.mcpPath);
              if (mcpFile && mcpFile.content) {
                // Update file in context and then local state
                updateFile(fileId, { content: mcpFile.content });
                foundFile = { ...foundFile, content: mcpFile.content }; // Update local copy
                addAuditLogEntry('DOC_VIEW_MCP_READ_SUCCESS', `Content loaded for ${foundFile.name}`);
              } else {
                setError(`Could not load content for ${foundFile.name} from MCP.`);
                addAuditLogEntry('DOC_VIEW_MCP_READ_NO_CONTENT', `No content from MCP for ${foundFile.name}`);
              }
            } catch (err: any) {
              setError(`Error loading file content for ${foundFile.name}: ${err.message}`);
              addAuditLogEntry('DOC_VIEW_MCP_READ_ERROR', `MCP Error for ${foundFile.name}: ${err.message}`);
            }
          }
          
          // Re-extract policies if content/summary changed or file first loaded (after potential MCP load)
          const currentPolicies = foundFile.referencedPolicies || [];
          const newPolicies = extractPolicyReferencesFromFile(foundFile);
          if (JSON.stringify(newPolicies) !== JSON.stringify(currentPolicies)) {
               updateFile(foundFile.id, { referencedPolicies: newPolicies });
               foundFile = { ...foundFile, referencedPolicies: newPolicies }; // Update local copy
          }
          setFile(foundFile);

          // Fetch relevant WCAT cases
          findRelevantWcatCases(foundFile.name + " " + (foundFile.summary || ""), foundFile)
            .then(setRelevantWcatCases)
            .catch(err => console.error("Error fetching relevant WCAT cases:", err));

        } else {
          setFile(undefined); // Not found
          setRelevantWcatCases([]);
        }
        setIsLoadingLocal(false);
      } else {
        setFile(undefined);
        setRelevantWcatCases([]);
        setIsLoadingLocal(false);
      }
    };
    
    if (!isMcpClientLoading) { // Wait for McpClient to be potentially ready
        loadFileAndContext();
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, getFileById, updateFile, extractPolicyReferencesFromFile, findRelevantWcatCases, mcpClient, isMcpClientLoading, setError, addAuditLogEntry]);


  const handleAddTagToCurrentFile = () => {
    if (!file || !selectedTagForAdding) return;
    const tagToAdd = tags.find(t => t.id === selectedTagForAdding);
    if (tagToAdd && !file.tags.find(t => t.id === tagToAdd.id)) {
      addTagToFile(file.id, tagToAdd);
      // Local state update is handled by getFileById re-fetch or AppContext propagation
    }
    setSelectedTagForAdding('');
  };

  const handleCreateAndAddTag = () => {
    if (!file || newTagName.trim() === '') return;
    const newCreatedTag = addTag({ name: newTagName.trim(), color: DEFAULT_TAG_COLOR, criteria: 'other' });
    addTagToFile(file.id, newCreatedTag);
    setNewTagName('');
    setIsTagModalOpen(false);
  };

  const handleRemoveTag = (tagId: string) => {
    if (!file) return;
    removeTagFromFile(file.id, tagId);
  };
  
  const handleAddAnnotation = () => {
    if (!file || newAnnotationText.trim() === '') return;
    const newAnnotation: Annotation = {
        id: Date.now().toString(),
        fileId: file.id,
        text: newAnnotationText.trim(),
        quote: `Annotation for ${file.name}` 
    };
    const updatedAnnotations = [...file.annotations, newAnnotation];
    updateFile(file.id, { annotations: updatedAnnotations });
    setNewAnnotationText('');
    addAuditLogEntry('ANNOTATION_ADDED', `Annotation added to file ${file.name}`);
  };
  
  const handleDeleteFile = async () => {
    if (!file) return;
    if (window.confirm(`Are you sure you want to delete "${file.name}"? This action will attempt to delete from the MCP server and remove from the app.`)) {
        setAppIsLoadingGlobally(true); // Use global loading for this critical op
        // deleteFileFromContext already handles MCP interaction and then app state update
        await deleteFileFromContext(file.id); 
        setAppIsLoadingGlobally(false);
        navigate('/'); // Navigate away after deletion attempt
    }
  };

  // Update local file state when global files context changes (e.g. after tag update from modal)
  useEffect(() => {
    if (fileId) {
      const currentFileFromContext = getFileById(fileId);
      if (currentFileFromContext && JSON.stringify(currentFileFromContext) !== JSON.stringify(file)) {
        setFile(currentFileFromContext);
      }
    }
  }, [getFileById, fileId, file]);


  if (isLoadingLocal || (isAppLoadingGlobally && !file)) return <div className="p-6 flex justify-center items-center h-full"><LoadingSpinner message="Loading document..." /></div>;
  if (file === undefined && !isLoadingLocal) return <div className="p-6 text-center text-textSecondary">Document not found. <Link to="/" className="text-primary hover:underline">Go to Dashboard</Link></div>;
  if (!file) return null;


  const renderFileContent = () => {
    if (isAppLoadingGlobally && !file.content) return <LoadingSpinner message="Loading content from MCP..." />;
    if (!file.content && file.type !== 'img') {
        if (mcpClient && !mcpClient.isReady()) {
            return <p className="text-textSecondary">MCP Client not ready. Content cannot be loaded from server.</p>;
        }
        return <p className="text-textSecondary">Content not available or still loading. Check MCP server connection.</p>;
    }

    switch (file.type) {
      case 'txt':
        return <pre className="whitespace-pre-wrap text-sm bg-background p-4 rounded-md border border-border max-h-[60vh] overflow-y-auto">{file.content}</pre>;
      case 'pdf':
      case 'docx':
        return <div className="bg-background p-4 rounded-md border border-border max-h-[60vh] overflow-y-auto">
            <h4 className="font-semibold mb-2">Simulated {file.type.toUpperCase()} Content (from MCP or App State):</h4>
            <p className="text-sm text-textSecondary">Displaying raw text content for this demo. A full viewer would render the document.</p>
            <pre className="whitespace-pre-wrap text-sm mt-2">{file.content?.substring(0,1000) || "No content loaded."}...</pre>
            {(file.content?.length || 0) > 1000 && <p className="text-xs text-textSecondary mt-2">(Content truncated for display)</p>}
        </div>;
      case 'img':
        // Image content in app state is expected to be base64 data URL or placeholder
        if (file.content && file.content.startsWith('data:image')) {
            return <img src={file.content} alt={file.name} className="max-w-full max-h-[60vh] rounded-md border border-border object-contain"/>;
        }
        return <p className="text-textSecondary">Image preview not available or content is a placeholder. MCP path: {file.mcpPath}</p>;
      default:
        return <p className="text-textSecondary">Unsupported file type for preview: {file.type}. Path: {file.mcpPath}</p>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-semibold text-textPrimary break-all">{file.name}</h2>
        <button 
            onClick={handleDeleteFile}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center text-sm"
            disabled={isAppLoadingGlobally || (mcpClient && !mcpClient.isReady() && !!file.mcpPath) } // Disable if MCP needed & not ready
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c1.153 0 2.243.096 3.222.261m3.222.261L12 5.291M12 5.291L8.777 5.03M8.777 5.03l-.001-.001A48.716 48.716 0 013 5.291" /></svg>
            Delete File
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="bg-surface p-4 rounded-lg shadow border border-border">
            <h3 className="text-xl font-semibold text-textPrimary mb-2">Document Preview</h3>
            {renderFileContent()}
          </div>
          <div className="bg-surface p-4 rounded-lg shadow border border-border">
            <h3 className="text-xl font-semibold text-textPrimary mb-2">AI Summary</h3>
            {file.isProcessing ? <LoadingSpinner message="AI processing summary..." /> : 
             file.summary ? (
              <pre className="whitespace-pre-wrap text-sm text-textSecondary max-h-60 overflow-y-auto">{file.summary}</pre>
            ) : (
              <p className="text-textSecondary">No AI summary available for this file.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-surface p-4 rounded-lg shadow border border-border">
            <h3 className="text-xl font-semibold text-textPrimary mb-2">Metadata</h3>
            <ul className="text-sm text-textSecondary space-y-1">
              <li><strong>Type:</strong> {file.type}</li>
              <li><strong>Size:</strong> {file.metadata.size ? `${Math.round(file.metadata.size / 1024)} KB` : 'N/A'}</li>
              <li><strong>Source:</strong> {file.metadata.source || 'N/A'}</li>
              <li><strong>Modified:</strong> {file.metadata.modifiedAt ? new Date(file.metadata.modifiedAt).toLocaleString() : 'N/A'}</li>
              <li><strong>MCP Path:</strong> <span className="break-all">{file.mcpPath || "Not set/applicable"}</span></li>
            </ul>
          </div>

          <div className="bg-surface p-4 rounded-lg shadow border border-border">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-semibold text-textPrimary">Tags</h3>
                <button onClick={() => setIsTagModalOpen(true)} className="text-sm text-primary hover:underline">Manage Tags</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {file.tags.length > 0 ? file.tags.map(tag => (
                <span key={tag.id} className={`px-2 py-1 text-xs rounded-full text-white ${tag.color || DEFAULT_TAG_COLOR} flex items-center`}>
                  {tag.name}
                  <button onClick={() => handleRemoveTag(tag.id)} className="ml-1.5 text-white hover:text-opacity-75 text-xs leading-none">&times;</button>
                </span>
              )) : <p className="text-sm text-textSecondary">No tags yet.</p>}
            </div>
          </div>

          <div className="bg-surface p-4 rounded-lg shadow border border-border">
             <h3 className="text-xl font-semibold text-textPrimary mb-2">Policy References</h3>
             {file.referencedPolicies && file.referencedPolicies.length > 0 ? (
                <ul className="space-y-1 text-sm">
                    {file.referencedPolicies.map(ref => (
                        <li key={ref.policyNumber}>
                            <Link to={`/policy-manual/${ref.policyNumber}`} className="text-primary hover:underline">
                                {ref.policyNumber}
                            </Link>
                            {ref.policyTitle && <span className="text-textSecondary"> - {ref.policyTitle}</span>}
                        </li>
                    ))}
                </ul>
             ) : <p className="text-sm text-textSecondary">No policies automatically referenced in this document.</p>}
          </div>
          
          <div className="bg-surface p-4 rounded-lg shadow border border-border">
            <h3 className="text-xl font-semibold text-textPrimary mb-2">Annotations</h3>
            <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                {file.annotations.length > 0 ? file.annotations.map(ann => (
                    <div key={ann.id} className="text-xs p-2 bg-background rounded border border-border">
                        <p className="font-medium">{ann.quote || "Note"}</p>
                        <p className="text-textSecondary">{ann.text}</p>
                    </div>
                )) : <p className="text-sm text-textSecondary">No annotations yet.</p>}
            </div>
            <textarea value={newAnnotationText} onChange={(e) => setNewAnnotationText(e.target.value)} placeholder="Add new annotation..." rows={2}
                className="w-full p-2 border border-border rounded-md bg-background text-sm focus:ring-primary focus:border-primary" />
            <button onClick={handleAddAnnotation} className="mt-2 bg-secondary text-white px-3 py-1.5 rounded-md hover:bg-secondary-dark text-sm" disabled={newAnnotationText.trim() === ''}>Add Note</button>
          </div>
          
          {relevantWcatCases.length > 0 && (
            <div className="bg-surface p-4 rounded-lg shadow border border-border">
                <h3 className="text-xl font-semibold text-textPrimary mb-2">Relevant WCAT Precedents</h3>
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                    {relevantWcatCases.map(wcase => (
                        <li key={wcase.id} className="p-2 bg-background rounded border border-border hover:shadow-sm">
                            <Link to={`/wcat-database/${wcase.decisionNumber}`} className="text-sm font-medium text-primary hover:underline">
                                {wcase.decisionNumber} ({wcase.year})
                            </Link>
                            <p className="text-xs text-textSecondary truncate" title={wcase.outcomeSummary}>{wcase.outcomeSummary}</p>
                        </li>
                    ))}
                </ul>
            </div>
          )}

        </div>
      </div>

      <Modal title="Manage Tags" isOpen={isTagModalOpen} onClose={() => setIsTagModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label htmlFor="existing-tag" className="block text-sm font-medium text-textSecondary">Add Existing Tag</label>
            <select id="existing-tag" value={selectedTagForAdding} onChange={(e) => setSelectedTagForAdding(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
              <option value="">Select a tag</option>
              {tags.filter(t => !file.tags.find(ft => ft.id === t.id)).map(tag => (
                <option key={tag.id} value={tag.id}>{tag.name} ({tag.criteria || 'other'})</option>
              ))}
            </select>
            <button onClick={handleAddTagToCurrentFile} disabled={!selectedTagForAdding} className="mt-2 bg-primary text-white px-3 py-1.5 rounded-md hover:bg-primary-dark text-sm disabled:opacity-50">Add Selected</button>
          </div>
          <div>
            <label htmlFor="new-tag-name" className="block text-sm font-medium text-textSecondary">Create and Add New Tag</label>
            <input type="text" id="new-tag-name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Enter new tag name"
              className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
            <button onClick={handleCreateAndAddTag} disabled={newTagName.trim() === ''} className="mt-2 bg-secondary text-white px-3 py-1.5 rounded-md hover:bg-secondary-dark text-sm disabled:opacity-50">Create & Add</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DocumentViewerPage;