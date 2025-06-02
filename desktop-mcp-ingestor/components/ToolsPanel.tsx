
import React from 'react';
import { Page, AgentToolDefinition } from '../types'; 
import { Icons } from '../constants';

interface ToolsPanelProps {
  availableAgentTools: AgentToolDefinition[]; // Tools provided by the backend agent
  toolStates: Record<string, boolean>; // User's enable/disable preferences
  onToggleToolState: (toolName: string) => void;
  currentTheme: 'dark' | 'light';
  onNavigate: (page: Page) => void; 
}

const ToolsPanel: React.FC<ToolsPanelProps> = ({ 
  availableAgentTools, 
  toolStates, 
  onToggleToolState, 
  currentTheme, 
  onNavigate 
}) => {

  const panelClass = currentTheme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-300 text-gray-800';
  const itemClass = currentTheme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200';
  const textMutedClass = currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-500';
  const accentColor = currentTheme === 'dark' ? 'var(--accent-dark)' : 'var(--accent-light)';

  if (!availableAgentTools || availableAgentTools.length === 0) {
    return (
      <div className={`p-6 panel rounded-lg shadow ${panelClass}`}>
        <h2 className="text-2xl font-semibold mb-4 text-accent flex items-center">
          {Icons.tools} <span className="ml-2">Available Agent Tools</span>
        </h2>
        <p className={textMutedClass}>
          No tools reported by the backend agent, or agent not connected. 
          Check agent status and configuration. You can configure the agent URL in the
          <button onClick={() => onNavigate('settings')} className="text-accent underline ml-1 hover:opacity-80 focus:outline-none">
            Settings panel
          </button>.
        </p>
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-6 panel rounded-lg shadow ${panelClass} max-w-3xl mx-auto`}>
      <h2 className="text-2xl font-semibold mb-6 text-accent flex items-center">
        {Icons.tools} <span className="ml-2">Available Agent Tools</span>
      </h2>
      <p className={`text-sm ${textMutedClass} mb-6`}>
        These tools are provided by the connected backend agent. Toggle to enable or disable a tool for potential AI interaction. 
        Your preferences are sent to the agent.
      </p>
      <div className="space-y-4">
        {availableAgentTools.map((tool) => {
          const isEnabled = toolStates[tool.name] ?? true; // Default to enabled if not in state (newly discovered)

          return (
            <div key={tool.name} className={`p-4 rounded-md border ${currentTheme === 'dark' ? 'border-gray-600' : 'border-gray-200'} ${itemClass} flex justify-between items-start md:items-center flex-col md:flex-row transition-colors duration-150`}>
              <div className="mb-2 md:mb-0 md:mr-4">
                <h3 className="text-lg font-medium">{tool.name}</h3>
                <p className={`text-xs ${textMutedClass}`}>
                  {tool.description || "No description provided by agent."}
                </p>
                {tool.parameters && Object.keys(tool.parameters).length > 0 && (
                  <details className="mt-1 text-xs">
                    <summary className={`cursor-pointer ${textMutedClass} hover:opacity-80`}>View Parameters</summary>
                    <pre className={`mt-1 p-2 rounded text-xs ${currentTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'} whitespace-pre-wrap`}>
                      {JSON.stringify(tool.parameters, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
              <label htmlFor={`tool-toggle-${tool.name}`} className="flex items-center cursor-pointer shrink-0">
                <div className="relative">
                  <input
                    type="checkbox"
                    id={`tool-toggle-${tool.name}`}
                    className="sr-only" 
                    checked={isEnabled}
                    onChange={() => onToggleToolState(tool.name)}
                  />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${isEnabled ? '' : (currentTheme === 'dark' ? 'bg-gray-500' : 'bg-gray-300')}`} style={isEnabled ? { backgroundColor: accentColor } : {}}></div>
                  <div
                    className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${
                      isEnabled ? 'translate-x-full' : ''
                    }`}
                  ></div>
                </div>
                <span className={`ml-2 text-xs font-medium ${isEnabled ? (currentTheme === 'dark' ? 'text-gray-200' : 'text-gray-800') : textMutedClass}`}>
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ToolsPanel;
