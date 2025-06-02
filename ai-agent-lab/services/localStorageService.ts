
import { Agent, LegacyTool, AppSettings, ChatMessage, McpServer } from '../types';
import { LOCAL_STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants';

function getItem<T,>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error getting item ${key} from localStorage`, error);
    return defaultValue;
  }
}

function setItem<T,>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting item ${key} in localStorage`, error);
  }
}

export const localStorageService = {
  getAgents: (): Agent[] => getItem<Agent[]>(LOCAL_STORAGE_KEYS.AGENTS, []),
  setAgents: (agents: Agent[]): void => setItem<Agent[]>(LOCAL_STORAGE_KEYS.AGENTS, agents),

  /** @deprecated Legacy tools are file-based. Use McpServers for live interactions. */
  getLegacyTools: (): LegacyTool[] => getItem<LegacyTool[]>(LOCAL_STORAGE_KEYS.TOOLS, []),
  /** @deprecated Legacy tools are file-based. Use McpServers for live interactions. */
  setLegacyTools: (tools: LegacyTool[]): void => setItem<LegacyTool[]>(LOCAL_STORAGE_KEYS.TOOLS, tools),

  getMcpServers: (): McpServer[] => getItem<McpServer[]>(LOCAL_STORAGE_KEYS.MCP_SERVERS, []),
  setMcpServers: (servers: McpServer[]): void => setItem<McpServer[]>(LOCAL_STORAGE_KEYS.MCP_SERVERS, servers),

  getSettings: (): AppSettings => getItem<AppSettings>(LOCAL_STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS),
  setSettings: (settings: AppSettings): void => setItem<AppSettings>(LOCAL_STORAGE_KEYS.SETTINGS, settings),
  
  getChatHistory: (): ChatMessage[] => getItem<ChatMessage[]>(LOCAL_STORAGE_KEYS.CHAT_HISTORY, []),
  setChatHistory: (messages: ChatMessage[]): void => setItem<ChatMessage[]>(LOCAL_STORAGE_KEYS.CHAT_HISTORY, messages),
};
