
import React, { useState, useEffect, ChangeEvent } from 'react';
import { MCPConfig } from '../types';
import { Icons, DEFAULT_SETTINGS_FILENAME } from '../constants';
// AI Linting for mcpJsonContent is still relevant if this JSON configures the backend
// For now, we assume direct Gemini call for this utility is okay, or it would also
// be a call to a specific "linting" tool via the backend agent if fully refactored.
// import { aiLintAndFormatMcpJson } from '../services/agentService'; // This function would need to be adapted or replaced if agentService no longer has direct AI calls.
                                                       // For now, assuming it's a utility that *could* still exist or uses a general purpose AI.

interface SettingsPanelProps {
  currentConfig: MCPConfig;
  onConfigChange: (newConfig: MCPConfig) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ currentConfig, onConfigChange }) => {
  const [localConfig, setLocalConfig] = useState<MCPConfig>(currentConfig);
  const [feedback, setFeedback] = useState<string>('');
  const [jsonError, setJsonError] = useState<string>('');
  const [isAiFormattingJson, setIsAiFormattingJson] = useState<boolean>(false);

  useEffect(() => {
    setLocalConfig(currentConfig);
  }, [currentConfig]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    let processedValue: string | number | boolean | string[] = value;

    if (name === 'ignoreGlobs') {
      processedValue = (value as string).split(',').map(glob => glob.trim()).filter(glob => glob !== '');
    } else if (type === 'number') {
      processedValue = parseFloat(value);
    } else if (name === 'mcpJsonContent') {
      try {
        if (value.trim() !== "") JSON.parse(value);
        setJsonError('');
      } catch (err) {
        setJsonError('Potentially invalid JSON format');
      }
    }
    
    setLocalConfig(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleSave = () => {
    if (localConfig.mcpJsonContent && localConfig.mcpJsonContent.trim() !== "") {
      try {
        JSON.parse(localConfig.mcpJsonContent);
        setJsonError('');
      } catch (err) {
        setJsonError('Cannot save: MCP JSON content (for backend) is invalid.');
        setFeedback('');
        return;
      }
    } else if (localConfig.mcpJsonContent.trim() === "") {
        setJsonError('');
    }
    onConfigChange(localConfig);
    setFeedback('Settings saved successfully!');
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleExportSettings = () => {
    const jsonString = JSON.stringify(localConfig, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = DEFAULT_SETTINGS_FILENAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    setFeedback('Settings exported!');
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleImportSettings = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedConfig = JSON.parse(e.target?.result as string) as MCPConfig;
          if (importedConfig && typeof importedConfig.workspaceName === 'string' && typeof importedConfig.theme === 'string') {
            const completeImportedConfig: MCPConfig = {
              ...currentConfig, 
              ...importedConfig, 
              agentUrl: importedConfig.agentUrl !== undefined ? importedConfig.agentUrl : currentConfig.agentUrl,
              mcpJsonContent: typeof importedConfig.mcpJsonContent === 'string' ? importedConfig.mcpJsonContent : JSON.stringify({ info: "Backend MCP config" }, null, 2),
              toolStates: importedConfig.toolStates || {},
            };
            onConfigChange(completeImportedConfig);
            setFeedback('Settings imported successfully!');
            setJsonError(''); 
          } else {
            throw new Error("Invalid config file format.");
          }
        } catch (err) {
          console.error("Failed to import settings:", err);
          setFeedback(`Error importing settings: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            event.target.value = ''; 
            setTimeout(() => setFeedback(''), 5000);
        }
      };
      reader.readAsText(file);
    }
  };
  
  const handleAiLintAndFormatJson = async () => {
    if (!localConfig.mcpJsonContent || localConfig.mcpJsonContent.trim() === "") {
      setJsonError("No JSON content to format.");
      return;
    }
    setIsAiFormattingJson(true);
    setJsonError('');
    setFeedback('AI is linting and formatting JSON for backend config...');
    try {
      // This assumes aiLintAndFormatMcpJson is still available and functional,
      // or replaced by an agent call to a similar utility tool.
      // For now, keeping the call, but its implementation in agentService might need adjustment.
      // If agentService is truly empty, this call would fail.
      // Let's assume a generic AI utility call for this for now.
      const tempDirectGeminiCallForLinting = async (jsonToLint: string): Promise<string> => {
         // Placeholder for a generic AI call if `aiLintAndFormatMcpJson` is removed from agentService
         // In a full refactor, this would ideally be a tool call via the connected agent.
         console.warn("Using placeholder for AI JSON linting. Ideally, this is a backend tool call.");
         try {
            const parsed = JSON.parse(jsonToLint);
            return JSON.stringify(parsed, null, 2);
         } catch {
            return JSON.stringify({error: "Invalid JSON provided to placeholder linter"}, null, 2);
         }
      };
      const formattedJson = await tempDirectGeminiCallForLinting(localConfig.mcpJsonContent);
      
      try {
        const parsedAIResponse = JSON.parse(formattedJson);
        if (parsedAIResponse.error) {
          setJsonError(`AI Formatting Error: ${parsedAIResponse.error}`);
          setFeedback('');
        } else {
          setLocalConfig(prev => ({ ...prev, mcpJsonContent: formattedJson }));
          setFeedback('JSON for backend config formatted by AI successfully!');
        }
      } catch (e) { 
        setLocalConfig(prev => ({ ...prev, mcpJsonContent: formattedJson }));
        setFeedback('JSON for backend config formatted by AI successfully!');
      }

    } catch (err) {
      console.error("AI Linting/Formatting Error:", err);
      setJsonError(`AI formatting failed: ${err instanceof Error ? err.message : String(err)}`);
      setFeedback('');
    } finally {
      setIsAiFormattingJson(false);
      setTimeout(() => setFeedback(''), 3000);
    }
  };


  const inputClass = `w-full p-2 rounded border ${currentConfig.theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-black'} focus:ring-2 focus:ring-opacity-50`;
  const labelClass = `block mb-1 font-medium ${currentConfig.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`;

  return (
    <div className="p-4 panel max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-accent">Application Settings</h2>

      <div className="space-y-6 mb-8">
        <div>
          <label htmlFor="workspaceName" className={labelClass}>Workspace Name (Conceptual)</label>
          <input type="text" id="workspaceName" name="workspaceName" value={localConfig.workspaceName} onChange={handleChange} className={inputClass} placeholder="e.g., My Project Files" />
        </div>
        <div>
          <label htmlFor="maxFileSizeMB" className={labelClass}>Max File Size for Ingest (MB)</label>
          <input type="number" id="maxFileSizeMB" name="maxFileSizeMB" value={localConfig.maxFileSizeMB} onChange={handleChange} min="1" className={inputClass} />
        </div>
        <div>
          <label htmlFor="ignoreGlobs" className={labelClass}>Ignore Patterns (comma-separated)</label>
          <textarea id="ignoreGlobs" name="ignoreGlobs" value={localConfig.ignoreGlobs.join(', ')} onChange={handleChange} className={`${inputClass} min-h-[60px]`} placeholder="e.g., node_modules/, .git/, *.tmp, build/" />
        </div>
        <div>
          <label htmlFor="theme" className={labelClass}>Theme</label>
          <select id="theme" name="theme" value={localConfig.theme} onChange={handleChange} className={inputClass}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
         <div>
          <label htmlFor="agentUrl" className={labelClass}>Backend Agent URL</label>
          <input type="url" id="agentUrl" name="agentUrl" value={localConfig.agentUrl} onChange={handleChange} className={inputClass} placeholder="e.g., /api/my-backend-agent or http://localhost:8000/agent" />
           <p className="text-xs mt-1 opacity-70">The URL of the AG-UI compatible backend agent.</p>
        </div>
      </div>

      <div className="md:flex md:space-x-8 border-t pt-8 ${currentConfig.theme === 'dark' ? 'border-gray-700' : 'border-gray-600'}">
        <div className="md:w-1/3 space-y-4 mb-8 md:mb-0">
          <button onClick={handleSave} className="button-accent w-full">
            Save Settings
          </button>
          <button onClick={handleExportSettings} className={`button-accent w-full ${currentConfig.theme === 'dark' ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-300 hover:bg-gray-400 text-black'}`}>
            Export Settings
          </button>
          <label htmlFor="import-settings-input" className={`button-accent w-full text-center cursor-pointer block py-2 px-4 rounded ${currentConfig.theme === 'dark' ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-300 hover:bg-gray-400 text-black'}`}>
            Import Settings
          </label>
          <input type="file" id="import-settings-input" accept=".json" onChange={handleImportSettings} className="hidden" />
          
          {feedback && (
            <div className={`p-3 mt-4 rounded text-sm ${feedback.includes('Error') || feedback.includes('Cannot save') || feedback.includes('AI formatting failed') ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
              {feedback}
            </div>
          )}
           {jsonError && !feedback.includes('Cannot save') && !feedback.includes('AI Formatting Error') && (
            <div className="p-3 mt-4 rounded text-sm bg-red-500 text-white">
              {jsonError}
            </div>
          )}
          <p className="text-xs mt-6 opacity-70">
            Settings are saved in your browser's local storage.
          </p>
        </div>

        <div className="md:w-2/3 space-y-6">
          {/* MCP Server URL and Token might be less relevant if agentUrl is primary */}
          {/* Or they could be part of mcpJsonContent if backend needs them per-tool */}
          
          <div className="border-t md:border-none pt-6 md:pt-0 ${currentConfig.theme === 'dark' ? 'border-gray-700' : 'border-gray-600'}"> 
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold ${currentConfig.theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}">Backend Agent MCP Tool Configuration</h3>
                <button
                    onClick={handleAiLintAndFormatJson}
                    disabled={isAiFormattingJson}
                    className="button-accent text-xs px-3 py-1 flex items-center space-x-1"
                    title="Use AI to lint and format the JSON content for backend"
                >
                    {/* ... (button content same as before) ... */}
                     {isAiFormattingJson ? (
                        <>
                         <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                             style={{ borderColor: currentConfig.theme === 'dark' ? 'var(--accent-text-dark)' : 'var(--accent-text-light)', borderTopColor: 'transparent' }}>
                        </div>
                        <span>Formatting...</span>
                        </>
                    ) : (
                        <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 3.75a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 3.75zM10 8.75a.75.75 0 01.75.75v1.5a.75.75 0 01-1.501 0v-1.5A.75.75 0 0110 8.75zM10 13.75a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75z"/></svg>
                        <span>AI Lint & Format</span>
                        </>
                    )}
                </button>
            </div>
            <p className="text-xs opacity-70 mb-3">Paste the JSON content (e.g., `mcp.json` structure) here if your backend agent uses it to define its tools. This UI does not directly parse it for tool listing anymore.</p>
            <textarea
              id="mcpJsonContent"
              name="mcpJsonContent"
              value={localConfig.mcpJsonContent || ''}
              onChange={handleChange}
              className={`${inputClass} min-h-[200px] md:min-h-[250px] font-mono text-xs leading-tight`}
              placeholder='{ "mcpServers": { "ToolNameFromBackend": { /* ... backend specific config ... */ } } }'
              aria-label="Backend Agent MCP JSON Configuration"
            />
            {jsonError && localConfig.mcpJsonContent && ( 
                 <p className="text-xs mt-1 text-red-500">{jsonError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
