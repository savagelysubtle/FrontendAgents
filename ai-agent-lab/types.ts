
export interface Agent {
  id: string;
  name: string;
  description: string;
  url: string; // URL to agent.json
  isEnabled: boolean;
  version?: string;
  author?: string;
  capabilities?: string[];
  lastRefreshed?: string;
  status?: 'online' | 'offline' | 'error' | 'loading';
  metadata?: Record<string, any>; 
}

/** @deprecated Prefer McpServer and its associated McpTool for live server interactions. */
export interface LegacyTool {
  id: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  isEnabled: boolean;
  mcpData: Record<string, any>; 
  lastRefreshed?: string; 
  status?: 'active' | 'inactive' | 'error' | 'loading';
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  telemetryEnabled: boolean;
  integrations: {
    googleCloud: boolean;
    github: boolean;
  };
  mcpClientCapabilities: ClientCapabilitiesConfig; 
  // Assistant Specific Settings
  assistantModel: string;
  assistantTemperature: number; // 0.0 to 1.0 (or higher for some models)
  assistantSystemPrompt: string;
  assistantTopK?: number;
  assistantTopP?: number;
  assistantEnableThinking?: boolean; // Specific to Flash model
}

export enum MessageSender {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: number;
  data?: Record<string, any>; 
  isLoading?: boolean;
  isCommandResponse?: boolean; // Optional: To style command responses differently
}

export interface DocumentationContent {
  title: string;
  installGuide?: string[];
  usage?: { command: string; description: string }[];
  faq?: { question: string; answer: string }[];
  improvementSuggestions?: string[];
}

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed',
    platform: string
  }>;
  prompt(): Promise<void>;
}

// --- MCP (Model Context Protocol) Types ---

export interface ClientCapabilitiesConfig {
  roots: boolean;
  sampling: boolean;
  loggingLevel?: McpLoggingLevel;
}

export enum McpLoggingLevel {
  DEBUG = 0,
  INFO = 1,
  NOTICE = 2,
  WARNING = 3,
  ERROR = 4,
  CRITICAL = 5,
  ALERT = 6,
  EMERGENCY = 7
}

export interface StdioConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface McpServer {
  id: string;
  name: string; // User-defined alias, typically from JSON key
  configType: 'stdio' | 'sse';
  stdioConfig?: StdioConfig; // For stdio type servers
  url?: string; // For sse type servers
  
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  clientCapabilities: ClientCapabilitiesConfig;
  serverReportedCapabilities?: Record<string, any>; 
  lastError?: string;
  tools: McpTool[];
  resources: McpResource[];
  prompts: McpPrompt[];
}

export interface McpTool {
  name: string; 
  description?: string;
  inputSchema?: Record<string, { type: string; description?: string; required?: boolean }>;
}

export interface McpResource {
  name: string;
  description?: string;
  uriTemplate?: string; 
  paramsSchema?: Record<string, { type: string; description?: string; required?: boolean }>; 
}

export interface McpPrompt {
  name: string;
  description?: string;
  paramsSchema?: Record<string, { type: string; description?: string; required?: boolean }>;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any[] | object;
  id: string | number;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

// Type for the root JSON structure the user will input
export interface McpServersJsonFormat {
  mcpServers: {
    [serverName: string]: {
      type?: 'stdio' | 'sse'; // if type is missing, assume stdio if command is present
      command?: string; // Required if stdio
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      url?: string; // Required if sse
      // Allow other properties for future extensibility or custom needs
      [key: string]: any; 
    };
  };
}

// Added from user's example for potential future use or if other components expect it.
// For the MCP tools pane, we'll primarily use McpTool.
export interface AgentToolDefinition {
  name: string;
  description?: string;
  // Add other properties if needed based on how AgentToolDefinition is used elsewhere
}
