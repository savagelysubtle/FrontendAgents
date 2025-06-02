
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HttpAgent, EventType as AguiEventTypesInternal, AgentEvent as AguiAgentEventInternal, AgentInput } from '@ag-ui/client';
import type { Subscription } from 'rxjs';

import { 
    ChatMessage, MCPConfig, IngestedData, IngestedFile, IngestedFolder, 
    MessageSender, Page, AgentToolDefinition, AguiEventType, AgentEvent 
} from './types'; // Ensure AgentEvent uses your defined AguiEventType
import { APP_TITLE, Icons, SYSTEM_MESSAGE_WELCOME, DEFAULT_SETTINGS_FILENAME, SYSTEM_MESSAGE_INGEST_START, SYSTEM_MESSAGE_NO_API_KEY as DEPRECATED_SYSTEM_MESSAGE_NO_API_KEY } from './constants';
// Removed direct Gemini service imports: streamChatResponse, generateDescriptionForIngest, etc.
// These are now backend responsibilities.
// import { placeholder as agentServicePlaceholder } from './services/agentService'; // agentService.ts is mostly placeholder

import ChatPanel from './components/ChatPanel';
import SettingsPanel from './components/SettingsPanel';
import FileManagerPanel from './components/FileManagerPanel';
import ToolsPanel from './components/ToolsPanel';

const initialConfig: MCPConfig = {
  workspaceName: "My Workspace",
  maxFileSizeMB: 10, 
  ignoreGlobs: ["node_modules/", ".git/", "*.log", "*.temp"],
  theme: 'dark',
  agentUrl: '/api/my-backend-agent', // Default backend agent URL
  mcpJsonContent: JSON.stringify({ 
    // This mcpJsonContent is now primarily for user display/editing
    // if it's used to configure the backend agent.
    // The authoritative list of tools comes from the agent.
    info: "This JSON can be used to configure the backend agent's tools. The frontend displays tools reported by the connected agent."
  }, null, 2), 
  toolStates: {}, // User preferences for tools reported by the agent
};

// Helper to ensure our internal AgentEvent type aligns with @ag-ui/client's EventType
const mapAguiEventType = (type: AguiEventTypesInternal): AguiEventType | null => {
    switch (type) {
        case AguiEventTypesInternal.TEXT_MESSAGE_START: return AguiEventType.TEXT_MESSAGE_START;
        case AguiEventTypesInternal.TEXT_MESSAGE_CONTENT: return AguiEventType.TEXT_MESSAGE_CONTENT;
        case AguiEventTypesInternal.TEXT_MESSAGE_END: return AguiEventType.TEXT_MESSAGE_END;
        case AguiEventTypesInternal.TOOL_CALL_START: return AguiEventType.TOOL_CALL_START;
        // case AguiEventTypesInternal.TOOL_CALL_ARGS: return AguiEventType.TOOL_CALL_ARGS; // Assuming AguiEventType.TOOL_CALL_ARGS matches
        case AguiEventTypesInternal.TOOL_CALL_END: return AguiEventType.TOOL_CALL_END;
        case AguiEventTypesInternal.STATE_SNAPSHOT: return AguiEventType.STATE_SNAPSHOT;
        case AguiEventTypesInternal.ERROR_MESSAGE: return AguiEventType.ERROR; // Map ERROR_MESSAGE to ERROR
        default:
            if (Object.values(AguiEventType).includes(type as AguiEventType)) {
                return type as AguiEventType;
            }
            console.warn(`Unknown AG-UI event type from client: ${type}`);
            return null; 
    }
};


const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('fileManager');
  const [config, setConfig] = useState<MCPConfig>(initialConfig);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [ingestedData, setIngestedData] = useState<IngestedData | null>(null); // Might be less used if backend handles ingest
  const [isAgentTyping, setIsAgentTyping] = useState<boolean>(false); // Represents agent processing
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [ingestProgress, setIngestProgress] = useState(0);
  
  const [availableAgentTools, setAvailableAgentTools] = useState<AgentToolDefinition[]>([]);
  const [sessionId, setSessionId] = useState<string>(`session-${Date.now()}`); // Simple session ID management

  // AI features that are now backend-driven
  // const [aiOrganizedSuggestion, setAiOrganizedSuggestion] = useState<string | null>(null);
  // const [isAiOrganizing, setIsAiOrganizing] = useState<boolean>(false);
  
  const [sidebarExpandedForNonSettings, setSidebarExpandedForNonSettings] = useState<boolean>(false);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const agentRef = useRef<HttpAgent | null>(null);
  const agentEventSubscriptionRef = useRef<Subscription | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);

  const addMessageToChat = useCallback((sender: MessageSender, text: string, isLoading = false, isCommandResponse = false, toolCallId?: string, toolName?: string) => {
    setChatMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random()}`, sender, text, timestamp: new Date(), isLoading, isCommandResponse, toolCallId, toolName }]);
  }, []);

  // Initialize Agent Client
  useEffect(() => {
    if (config.agentUrl) {
      agentRef.current = new HttpAgent({ agentUrl: config.agentUrl });
      console.log(`HttpAgent initialized for URL: ${config.agentUrl}`);
      // Potentially send an initial "connect" or "get_initial_state" message
      // For now, let's assume the first user message triggers interaction and potential state snapshot.
      // Or, send a "client_ready" type of message:
      // agentRef.current.postInput({ sessionId, inputs: [{name: "client_ready", value: "true"}]})
      //  .then(() => console.log("Client ready signal sent"))
      //  .catch(err => console.error("Error sending client_ready signal", err));

    } else {
      addMessageToChat(MessageSender.SYSTEM, "Backend agent URL is not configured. AI features disabled.");
    }
    return () => {
      agentEventSubscriptionRef.current?.unsubscribe();
    };
  }, [config.agentUrl, addMessageToChat, sessionId]);


  useEffect(() => {
    const savedConfig = localStorage.getItem('mcpConfig');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        const completeSavedConfig: MCPConfig = { ...initialConfig, ...parsedConfig };
        setConfig(completeSavedConfig);
        document.body.className = completeSavedConfig.theme === 'light' ? 'light-theme' : 'dark-theme';
      } catch (e) { console.error("Failed to parse saved config", e); localStorage.removeItem('mcpConfig'); setConfig(initialConfig); }
    } else { setConfig(initialConfig); document.body.className = initialConfig.theme === 'light' ? 'light-theme' : 'dark-theme';}
    
    // Welcome message depends on agent connection status, not API key directly
    addMessageToChat(MessageSender.SYSTEM, SYSTEM_MESSAGE_WELCOME);

  }, [addMessageToChat]); 

  // mcpJsonContent in settings is for user display/editing, not direct tool state sync for frontend.
  // Tool states are synced with tools reported by the agent.
  useEffect(() => {
    const newToolStatesFromAvailable: Record<string, boolean> = {};
    availableAgentTools.forEach(tool => {
      newToolStatesFromAvailable[tool.name] = config.toolStates.hasOwnProperty(tool.name) 
        ? config.toolStates[tool.name] 
        : true; // Default new tools from agent to enabled
    });
    // Only update if there's a structural difference or new tools were added
    if (JSON.stringify(newToolStatesFromAvailable) !== JSON.stringify(config.toolStates)) {
       setConfig(prevConfig => ({ ...prevConfig, toolStates: newToolStatesFromAvailable }));
    }
  }, [availableAgentTools, config.toolStates]); // Removed config.mcpJsonContent dependency here

  const saveConfig = (newConfig: MCPConfig) => {
    const completeNewConfig = { ...initialConfig, ...newConfig }; 
    setConfig(completeNewConfig);
    localStorage.setItem('mcpConfig', JSON.stringify(completeNewConfig));
    document.body.className = completeNewConfig.theme === 'light' ? 'light-theme' : 'dark-theme';
    if (newConfig.agentUrl !== config.agentUrl) { // Re-initialize agent if URL changes
        agentRef.current = new HttpAgent({ agentUrl: newConfig.agentUrl });
        setChatMessages([]); // Clear chat on agent change
        addMessageToChat(MessageSender.SYSTEM, `Agent URL changed. Connecting to: ${newConfig.agentUrl}`);
    }
  };
  
  const handleToggleToolState = useCallback(async (toolName: string) => {
    const newEnabledState = !config.toolStates[toolName];
    const newToolStates = { ...config.toolStates, [toolName]: newEnabledState };
    
    // Optimistically update UI and save locally
    saveConfig({ ...config, toolStates: newToolStates });

    // Send preference to backend agent
    if (agentRef.current) {
      const preferenceInput: AgentInput = {
        name: AguiEventType.SET_TOOL_PREFERENCE, // Or a specific input name backend expects
        value: JSON.stringify({ toolName, enabled: newEnabledState })
      };
      try {
        // HttpAgent's postInput returns an observable of events, typically for operations
        // that don't expect a full conversational reply but might give status.
        // If this is just a fire-and-forget preference, we might not need to subscribe deeply.
        await agentRef.current.postInput({ sessionId, inputs: [preferenceInput] }).toPromise();
        console.log(`Tool preference for '${toolName}' sent to agent: ${newEnabledState}`);
        addMessageToChat(MessageSender.SYSTEM, `Tool '${toolName}' ${newEnabledState ? 'enabled' : 'disabled'}. Preference sent to agent.`, false, true);
      } catch (error) {
        console.error("Failed to send tool preference to agent:", error);
        addMessageToChat(MessageSender.SYSTEM, `Error sending preference for '${toolName}' to agent.`, false, true);
        // Optionally revert UI state if sending fails, though usually we trust the backend to eventually sync.
      }
    }
  }, [config, saveConfig, sessionId, addMessageToChat]);


  const handleAgentEvent = (event: AguiAgentEventInternal) => {
    // console.log("Received AG-UI Event:", event);
    const eventType = mapAguiEventType(event.type as AguiEventTypesInternal); // Cast needed from library's string type
    if (!eventType) return;

    switch (eventType) {
      case AguiEventType.TEXT_MESSAGE_START:
        setIsAgentTyping(true);
        currentMessageIdRef.current = event.messageId || `agent-msg-${Date.now()}`;
        addMessageToChat(MessageSender.AGENT, "", true); // Placeholder
        break;
      case AguiEventType.TEXT_MESSAGE_CONTENT:
        if (event.value && typeof (event.value as any).text === 'string') {
            setChatMessages(prev => prev.map(msg => 
                msg.id === (currentMessageIdRef.current || prev[prev.length -1]?.id) && msg.isLoading // ensure we target the loading placeholder
                ? { ...msg, text: msg.text + (event.value as any).text } 
                : msg
            ));
        }
        break;
      case AguiEventType.TEXT_MESSAGE_END:
        setIsAgentTyping(false);
        setChatMessages(prev => prev.map(msg => 
            msg.id === (currentMessageIdRef.current || prev[prev.length -1]?.id) && msg.isLoading
            ? { ...msg, isLoading: false, timestamp: new Date() } 
            : msg
        ));
        currentMessageIdRef.current = null;
        break;
      case AguiEventType.TOOL_CALL_START:
        if (event.value && typeof (event.value as any).toolName === 'string') {
            const toolCall = event.value as any;
            addMessageToChat(MessageSender.SYSTEM, `AI is attempting to use tool: "${toolCall.toolName}"...`, false, true, toolCall.toolCallId, toolCall.toolName);
        }
        break;
      // case AguiEventType.TOOL_CALL_ARGS: // AG-UI Spec implies args might be part of TOOL_CALL_START or a separate event
      //   if (event.value && typeof (event.value as any).toolCallId === 'string' && typeof (event.value as any).toolArgs === 'string') {
      //       const toolArgsEvent = event.value as any;
      //       setChatMessages(prev => prev.map(msg => 
      //           msg.toolCallId === toolArgsEvent.toolCallId && msg.sender === MessageSender.SYSTEM
      //           ? { ...msg, text: msg.text + `\nArguments: ${toolArgsEvent.toolArgs}` }
      //           : msg
      //       ));
      //   }
      //   break;
      case AguiEventType.TOOL_CALL_END:
         if (event.value && typeof (event.value as any).toolCallId === 'string') {
            // The result of the tool call will typically come back as a new TEXT_MESSAGE stream from the agent
            // So, we might just update the existing system message or add a new one.
            // addMessageToChat(MessageSender.SYSTEM, `Tool "${(event.value as any).toolName || 'Unknown'}" execution attempt finished.`, false, true, (event.value as any).toolCallId);
         }
        break;
      case AguiEventType.STATE_SNAPSHOT:
        if (event.value && Array.isArray((event.value as any).availableTools)) {
          console.log("Received available tools from agent:", (event.value as any).availableTools);
          setAvailableAgentTools((event.value as any).availableTools as AgentToolDefinition[]);
        }
        // Potentially handle other state parts from the snapshot
        break;
      case AguiEventType.ERROR:
        setIsAgentTyping(false);
        addMessageToChat(MessageSender.SYSTEM, `Agent Error: ${event.value ? (event.value as any).text || String(event.value) : 'Unknown error'}`);
        break;
      default:
        console.warn("Unhandled AG-UI event type in frontend:", event.type, event.value);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!agentRef.current) {
      addMessageToChat(MessageSender.SYSTEM, "Agent not connected. Cannot send message.");
      return;
    }
    if (text.startsWith('/')) {
      const commandProcessed = await processSlashCommandActual(text); // Local slash commands might still be useful
      if (commandProcessed) return;
    }

    addMessageToChat(MessageSender.USER, text);
    setIsAgentTyping(true); // Indicate agent is "thinking"

    if (agentEventSubscriptionRef.current) {
      agentEventSubscriptionRef.current.unsubscribe();
    }
    
    const { observable } = agentRef.current.runAgent({
      sessionId: sessionId,
      inputs: [{ name: 'user_message', value: text }], 
      // Include current toolStates preferences with each message, so backend is aware
      // This is an alternative to sending setToolPreference as a separate event.
      // Or backend could request it.
      // For now, let's rely on separate setToolPreference calls.
      // clientState: { toolPreferences: config.toolStates } // If AG-UI HttpAgent supports clientState
    });

    agentEventSubscriptionRef.current = observable.subscribe({
      next: handleAgentEvent,
      error: (err: any) => {
        console.error("Agent interaction error:", err);
        setIsAgentTyping(false);
        addMessageToChat(MessageSender.SYSTEM, `Error communicating with agent: ${err.message || String(err)}`);
      },
      complete: () => {
        // This 'complete' might signify the end of the stream for this specific runAgent call.
        // setIsAgentTyping(false); // Handled by TEXT_MESSAGE_END
      }
    });
  };

  const handleChatToolSelect = (toolName: string) => {
    const selectedTool = availableAgentTools.find(t => t.name === toolName);
    let message = `I'd like to use the "${toolName}" tool.`;
    if (selectedTool?.description) {
      message += ` (Description: ${selectedTool.description})`;
    }
    if (selectedTool?.parameters && Object.keys(selectedTool.parameters).length > 0) {
      message += `\nWhat information do you need for its arguments? Argument schema: ${JSON.stringify(selectedTool.parameters, null, 2)}`;
    }
    
    // Send this as a user message to the agent
    handleSendMessage(message);

    // Or pre-fill the chat input (less direct for agent interaction)
    // const chatInput = document.querySelector('textarea[aria-label="Chat input"]') as HTMLTextAreaElement;
    // if (chatInput) {
    //   chatInput.value = message;
    //   chatInput.focus();
    // }
  };


  // --- Ingest and File related functions (might be refactored if backend handles ingest) ---
  const generateFileTreeText = (folder: IngestedFolder, indent = ""): string => { /* ... (keep existing) ... */ 
    let treeText = `${indent}📁 ${folder.name}/\n`; 
    folder.folders.forEach(subFolder => {
      treeText += generateFileTreeText(subFolder, indent + "  ");
    });
    folder.files.forEach(file => {
      treeText += `${indent}  📄 ${file.name} (${file.type}, ${formatBytes(file.size)})\n`; 
    });
    return treeText;
  };
  const formatBytes = (bytes: number, decimals = 2) => { /* ... (keep existing) ... */
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  const handleIngest = async (files: FileList | null) => { /* ... (keep existing, but its role might change) ... */
     if (!files || files.length === 0) return;
    setIsIngesting(true);
    setIngestProgress(0);
    addMessageToChat(MessageSender.SYSTEM, SYSTEM_MESSAGE_INGEST_START);
    const rootName = files[0].webkitRelativePath.split('/')[0] || "Ingested_Files";
    const rootFolder: IngestedFolder = { id: 'root', name: rootName, path: '', files: [], folders: [] };
    let totalFiles = 0;
    let totalSize = 0;
    const fileArray = Array.from(files);
    
    function findOrCreateFolderActual(pathParts: string[], currentFolder: IngestedFolder): IngestedFolder {
        if (pathParts.length === 0) return currentFolder;
        const part = pathParts.shift()!;
        let nextFolder = currentFolder.folders.find(f => f.name === part);
        if (!nextFolder) {
            nextFolder = { id: `${currentFolder.id}/${part}`, name: part, path: `${currentFolder.path}${currentFolder.path ? '/' : ''}${part}`, files: [], folders: [] };
            currentFolder.folders.push(nextFolder);
        }
        return findOrCreateFolderActual(pathParts, nextFolder);
    }

    for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const pathParts = file.webkitRelativePath.split('/');
        const fileName = pathParts.pop()!;
        if (config.ignoreGlobs.some(glob => fileName.includes(glob.replace('*','')) || file.webkitRelativePath.includes(glob.replace('*','')) )) {
            setIngestProgress(((i + 1) / fileArray.length) * 100); continue;
        }
        if (file.size > config.maxFileSizeMB * 1024 * 1024) {
            addMessageToChat(MessageSender.SYSTEM, `Skipped ${file.name}: exceeds max file size of ${config.maxFileSizeMB}MB.`);
            setIngestProgress(((i + 1) / fileArray.length) * 100); continue;
        }
        const folderPathPartsForCreation = file.webkitRelativePath.split('/');
        folderPathPartsForCreation.pop(); 
        if (folderPathPartsForCreation.length > 0 && folderPathPartsForCreation[0] === rootName) {
            folderPathPartsForCreation.shift();
        }
        const parentFolder = findOrCreateFolderActual(folderPathPartsForCreation, rootFolder);
        parentFolder.files.push({
            id: file.name + Date.now() + Math.random(), name: fileName, path: file.webkitRelativePath,
            type: file.type || 'unknown', size: file.size,
        });
        totalFiles++; totalSize += file.size;
        if (i % Math.max(1, Math.floor(fileArray.length / 20)) === 0 || i === fileArray.length - 1) { 
            await new Promise(resolve => setTimeout(resolve, 0)); 
            setIngestProgress(((i + 1) / fileArray.length) * 100);
        }
    }
    const summaryText = `WORKSPACE: ${rootName}\n---\n${generateFileTreeText(rootFolder)}---\nMETADATA SUMMARY:\nTotal Files: ${totalFiles}\nTotal Size: ${formatBytes(totalSize)}\nIngested: ${new Date().toLocaleString()}`;
    const newIngestedData: IngestedData = {
      rootName: rootName, fileTree: rootFolder, summaryText, totalFiles,
      totalSizeMB: parseFloat((totalSize / (1024*1024)).toFixed(2)), timestamp: new Date(),
    };
    setIngestedData(newIngestedData);
    // Inform backend agent about the new ingest, if applicable
    if (agentRef.current) {
        agentRef.current.postInput({sessionId, inputs: [{name: "ingest_summary_update", value: summaryText}]})
            .catch(err => console.error("Error sending ingest summary to agent", err));
    }
    addMessageToChat(MessageSender.SYSTEM, `Ingest complete for "${rootName}". ${totalFiles} files summarised. Total size: ${formatBytes(totalSize)}.`);
    setIsIngesting(false); setIngestProgress(100); setCurrentPage('fileManager'); 
    if (folderInputRef.current) folderInputRef.current.value = ""; 
  };
  // --- End Ingest ---

  const processSlashCommandActual = async (text: string): Promise<boolean> => { /* ... (keep existing, but adapt for agent) ... */
    const parts = text.match(/^\/(\w+)\s*(.*)$/);
    if (!parts) return false;
    const command = parts[1].toLowerCase();
    const args = parts[2].trim();

    // Some slash commands might now be messages to the agent
    if (command === 'ingest') {
        addMessageToChat(MessageSender.USER, text);
        addMessageToChat(MessageSender.SYSTEM, "Triggering folder selection for ingest...", false, true);
        folderInputRef.current?.click(); return true;
    }
    // For /open and /rename, these could be natural language messages to the agent.
    // Or, if they are purely frontend concepts related to local 'ingestedData', they can stay.
    // Let's assume they are frontend for now.
    addMessageToChat(MessageSender.USER, text);
    switch (command) {
      case 'open':
        if (!ingestedData) { addMessageToChat(MessageSender.SYSTEM, "No data ingested.", false, true); return true; }
        if (!args) { addMessageToChat(MessageSender.SYSTEM, "Usage: /open [filename or path]", false, true); return true; }
        const fileToOpen = findFileInIngestActual(ingestedData.fileTree, args);
        if (fileToOpen) { addMessageToChat(MessageSender.SYSTEM, `File: ${fileToOpen.path}\nType: ${fileToOpen.type}\nSize: ${formatBytes(fileToOpen.size)}\n(Content display not implemented)`, false, true);
        } else { addMessageToChat(MessageSender.SYSTEM, `File "${args}" not found in current ingest.`, false, true); }
        return true;
      case 'rename': // This now sends a message to the agent
         if (!ingestedData) { addMessageToChat(MessageSender.SYSTEM, "No data ingested.", false, true); return true; }
         const renameMatch = args.match(/^"(.+?)"\s+to\s+"(.+?)"$/i);
         if (!renameMatch) { addMessageToChat(MessageSender.SYSTEM, 'Usage: /rename "[pattern]" to "[new_pattern]"', false, true); return true; }
         handleSendMessage(`Please describe how files matching pattern "${renameMatch[1]}" would be renamed to "${renameMatch[2]}" based on the currently ingested content summary.`);
         return true;
      default:
        addMessageToChat(MessageSender.SYSTEM, `Unknown command: ${command}.`, false, true); return false; // Let agent handle unknown
    }
   };
  const findFileInIngestActual = (folder: IngestedFolder, filePathOrName: string): IngestedFile | null => { /* ... (keep existing) ... */ 
    const normalizedQuery = filePathOrName.trim().toLowerCase();
    for (const file of folder.files) { if (file.name.toLowerCase() === normalizedQuery || file.path.toLowerCase() === normalizedQuery) return file; }
    for (const subFolder of folder.folders) { const found = findFileInIngestActual(subFolder, filePathOrName); if (found) return found; } return null;
  };

  // AI Organize Structure is now a message to the agent
  const handleAiOrganizeRequestActual = async () => {
    if (!ingestedData) {
      addMessageToChat(MessageSender.SYSTEM, "No data ingested. Please ingest a folder first."); return;
    }
    handleSendMessage("Can you suggest a new organizational structure for the ingested files?");
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'settings':
        return <SettingsPanel currentConfig={config} onConfigChange={saveConfig} />;
      case 'fileManager':
        return <FileManagerPanel 
                    ingestedData={ingestedData} 
                    onIngestRequest={() => folderInputRef.current?.click()}
                    isIngesting={isIngesting}
                    ingestProgress={ingestProgress}
                    currentTheme={config.theme}
                    // AI Organization features are now agent-driven
                    aiOrganizedSuggestion={null} // This would come from agent as a message
                    isAiOrganizing={isAgentTyping && chatMessages[chatMessages.length -1]?.text.includes("organizational structure")} // Crude check
                    onAiOrganizeRequest={handleAiOrganizeRequestActual}
                    apiKeyExists={!!agentRef.current} // "API Key" now means "Agent Connected"
                />;
      case 'chat':
        return <ChatPanel 
                  messages={chatMessages} 
                  onSendMessage={handleSendMessage} 
                  isSending={isAgentTyping} 
                  currentTheme={config.theme} 
                  availableAgentTools={availableAgentTools} // Pass agent tools
                  toolStates={config.toolStates}
                  onToolSelect={handleChatToolSelect}
                />;
      case 'tools':
        return <ToolsPanel 
                    availableAgentTools={availableAgentTools} // Pass agent tools
                    toolStates={config.toolStates}
                    onToggleToolState={handleToggleToolState}
                    currentTheme={config.theme}
                    onNavigate={setCurrentPage} 
                />;
      default:
        return <div className="p-4 text-center">Page not found</div>;
    }
  };

  const navItems: { page: Page; label: string; icon: JSX.Element }[] = [
    { page: 'fileManager', label: 'File Manager', icon: Icons.folderTree },
    { page: 'chat', label: 'Chat', icon: Icons.chat },
    { page: 'tools', label: 'Tools', icon: Icons.tools },
    { page: 'settings', label: 'Settings', icon: Icons.settings },
  ];

  const isSidebarEffectivelyExpanded = currentPage === 'settings' || sidebarExpandedForNonSettings;
  
  return (
    <div className={`h-screen flex flex-col text-sm md:text-base ${config.theme === 'dark' ? 'dark-theme' : 'light-theme'}`}>
      <input type="file" webkitdirectory="" directory="" multiple ref={folderInputRef} onChange={(e) => handleIngest(e.target.files)} style={{ display: 'none' }} />
      
      <header className={`p-3 flex items-center justify-between shrink-0 border-b ${config.theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>
        <div className="flex items-center space-x-2">
           <span className="text-xl font-bold text-accent">{Icons.folderTree}</span>
           <h1 className="text-lg md:text-xl font-bold">{APP_TITLE}</h1>
        </div>
        <button 
            onClick={() => saveConfig({...config, theme: config.theme === 'dark' ? 'light' : 'dark'})}
            className={`p-2 rounded-full hover:opacity-80 transition-opacity ${config.theme === 'dark' ? 'text-yellow-400' : 'text-gray-700'}`}
            aria-label={`Switch to ${config.theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${config.theme === 'dark' ? 'light' : 'dark'} theme`}
        >
            {config.theme === 'dark' ? Icons.sun : Icons.moon}
        </button>
      </header>

      <div className="flex flex-grow overflow-hidden">
        <nav className={`p-3 flex flex-col shrink-0 border-r ${config.theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'} 
                         w-16 ${isSidebarEffectivelyExpanded ? 'md:w-48' : ''} overflow-y-auto transition-all duration-300 ease-in-out`}>
          <div className="space-y-2 flex-grow">
            {navItems.map(item => (
              <button
                key={item.page}
                onClick={() => setCurrentPage(item.page)}
                className={`w-full flex items-center space-x-3 nav-button ${currentPage === item.page ? 'active' : ''}`}
                title={item.label}
              >
                {item.icon}
                <span className={isSidebarEffectivelyExpanded ? "hidden md:inline" : "hidden"}>{item.label}</span>
              </button>
            ))}
          </div>
          {currentPage !== 'settings' && (
            <div className="mt-auto pt-2 border-t ${config.theme === 'dark' ? 'border-gray-700' : 'border-gray-600'}">
              <button
                onClick={() => setSidebarExpandedForNonSettings(!sidebarExpandedForNonSettings)}
                className={`w-full flex items-center space-x-3 nav-button`}
                title={sidebarExpandedForNonSettings ? "Collapse Sidebar" : "Expand Sidebar"}
              >
                {sidebarExpandedForNonSettings ? Icons.chevronDoubleLeft : Icons.chevronDoubleRight}
                <span className={isSidebarEffectivelyExpanded ? "hidden md:inline" : "hidden"}>
                  {sidebarExpandedForNonSettings ? "Collapse" : "Expand"}
                </span>
              </button>
            </div>
          )}
        </nav>

        <main className="flex-grow p-1 md:p-4 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
       <footer className={`text-center text-xs p-2 border-t ${config.theme === 'dark' ? 'text-gray-500 border-gray-700' : 'text-gray-600 border-gray-300'} shrink-0`}>
         {APP_TITLE} - AG-UI Agent Connected. Ingest ops are local.
      </footer>
    </div>
  );
};

export default App;
