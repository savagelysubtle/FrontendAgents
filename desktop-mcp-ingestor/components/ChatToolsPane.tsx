
import React, { useMemo } from 'react';
import { Icons } from '../constants';
import { AgentToolDefinition } from '../types'; // Using AgentToolDefinition

interface ChatToolsPaneProps {
  availableAgentTools: AgentToolDefinition[]; // Tools from the backend agent
  toolStates: Record<string, boolean>;
  onToolSelect: (toolName: string) => void; 
  currentTheme: 'dark' | 'light';
}

const ChatToolsPane: React.FC<ChatToolsPaneProps> = ({ 
  availableAgentTools, 
  toolStates, 
  onToolSelect, 
  currentTheme 
}) => {

  const enabledTools = useMemo(() => {
    return availableAgentTools.filter(tool => toolStates[tool.name]);
  }, [availableAgentTools, toolStates]);


  if (enabledTools.length === 0) {
    return <div className={`p-2 text-xs ${currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>No tools enabled or available from agent.</div>;
  }

  return (
    <div className={`p-2 space-y-1 h-full overflow-y-auto ${currentTheme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-200 border-gray-300'}`}>
      <h4 className={`text-xs font-semibold mb-2 sticky top-0 py-1 ${currentTheme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'}`}>Enabled Agent Tools:</h4>
      {enabledTools.map(tool => (
        <button
          key={tool.name}
          onClick={() => onToolSelect(tool.name)}
          title={tool.description || tool.name}
          className={`w-full text-left text-xs p-1.5 rounded flex items-center space-x-2
                      ${currentTheme === 'dark' ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-300 text-gray-700'}`}
        >
          <span className="flex-shrink-0 w-4 h-4">{Icons.tools}</span>
          <span className="truncate">{tool.name}</span>
        </button>
      ))}
    </div>
  );
};

export default ChatToolsPane;
