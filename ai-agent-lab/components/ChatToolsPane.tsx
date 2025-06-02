
import React from 'react';
import { McpServer, McpTool } from '../types';
import ToolIcon from './icons/ToolIcon'; 
// import { ACCENT_COLOR } from '../constants'; // ACCENT_COLOR not directly used

interface ChatToolsPaneProps {
  mcpServers: McpServer[]; // Expects already connected servers
  onToolSelect: (serverName: string, toolName: string) => void;
  currentTheme: 'dark' | 'light'; // Still useful for conditional logic if any remains beyond CSS vars
}

const ChatToolsPane: React.FC<ChatToolsPaneProps> = ({
  mcpServers,
  onToolSelect,
  // currentTheme, // May not be needed if all styling is via CSS vars
}) => {
  const activeServersWithTools = mcpServers.filter(s => s.status === 'connected' && s.tools && s.tools.length > 0);

  if (activeServersWithTools.length === 0) {
    return (
      <div className={`p-3 text-xs text-[var(--text-subtle)]`}>
        No connected MCP servers with available tools. Connect servers on the 'Tools' page.
      </div>
    );
  }

  return (
    <div className={`h-full overflow-y-auto p-2 space-y-3 bg-[var(--panel-background-alt)]`}>
      <h3 className={`text-sm font-semibold sticky top-0 py-2 px-1 z-10 
        bg-[var(--panel-background-alt)] text-[var(--panel-text-primary)]
        border-b border-[var(--border-secondary)] mb-2`}>
        Available MCP Tools
      </h3>
      {activeServersWithTools.map((server) => (
        <div key={server.id} className="mb-3">
          <h4 className={`text-xs font-medium uppercase tracking-wider px-1 mb-1 text-[var(--accent-text)]`}>
            {server.name}
          </h4>
          <ul className="space-y-1">
            {server.tools.map((tool: McpTool) => (
              <li key={tool.name}>
                <button
                  onClick={() => onToolSelect(server.name, tool.name)}
                  title={tool.description || tool.name}
                  className={`w-full text-left text-xs p-1.5 rounded-md flex items-center space-x-2 transition-colors
                              text-[var(--panel-text-primary)] dark:text-[var(--text-secondary)] hover:bg-[var(--button-ghost-alt-hover-bg)]`}
                  aria-label={`Select tool ${tool.name} from server ${server.name}`}
                >
                  <ToolIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate" title={tool.name}>{tool.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default ChatToolsPane;