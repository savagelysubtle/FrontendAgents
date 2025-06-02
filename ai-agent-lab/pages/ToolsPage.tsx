
import React, { useState, useEffect, useCallback } from 'react';
import { McpServer, McpTool, McpResource, McpPrompt, ClientCapabilitiesConfig, StdioConfig, McpServersJsonFormat } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS, ACCENT_COLOR, DEFAULT_SETTINGS } from '../constants';
import Button from '../components/Button';
import Input from '../components/Input';
import Textarea from '../components/Textarea';
import Modal from '../components/Modal';
import ToggleSwitch from '../components/ToggleSwitch';
import Card from '../components/Card';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import EditIcon from '../components/icons/EditIcon';
import SpinnerIcon from '../components/icons/SpinnerIcon';
import BookOpenIcon from '../components/icons/BookOpenIcon';
import PlayIcon from '../components/icons/PlayIcon';
import { mcpClientService } from '../services/mcpClientService';
import { telemetryService } from '../services/telemetryService';
import { geminiService } from '../services/geminiService'; // Import Gemini service

// --- Sub-components for ToolsPage ---

interface McpServerCardProps {
  server: McpServer;
  onConnect: (server: McpServer) => void;
  onDisconnect: (serverId: string) => void;
  onEdit: (server: McpServer) => void; // This might change if editing only happens via JSON modal
  onDelete: (serverId: string) => void;
  onViewDetails: (server: McpServer) => void;
}

const McpServerCard: React.FC<McpServerCardProps> = ({ server, onConnect, onDisconnect, onEdit, onDelete, onViewDetails }) => {
  const isConnecting = server.status === 'connecting';
  const isConnected = server.status === 'connected';

  return (
    <Card>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-zinc-50">{server.name}</h3>
          {server.configType === 'sse' && server.url && (
            <p className="text-sm text-gray-500 dark:text-zinc-400 truncate max-w-xs" title={server.url}>{server.url}</p>
          )}
          {server.configType === 'stdio' && server.stdioConfig?.command && (
            <p className="text-sm text-gray-500 dark:text-zinc-400 truncate max-w-xs" title={server.stdioConfig.command}>
              Cmd: {server.stdioConfig.command} {server.stdioConfig.args?.[0] ? server.stdioConfig.args[0] + '...' : ''}
            </p>
          )}
           <p className="text-xs text-gray-400 dark:text-zinc-500">Type: {server.configType.toUpperCase()}</p>
        </div>
        <div className={`px-2 py-0.5 rounded-full text-xs font-medium
          ${isConnected ? `bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100` : ''}
          ${server.status === 'disconnected' ? `bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-100` : ''}
          ${server.status === 'error' ? `bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100` : ''}
          ${isConnecting ? `bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100` : ''}
        `}>
          {isConnecting && <SpinnerIcon className="w-3 h-3 mr-1 inline-block" />}
          {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
        </div>
      </div>
      {server.lastError && server.status === 'error' && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400" title={server.lastError}>Error: {server.lastError.substring(0,100)}{server.lastError.length > 100 ? "..." : ""}</p>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800 flex flex-wrap gap-2">
        {isConnected ? (
          <Button variant="secondary" size="sm" onClick={() => onDisconnect(server.id)} isLoading={isConnecting}>Disconnect</Button>
        ) : (
          <Button variant="primary" size="sm" onClick={() => onConnect(server)} isLoading={isConnecting} disabled={isConnecting}>Connect</Button>
        )}
        {/* The 'Edit' button might be removed if all stdio/json configs are through the bulk editor */}
        <Button variant="ghost" size="sm" onClick={() => onEdit(server)} title="Edit Server Config (May open JSON editor for STDIO)"><EditIcon className="w-4 h-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(server.id)} className={`text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-700`} title="Delete Server">
          <TrashIcon className="w-4 h-4" />
        </Button>
        {isConnected && (
          <Button variant="ghost" size="sm" onClick={() => onViewDetails(server)} className={`text-${ACCENT_COLOR}-600 dark:text-${ACCENT_COLOR}-400`}>View Details</Button>
        )}
      </div>
    </Card>
  );
};

interface DynamicParamInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  schema: Record<string, { type: string; description?: string; required?: boolean }> | undefined | null;
  onSubmit: (params: Record<string, any>) => void;
  isLoading: boolean;
  itemType: 'Tool' | 'Resource' | 'Prompt';
  itemName: string;
  actionName: string;
}

const DynamicParamInputModal: React.FC<DynamicParamInputModalProps> = ({ isOpen, onClose, title, schema, onSubmit, isLoading, itemType, itemName, actionName }) => {
  const [params, setParams] = useState<Record<string, any>>({});
  const [rawJsonParams, setRawJsonParams] = useState('{}');
  const [useRawJson, setUseRawJson] = useState(!schema || Object.keys(schema).length === 0); 

  useEffect(() => {
    if (isOpen) {
      const initialParams: Record<string, any> = {};
      if (schema) {
        Object.keys(schema).forEach(key => {
          initialParams[key] = schema[key].type === 'boolean' ? false : '';
        });
      }
      setParams(initialParams);
      setRawJsonParams('{}');
      setUseRawJson(!schema || Object.keys(schema).length === 0);
    }
  }, [isOpen, schema]);

  const handleParamChange = (key: string, value: string | boolean) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    let finalParams: Record<string, any> = {};
    if (useRawJson) {
        try {
            finalParams = JSON.parse(rawJsonParams);
        } catch (e) {
            alert("Invalid JSON in parameters.");
            return;
        }
    } else {
        finalParams = { ...params };
        if (schema) {
            Object.keys(schema).forEach(key => {
                if (schema[key].type === 'number' && typeof finalParams[key] === 'string') {
                    finalParams[key] = parseFloat(finalParams[key]);
                } else if (schema[key].type === 'boolean' && typeof finalParams[key] === 'string') {
                    finalParams[key] = finalParams[key] === 'true';
                }
            });
        }
    }
    onSubmit(finalParams);
  };
  const hasSchema = schema && Object.keys(schema).length > 0;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <p className="text-sm text-gray-600 dark:text-zinc-400 mb-1">{itemType}: <span className="font-semibold">{itemName}</span></p>
      {hasSchema && (
         <div className="mb-3"> <ToggleSwitch label="Use Raw JSON for Parameters" checked={useRawJson} onChange={setUseRawJson} /> </div>
      )}
      {useRawJson || !hasSchema ? (
        <Textarea label="Parameters (JSON format)" value={rawJsonParams} onChange={(e) => setRawJsonParams(e.target.value)} textareaClassName="h-32 font-mono text-sm" placeholder='{ "param_name": "value" }'/>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {Object.entries(schema!).map(([key, field]: [string, { type: string; description?: string; required?: boolean }]) => ( <div key={key}> {field.type === 'boolean' ? ( <ToggleSwitch label={`${key}${field.required ? '*' : ''}`} checked={Boolean(params[key])} onChange={(val) => handleParamChange(key, val)}/> ) : ( <Input label={`${key}${field.required ? '*' : ''} (${field.type})`} type={field.type === 'number' ? 'number' : 'text'} placeholder={field.description || `Enter ${field.type}`} value={String(params[key] ?? '')} onChange={(e) => handleParamChange(key, e.target.value)} required={field.required}/> )} {field.description && field.type !== 'boolean' && <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{field.description}</p>} </div> ))}
        </div>
      )}
      <div className="mt-6 flex justify-end space-x-3"> <Button variant="secondary" onClick={onClose} disabled={isLoading}>Close</Button> <Button onClick={handleSubmit} isLoading={isLoading}>{actionName}</Button> </div>
    </Modal>
  );
};


// --- Main ToolsPage Component ---
const ToolsPage: React.FC = () => {
  const [mcpServers, setMcpServers] = useLocalStorage<McpServer[]>(LOCAL_STORAGE_KEYS.MCP_SERVERS, []);
  
  // State for the old individual server modal (primarily for SSE or simple edits)
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState(''); // For SSE
  const [clientCaps, setClientCaps] = useState<ClientCapabilitiesConfig>(DEFAULT_SETTINGS.mcpClientCapabilities);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmittingServer, setIsSubmittingServer] = useState(false);

  // State for the new JSON configuration modal
  const [isStdioJsonModalOpen, setIsStdioJsonModalOpen] = useState(false);
  const [stdioJsonConfig, setStdioJsonConfig] = useState('');
  const [isProcessingJson, setIsProcessingJson] = useState(false);
  const [jsonModalError, setJsonModalError] = useState<string | null>(null);

  const [detailedServer, setDetailedServer] = useState<McpServer | null>(null);
  const [activeTab, setActiveTab] = useState<'tools' | 'resources' | 'prompts' | 'capabilities'>('tools');
  
  const [interactionItem, setInteractionItem] = useState<McpTool | McpResource | McpPrompt | null>(null);
  const [interactionType, setInteractionType] = useState<'tool' | 'resource' | 'prompt' | null>(null);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [interactionResult, setInteractionResult] = useState<any | null>(null);
  const [isProcessingInteraction, setIsProcessingInteraction] = useState(false);
  const [interactionError, setInteractionError] = useState<string | null>(null);

  const updateServerState = (serverId: string, updates: Partial<McpServer>) => {
    setMcpServers(prev => prev.map(s => s.id === serverId ? { ...s, ...updates } : s));
    if (detailedServer?.id === serverId) {
      setDetailedServer(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleConnectServer = async (serverToConnect: McpServer) => {
    updateServerState(serverToConnect.id, { status: 'connecting', lastError: undefined });
    try {
      const connectionDetails = await mcpClientService.connect(serverToConnect); // Mock will need to handle stdio vs sse
      updateServerState(serverToConnect.id, { ...connectionDetails });
      telemetryService.logEvent('mcp_server_connected', { serverId: serverToConnect.id, serverName: serverToConnect.name });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      updateServerState(serverToConnect.id, { status: 'error', lastError: err.message, tools:[], resources:[], prompts:[], serverReportedCapabilities: undefined });
      telemetryService.logError(err, { context: 'mcp_server_connect', serverId: serverToConnect.id });
    }
  };

  const handleDisconnectServer = async (serverId: string) => {
    await mcpClientService.disconnect(serverId);
    updateServerState(serverId, { status: 'disconnected', tools:[], resources:[], prompts:[], serverReportedCapabilities: undefined, lastError: undefined });
    if (detailedServer?.id === serverId) setDetailedServer(null); 
    telemetryService.logEvent('mcp_server_disconnected', { serverId });
  };

  // For individual SSE server modal
  const handleSseServerSubmit = async () => {
    setModalError(null);
    if (!serverName.trim() || (editingServer?.configType === 'sse' && !serverUrl.trim())) {
      setModalError("Server Name and URL (for SSE) are required.");
      return;
    }
    if (editingServer?.configType === 'sse' && serverUrl) { // Added serverUrl check here
        try { new URL(serverUrl); } catch (_) {
          setModalError("Invalid Server URL format for SSE.");
          return;
        }
    }

    setIsSubmittingServer(true);
    const serverData: McpServer = {
      id: editingServer ? editingServer.id : crypto.randomUUID(),
      name: serverName, 
      configType: 'sse', // This modal primarily handles SSE
      url: serverUrl,
      status: editingServer ? editingServer.status : 'disconnected',
      clientCapabilities: clientCaps,
      tools: editingServer?.tools || [], resources: editingServer?.resources || [], prompts: editingServer?.prompts || [],
    };

    if (editingServer) {
      setMcpServers(prev => prev.map(s => s.id === editingServer.id ? serverData : s));
      telemetryService.logEvent('mcp_server_updated', { serverId: serverData.id });
    } else {
      setMcpServers(prev => [...prev, serverData]);
      telemetryService.logEvent('mcp_server_registered', { serverName: serverData.name });
    }
    setIsSubmittingServer(false);
    closeServerModal();
  };
  
  const openSseServerModalForEdit = (server: McpServer) => {
    setEditingServer(server); setServerName(server.name); 
    setServerUrl(server.configType === 'sse' ? server.url || '' : ''); 
    setClientCaps(server.clientCapabilities);
    setModalError(null); setIsServerModalOpen(true);
  };

  const openSseServerModalForAdd = () => {
    setEditingServer(null); setServerName(''); setServerUrl(''); setClientCaps(DEFAULT_SETTINGS.mcpClientCapabilities);
    setModalError(null); setIsServerModalOpen(true);
  };
  
  const closeServerModal = () => { setIsServerModalOpen(false); setEditingServer(null); setModalError(null); };

  const deleteServer = (serverId: string) => {
    if (window.confirm("Are you sure you want to delete this MCP server configuration?")) {
      handleDisconnectServer(serverId); 
      setMcpServers(prev => prev.filter(s => s.id !== serverId));
      if (detailedServer?.id === serverId) setDetailedServer(null);
      telemetryService.logEvent('mcp_server_deleted', { serverId });
    }
  };

  // --- JSON Config Modal Logic ---
  const openStdioJsonModal = () => {
    const currentStdioConfigs: McpServersJsonFormat = { mcpServers: {} };
    mcpServers.forEach(s => {
        currentStdioConfigs.mcpServers[s.name] = {
            type: s.configType,
            command: s.configType === 'stdio' ? s.stdioConfig?.command : undefined,
            args: s.configType === 'stdio' ? s.stdioConfig?.args : undefined,
            cwd: s.configType === 'stdio' ? s.stdioConfig?.cwd : undefined,
            env: s.configType === 'stdio' ? s.stdioConfig?.env : undefined,
            url: s.configType === 'sse' ? s.url : undefined,
            // Include other relevant stored fields if needed, or just the core config
        };
    });
    setStdioJsonConfig(JSON.stringify(currentStdioConfigs, null, 2));
    setJsonModalError(null);
    setIsStdioJsonModalOpen(true);
  };

  const handleFormatJsonWithAI = async () => {
    setIsProcessingJson(true);
    setJsonModalError(null);
    try {
      const formattedJson = await geminiService.formatMcpServerConfig(stdioJsonConfig);
      if (formattedJson.startsWith("ERROR:")) {
        setJsonModalError(formattedJson);
      } else {
        setStdioJsonConfig(formattedJson);
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setJsonModalError(`AI Formatting failed: ${err.message}`);
      telemetryService.logError(err, {context: 'mcp_json_format_ai'});
    } finally {
      setIsProcessingJson(false);
    }
  };
  
  const handleSaveStdioJsonConfig = () => {
    setIsProcessingJson(true);
    setJsonModalError(null);
    try {
      const parsed = JSON.parse(stdioJsonConfig) as McpServersJsonFormat;
      if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
        throw new Error("Invalid JSON structure: Missing 'mcpServers' root object.");
      }

      const newServerList: McpServer[] = [];
      const incomingServerNames = Object.keys(parsed.mcpServers);
      
      // Process servers from JSON
      for (const serverName of incomingServerNames) {
        const config = parsed.mcpServers[serverName];
        const existingServer = mcpServers.find(s => s.name === serverName);
        
        let serverType: 'stdio' | 'sse' = config.type || (config.command ? 'stdio' : (config.url ? 'sse' : 'stdio')); // Infer type
        if(config.type) serverType = config.type;


        let newOrUpdatedServer: McpServer;

        if (existingServer) { // Update existing
          newOrUpdatedServer = { ...existingServer, name: serverName, configType: serverType };
        } else { // Add new
          newOrUpdatedServer = {
            id: crypto.randomUUID(),
            name: serverName,
            configType: serverType,
            status: 'disconnected',
            clientCapabilities: DEFAULT_SETTINGS.mcpClientCapabilities, // Or allow configuring this globally for JSON import
            tools: [], resources: [], prompts: [],
          };
        }

        if (serverType === 'stdio') {
          if (!config.command) throw new Error(`Server '${serverName}' is type 'stdio' but missing 'command'.`);
          newOrUpdatedServer.stdioConfig = {
            command: config.command,
            args: config.args,
            cwd: config.cwd,
            env: config.env,
          };
          newOrUpdatedServer.url = undefined;
        } else if (serverType === 'sse') {
          if (!config.url) throw new Error(`Server '${serverName}' is type 'sse' but missing 'url'.`);
          newOrUpdatedServer.url = config.url;
          newOrUpdatedServer.stdioConfig = undefined;
        } else {
            // Preserve unknown type and its config as much as possible if needed, or throw error
            console.warn(`Server '${serverName}' has an unsupported type '${config.type}'. It will be treated as disconnected with minimal config.`);
             newOrUpdatedServer.status = 'error';
             newOrUpdatedServer.lastError = `Unsupported server type: ${config.type}`;
        }
        newServerList.push(newOrUpdatedServer);
      }
      
      // Identify SSE servers added NOT through JSON to preserve them
      const sseServersNotFromJSON = mcpServers.filter(
        s => s.configType === 'sse' && !newServerList.find(nsl => nsl.name === s.name) && !s.stdioConfig // Check if it was purely an SSE server
      );

      setMcpServers([...newServerList, ...sseServersNotFromJSON]);
      telemetryService.logEvent('mcp_json_config_saved', { serverCount: newServerList.length });
      setIsStdioJsonModalOpen(false);

    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setJsonModalError(`Error saving JSON configuration: ${err.message}`);
      telemetryService.logError(err, {context: 'mcp_json_save'});
    } finally {
      setIsProcessingJson(false);
    }
  };
  

  // --- Interaction Modal Logic (Tool Call, Read Resource, Execute Prompt) ---
  const openInteractionModal = (item: McpTool | McpResource | McpPrompt, type: 'tool' | 'resource' | 'prompt', server: McpServer) => {
    setInteractionItem(item); setInteractionType(type); setDetailedServer(server); 
    setInteractionResult(null); setInteractionError(null); setIsInteractionModalOpen(true);
  };

  const handleProcessInteraction = async (params: Record<string, any>) => {
    if (!interactionItem || !interactionType || !detailedServer) return;
    setIsProcessingInteraction(true); setInteractionResult(null); setInteractionError(null);
    try {
      let result;
      if (interactionType === 'tool') result = await mcpClientService.callTool(detailedServer.id, interactionItem.name, params);
      else if (interactionType === 'resource') result = await mcpClientService.readResource(detailedServer.id, interactionItem.name, params);
      else if (interactionType === 'prompt') result = await mcpClientService.executePrompt(detailedServer.id, interactionItem.name, params);
      setInteractionResult(result);
      telemetryService.logEvent(`mcp_${interactionType}_action`, { serverId: detailedServer.id, itemName: interactionItem.name });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setInteractionError(err.message);
      telemetryService.logError(err, { context: `mcp_${interactionType}_action`, serverId: detailedServer.id, itemName: interactionItem.name });
    } finally {
      setIsProcessingInteraction(false);
    }
  };
  
  const handleViewServerDetails = (server: McpServer) => { setDetailedServer(server); setActiveTab('tools'); };
  const renderServerDetails = () => { 
    if (!detailedServer || detailedServer.status !== 'connected') return null;
    const tabs: { name: 'tools' | 'resources' | 'prompts' | 'capabilities', label: string, count?: number }[] = [ { name: 'tools', label: 'Tools', count: detailedServer.tools.length }, { name: 'resources', label: 'Resources', count: detailedServer.resources.length }, { name: 'prompts', label: 'Prompts', count: detailedServer.prompts.length }, { name: 'capabilities', label: 'Capabilities' } ];
    return ( <Modal isOpen={!!detailedServer} onClose={() => setDetailedServer(null)} title={`Details for ${detailedServer.name}`} size="xl"> <div className="mb-4 border-b border-gray-200 dark:border-zinc-800"> <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs"> {tabs.map((tab) => ( <button key={tab.name} onClick={() => setActiveTab(tab.name)} className={`whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm ${activeTab === tab.name ? `border-${ACCENT_COLOR}-500 text-${ACCENT_COLOR}-600 dark:text-${ACCENT_COLOR}-400` : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:border-zinc-500' }`}>{tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}</button> ))} </nav> </div> <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar"> {activeTab === 'tools' && ( <ul className="space-y-3"> {detailedServer.tools.length === 0 && <p className="text-sm text-gray-500 dark:text-zinc-400">No tools discovered.</p>} {detailedServer.tools.map(tool => ( <li key={tool.name} className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-md"> <div className="flex justify-between items-center"> <div> <h4 className="font-semibold text-gray-800 dark:text-zinc-50">{tool.name}</h4> {tool.description && <p className="text-xs text-gray-600 dark:text-zinc-300">{tool.description}</p>} </div> <Button size="sm" leftIcon={<PlayIcon className="w-3.5 h-3.5"/>} onClick={() => openInteractionModal(tool, 'tool', detailedServer)}>Call</Button> </div> {tool.inputSchema && (<details className="mt-2 text-xs"><summary className="cursor-pointer text-gray-500 dark:text-zinc-400">Input Schema</summary><pre className="mt-1 p-1.5 bg-gray-100 dark:bg-zinc-700 rounded text-[10px] max-h-24 overflow-auto">{JSON.stringify(tool.inputSchema, null, 2)}</pre></details>)} </li> ))} </ul> )} {activeTab === 'resources' && ( <ul className="space-y-3"> {detailedServer.resources.length === 0 && <p className="text-sm text-gray-500 dark:text-zinc-400">No resources discovered.</p>} {detailedServer.resources.map(res => ( <li key={res.name} className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-md"> <div className="flex justify-between items-center"> <div> <h4 className="font-semibold text-gray-800 dark:text-zinc-50">{res.name}</h4> {res.description && <p className="text-xs text-gray-600 dark:text-zinc-300">{res.description}</p>} {res.uriTemplate && <p className="text-xs text-gray-500 dark:text-zinc-400">Template: <code className="bg-gray-200 dark:bg-zinc-700 p-0.5 rounded">{res.uriTemplate}</code></p>} </div> <Button size="sm" leftIcon={<BookOpenIcon className="w-3.5 h-3.5"/>} onClick={() => openInteractionModal(res, 'resource', detailedServer)}>Read</Button> </div> {res.paramsSchema && (<details className="mt-2 text-xs"><summary className="cursor-pointer text-gray-500 dark:text-zinc-400">Parameters Schema</summary><pre className="mt-1 p-1.5 bg-gray-100 dark:bg-zinc-700 rounded text-[10px] max-h-24 overflow-auto">{JSON.stringify(res.paramsSchema, null, 2)}</pre></details>)} </li> ))} </ul> )} {activeTab === 'prompts' && ( <ul className="space-y-3"> {detailedServer.prompts.length === 0 && <p className="text-sm text-gray-500 dark:text-zinc-400">No prompts discovered.</p>} {detailedServer.prompts.map(prompt => ( <li key={prompt.name} className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-md"> <div className="flex justify-between items-center"> <div> <h4 className="font-semibold text-gray-800 dark:text-zinc-50">{prompt.name}</h4> {prompt.description && <p className="text-xs text-gray-600 dark:text-zinc-300">{prompt.description}</p>} </div> <Button size="sm" leftIcon={<PlayIcon className="w-3.5 h-3.5"/>} onClick={() => openInteractionModal(prompt, 'prompt', detailedServer)}>Execute</Button> </div> {prompt.paramsSchema && (<details className="mt-2 text-xs"><summary className="cursor-pointer text-gray-500 dark:text-zinc-400">Parameters Schema</summary><pre className="mt-1 p-1.5 bg-gray-100 dark:bg-zinc-700 rounded text-[10px] max-h-24 overflow-auto">{JSON.stringify(prompt.paramsSchema, null, 2)}</pre></details>)} </li> ))} </ul> )} {activeTab === 'capabilities' && detailedServer.serverReportedCapabilities && ( <div> <h4 className="font-semibold text-gray-800 dark:text-zinc-50 mb-2">Server Reported Capabilities</h4> <pre className="p-3 bg-gray-100 dark:bg-zinc-800 rounded text-xs max-h-[50vh] overflow-auto">{JSON.stringify(detailedServer.serverReportedCapabilities, null, 2)}</pre> </div> )} </div> </Modal> );
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-zinc-50">MCP Servers</h1>
        <div className="flex space-x-2">
          <Button onClick={openSseServerModalForAdd} leftIcon={<PlusIcon className="w-5 h-5" />}>Add SSE Server</Button>
          <Button onClick={openStdioJsonModal} variant="secondary" leftIcon={<EditIcon className="w-4 h-4" />}>Manage JSON Configs</Button>
        </div>
      </div>

      {mcpServers.length === 0 ? (
        <Card><p className="text-center text-gray-600 dark:text-zinc-400 py-8">No MCP servers registered.</p></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mcpServers.map(server => (
            <McpServerCard key={server.id} server={server} onConnect={handleConnectServer} onDisconnect={handleDisconnectServer} onEdit={openSseServerModalForEdit} onDelete={deleteServer} onViewDetails={handleViewServerDetails} />
          ))}
        </div>
      )}

      {/* Modal for individual SSE server add/edit */}
      <Modal isOpen={isServerModalOpen} onClose={closeServerModal} title={editingServer ? (editingServer.configType === 'sse' ? "Edit SSE Server" : "Edit Server Configuration") : "Register New SSE Server"}>
        <div className="space-y-4">
          <Input label="Server Name (Alias)" type="text" placeholder="My Local MCP Server" value={serverName} onChange={(e) => setServerName(e.target.value)} required />
          {(!editingServer || editingServer.configType === 'sse') && (
            <Input label="Server URL (for SSE)" type="url" placeholder="http://localhost:8080" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} required={!editingServer || editingServer.configType === 'sse'} />
          )}
          {editingServer?.configType === 'stdio' && (
            <p className="text-sm text-gray-600 dark:text-zinc-400">STDIO server configurations are managed via the 'Manage JSON Configs' editor.</p>
          )}
          <fieldset className="border border-gray-300 dark:border-zinc-700 p-3 rounded-md">
            <legend className="text-sm font-medium text-gray-700 dark:text-zinc-300 px-1">Client Capabilities to Request</legend>
            <ToggleSwitch label="Roots Support" checked={clientCaps.roots} onChange={(checked) => setClientCaps(prev => ({ ...prev, roots: checked }))} />
            <ToggleSwitch label="Sampling Support" checked={clientCaps.sampling} onChange={(checked) => setClientCaps(prev => ({ ...prev, sampling: checked }))} />
          </fieldset>
          {modalError && <p className="text-sm text-red-600 dark:text-red-400">{modalError}</p>}
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <Button variant="secondary" onClick={closeServerModal} disabled={isSubmittingServer}>Cancel</Button>
          <Button onClick={handleSseServerSubmit} isLoading={isSubmittingServer} disabled={editingServer?.configType === 'stdio'}>{editingServer ? "Save Changes" : "Register Server"}</Button>
        </div>
      </Modal>

      {/* Modal for STDIO/JSON Configurations */}
      <Modal isOpen={isStdioJsonModalOpen} onClose={() => setIsStdioJsonModalOpen(false)} title="Manage MCP Server Configurations (JSON)" size="xl">
        <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-zinc-400">
                Define or update your MCP server configurations using JSON. This typically includes STDIO-based servers and can also define SSE servers.
                Use the "Format & Validate with AI" button to help clean up the JSON.
            </p>
          <Textarea
            label="Server Configurations JSON"
            value={stdioJsonConfig}
            onChange={(e) => setStdioJsonConfig(e.target.value)}
            textareaClassName="h-96 font-mono text-xs"
            placeholder='{\n  "mcpServers": {\n    "MyPythonServer": {\n      "command": "python",\n      "args": ["main.py"]\n    }\n  }\n}'
          />
          {jsonModalError && <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{jsonModalError}</p>}
           {jsonModalError?.includes("fix the incorrect config") && // Crude check
             <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                Consider copying the problematic JSON and asking the AI Assistant on the Assistant page for help.
            </p>
           }
        </div>
        <div className="mt-6 flex justify-between items-center">
            <div>
                <Button onClick={handleFormatJsonWithAI} isLoading={isProcessingJson} variant="ghost">
                    Format & Validate with AI
                </Button>
            </div>
            <div className="flex space-x-3">
                <Button variant="secondary" onClick={() => setIsStdioJsonModalOpen(false)} disabled={isProcessingJson}>Cancel</Button>
                <Button onClick={handleSaveStdioJsonConfig} isLoading={isProcessingJson}>Save Configurations</Button>
            </div>
        </div>
      </Modal>


      {renderServerDetails()}
      {interactionItem && interactionType && detailedServer && ( <DynamicParamInputModal 
        isOpen={isInteractionModalOpen} 
        onClose={() => setIsInteractionModalOpen(false)} 
        title={`${interactionType === 'tool' ? 'Call Tool' : interactionType === 'resource' ? 'Read Resource' : 'Execute Prompt'}: ${interactionItem.name}`} 
        itemType={interactionType.charAt(0).toUpperCase() + interactionType.slice(1) as 'Resource' | 'Prompt' | 'Tool'} 
        itemName={interactionItem.name} 
        actionName={interactionType === 'tool' ? 'Call' : interactionType === 'resource' ? 'Read' : 'Execute'} 
        schema={(interactionItem as McpTool).inputSchema || (interactionItem as McpResource | McpPrompt).paramsSchema} 
        onSubmit={handleProcessInteraction} 
        isLoading={isProcessingInteraction}
        /> )}
      {interactionResult !== null && ( <Modal isOpen={true} onClose={() => setInteractionResult(null)} title={`Result: ${interactionItem?.name || 'Interaction'}`} size="lg"> <pre className="p-2 bg-gray-100 dark:bg-zinc-800 rounded text-sm max-h-96 overflow-auto">{JSON.stringify(interactionResult, null, 2)}</pre> <div className="mt-4 flex justify-end"> <Button onClick={() => setInteractionResult(null)}>Close</Button> </div> </Modal> )}
      {interactionError && ( <Modal isOpen={true} onClose={() => setInteractionError(null)} title={`Error: ${interactionItem?.name || 'Interaction'}`} size="md"> <p className="text-red-500 dark:text-red-400">{interactionError}</p> <div className="mt-4 flex justify-end"> <Button onClick={() => setInteractionError(null)}>Close</Button> </div> </Modal> )}
    </div>
  );
};

export default ToolsPage;