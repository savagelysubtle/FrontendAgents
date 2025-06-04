import React, { useState, useEffect } from 'react';
import { EvidenceFile, WcatCase, SavedChatSession, AiTool as AppAgUiToolDef } from '../../types';
import { useAppContext } from '../../contexts/AppContext';
import Modal from './Modal'; // Assuming Modal component exists
import LoadingSpinner from './LoadingSpinner';
import { Tool as McpServerToolDef } from "@modelcontextprotocol/sdk/types.js"; // For MCP server tools

interface ChatContextSidebarProps {
  onToggleCollapse: () => void;
  files: EvidenceFile[];
  wcatCases: WcatCase[];
  selectedFileIds: string[];
  onToggleFileContext: (fileId: string) => void; // Removed forceAdd
  selectedWcatCaseIds: string[];
  onToggleWcatCaseContext: (caseId: string) => void; // Removed forceAdd
  onLoadSession: (sessionId: string) => void;

  tools: AppAgUiToolDef[]; // Use AppAgUiToolDef. Prop name was 'tools'
  selectedToolIds: string[]; // Prop name was 'selectedToolIds'
  onToggleToolContext: (toolId: string) => void; // Prop name was 'onToggleToolContext'
}

const ChevronRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>;
const LoadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c1.153 0 2.243.096 3.222.261m3.222.261L12 5.291M12 5.291L8.777 5.03M8.777 5.03l-.001-.001A48.716 48.716 0 013 5.291" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;


const ChatContextSidebar: React.FC<ChatContextSidebarProps> = ({
  onToggleCollapse,
  files,
  wcatCases,
  selectedFileIds,
  onToggleFileContext,
  selectedWcatCaseIds,
  onToggleWcatCaseContext,
  onLoadSession,
  tools, // New prop
  selectedToolIds, // New prop
  onToggleToolContext, // New prop
}) => {
  const {
    savedChatSessions,
    deleteChatSession: deleteSessionFromContext,
    chatHistory,
    addTool,
    deleteTool: deleteCustomTool,
    isLoading,
    mcpClient, // Added from AppContext
    isMcpClientLoading, // Added from AppContext
    addAuditLogEntry, // Added from AppContext
    setError // Added from AppContext
  } = useAppContext();
  const [activeTab, setActiveTab] = useState<'evidence' | 'wcat' | 'tools' | 'history'>('evidence');
  const [searchTermEvidence, setSearchTermEvidence] = useState('');
  const [searchTermWcat, setSearchTermWcat] = useState('');
  const [searchTermTools, setSearchTermTools] = useState('');
  const [searchTermHistory, setSearchTermHistory] = useState('');

  const [isAddToolModalOpen, setIsAddToolModalOpen] = useState(false);
  const [newToolName, setNewToolName] = useState('');
  const [newToolDescription, setNewToolDescription] = useState('');
  const [newToolUsageExample, setNewToolUsageExample] = useState('');

  // State for MCP Server Tools
  const [mcpServerTools, setMcpServerTools] = useState<McpServerToolDef[]>([]);
  const [isLoadingMcpTools, setIsLoadingMcpTools] = useState<boolean>(false);


  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchTermEvidence.toLowerCase()) ||
    (f.summary && f.summary.toLowerCase().includes(searchTermEvidence.toLowerCase()))
  );

  const filteredWcatCases = wcatCases.filter(c =>
    c.decisionNumber.toLowerCase().includes(searchTermWcat.toLowerCase()) ||
    c.aiSummary.toLowerCase().includes(searchTermWcat.toLowerCase()) ||
    c.outcomeSummary.toLowerCase().includes(searchTermWcat.toLowerCase())
  );

  const filteredTools = tools.filter(t =>
    t.name.toLowerCase().includes(searchTermTools.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTermTools.toLowerCase()) ||
    (t.usageExample && t.usageExample.toLowerCase().includes(searchTermTools.toLowerCase()))
  );

  const filteredHistorySessions = savedChatSessions.filter(s =>
    s.name.toLowerCase().includes(searchTermHistory.toLowerCase()) ||
    s.messages.some(m => m.text.toLowerCase().includes(searchTermHistory.toLowerCase()))
  );

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, itemId: string, itemType: 'evidence' | 'wcat' | 'tool') => {
    const data = JSON.stringify({ id: itemId, type: itemType });
    event.dataTransfer.setData("application/json", data);
    event.dataTransfer.effectAllowed = "copy";
  };

  const handleLoadSessionClick = (sessionId: string) => {
    if (chatHistory.length > 0) {
        if (!window.confirm("Loading a saved session will clear your current unsaved chat. Continue?")) {
            return;
        }
    }
    onLoadSession(sessionId);
  };

  const handleDeleteSessionClick = (sessionId: string) => {
    if (window.confirm("Are you sure you want to delete this chat session? This action cannot be undone.")) {
        deleteSessionFromContext(sessionId);
    }
  };

  const handleAddCustomTool = () => {
    if (newToolName.trim() && newToolDescription.trim()) {
        addTool({
            name: newToolName.trim(),
            description: newToolDescription.trim(),
            usageExample: newToolUsageExample.trim() || undefined,
        });
        setNewToolName('');
        setNewToolDescription('');
        setNewToolUsageExample('');
        setIsAddToolModalOpen(false);
    }
  };

  const handleDeleteCustomToolClick = (toolId: string) => {
     const toolToDelete = tools.find(t => t.id === toolId);
     if(toolToDelete && toolToDelete.type === 'custom_abstract') {
        if(window.confirm(`Are you sure you want to delete the custom tool "${toolToDelete.name}"?`)) {
            deleteCustomTool(toolId);
        }
     } else if (toolToDelete) {
         alert(`Tool "${toolToDelete.name}" is of type '${toolToDelete.type}' and cannot be deleted from this UI.`);
     }
  };

  useEffect(() => {
    const fetchMcpTools = async () => {
      if (mcpClient && mcpClient.ready) {
        setIsLoadingMcpTools(true);
        try {
          const toolsResult = await mcpClient.listMcpTools();
          setMcpServerTools(toolsResult || []);
          addAuditLogEntry('MCP_TOOLS_FETCHED_SIDEBAR', `Fetched ${toolsResult?.length || 0} tools from MCP server.`);
        } catch (error: any) {
          setError(`Failed to fetch MCP server tools: ${error.message}`);
          setMcpServerTools([]);
          addAuditLogEntry('MCP_TOOLS_FETCH_ERROR_SIDEBAR', `Error: ${error.message}`);
        } finally {
          setIsLoadingMcpTools(false);
        }
      } else {
        setMcpServerTools([]);
      }
    };

    if (!isMcpClientLoading) {
      fetchMcpTools();
    }
  }, [mcpClient, mcpClient?.ready, isMcpClientLoading, setError, addAuditLogEntry]);

  return (
    <div className="fixed top-[calc(var(--header-height,64px)+1.5rem)] right-0 bottom-6
                   w-80 min-w-[320px] bg-surface p-4 border-l border-border
                   flex flex-col space-y-3 shadow-xl z-20
                   transform transition-transform duration-300 ease-in-out translate-x-0">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-textPrimary">Chat Context & Tools</h3>
        <button
          onClick={onToggleCollapse}
          className="p-2 text-textPrimary hover:bg-primary-light/20 rounded-md"
          title="Close Context Sidebar"
          aria-label="Close Context Sidebar"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="flex border-b border-border">
        {(['evidence', 'wcat', 'tools', 'history'] as const).map(tabName => (
            <button
                key={tabName}
                onClick={() => setActiveTab(tabName)}
                className={`flex-1 py-2 text-xs sm:text-sm font-medium ${activeTab === tabName ? 'text-primary border-b-2 border-primary' : 'text-textSecondary hover:text-textPrimary'}`}
            >
                {tabName.charAt(0).toUpperCase() + tabName.slice(1)}
                {tabName === 'evidence' && ` (${selectedFileIds.length})`}
                {tabName === 'wcat' && ` (${selectedWcatCaseIds.length})`}
                {tabName === 'tools' && ` (${selectedToolIds.length})`}
                {tabName === 'history' && ` (${savedChatSessions.length})`}
            </button>
        ))}
      </div>

      <div className="flex-grow overflow-y-auto space-y-2 pr-1">
        {activeTab === 'evidence' && (
          <>
            <input
              type="text"
              placeholder="Search evidence..."
              value={searchTermEvidence}
              onChange={(e) => setSearchTermEvidence(e.target.value)}
              className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary"
            />
            {filteredFiles.length === 0 && <p className="text-xs text-textSecondary text-center py-2">No evidence files match.</p>}
            {filteredFiles.map(file => (
              <div
                key={file.id}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, file.id, 'evidence')}
                onClick={() => onToggleFileContext(file.id)}
                title={`Summary: ${file.summary || 'N/A'}\nTags: ${file.tags.map(t => t.name).join(', ') || 'None'}`}
                className={`p-2 rounded-md cursor-grab text-sm border ${
                  selectedFileIds.includes(file.id)
                    ? 'bg-primary-light/20 border-primary text-primary font-medium'
                    : 'bg-background hover:bg-gray-50 dark:hover:bg-gray-700 border-border text-textPrimary'
                }`}
              >
                {file.name}
              </div>
            ))}
          </>
        )}

        {activeTab === 'wcat' && (
          <>
            <input
              type="text"
              placeholder="Search WCAT cases..."
              value={searchTermWcat}
              onChange={(e) => setSearchTermWcat(e.target.value)}
              className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary"
            />
            {filteredWcatCases.length === 0 && <p className="text-xs text-textSecondary text-center py-2">No WCAT cases match.</p>}
            {filteredWcatCases.map(wcase => (
              <div
                key={wcase.id}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, wcase.id, 'wcat')}
                onClick={() => onToggleWcatCaseContext(wcase.id)}
                title={`Outcome: ${wcase.outcomeSummary}\nKeywords: ${wcase.keywords.join(', ') || 'N/A'}`}
                className={`p-2 rounded-md cursor-grab text-sm border ${
                  selectedWcatCaseIds.includes(wcase.id)
                    ? 'bg-primary-light/20 border-primary text-primary font-medium'
                    : 'bg-background hover:bg-gray-50 dark:hover:bg-gray-700 border-border text-textPrimary'
                }`}
              >
                {wcase.decisionNumber} ({wcase.year})
              </div>
            ))}
          </>
        )}

        {activeTab === 'tools' && (
            <>
                <input
                    type="text"
                    placeholder="Search all tools..."
                    value={searchTermTools}
                    onChange={(e) => setSearchTermTools(e.target.value)}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary mb-3"
                />

                {/* MCP Server Tools Section */}
                <h4 className="text-xs font-semibold text-textSecondary uppercase tracking-wider mt-3 mb-1">
                  MCP Server Tools (from connected server)
                </h4>
                {isMcpClientLoading && <LoadingSpinner size="sm" message="Checking MCP client..." />}
                {!isMcpClientLoading && (!mcpClient || !mcpClient.ready) && (
                  <p className="text-xs text-red-500 p-2 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md">MCP Client not ready or not connected. Server tools unavailable. Error: {mcpClient?.getInitializationError() || 'Unknown'}</p>
                )}
                {!isMcpClientLoading && mcpClient && mcpClient.ready && isLoadingMcpTools && (
                  <LoadingSpinner size="sm" message="Loading server tools..." />
                )}
                {!isMcpClientLoading && mcpClient && mcpClient.ready && !isLoadingMcpTools && mcpServerTools.length === 0 && (
                  <p className="text-xs text-textSecondary p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">No tools found on the connected MCP server: {mcpClient.getConfiguredServerName()}</p>
                )}
                {!isLoadingMcpTools && mcpServerTools.filter(tool => tool.name.toLowerCase().includes(searchTermTools.toLowerCase()) || (tool.description && tool.description.toLowerCase().includes(searchTermTools.toLowerCase()))).map((tool: McpServerToolDef) => (
                  <div
                    key={tool.name}
                    title={`${tool.description}\\nInput Schema: ${JSON.stringify(tool.inputSchema).substring(0,100)}...`}
                    className={`p-2 rounded-md text-sm border bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-textPrimary mb-1 opacity-75 cursor-not-allowed`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{tool.name}</span>
                      <div className="flex gap-1">
                        {tool.annotations?.readOnlyHint && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Read-Only</span>}
                        {tool.annotations?.destructiveHint && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Destructive</span>}
                      </div>
                    </div>
                    <p className="text-xs text-textSecondary truncate mt-0.5">{tool.description || "No description."}</p>
                  </div>
                ))}

                {/* Frontend AG-UI Tools Section (Your Custom Abstract Tools) */}
                <div className="flex justify-between items-center mt-4 mb-1">
                  <h4 className="text-xs font-semibold text-textSecondary uppercase tracking-wider">
                    Frontend AG-UI Tools (custom actions)
                  </h4>
                  <button
                    onClick={() => setIsAddToolModalOpen(true)}
                    className="text-xs bg-secondary text-white px-2 py-1 rounded-md hover:bg-secondary-dark flex items-center whitespace-nowrap"
                    title="Add a new custom abstract tool for the AI to use"
                  >
                    <PlusIcon /> Add Custom
                  </button>
                </div>
                {tools.filter(t => t.type === 'custom_abstract' && (t.name.toLowerCase().includes(searchTermTools.toLowerCase()) || t.description.toLowerCase().includes(searchTermTools.toLowerCase()) || (t.usageExample && t.usageExample.toLowerCase().includes(searchTermTools.toLowerCase())))).length === 0 && <p className="text-xs text-textSecondary text-center py-2">No custom AG-UI tools defined or match search.</p>}
                {tools
                  .filter(t => t.type === 'custom_abstract' && (t.name.toLowerCase().includes(searchTermTools.toLowerCase()) || t.description.toLowerCase().includes(searchTermTools.toLowerCase()) || (t.usageExample && t.usageExample.toLowerCase().includes(searchTermTools.toLowerCase()))))
                  .map((tool: AppAgUiToolDef) => (
                  <div
                    key={tool.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, tool.id, 'tool')}
                    onClick={() => onToggleToolContext(tool.id)}
                    title={`${tool.description}\\nUsage Example: ${tool.usageExample || 'N/A'}`}
                    className={`p-2 rounded-md cursor-grab text-sm border ${
                      selectedToolIds.includes(tool.id)
                        ? 'bg-primary-light/20 border-primary text-primary font-medium'
                        : 'bg-background hover:bg-gray-50 dark:hover:bg-gray-700 border-border text-textPrimary'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                        <span className="font-medium">{tool.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomToolClick(tool.id); }} className="text-red-500 hover:text-red-700 text-xs ml-2 p-0.5" title="Delete custom tool">&times;</button>
                    </div>
                    <p className="text-xs text-textSecondary truncate mt-0.5">{tool.description}</p>
                  </div>
                ))}
            </>
        )}

        {activeTab === 'history' && (
            <>
                <input
                    type="text"
                    placeholder="Search saved sessions..."
                    value={searchTermHistory}
                    onChange={(e) => setSearchTermHistory(e.target.value)}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                />
                {filteredHistorySessions.length === 0 && <p className="text-xs text-textSecondary text-center py-2">No saved chat sessions match or none saved yet.</p>}
                {filteredHistorySessions.map(session => (
                    <div key={session.id} className="p-2 rounded-md border bg-background border-border text-sm">
                        <p className="font-medium text-textPrimary truncate" title={session.name}>{session.name}</p>
                        <p className="text-xs text-textSecondary">
                            Saved: {new Date(session.timestamp).toLocaleDateString()} {new Date(session.timestamp).toLocaleTimeString()}
                        </p>
                        <p className="text-xs text-textSecondary">Messages: {session.messages.length}</p>
                        <p className="text-xs text-textSecondary truncate" title={`Files: ${(session.relatedFileIds || []).length}, WCAT: ${(session.relatedWcatCaseIds || []).length}, Tools: ${(session.relatedToolIds || []).length}`}>
                            Context: Files ({(session.relatedFileIds || []).length}), WCAT ({(session.relatedWcatCaseIds || []).length}), Tools ({(session.relatedToolIds || []).length})
                        </p>
                        <div className="mt-1.5 flex space-x-2">
                            <button
                                onClick={() => handleLoadSessionClick(session.id)}
                                className="text-xs bg-secondary text-white px-2 py-1 rounded hover:bg-secondary-dark flex items-center"
                            >
                                <LoadIcon /> Load
                            </button>
                            <button
                                onClick={() => handleDeleteSessionClick(session.id)}
                                className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 flex items-center"
                            >
                                <DeleteIcon /> Delete
                            </button>
                        </div>
                    </div>
                ))}
            </>
        )}
      </div>
       <p className="text-xs text-textSecondary text-center p-1">
        Manage context items, tools, or load past chat sessions.
      </p>

      <Modal title="Add Custom AI Tool" isOpen={isAddToolModalOpen} onClose={() => setIsAddToolModalOpen(false)}
        footer={
            <div className="flex justify-end gap-2">
                <button onClick={() => setIsAddToolModalOpen(false)} className="px-3 py-1.5 border border-border rounded-md text-textPrimary hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">Cancel</button>
                <button onClick={handleAddCustomTool} disabled={!newToolName.trim() || !newToolDescription.trim() || isLoading} className="px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary-dark text-sm disabled:opacity-50">
                    {isLoading ? <LoadingSpinner size="sm"/> : 'Add Tool'}
                </button>
            </div>
        }
      >
        <div className="space-y-3 text-sm">
            <div>
                <label htmlFor="newToolName" className="block text-xs font-medium text-textSecondary">Tool Name*</label>
                <input type="text" id="newToolName" value={newToolName} onChange={e => setNewToolName(e.target.value)} placeholder="e.g., Legal Policy Lookup"
                    className="mt-0.5 w-full px-2 py-1.5 bg-background border border-border rounded-md"/>
            </div>
            <div>
                <label htmlFor="newToolDescription" className="block text-xs font-medium text-textSecondary">Description* (for AI)</label>
                <textarea id="newToolDescription" value={newToolDescription} onChange={e => setNewToolDescription(e.target.value)} rows={3} placeholder="Describe what this tool does or represents, for the AI's understanding. This is for custom abstract tools."
                    className="mt-0.5 w-full px-2 py-1.5 bg-background border border-border rounded-md"/>
            </div>
            <div>
                <label htmlFor="newToolUsageExample" className="block text-xs font-medium text-textSecondary">Usage Example (optional, for AI)</label>
                <input type="text" id="newToolUsageExample" value={newToolUsageExample} onChange={e => setNewToolUsageExample(e.target.value)} placeholder="e.g., '/lookup_policy C3-16.00'"
                    className="mt-0.5 w-full px-2 py-1.5 bg-background border border-border rounded-md"/>
            </div>
        </div>
      </Modal>

    </div>
  );
};

export default ChatContextSidebar;
