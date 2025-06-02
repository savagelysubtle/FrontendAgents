
import { AppSettings, McpLoggingLevel } from "./types";

export const LOCAL_STORAGE_KEYS = {
  AGENTS: 'aiAgentLab_agents',
  TOOLS: 'aiAgentLab_tools', // This will now store McpServer[] instead of LegacyTool[]
  SETTINGS: 'aiAgentLab_settings',
  CHAT_HISTORY: 'aiAgentLab_chatHistory',
  MCP_SERVERS: 'aiAgentLab_mcpServers', // Explicit key for MCP Servers
};

export const GEMINI_TEXT_MODEL = 'gemini-2.5-flash-preview-04-17';
export const GEMINI_PRO_TEXT_MODEL_EXPERIMENTAL = 'gemini-2.5-pro-preview-04-17'; // Added experimental Pro model
export const GEMINI_IMAGE_MODEL = 'imagen-3.0-generate-002'; // Not used in this app, but for reference

export const AVAILABLE_ASSISTANT_MODELS = [
  GEMINI_TEXT_MODEL,
  GEMINI_PRO_TEXT_MODEL_EXPERIMENTAL, // Added to the list
  // To experiment with other models, you can add their valid IDs here.
  // Ensure they are compatible text generation models.
  // e.g., if other specific versions become recommended by Google for this use case.
];

export const DEFAULT_ASSISTANT_SYSTEM_PROMPT = "You are a helpful AI assistant for the AI Agent Lab. You can help users understand agents, tools, and provide guidance. You can also engage in general conversation. If a user provides an MCP server configuration JSON and asks for help, guide them to ensure it has a root 'mcpServers' object, and each server entry has a 'command' (for stdio type) or 'url' (for sse type).";

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system' as 'light' | 'dark' | 'system',
  telemetryEnabled: false,
  integrations: {
    googleCloud: false,
    github: false,
  },
  mcpClientCapabilities: { 
    roots: false,
    sampling: false,
    loggingLevel: undefined, 
  },
  assistantModel: GEMINI_TEXT_MODEL, // Default to the primary recommended model
  assistantTemperature: 0.7,
  assistantSystemPrompt: DEFAULT_ASSISTANT_SYSTEM_PROMPT,
  assistantTopK: undefined, // Using undefined means let the API use its default
  assistantTopP: undefined, // Using undefined means let the API use its default
  assistantEnableThinking: true, // Default to true for Flash model as it's generally better.
};

export const APP_VERSION = '1.0.0';
export const ACCENT_COLOR = 'green'; // e.g. text-green-600, bg-green-600
export const SESSION_STORAGE_KEYS = {
  ASSISTANT_INIT_CONTEXT: 'aiAgentLab_assistantInitContext',
};