
export enum MessageSender {
  USER = 'user',
  AGENT = 'agent',
  SYSTEM = 'system'
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: Date;
  isLoading?: boolean;
  isCommandResponse?: boolean; 
  toolCallId?: string; // For tracking tool call messages
  toolName?: string; // For displaying tool name in UI
}

// --- AG-UI Related Types ---
export enum AguiEventType {
  // Standard AG-UI event types (subset based on prompt)
  TEXT_MESSAGE_START = "TEXT_MESSAGE_START",
  TEXT_MESSAGE_CONTENT = "TEXT_MESSAGE_CONTENT",
  TEXT_MESSAGE_END = "TEXT_MESSAGE_END",
  TOOL_CALL_START = "TOOL_CALL_START", // Backend intends to call a tool
  TOOL_CALL_ARGS = "TOOL_CALL_ARGS", // Arguments for the tool call
  TOOL_CALL_END = "TOOL_CALL_END", // Tool call finished, result might follow as text
  STATE_SNAPSHOT = "STATE_SNAPSHOT", // For general state, e.g., available tools
  ERROR = "ERROR",
  // Custom event types for this application
  SET_TOOL_PREFERENCE = "setToolPreference", // Frontend to Backend
  AVAILABLE_TOOLS_UPDATE = "availableToolsUpdate" // Backend to Frontend (alternative to STATE_SNAPSHOT for tools)
}

export interface AgentEventValueText {
  text: string;
}
export interface AgentEventValueToolCall {
  toolCallId: string;
  toolName: string;
  toolArgs?: string; // JSON string of arguments
}
export interface AgentEventValueState {
  // Define structure for state snapshot, e.g., for available tools
  availableTools?: AgentToolDefinition[];
  // other state parts
}
export interface AgentEventValueCustom {
  name: string; // e.g., "setToolPreference"
  data: any; // e.g., { toolName: string, enabled: boolean }
}

export interface AgentEvent {
  type: AguiEventType;
  messageId?: string; // Correlates parts of a single message stream
  value?: AgentEventValueText | AgentEventValueToolCall | AgentEventValueState | AgentEventValueCustom | string; // string for simple error
}
// --- End AG-UI Related Types ---


export interface McpParameterConfig {
  type: string; 
  description: string;
  required?: boolean;
}

// This now represents the definition received from the backend agent
export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, McpParameterConfig>; // Argument schema
  // command, args, cwd, env are now backend concerns
}

// McpJsonParsed and McpServerToolConfig might still be useful if mcpJsonContent
// in settings is used to configure the backend agent itself, but not directly for frontend tool discovery.
export interface McpServerToolConfigForSettings { // Renamed to avoid confusion
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  description?: string; 
  parameters?: Record<string, McpParameterConfig>;
}
export interface McpJsonParsedForSettings { // Renamed
  mcpServers?: Record<string, McpServerToolConfigForSettings>;
}


export interface MCPConfig {
  workspaceName: string; 
  maxFileSizeMB: number;
  ignoreGlobs: string[]; 
  theme: 'dark' | 'light';
  agentUrl: string; // New: URL for the backend AG-UI agent
  mcpJsonContent: string; // For displaying/editing raw JSON that might configure the backend agent
  toolStates: Record<string, boolean>; // User's preferences for enabling/disabling tools
}

export interface IngestedFile {
  id: string;
  name: string;
  path: string; 
  type: string; 
  size: number; 
  contentPreview?: string; 
}

export interface IngestedFolder {
  id: string;
  name: string;
  path: string; 
  files: IngestedFile[];
  folders: IngestedFolder[];
}

export interface IngestedData {
  rootName: string;
  fileTree: IngestedFolder; 
  summaryText: string; // This might become less relevant if backend summarizes
  totalFiles: number;
  totalSizeMB: number;
  timestamp: Date;
}

export type Page = 'settings' | 'fileManager' | 'chat' | 'tools';


declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    directory?: string;
    webkitdirectory?: string;
  }
}