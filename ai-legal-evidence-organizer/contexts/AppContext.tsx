import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { EvidenceFile, Tag, ChatMessage, AuditLogEntry, Theme, McpServerStatus, WcatCase, PolicyManual, PolicyEntry, PolicyReference, SavedChatSession, McpUserProvidedServers, McpApiConfig, AiTool, McpServerProcessConfig, DynamicMarker, McpStdioOptions } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { POLICY_NUMBER_REGEX, DEFAULT_WCAT_PATTERN_TAG_COLOR } from '../constants';
import { McpClient } from '../services/McpClient';
import { identifyWcatCasePatterns, resetChatSession as resetGeminiChatSession, extractPolicyEntriesFromManualText } from '../services/geminiService';

console.log("AppContext.tsx: Module loaded.");

interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  files: EvidenceFile[];
  addFile: (file: Omit<EvidenceFile, 'id' | 'tags' | 'annotations' | 'mcpPath' | 'isProcessing' | 'referencedPolicies'>, mcpPath: string, originalFileNameForMcp: string, contentForMcp: string) => Promise<EvidenceFile | null >;
  updateFile: (fileId: string, updates: Partial<EvidenceFile>) => void;
  deleteFile: (fileId: string) => Promise<void>;
  getFileById: (fileId: string) => EvidenceFile | undefined;
  tags: Tag[];
  addTag: (tag: Omit<Tag, 'id'>) => Tag;
  removeTagFromFile: (fileId: string, tagId: string) => void;
  addTagToFile: (fileId: string, tag: Tag) => void;
  chatHistory: ChatMessage[];
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => ChatMessage;
  clearChatHistory: () => void;
  auditLog: AuditLogEntry[];
  addAuditLogEntry: (action: string, details: string, status?: 'info' | 'success' | 'warning' | 'error') => void;
  mcpServerStatus: McpServerStatus;
  setMcpServerStatus: (status: McpServerStatus) => void;
  mcpClient: McpClient | null;
  isMcpClientLoading: boolean;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  currentError: string | null;
  setError: (error: string | null) => void;
  apiKey: string | null;
  setApiKey: (key: string | null) => void;

  wcatCases: WcatCase[];
  addWcatCase: (caseData: Omit<WcatCase, 'id' | 'ingestedAt' | 'tags'>, fetchedPatternTags?: Tag[]) => Promise<WcatCase>;
  updateWcatCase: (caseId: string, updates: Partial<WcatCase>) => void;
  deleteWcatCase: (caseId: string) => void;
  getWcatCaseByDecisionNumber: (decisionNumber: string) => WcatCase | undefined;
  getWcatCaseById: (id: string) => WcatCase | undefined;

  policyManuals: PolicyManual[];
  addPolicyManual: (manualInfo: { manualName: string; sourceUrl?: string; version?: string }, pdfContent: string, originalFileName: string) => Promise<PolicyManual | null>;
  deletePolicyManual: (manualId: string) => Promise<void>;
  getPolicyManualById: (manualId: string) => PolicyManual | undefined;
  getPolicyEntry: (manualId: string, policyNumber: string) => PolicyEntry | undefined;

  findRelevantWcatCases: (queryText: string, associatedFile?: EvidenceFile) => Promise<WcatCase[]>;
  extractPolicyReferencesFromFile: (file: EvidenceFile) => PolicyReference[];
  generateAndAssignWcatPatternTags: (caseId: string) => Promise<void>;

  isMainSidebarCollapsed: boolean;
  toggleMainSidebar: () => void;

  savedChatSessions: SavedChatSession[];
  saveChatSession: (name: string, messagesToSave: ChatMessage[], fileIds?: string[], wcatIds?: string[], toolIds?: string[]) => void;
  loadChatSession: (sessionId: string) => SavedChatSession | null;
  deleteChatSession: (sessionId: string) => void;

  // MCP Server Configuration Management
  userMcpServerDefinitions: McpUserProvidedServers | null; // From user's mcp.json
  mcpApiConfigs: McpApiConfig[]; // Array of API connection configurations
  activeApiConfigName: string | null;
  setActiveApiConfig: (configName: string | null) => Promise<void>;
  updateMcpApiConfigs: (newConfigs: McpApiConfig[]) => void;

  // AI Tools Management
  tools: AiTool[];
  addTool: (toolData: Omit<AiTool, 'id' | 'type' | 'mcpProcessDetails'>, type?: 'custom_abstract') => AiTool; // For custom tools
  deleteTool: (toolId: string) => void; // Only custom tools
  selectedToolIdsForContext: string[];
  toggleToolContext: (toolId: string) => void;

  // Chat Context Selection
  selectedFileIdsForContext: string[];
  toggleFileContext: (fileId: string) => void;
  selectedWcatCaseIdsForContext: string[];
  toggleWcatCaseContext: (caseId: string) => void;

  // Dynamic Markers for Generative UI
  dynamicMarkers: Record<string, DynamicMarker[]>;
  setDynamicMarkersForFile: (fileId: string, markers: DynamicMarker[]) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  console.log("AppContext.tsx: AppProvider component function STARTED.");
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem('app-theme') as Theme;
    return storedTheme || Theme.Dark;
  });
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const currentErrorRef = useRef(currentError); // Ref for currentError
  useEffect(() => {
    currentErrorRef.current = currentError;
  }, [currentError]);


  const [apiKey, setApiKeyInternal] = useState<string | null>(process.env.API_KEY || null);

  const [wcatCases, setWcatCases] = useState<WcatCase[]>([]);
  const [policyManuals, setPolicyManuals] = useState<PolicyManual[]>([]);

  const [mcpClientInstance, setMcpClientInstance] = useState<McpClient | null>(null);
  const [isMcpClientLoading, setIsMcpClientLoading] = useState<boolean>(true);
  const [mcpServerStatus, setMcpServerStatus] = useState<McpServerStatus>({ isRunning: false, error: "Initializing MCP Client..." });

  const [isMainSidebarCollapsed, setIsMainSidebarCollapsed] = useState<boolean>(false);
  const [savedChatSessions, setSavedChatSessions] = useState<SavedChatSession[]>([]);

  // MCP Server Configuration State
  const [userMcpServerDefinitions, setUserMcpServerDefinitions] = useState<McpUserProvidedServers | null>(null);
  const [mcpApiConfigs, setMcpApiConfigsInternal] = useState<McpApiConfig[]>([]);
  const [activeApiConfigName, setActiveApiConfigNameInternal] = useState<string | null>(null);

  // AI Tools State
  const [tools, setTools] = useState<AiTool[]>([]);
  const [selectedToolIdsForContext, setSelectedToolIdsForContext] = useState<string[]>([]);

  // Chat Context Selection State
  const [selectedFileIdsForContext, setSelectedFileIdsForContext] = useState<string[]>([]);
  const [selectedWcatCaseIdsForContext, setSelectedWcatCaseIdsForContext] = useState<string[]>([]);

  // Dynamic Markers State
  const [dynamicMarkers, setDynamicMarkersInternal] = useState<Record<string, DynamicMarker[]>>({});


  const addAuditLogEntry = useCallback((action: string, details: string, status: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const newEntry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      action,
      details,
      status,
    };
    setAuditLog((prevLog) => [newEntry, ...prevLog.slice(0, 199)]);
  }, []);

  const localSetError = useCallback((error: string | null) => {
    setCurrentError(error);
    if (error) {
        console.error("AppContext: Application Error Set:", error);
        addAuditLogEntry('APPLICATION_ERROR_SET', error, 'error');
    }
  }, [addAuditLogEntry]);

  useEffect(() => {
    const initializeSystem = async () => {
      console.log("AppContext.tsx: initializeSystem async function STARTED.");
      setIsMcpClientLoading(true);
      localSetError(null); // Clear previous general errors

      let combinedApiConfigs: McpApiConfig[] = [];

      // 1. Fetch and process mcp.json (for stdio servers)
      try {
        addAuditLogEntry('MCP_CONFIG_LOAD_STDIO_ATTEMPT', 'Attempting to fetch mcp.json for stdio servers...');
        const responseMcpJson = await fetch('/mcp.json'); // Ensure mcp.json is in public folder
        addAuditLogEntry('MCP_CONFIG_LOAD_STDIO_FETCH_STATUS', `mcp.json fetch status: ${responseMcpJson.status}`);

        if (responseMcpJson.ok) {
          const mcpJsonData = await responseMcpJson.json();
          if (mcpJsonData && mcpJsonData.mcpServers && typeof mcpJsonData.mcpServers === 'object') {
            const parsedStdioConfigs: McpApiConfig[] = Object.entries(mcpJsonData.mcpServers)
              .map(([name, serverDef]: [string, any]) => {
                const expectedVersion = serverDef.expectedServerVersion || serverDef.expected_server_version;
                const transportTypeString = serverDef.type === 'stdio' ? 'stdio' : 'http';
                let transportTypeFinal: 'stdio' | 'http' | undefined = 'http';
                if (transportTypeString === 'stdio') {
                    transportTypeFinal = 'stdio';
                } else if (transportTypeString === 'http') {
                    transportTypeFinal = 'http';
                } else {
                    console.warn(`Unexpected transport type string: ${transportTypeString} for ${name}. Defaulting to http.`);
                    transportTypeFinal = 'http';
                }

                return {
                  configName: name,
                  transportType: transportTypeFinal,
                  stdioOptions: serverDef.type === 'stdio' ? {
                    command: serverDef.command,
                    args: serverDef.args,
                    cwd: serverDef.cwd,
                    env: serverDef.env,
                  } : undefined,
                  expectedServerVersion: expectedVersion,
                };
              })
              .filter(config => config.transportType === 'stdio');

            combinedApiConfigs = combinedApiConfigs.concat(parsedStdioConfigs);
            addAuditLogEntry('MCP_CONFIGS_LOADED_STDIO_SUCCESS', `Loaded ${parsedStdioConfigs.length} stdio configurations from mcp.json.`);
            console.log("AppContext.tsx: mcp.json loaded and processed for stdio servers.", parsedStdioConfigs);
            // Also store the raw mcp.json definitions if needed elsewhere
            setUserMcpServerDefinitions(mcpJsonData);

          } else {
            addAuditLogEntry('MCP_CONFIGS_PARSE_STDIO_WARN', `mcp.json does not contain a valid mcpServers object or is empty.`, 'warning');
            console.warn("AppContext.tsx: mcp.json does not contain a valid mcpServers object or is empty.");
          }
        } else {
          addAuditLogEntry('MCP_CONFIGS_LOAD_STDIO_FAIL', `Failed to load mcp.json: ${responseMcpJson.statusText} (status ${responseMcpJson.status})`, 'warning');
          console.warn(`AppContext.tsx: Failed to load mcp.json (status: ${responseMcpJson.status}). Ensure it's in the public folder.`);
        }
      } catch (e: any) {
        addAuditLogEntry('MCP_CONFIGS_FETCH_STDIO_ERROR', `Exception fetching or parsing mcp.json: ${e.message}`, 'error');
        console.error("AppContext.tsx: Exception fetching or parsing mcp.json:", e);
      }

      // 2. Fetch and process mcp_api_configs.json (for HTTP servers)
      //    This also serves as a fallback if localStorage for API configs isn't present or is invalid.
      let httpConfigsFromDefaultFile: McpApiConfig[] = [];
      try {
        addAuditLogEntry('MCP_CONFIG_LOAD_HTTP_ATTEMPT', 'Attempting to fetch mcp_api_configs.json for HTTP servers...');
        const responseApiConfigsJson = await fetch('/mcp_api_configs.json'); // Ensure mcp_api_configs.json is in public folder
        addAuditLogEntry('MCP_CONFIG_LOAD_HTTP_FETCH_STATUS', `mcp_api_configs.json fetch status: ${responseApiConfigsJson.status}`);

        if (responseApiConfigsJson.ok) {
          const httpConfigsData = await responseApiConfigsJson.json();
          if (Array.isArray(httpConfigsData) && httpConfigsData.every(c => c.configName)) {
            httpConfigsFromDefaultFile = httpConfigsData.map(config => ({
              ...config,
              transportType: 'http',
            }));
            addAuditLogEntry('MCP_API_CONFIGS_LOADED_HTTP_SUCCESS', `Loaded ${httpConfigsFromDefaultFile.length} HTTP configurations from mcp_api_configs.json.`);
            console.log("AppContext.tsx: mcp_api_configs.json loaded and processed for HTTP servers.", httpConfigsFromDefaultFile);
          } else {
            addAuditLogEntry('MCP_API_CONFIGS_PARSE_HTTP_WARN', `mcp_api_configs.json is not a valid array of configurations or is empty.`, 'warning');
            console.warn("AppContext.tsx: mcp_api_configs.json is not a valid array of configurations or is empty.");
          }
        } else {
          addAuditLogEntry('MCP_API_CONFIGS_LOAD_HTTP_FAIL', `Failed to load mcp_api_configs.json: ${responseApiConfigsJson.statusText} (status ${responseApiConfigsJson.status})`, 'warning');
          console.warn(`AppContext.tsx: Failed to load mcp_api_configs.json (status: ${responseApiConfigsJson.status}). Ensure it's in the public folder.`);
        }
      } catch (e: any) {
        addAuditLogEntry('MCP_API_CONFIGS_FETCH_HTTP_ERROR', `Exception fetching or parsing mcp_api_configs.json: ${e.message}`, 'error');
        console.error("AppContext.tsx: Exception fetching or parsing mcp_api_configs.json:", e);
      }

      // Combine with HTTP configs from default file
      combinedApiConfigs = combinedApiConfigs.concat(httpConfigsFromDefaultFile);

      // Attempt to load API configs from localStorage (these might include user edits if you have a settings page to manage them)
      const storedApiConfigsStr = localStorage.getItem('mcp-api-configurations');
      let configsFromLocalStorage: McpApiConfig[] = [];
      if (storedApiConfigsStr) {
        try {
          configsFromLocalStorage = JSON.parse(storedApiConfigsStr);
          addAuditLogEntry('MCP_API_CONFIGS_LOADED_LS', `Loaded ${configsFromLocalStorage.length} API configurations from localStorage.`);
           // Replace default HTTP with LS ones if they exist for HTTP, but keep stdio from mcp.json
          const stdioFromMcpDotJson = combinedApiConfigs.filter(c => c.transportType === 'stdio');
          const httpFromLS = configsFromLocalStorage.filter(c => c.transportType === 'http');
          combinedApiConfigs = [...stdioFromMcpDotJson, ...httpFromLS];

        } catch (e:any) {
          addAuditLogEntry('MCP_API_CONFIGS_PARSE_LS_ERROR', `Failed to parse API configs from localStorage: ${e.message}. Using defaults/mcp.json.`, 'warning');
          // combinedApiConfigs remains as loaded from files
        }
      }


      // Deduplicate configurations, prioritizing stdio, then localStorage HTTP, then file HTTP
      const uniqueConfigs: McpApiConfig[] = [];
      const names = new Set<string>();

      // Order of preference: stdio from mcp.json, then all from localStorage, then http from mcp_api_configs.json
      // Note: combinedApiConfigs already reflects a preference for localStorage HTTP over file HTTP if LS was valid.
      // The main goal here is to ensure stdio from mcp.json is present and that names are unique.
      const configsToDeduplicate = [
          ...combinedApiConfigs.filter(c => c.transportType === 'stdio'), // Stdio from mcp.json first
          ...combinedApiConfigs.filter(c => c.transportType === 'http')    // HTTP from LS (if loaded) or mcp_api_configs.json
      ];

      for (const config of configsToDeduplicate) {
        if (!names.has(config.configName)) {
          uniqueConfigs.push(config);
          names.add(config.configName);
        } else {
          addAuditLogEntry('MCP_CONFIG_DUPLICATE_IGNORED', `Duplicate config name "${config.configName}" (type: ${config.transportType}) ignored. Prioritized first encountered or stdio.`, 'warning');
        }
      }

      setMcpApiConfigsInternal(uniqueConfigs); // Update state with the final list of configs
      if (uniqueConfigs.length > 0) {
        addAuditLogEntry('MCP_CONFIGS_SET_SUCCESS', `Total ${uniqueConfigs.length} unique MCP configurations loaded and set.`);
        console.log("AppContext.tsx: Final unique MCP configurations set:", uniqueConfigs);
      } else {
        localSetError("No MCP server configurations found. Check mcp.json and mcp_api_configs.json in your public folder, and the console for errors.");
        addAuditLogEntry('MCP_CONFIGS_LOAD_FINAL_FAILURE', 'No MCP configurations were loaded from any source.', 'error');
        console.error("AppContext.tsx: No MCP configurations loaded from any source.");
      }

      // Determine and set active MCP configuration
      let activeConfigToSet: McpApiConfig | null = null;
      const activeConfigNameFromStorage = localStorage.getItem('mcp-active-api-config-name');
      if (activeConfigNameFromStorage) {
        activeConfigToSet = uniqueConfigs.find(c => c.configName === activeConfigNameFromStorage) || null;
      }
      if (!activeConfigToSet && uniqueConfigs.length > 0) {
        activeConfigToSet = uniqueConfigs[0]; // Default to the first one if no active or previous active not found
      }

      setActiveApiConfigNameInternal(activeConfigToSet ? activeConfigToSet.configName : null);
      if (activeConfigToSet) {
        localStorage.setItem('mcp-active-api-config-name', activeConfigToSet.configName);
        addAuditLogEntry('MCP_ACTIVE_CONFIG_DETERMINED', `Active MCP config to be used: ${activeConfigToSet.configName}`);
        console.log("AppContext.tsx: Active API config to be used:", activeConfigToSet.configName);
      } else {
        localStorage.removeItem('mcp-active-api-config-name');
        addAuditLogEntry('MCP_ACTIVE_CONFIG_NONE', 'No active MCP configuration could be set.');
        console.log("AppContext.tsx: No active API config to set.");
      }

      // Initialize McpClient instance
      const client = new McpClient(addAuditLogEntry);
      await client.initialize(activeConfigToSet); // Initialize with the determined active config
      setMcpClientInstance(client);
      addAuditLogEntry('MCP_CLIENT_INSTANCE_INITIALIZED', `McpClient instance initialized. Ready: ${client.ready}. Error: ${client.getInitializationError() || 'None'}`);
      console.log("AppContext.tsx: McpClient instance set. IsReady:", client.ready, "InitError:", client.getInitializationError());

      // Check server status if client initialized
      if (client.ready && activeConfigToSet) {
        try {
          addAuditLogEntry('MCP_STATUS_FETCH_ATTEMPT', `Fetching server status for ${activeConfigToSet.configName}...`);
          const status = await client.getServerStatus();
          setMcpServerStatus(status);
          console.log("AppContext.tsx: MCP Server status received:", status);
          if (!status.isRunning) {
            const serverName = client.getConfiguredServerName() || 'MCP Server';
            const targetDetail = activeConfigToSet.transportType === 'stdio'
              ? `command '${activeConfigToSet.stdioOptions?.command}'`
              : client.getConfiguredBaseUrl() || 'configured address';
            const errorDetail = status.error ? `: ${status.error}` : '(no specific error reported).';

            const isDefaultHttpConfig = activeConfigToSet.configName === "Default Local MCP Server" && activeConfigToSet.transportType === 'http';
            const isNetworkError = status.error && (status.error.toLowerCase().includes("failed to fetch") || status.error.toLowerCase().includes("networkerror"));

            if (isDefaultHttpConfig && isNetworkError) {
              console.warn(`AppContext.tsx: Initial check: ${serverName} at ${targetDetail} appears to be offline. Global error suppressed for default HTTP config.`);
              addAuditLogEntry('MCP_DEFAULT_HTTP_OFFLINE_STARTUP', `Initial check: ${serverName} at ${targetDetail} offline. Global error suppressed for this startup.`);
            } else {
              localSetError(`${serverName} (target: ${targetDetail}) Issue${errorDetail} File operations may fail.`);
            }
          } else {
            localSetError(null); // Clear error if server is running
          }
        } catch (e: any) {
          const errorMessage = e.message || "Unknown error during MCP status check";
          setMcpServerStatus({ isRunning: false, error: errorMessage });
          localSetError(`Failed to get MCP status for ${activeConfigToSet.configName}: ${errorMessage}. File operations may fail.`);
          console.error("AppContext.tsx: Error fetching MCP status for " + activeConfigToSet.configName + ":", e);
        }
      } else if (activeConfigToSet) { // Client not ready but there was an active config
        const initError = client.getInitializationError() || `MCP Client failed to initialize for ${activeConfigToSet.configName}.`;
        setMcpServerStatus({ isRunning: false, error: initError });
        localSetError(initError + " File operations will likely fail.");
        console.error(`AppContext.tsx: MCP Client not ready after initialize for ${activeConfigToSet.configName}. Error:`, initError);
      } else { // No active config to initialize with
         setMcpServerStatus({ isRunning: false, error: "No active MCP configuration to initialize client." });
      }

      // Load AI Tools (combining localStorage and mcp.json derived tools)
      const storedToolsStr = localStorage.getItem('app-tools');
      let toolsFromStorage: AiTool[] = [];
      if (storedToolsStr) {
        try { toolsFromStorage = JSON.parse(storedToolsStr); }
        catch (e: any) { addAuditLogEntry('APP_TOOLS_LS_PARSE_ERROR', `Failed to parse tools from localStorage: ${e.message}`, 'warning'); }
      }

      let derivedToolsFromMcpJson: AiTool[] = [];
      const currentMcpJson = userMcpServerDefinitions || (await (async () => { try { const r = await fetch('/mcp.json'); if (r.ok) return await r.json(); } catch { return null; } })());

      if (currentMcpJson && currentMcpJson.mcpServers) {
        derivedToolsFromMcpJson = Object.entries(currentMcpJson.mcpServers).map(([name, config]: [string, any]) => ({
          id: `mcp_server_tool_${name.replace(/\s+/g, '_').toLowerCase()}`,
          name: `${name} (MCP Server)`,
          description: config.description || `Represents the '${name}' MCP server process defined in mcp.json. Use to interact with its capabilities if no specific tool is listed.`,
          type: 'mcp_server_representation', // A new type to distinguish these
          usageExample: `Consider if tasks related to '${name}' are needed.`,
          isAvailable: true, // Assumed available if defined
          mcpProcessDetails: { // Storing for reference, not direct execution via chat agent
            command: config.command,
            args: config.args,
            cwd: config.cwd,
          },
        }));
      }

      // Combine and deduplicate tools
      const finalTools: AiTool[] = [];
      const toolNames = new Set<string>();
      // Priority: localStorage (user's custom tools), then mcp.json derived (server representations)
      [...toolsFromStorage, ...derivedToolsFromMcpJson].forEach(tool => {
        if (!toolNames.has(tool.name)) {
          finalTools.push(tool);
          toolNames.add(tool.name);
        }
      });
      setTools(finalTools);
      addAuditLogEntry('TOOLS_INIT_COMPLETE', `${finalTools.length} AI tools loaded/derived.`);
      console.log("AppContext.tsx: Tools initialized/loaded.", finalTools);

      setIsMcpClientLoading(false);
      addAuditLogEntry('APP_INIT_COMPLETE', 'Application initialization sequence complete.');
      console.log(
        "=========================================================\n" +
        "AppContext.tsx: initializeSystem finally block equivalent.\n" +
        `  IsMcpClientLoading: false\n` +
        `  McpClient Instance available: ${!!mcpClientInstance}\n` + // Log current state value
        `  McpClient Ready: ${mcpClientInstance?.ready}\n` +
        `  McpClient Initialization Error: ${mcpClientInstance?.getInitializationError() || 'None'}\n` +
        `  Current AppContext Error (from ref): ${currentErrorRef.current}\n` +
        "========================================================="
      );
    };

    initializeSystem();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addAuditLogEntry, localSetError]); // Keep deps minimal for this main init effect


  const updateMcpApiConfigs = useCallback((newConfigs: McpApiConfig[]) => {
    setMcpApiConfigsInternal(newConfigs);
    localStorage.setItem('mcp-api-configurations', JSON.stringify(newConfigs));
    addAuditLogEntry('MCP_API_CONFIGS_UPDATED', `${newConfigs.length} API configurations saved.`);
  }, [addAuditLogEntry]);

  const setActiveApiConfig = useCallback(async (configName: string | null) => {
    if (configName === null) {
        setActiveApiConfigNameInternal(null);
        localStorage.removeItem('mcp-active-api-config-name');
        if (mcpClientInstance) {
            await mcpClientInstance.initialize(null);
        }
        setMcpServerStatus({ isRunning: false, error: "No active API configuration." });
        addAuditLogEntry('MCP_ACTIVE_API_CONFIG_CLEARED', 'Active API config cleared.');
        localSetError(null);
        setIsMcpClientLoading(false);
        return;
    }

    const newActiveConfig = mcpApiConfigs.find(c => c.configName === configName);
    if (newActiveConfig && mcpClientInstance) {
      setActiveApiConfigNameInternal(configName);
      localStorage.setItem('mcp-active-api-config-name', configName);

      await mcpClientInstance.initialize(newActiveConfig);
      addAuditLogEntry('MCP_ACTIVE_API_CONFIG_SET', `Active API config set to: ${configName}. McpClient re-initialized.`);

      setIsMcpClientLoading(true);
      try {
        const status = await mcpClientInstance.getServerStatus();
        setMcpServerStatus(status);
        if (!status.isRunning && status.error) {
          localSetError(`MCP Server (${newActiveConfig.configName}) at ${newActiveConfig.baseApiUrl} Issue: ${status.error}.`);
        } else if (!status.isRunning) {
          localSetError(`MCP Server (${newActiveConfig.configName}) at ${newActiveConfig.baseApiUrl} is not running.`);
        } else {
          localSetError(null);
        }
      } catch (e: any) {
        const errorMsg = `Error fetching status for ${configName}: ${e.message}`;
        localSetError(errorMsg);
        setMcpServerStatus({isRunning: false, error: errorMsg});
        addAuditLogEntry('MCP_STATUS_FETCH_ERROR', errorMsg);
      } finally {
        setIsMcpClientLoading(false);
      }

    } else {
      const errorMsg = `Failed to set active API config: ${configName} not found or McpClient not available.`;
      localSetError(errorMsg);
      addAuditLogEntry('MCP_ACTIVE_API_CONFIG_ERROR', errorMsg);
       setIsMcpClientLoading(false);
    }
  }, [mcpApiConfigs, mcpClientInstance, addAuditLogEntry, localSetError]);


  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    if (theme === Theme.Dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const loadFromLocalStorage = (key: string, setter: Function, itemName: string) => {
        const savedData = localStorage.getItem(key);
        if (savedData) {
            try {
                setter(JSON.parse(savedData));
            } catch (e: any) {
                console.error(`AppContext.tsx: Error parsing ${itemName} from localStorage:`, e.message);
                addAuditLogEntry('LOCALSTORAGE_PARSE_ERROR', `Error parsing ${itemName}: ${e.message}. Data might be lost or reset.`, 'warning');
            }
        }
    };

    loadFromLocalStorage('app-files', setFiles, 'files');
    loadFromLocalStorage('app-tags', setTags, 'tags');
    loadFromLocalStorage('app-chat', setChatHistory, 'chat history');
    loadFromLocalStorage('app-audit', setAuditLog, 'audit log');
    loadFromLocalStorage('app-wcatCases', setWcatCases, 'WCAT cases');
    loadFromLocalStorage('app-policyManuals', setPolicyManuals, 'policy manuals');
    loadFromLocalStorage('app-chat-sessions', setSavedChatSessions, 'saved chat sessions');
    loadFromLocalStorage('app-selected-tool-ids', setSelectedToolIdsForContext, 'selected tool IDs');
    loadFromLocalStorage('app-selected-file-ids', setSelectedFileIdsForContext, 'selected file IDs');
    loadFromLocalStorage('app-selected-wcat-ids', setSelectedWcatCaseIdsForContext, 'selected WCAT IDs');
    loadFromLocalStorage('app-dynamic-markers', setDynamicMarkersInternal, 'dynamic markers');

    const storedSidebarState = localStorage.getItem('main-sidebar-collapsed');
    if (storedSidebarState) {
        try { setIsMainSidebarCollapsed(JSON.parse(storedSidebarState)); } catch (e: any) { console.error("AppContext.tsx: Error parsing sidebar state from localStorage:", e.message); }
    }
  }, [addAuditLogEntry, localSetError]); // Added addAuditLogEntry and localSetError as they are dependencies

  useEffect(() => { localStorage.setItem('app-files', JSON.stringify(files)); }, [files]);
  useEffect(() => { localStorage.setItem('app-tags', JSON.stringify(tags)); }, [tags]);
  useEffect(() => { localStorage.setItem('app-chat', JSON.stringify(chatHistory)); }, [chatHistory]);
  useEffect(() => { localStorage.setItem('app-audit', JSON.stringify(auditLog)); }, [auditLog]);
  useEffect(() => { localStorage.setItem('app-wcatCases', JSON.stringify(wcatCases)); }, [wcatCases]);
  useEffect(() => { localStorage.setItem('app-policyManuals', JSON.stringify(policyManuals)); }, [policyManuals]);
  useEffect(() => { localStorage.setItem('app-chat-sessions', JSON.stringify(savedChatSessions)); }, [savedChatSessions]);
  useEffect(() => {
    localStorage.setItem('main-sidebar-collapsed', JSON.stringify(isMainSidebarCollapsed));
  }, [isMainSidebarCollapsed]);
  useEffect(() => { localStorage.setItem('app-tools', JSON.stringify(tools)); }, [tools]);
  useEffect(() => { localStorage.setItem('app-selected-tool-ids', JSON.stringify(selectedToolIdsForContext)); }, [selectedToolIdsForContext]);
  useEffect(() => { localStorage.setItem('app-selected-file-ids', JSON.stringify(selectedFileIdsForContext)); }, [selectedFileIdsForContext]);
  useEffect(() => { localStorage.setItem('app-selected-wcat-ids', JSON.stringify(selectedWcatCaseIdsForContext)); }, [selectedWcatCaseIdsForContext]);
  useEffect(() => { localStorage.setItem('app-dynamic-markers', JSON.stringify(dynamicMarkers)); }, [dynamicMarkers]);


  const setApiKey = (key: string | null) => {
    setApiKeyInternal(key);
  };

  useEffect(() => {
    const apiKeyErrorMsg = "Gemini API Key is not set. Please set it in Settings or ensure the API_KEY environment variable was available at startup.";
    if (!apiKey) {
      if (!currentErrorRef.current || (currentErrorRef.current && currentErrorRef.current.includes("Gemini API Key"))) {
        localSetError(apiKeyErrorMsg);
      }
    } else {
      if (currentErrorRef.current && currentErrorRef.current === apiKeyErrorMsg) {
        localSetError(null);
      }
    }
  }, [apiKey, localSetError]);


  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => (prevTheme === Theme.Light ? Theme.Dark : Theme.Light));
  }, []);

  const toggleMainSidebar = useCallback(() => {
    setIsMainSidebarCollapsed(prev => !prev);
  }, []);

  const extractPolicyReferencesFromFile = useCallback((file: EvidenceFile): PolicyReference[] => {
    const references: PolicyReference[] = [];
    if (!file.content && !file.summary) return references;
    const textToScan = `${file.summary || ''} ${file.content || ''}`;
    const matches = textToScan.matchAll(POLICY_NUMBER_REGEX);

    for (const match of matches) {
        const policyNumber = match[1];
        if (!references.some(r => r.policyNumber === policyNumber)) {
            let foundPolicy: PolicyEntry | undefined;
            let foundManualName: string | undefined;

            for (const manual of policyManuals) {
                foundPolicy = manual.policyEntries.find(pe => pe.policyNumber === policyNumber);
                if (foundPolicy) {
                    foundManualName = manual.manualName;
                    break;
                }
            }
            references.push({
                policyNumber,
                policyTitle: foundPolicy?.title,
                manualVersion: foundManualName
            });
        }
    }
    return references;
  }, [policyManuals]);


  const addFile = useCallback(async (
      fileData: Omit<EvidenceFile, 'id' | 'tags' | 'annotations' | 'mcpPath' | 'isProcessing' | 'referencedPolicies'>,
      mcpPath: string,
      originalFileNameForMcp: string,
      contentForMcp: string
    ): Promise<EvidenceFile | null> => {
    if (!mcpClientInstance || !mcpClientInstance.ready) {
      localSetError(`MCP Client not ready (${mcpClientInstance?.getInitializationError() || 'unknown reason'}). Cannot add file to server.`);
      addAuditLogEntry('ADD_FILE_ERROR_MCP_UNREADY', `MCP Client not ready for file ${fileData.name}`);
      return null;
    }

    const successOnMcp = await mcpClientInstance.writeFile(mcpPath, contentForMcp);
    if (!successOnMcp) {
        localSetError(`Failed to write file "${originalFileNameForMcp}" to MCP path "${mcpPath}".`);
        addAuditLogEntry('ADD_FILE_ERROR_MCP_WRITE', `Failed MCP write for ${originalFileNameForMcp} to ${mcpPath}`);
        return null;
    }
    addAuditLogEntry('FILE_WRITTEN_MCP', `File "${originalFileNameForMcp}" written to MCP path "${mcpPath}".`);

    const newFile: EvidenceFile = {
      ...fileData,
      id: uuidv4(),
      tags: [],
      annotations: [],
      mcpPath,
      isProcessing: false,
      metadata: { ...fileData.metadata, createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() },
      referencedPolicies: []
    };

    const policyRefs = extractPolicyReferencesFromFile(newFile);
    newFile.referencedPolicies = policyRefs;

    setFiles((prevFiles) => [...prevFiles, newFile]);
    addAuditLogEntry('FILE_ADDED_APP', `File "${newFile.name}" added to app. Policies found: ${policyRefs.length}`);
    return newFile;
  }, [mcpClientInstance, addAuditLogEntry, extractPolicyReferencesFromFile, localSetError]);

  const updateFile = useCallback((fileId: string, updates: Partial<EvidenceFile>) => {
    setFiles((prevFiles) =>
      prevFiles.map((f) => {
        if (f.id === fileId) {
          const updatedFile = { ...f, ...updates, metadata: {...f.metadata, modifiedAt: new Date().toISOString()} };
          if (updates.content || updates.summary || updates.name) {
            updatedFile.referencedPolicies = extractPolicyReferencesFromFile(updatedFile);
            addAuditLogEntry('FILE_UPDATED_APP', `File ID "${fileId}" updated. Policies re-checked: ${updatedFile.referencedPolicies.length}. Changes: ${Object.keys(updates).join(', ')}`);
          } else {
             addAuditLogEntry('FILE_UPDATED_APP', `File ID "${fileId}" updated. Changes: ${Object.keys(updates).join(', ')}`);
          }
          return updatedFile;
        }
        return f;
      })
    );
  }, [addAuditLogEntry, extractPolicyReferencesFromFile]);

  const deleteFile = useCallback(async (fileId: string): Promise<void> => {
    const fileToDelete = files.find(f => f.id === fileId);
    if (!fileToDelete) return;

    if (mcpClientInstance && mcpClientInstance.ready && fileToDelete.mcpPath) {
        const successOnMcp = await mcpClientInstance.deleteFileOrDirectory(fileToDelete.mcpPath);
        if (!successOnMcp) {
            localSetError(`Failed to delete file "${fileToDelete.name}" from MCP path "${fileToDelete.mcpPath}". It will only be removed from the app.`);
            addAuditLogEntry('DELETE_FILE_ERROR_MCP', `MCP delete failed for ${fileToDelete.name} at ${fileToDelete.mcpPath}`);
        } else {
             addAuditLogEntry('FILE_DELETED_MCP', `File "${fileToDelete.name}" deleted from MCP path "${fileToDelete.mcpPath}".`);
        }
    } else if (fileToDelete.mcpPath) {
        localSetError(`MCP Client not ready (${mcpClientInstance?.getInitializationError() || 'unknown reason'}). File will be removed from app list only, not from server.`);
        addAuditLogEntry('DELETE_FILE_WARN_MCP_UNREADY', `MCP Client not ready for deleting ${fileToDelete.name} from ${fileToDelete.mcpPath}`);
    }

    setFiles((prevFiles) => prevFiles.filter((f) => f.id !== fileId));
    setDynamicMarkersInternal(prev => {
        const newMarkers = {...prev};
        delete newMarkers[fileId];
        return newMarkers;
    });
    addAuditLogEntry('FILE_DELETED_APP', `File "${fileToDelete.name}" (ID: ${fileId}) deleted from app.`);
  }, [files, mcpClientInstance, addAuditLogEntry, localSetError]);

  const getFileById = useCallback((fileId: string) => {
    return files.find(f => f.id === fileId);
  }, [files]);

  const addTag = useCallback((tagData: Omit<Tag, 'id'>): Tag => {
    const existingTag = tags.find(t => t.name.toLowerCase() === tagData.name.toLowerCase() && t.scope === tagData.scope && t.criteria === tagData.criteria);
    if (existingTag) return existingTag;

    const newTag: Tag = { ...tagData, id: uuidv4() };
    setTags((prevTags) => [...prevTags, newTag]);
    addAuditLogEntry('TAG_CREATED', `Tag "${newTag.name}" (Scope: ${newTag.scope || 'N/A'}) created.`);
    return newTag;
  }, [tags, addAuditLogEntry]);

  const removeTagFromFile = useCallback((fileId: string, tagId: string) => {
    setFiles(prevFiles => prevFiles.map(file => {
      if (file.id === fileId) {
        return { ...file, tags: file.tags.filter(tag => tag.id !== tagId) };
      }
      return file;
    }));
    const tagName = tags.find(t => t.id === tagId)?.name || 'Unknown Tag';
    addAuditLogEntry('TAG_REMOVED_FROM_FILE', `Tag "${tagName}" removed from file ID "${fileId}".`);
  }, [tags, addAuditLogEntry]);

  const addTagToFile = useCallback((fileId: string, tag: Tag) => {
    setFiles(prevFiles => prevFiles.map(file => {
      if (file.id === fileId && !file.tags.find(t => t.id === tag.id)) {
        return { ...file, tags: [...file.tags, tag] };
      }
      return file;
    }));
    addAuditLogEntry('TAG_ADDED_TO_FILE', `Tag "${tag.name}" added to file ID "${fileId}".`);
  }, [addAuditLogEntry]);

  const addChatMessage = useCallback((messageData: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage => {
    const newMessage: ChatMessage = {
      ...messageData,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    setChatHistory((prevHistory) => [...prevHistory, newMessage]);
    return newMessage;
  }, []);

  const clearChatHistory = useCallback(() => {
    setChatHistory([]);
    setSelectedFileIdsForContext([]);
    setSelectedWcatCaseIdsForContext([]);
    setSelectedToolIdsForContext([]);
    resetGeminiChatSession();
    addAuditLogEntry('CHAT_CLEARED', 'Chat history, AI session, and all context items cleared.');
  }, [addAuditLogEntry]);

  const getWcatCaseById = useCallback((id: string) => {
    return wcatCases.find(c => c.id === id);
  }, [wcatCases]);

  const addWcatCase = useCallback(async (caseData: Omit<WcatCase, 'id' | 'ingestedAt' | 'tags'>, fetchedPatternTags?: Tag[]): Promise<WcatCase> => {
    const newCase: WcatCase = {
      ...caseData,
      id: caseData.decisionNumber,
      ingestedAt: new Date().toISOString(),
      tags: fetchedPatternTags || [],
    };
    setWcatCases((prevCases) => {
      const existingIndex = prevCases.findIndex(c => c.decisionNumber === newCase.decisionNumber);
      if (existingIndex !== -1) {
        addAuditLogEntry('WCAT_CASE_UPDATED_ON_ADD', `WCAT Case "${newCase.decisionNumber}" updated as it already existed.`);
        const updatedCases = [...prevCases];
        updatedCases[existingIndex] = { ...prevCases[existingIndex], ...newCase };
        return updatedCases;
      }
      addAuditLogEntry('WCAT_CASE_ADDED', `WCAT Case "${newCase.decisionNumber}" added to database. MCP Path: ${newCase.mcpPath || 'N/A'}`);
      return [...prevCases, newCase];
    });
    return newCase;
  }, [addAuditLogEntry]);

  const updateWcatCase = useCallback((caseId: string, updates: Partial<WcatCase>) => {
    setWcatCases((prevCases) =>
      prevCases.map((c) => (c.id === caseId ? { ...c, ...updates } : c))
    );
    addAuditLogEntry('WCAT_CASE_UPDATED', `WCAT Case ID "${caseId}" updated. Changes: ${Object.keys(updates).join(', ')}`);
  }, [addAuditLogEntry]);

  const deleteWcatCase = useCallback(async (caseId: string): Promise<void> => {
    const caseToDelete = wcatCases.find(c => c.id === caseId);
    if (!caseToDelete) return;

    if (mcpClientInstance && mcpClientInstance.ready && caseToDelete.mcpPath) {
        const successOnMcp = await mcpClientInstance.deleteFileOrDirectory(caseToDelete.mcpPath);
        if (!successOnMcp) {
            localSetError(`Failed to delete WCAT case file "${caseToDelete.decisionNumber}" from MCP path "${caseToDelete.mcpPath}". It will only be removed from the app database.`);
            addAuditLogEntry('DELETE_WCAT_FILE_ERROR_MCP', `MCP delete failed for WCAT ${caseToDelete.decisionNumber} at ${caseToDelete.mcpPath}`);
        } else {
             addAuditLogEntry('WCAT_FILE_DELETED_MCP', `WCAT case file "${caseToDelete.decisionNumber}" deleted from MCP path "${caseToDelete.mcpPath}".`);
        }
    } else if (caseToDelete.mcpPath) {
        localSetError(`MCP Client not ready for WCAT file deletion. File will be removed from app list only, not from server.`);
        addAuditLogEntry('DELETE_WCAT_FILE_WARN_MCP_UNREADY', `MCP Client not ready for deleting WCAT ${caseToDelete.decisionNumber} from ${caseToDelete.mcpPath}`);
    }

    setWcatCases((prevCases) => prevCases.filter((c) => c.id !== caseId));
    addAuditLogEntry('WCAT_CASE_DELETED_APP', `WCAT Case "${caseToDelete.decisionNumber}" (ID: ${caseId}) deleted from app.`);
  }, [wcatCases, mcpClientInstance, addAuditLogEntry, localSetError]);

  const generateAndAssignWcatPatternTags = useCallback(async (caseId: string): Promise<void> => {
    if (!apiKey) {
      localSetError("Cannot generate WCAT patterns: Gemini API Key is not set.");
      return;
    }
    const targetCase = wcatCases.find(c => c.id === caseId);
    if (!targetCase || !targetCase.rawTextContent) {
      localSetError(`Cannot generate WCAT patterns: Case ${caseId} not found or has no raw text content.`);
      return;
    }

    setIsLoading(true);
    try {
      addAuditLogEntry('WCAT_PATTERN_GEN_START', `Starting pattern generation for WCAT case ${targetCase.decisionNumber}`);
      const patternStrings = await identifyWcatCasePatterns(targetCase.rawTextContent);
      const patternTags: Tag[] = [];
      for (const pStr of patternStrings) {
        const tag = addTag({ name: pStr, color: DEFAULT_WCAT_PATTERN_TAG_COLOR, criteria: 'wcat_pattern_generic', scope: 'wcat_pattern' });
        patternTags.push(tag);
      }
      updateWcatCase(caseId, { tags: [...(targetCase.tags || []), ...patternTags].filter((t, i, self) => self.findIndex(s => s.id === t.id) === i) });
      addAuditLogEntry('WCAT_PATTERN_GEN_SUCCESS', `Patterns generated for ${targetCase.decisionNumber}: ${patternStrings.join(', ')}`);
    } catch (error: any) {
      localSetError(`Failed to generate WCAT patterns for ${targetCase.decisionNumber}: ${error.message}`);
      addAuditLogEntry('WCAT_PATTERN_GEN_ERROR', `Error for ${targetCase.decisionNumber}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [wcatCases, apiKey, addTag, updateWcatCase, localSetError, setIsLoading, addAuditLogEntry]);


  const getWcatCaseByDecisionNumber = useCallback((decisionNumber: string) => {
    return wcatCases.find(c => c.decisionNumber === decisionNumber);
  }, [wcatCases]);

  const addPolicyManual = useCallback(async (
      manualInfo: { manualName: string; sourceUrl?: string; version?: string },
      pdfContentString: string,
      originalFileName: string
    ): Promise<PolicyManual | null> => {
    if (!mcpClientInstance || !mcpClientInstance.ready) {
        localSetError("MCP Client not ready. Cannot add policy manual.");
        addAuditLogEntry('ADD_POLICY_MANUAL_ERROR_MCP_UNREADY', `MCP Client not ready for manual ${manualInfo.manualName}`);
        return null;
    }
     if (!apiKey) {
      localSetError("Gemini API Key not set. Cannot process policy manual for indexing.");
      addAuditLogEntry('ADD_POLICY_MANUAL_ERROR_NO_API_KEY', `API Key missing for manual ${manualInfo.manualName}`);
      return null;
    }

    const manualId = uuidv4();
    const mcpPath = `/policy_manuals/${manualId}_${originalFileName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;

    const mcpSuccess = await mcpClientInstance.writeFile(mcpPath, pdfContentString);
    if (!mcpSuccess) {
        localSetError(`Failed to write policy manual "${manualInfo.manualName}" to MCP path "${mcpPath}".`);
        addAuditLogEntry('ADD_POLICY_MANUAL_ERROR_MCP_WRITE', `Failed MCP write for ${manualInfo.manualName} to ${mcpPath}`);
        return null;
    }
    addAuditLogEntry('POLICY_MANUAL_WRITTEN_MCP', `Manual "${manualInfo.manualName}" written to MCP path "${mcpPath}".`);

    const rawTextContent = pdfContentString;

    setIsLoading(true);
    let policyEntries: PolicyEntry[] = [];
    try {
        addAuditLogEntry('POLICY_MANUAL_INDEXING_START', `AI indexing started for manual ${manualInfo.manualName}`);
        policyEntries = await extractPolicyEntriesFromManualText(rawTextContent, manualInfo.manualName);
        addAuditLogEntry('POLICY_MANUAL_INDEXING_SUCCESS', `AI indexing complete for ${manualInfo.manualName}. Found ${policyEntries.length} entries.`);
    } catch(error: any) {
        localSetError(`AI failed to index policy manual ${manualInfo.manualName}: ${error.message}`);
        addAuditLogEntry('POLICY_MANUAL_INDEXING_ERROR', `AI indexing error for ${manualInfo.manualName}: ${error.message}`);
    } finally {
        setIsLoading(false);
    }

    const newManual: PolicyManual = {
      id: manualId,
      manualName: manualInfo.manualName,
      sourceUrl: manualInfo.sourceUrl,
      version: manualInfo.version,
      mcpPath,
      rawTextContent,
      policyEntries,
      ingestedAt: new Date().toISOString(),
      isProcessing: false,
    };

    setPolicyManuals(prevManuals => [...prevManuals, newManual]);
    addAuditLogEntry('POLICY_MANUAL_ADDED_APP', `Policy Manual "${newManual.manualName}" added to app.`);
    return newManual;
  }, [mcpClientInstance, apiKey, addAuditLogEntry, localSetError, setIsLoading]);

  const deletePolicyManual = useCallback(async (manualId: string): Promise<void> => {
    const manualToDelete = policyManuals.find(m => m.id === manualId);
    if (!manualToDelete) return;

    if (mcpClientInstance && mcpClientInstance.ready && manualToDelete.mcpPath) {
        const successOnMcp = await mcpClientInstance.deleteFileOrDirectory(manualToDelete.mcpPath);
        if (!successOnMcp) {
            localSetError(`Failed to delete policy manual "${manualToDelete.manualName}" from MCP. It will only be removed from app.`);
            addAuditLogEntry('DELETE_POLICY_MANUAL_ERROR_MCP', `MCP delete failed for ${manualToDelete.manualName}`);
        } else {
             addAuditLogEntry('POLICY_MANUAL_DELETED_MCP', `Manual "${manualToDelete.manualName}" deleted from MCP.`);
        }
    } else if (manualToDelete.mcpPath) {
        localSetError(`MCP Client not ready for policy manual deletion. File will be removed from app list only.`);
        addAuditLogEntry('DELETE_POLICY_MANUAL_WARN_MCP_UNREADY', `MCP Client not ready for deleting ${manualToDelete.manualName}`);
    }
    setPolicyManuals(prevManuals => prevManuals.filter(m => m.id !== manualId));
    addAuditLogEntry('POLICY_MANUAL_DELETED_APP', `Policy Manual "${manualToDelete.manualName}" deleted from app.`);
  }, [policyManuals, mcpClientInstance, addAuditLogEntry, localSetError]);

  const getPolicyManualById = useCallback((manualId: string) => {
    return policyManuals.find(m => m.id === manualId);
  }, [policyManuals]);

  const getPolicyEntry = useCallback((manualId: string, policyNumber: string): PolicyEntry | undefined => {
    const manual = policyManuals.find(m => m.id === manualId);
    return manual?.policyEntries.find(pe => pe.policyNumber === policyNumber);
  }, [policyManuals]);

  const findRelevantWcatCases = useCallback(async (queryText: string, associatedFile?: EvidenceFile): Promise<WcatCase[]> => {
    const queryLower = queryText.toLowerCase();
    const queryKeywords = queryLower.split(/\s+/).filter(kw => kw.length > 2);

    let fileKeywords: string[] = [];
    let filePolicyNumbers: string[] = [];

    if (associatedFile) {
        if (associatedFile.summary) {
            fileKeywords.push(...associatedFile.summary.toLowerCase().split(/\s+/).filter(kw => kw.length > 2));
        }
        if (associatedFile.referencedPolicies) {
            filePolicyNumbers.push(...associatedFile.referencedPolicies.map(p => p.policyNumber));
        }
    }
    const allSearchKeywords = [...new Set([...queryKeywords, ...fileKeywords])];

    const scoredCases = wcatCases.map(wcase => {
        let score = 0;
        const caseText = `${wcase.aiSummary.toLowerCase()} ${wcase.keywords.join(' ').toLowerCase()} ${wcase.outcomeSummary.toLowerCase()} ${wcase.tags.map(t => t.name).join(' ').toLowerCase()}`;

        allSearchKeywords.forEach(kw => {
            if (caseText.includes(kw)) score += 1;
        });

        wcase.referencedPolicies.forEach(pol => {
            if (filePolicyNumbers.includes(pol.policyNumber)) score += 5;
            if (queryLower.includes(pol.policyNumber.toLowerCase())) score += 3;
        });

        wcase.tags.forEach(tag => {
            if (tag.scope === 'wcat_pattern' && queryLower.includes(tag.name.toLowerCase())) {
                score += 2;
            }
        });

        return { wcase, score };
    });

    return scoredCases.filter(item => item.score > 0)
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 10)
                      .map(item => item.wcase);
  }, [wcatCases]);

  const saveChatSession = useCallback((name: string, messagesToSave: ChatMessage[], fileIds?: string[], wcatIds?: string[], toolIds?: string[]) => {
    const newSession: SavedChatSession = {
        id: uuidv4(),
        name,
        timestamp: new Date().toISOString(),
        messages: messagesToSave,
        relatedFileIds: fileIds,
        relatedWcatCaseIds: wcatIds,
        relatedToolIds: toolIds,
    };
    setSavedChatSessions(prev => [newSession, ...prev]);
    addAuditLogEntry('CHAT_SESSION_SAVED', `Session "${name}" saved with ${messagesToSave.length} messages.`);
  }, [addAuditLogEntry]);

  const loadChatSession = useCallback((sessionId: string): SavedChatSession | null => {
    const sessionToLoad = savedChatSessions.find(s => s.id === sessionId);
    if (sessionToLoad) {
        setChatHistory(sessionToLoad.messages);
        setSelectedFileIdsForContext(sessionToLoad.relatedFileIds || []);
        setSelectedWcatCaseIdsForContext(sessionToLoad.relatedWcatCaseIds || []);
        setSelectedToolIdsForContext(sessionToLoad.relatedToolIds || []);
        resetGeminiChatSession();
        addAuditLogEntry('CHAT_SESSION_LOADED', `Session "${sessionToLoad.name}" loaded.`);
        return sessionToLoad;
    }
    addAuditLogEntry('CHAT_SESSION_LOAD_FAILED', `Session ID "${sessionId}" not found.`);
    return null;
  }, [savedChatSessions, addAuditLogEntry]);

  const deleteChatSession = useCallback((sessionId: string) => {
    const sessionToDelete = savedChatSessions.find(s => s.id === sessionId);
    if (sessionToDelete) {
        setSavedChatSessions(prev => prev.filter(s => s.id !== sessionId));
        addAuditLogEntry('CHAT_SESSION_DELETED', `Session "${sessionToDelete.name}" (ID: ${sessionId}) deleted.`);
    }
  }, [savedChatSessions, addAuditLogEntry]);

  // AI Tool functions
  const addTool = useCallback((toolData: Omit<AiTool, 'id' | 'type' | 'mcpProcessDetails'>, type: 'custom_abstract' = 'custom_abstract'): AiTool => {
    const newTool: AiTool = {
        ...toolData,
        id: uuidv4(),
        type: type,
    };
    setTools(prevTools => [...prevTools, newTool]);
    addAuditLogEntry('AI_TOOL_ADDED', `Custom tool "${newTool.name}" added.`);
    return newTool;
  }, [addAuditLogEntry]);

  const deleteTool = useCallback((toolId: string) => {
    setTools(prevTools => {
        const toolToDelete = prevTools.find(t => t.id === toolId);
        if (toolToDelete && toolToDelete.type === 'custom_abstract') {
            addAuditLogEntry('AI_TOOL_DELETED', `Custom tool "${toolToDelete.name}" deleted.`);
            return prevTools.filter(t => t.id !== toolId);
        }
        addAuditLogEntry('AI_TOOL_DELETE_FAILED', `Failed to delete tool ID ${toolId} (not found or not custom).`);
        return prevTools;
    });
    setSelectedToolIdsForContext(prev => prev.filter(id => id !== toolId));
  }, [addAuditLogEntry]);

  const toggleToolContext = useCallback((toolId: string) => {
    setSelectedToolIdsForContext(prev =>
        prev.includes(toolId) ? prev.filter(id => id !== toolId) : [...prev, toolId]
    );
    const toolName = tools.find(t => t.id === toolId)?.name || toolId;
    addAuditLogEntry('AI_TOOL_CONTEXT_TOGGLED', `Tool "${toolName}" context toggled.`);
  }, [tools, addAuditLogEntry]);

  // Chat Context Selection Functions
  const toggleFileContext = useCallback((fileId: string) => {
    setSelectedFileIdsForContext(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
    const fileName = files.find(f => f.id === fileId)?.name || fileId;
    addAuditLogEntry('AI_FILE_CONTEXT_TOGGLED', `File "${fileName}" context toggled.`);
  }, [files, addAuditLogEntry]);

  const toggleWcatCaseContext = useCallback((caseId: string) => {
    setSelectedWcatCaseIdsForContext(prev =>
      prev.includes(caseId) ? prev.filter(id => id !== caseId) : [...prev, caseId]
    );
    const caseName = wcatCases.find(c => c.id === caseId)?.decisionNumber || caseId;
    addAuditLogEntry('AI_WCAT_CONTEXT_TOGGLED', `WCAT Case "${caseName}" context toggled.`);
  }, [wcatCases, addAuditLogEntry]);

  const setDynamicMarkersForFile = useCallback((fileId: string, markers: DynamicMarker[]) => {
    setDynamicMarkersInternal(prev => ({ ...prev, [fileId]: markers }));
    addAuditLogEntry('DYNAMIC_MARKERS_SET', `Dynamic markers updated for file ID ${fileId}. Count: ${markers.length}.`);
  }, [addAuditLogEntry]);

  console.log("AppContext.tsx: AppProvider component function ENDING. Rendering children.");
  return (
    <AppContext.Provider value={{
      theme, toggleTheme,
      files, addFile, updateFile, deleteFile, getFileById,
      tags, addTag, removeTagFromFile, addTagToFile,
      chatHistory, addChatMessage, clearChatHistory,
      auditLog, addAuditLogEntry,
      mcpServerStatus, setMcpServerStatus, mcpClient: mcpClientInstance, isMcpClientLoading,
      isLoading, setIsLoading,
      currentError, setError: localSetError,
      apiKey, setApiKey,
      wcatCases, addWcatCase, updateWcatCase, deleteWcatCase, getWcatCaseByDecisionNumber, getWcatCaseById,
      policyManuals, addPolicyManual, deletePolicyManual, getPolicyManualById, getPolicyEntry,
      findRelevantWcatCases, extractPolicyReferencesFromFile,
      generateAndAssignWcatPatternTags,
      isMainSidebarCollapsed, toggleMainSidebar,
      savedChatSessions, saveChatSession, loadChatSession, deleteChatSession,
      userMcpServerDefinitions, mcpApiConfigs, activeApiConfigName, setActiveApiConfig, updateMcpApiConfigs,
      tools, addTool, deleteTool, selectedToolIdsForContext, toggleToolContext,
      selectedFileIdsForContext, toggleFileContext,
      selectedWcatCaseIdsForContext, toggleWcatCaseContext,
      dynamicMarkers, setDynamicMarkersForFile
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
