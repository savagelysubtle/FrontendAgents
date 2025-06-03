
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { Theme, AuditLogEntry, McpServerStatus, McpApiConfig } from '../../types';
import ToggleSwitch from '../ui/ToggleSwitch';
import { testApiKey as testGeminiApiKey } from '../../services/geminiService';
import LoadingSpinner from '../ui/LoadingSpinner';

const SettingsPage: React.FC = () => {
  const { 
    theme, toggleTheme, auditLog, addAuditLogEntry, 
    mcpServerStatus: contextMcpStatus, setMcpServerStatus,
    apiKey: currentApiKey, setApiKey: setContextApiKey,
    setError, mcpClient, isMcpClientLoading,
    mcpApiConfigs, activeApiConfigName, 
    setActiveApiConfig, updateMcpApiConfigs 
  } = useAppContext();
  
  const [newAllowedDir, setNewAllowedDir] = useState('');
  const [localApiKey, setLocalApiKey] = useState(currentApiKey || '');
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [apiKeyTestResult, setApiKeyTestResult] = useState<string | null>(null);
  const [currentMcpStatus, setCurrentMcpStatus] = useState<McpServerStatus>(contextMcpStatus);

  const [apiConfigsJson, setApiConfigsJson] = useState<string>('');
  const [selectedActiveConfigInDropdown, setSelectedActiveConfigInDropdown] = useState<string>(activeApiConfigName || '');

  useEffect(() => {
    setCurrentMcpStatus(contextMcpStatus);
  }, [contextMcpStatus]);
  
  useEffect(() => {
    setApiConfigsJson(JSON.stringify(mcpApiConfigs, null, 2));
    setSelectedActiveConfigInDropdown(activeApiConfigName || (mcpApiConfigs.length > 0 ? mcpApiConfigs[0].configName : ''));
  }, [mcpApiConfigs, activeApiConfigName]);


  const fetchMcpStatus = async () => {
    if (mcpClient && mcpClient.isReady()) {
      try {
        const status = await mcpClient.getServerStatus();
        setMcpServerStatus(status); 
        setCurrentMcpStatus(status); 
      } catch (err: any) {
        setError(`Failed to refresh MCP server status: ${err.message}`);
        const errorStatus = { isRunning: false, error: err.message };
        setMcpServerStatus(errorStatus);
        setCurrentMcpStatus(errorStatus);
      }
    } else if (!isMcpClientLoading) {
        const errorMsg = mcpClient?.getInitializationError() || "MCP Client not available/initialized.";
        setError(`MCP Client not ready: ${errorMsg}`);
        const errorStatus = { isRunning: false, error: errorMsg };
        setMcpServerStatus(errorStatus);
        setCurrentMcpStatus(errorStatus);
    }
  };

  useEffect(() => {
    if(!isMcpClientLoading && mcpClient) fetchMcpStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcpClient, isMcpClientLoading]);


  const handleAddDirectory = async () => {
    if (newAllowedDir.trim() === '' || !mcpClient || !mcpClient.isReady()) {
        setError(!mcpClient || !mcpClient.isReady() ? "MCP Client not ready." : "Directory path cannot be empty.");
        return;
    }
    try {
      // The McpClient.addAllowedDirectory method sends the request to the server.
      // The server is responsible for updating its internal state and, if designed to,
      // persisting this change for future runs (e.g., by modifying its own config file or args).
      // The frontend cannot directly modify the Rust server's startup configuration.
      const success = await mcpClient.addAllowedDirectory(newAllowedDir);
      if (success) {
        addAuditLogEntry('MCP_DIRECTORY_ADDED_CLIENT', `Directory "${newAllowedDir}" add request sent to server.`);
        setNewAllowedDir('');
        await fetchMcpStatus(); // Refresh status to see if the server reflects the change
      } else {
        setError(`Server failed to process "add directory" request for "${newAllowedDir}". Check server logs.`);
      }
    } catch (err: any) {
      setError(`Error sending "add directory" request to MCP server: ${err.message}`);
    }
  };
  
  const handleApiKeySave = async () => {
    setIsTestingApiKey(true);
    setApiKeyTestResult(null);
    setError(null); // Clear previous errors
    const originalEnvKey = process.env.API_KEY;
    (process.env as any).API_KEY = localApiKey;

    const testSuccess = await testGeminiApiKey();
    
    (process.env as any).API_KEY = originalEnvKey; 

    if (testSuccess) {
      setContextApiKey(localApiKey); 
      setApiKeyTestResult("API Key is valid and saved!");
      addAuditLogEntry('API_KEY_UPDATED', 'Gemini API Key updated successfully.');
    } else {
      const errorMsg = "API Key is invalid. Please check and try again.";
      setApiKeyTestResult(errorMsg);
      setError(errorMsg);
    }
    setIsTestingApiKey(false);
  };

  const handleSaveApiConfigs = async () => {
    setError(null); // Clear previous errors
    try {
      const parsedConfigs: McpApiConfig[] = JSON.parse(apiConfigsJson);
      if (!Array.isArray(parsedConfigs) || !parsedConfigs.every(c => c.configName && c.baseApiUrl && c.endpoints)) {
        throw new Error("Invalid JSON structure. Ensure it's an array of McpApiConfig objects.");
      }
      updateMcpApiConfigs(parsedConfigs);
      
      let newActiveToSet = selectedActiveConfigInDropdown;
      if (!parsedConfigs.find(c => c.configName === newActiveToSet) && parsedConfigs.length > 0) {
        newActiveToSet = parsedConfigs[0].configName;
        setSelectedActiveConfigInDropdown(newActiveToSet);
      }
      
      if (newActiveToSet) {
        await setActiveApiConfig(newActiveToSet);
        // alert("API Configurations saved and applied!"); // Consider removing alert if setError provides enough feedback
      } else {
        // alert("API Configurations saved, but no valid configuration available to make active.");
        setError("API Configurations saved, but no valid configuration available to make active.");
      }
      addAuditLogEntry('MCP_API_CONFIGS_SAVED_UI', `${parsedConfigs.length} API configurations saved from UI.`);
    } catch (e: any) {
      const errorMsg = `Error saving API configurations: ${e.message}. Please ensure it's valid JSON.`;
      setError(errorMsg);
      // alert(`Error: ${e.message}. Please check the JSON format.`);
      addAuditLogEntry('MCP_API_CONFIGS_SAVE_ERROR_UI', errorMsg);
    }
  };

  const handleActiveApiConfigChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newActiveName = e.target.value;
    setSelectedActiveConfigInDropdown(newActiveName);
    await setActiveApiConfig(newActiveName); 
  };
  
  const activeConfigDetails = mcpApiConfigs.find(c => c.configName === activeApiConfigName);

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-semibold text-textPrimary">Settings</h2>

      <section className="bg-surface p-6 rounded-lg shadow border border-border">
        <h3 className="text-xl font-semibold text-textPrimary mb-4">Appearance</h3>
        <div className="flex items-center justify-between">
          <span className="text-textSecondary">Theme</span>
          <ToggleSwitch 
            id="theme-toggle"
            checked={theme === Theme.Dark} 
            onChange={() => toggleTheme()}
            label={theme === Theme.Dark ? 'Dark Mode' : 'Light Mode'}
          />
        </div>
      </section>

      <section className="bg-surface p-6 rounded-lg shadow border border-border">
        <h3 className="text-xl font-semibold text-textPrimary mb-4">Gemini API Key</h3>
        <p className="text-sm text-textSecondary mb-2">
          The API key is ideally set via the <code className="bg-background px-1 rounded">API_KEY</code> environment variable. 
          You can also set it here for the current session.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 items-start">
          <input 
            type="password" 
            value={localApiKey}
            onChange={(e) => setLocalApiKey(e.target.value)}
            placeholder="Enter your Gemini API Key"
            className="flex-grow mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          />
          <button 
            onClick={handleApiKeySave} 
            disabled={isTestingApiKey || !localApiKey}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {isTestingApiKey ? <LoadingSpinner size="sm" /> : 'Test & Save Key'}
          </button>
        </div>
        {apiKeyTestResult && (
          <p className={`mt-2 text-sm ${apiKeyTestResult.includes('invalid') ? 'text-red-500' : 'text-green-500'}`}>
            {apiKeyTestResult}
          </p>
        )}
         {!currentApiKey && !localApiKey && (
           <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
             Current API Key is not set. AI features might not work.
           </p>
         )}
      </section>

      <section className="bg-surface p-6 rounded-lg shadow border border-border">
        <h3 className="text-xl font-semibold text-textPrimary mb-2">MCP Server Connection & Status</h3>
        
        <div className="mb-4">
            <label htmlFor="active-api-config" className="block text-sm font-medium text-textSecondary">Active API Connection Profile</label>
            <select 
                id="active-api-config" 
                value={selectedActiveConfigInDropdown} 
                onChange={handleActiveApiConfigChange}
                disabled={isMcpClientLoading || mcpApiConfigs.length === 0}
                className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            >
                {mcpApiConfigs.length === 0 && <option value="">No API configurations loaded</option>}
                {mcpApiConfigs.map(conf => (
                    <option key={conf.configName} value={conf.configName}>{conf.configName}</option>
                ))}
            </select>
        </div>
        
        <h4 className="text-lg font-medium text-textPrimary mt-4 mb-1">Server Status (using "{selectedActiveConfigInDropdown || 'N/A'}")</h4>
         {isMcpClientLoading && <LoadingSpinner message="Initializing MCP Client..." />}
         {!isMcpClientLoading && mcpClient && !mcpClient.isReady() && (
            <p className="text-sm text-red-500">MCP Client Error: {mcpClient.getInitializationError()}</p>
         )}
        <div className="text-sm space-y-1 text-textSecondary">
          <p>Status: {currentMcpStatus.isRunning ? 
            <span className="text-green-500 font-semibold">Running</span> : 
            <span className="text-red-500 font-semibold">Not Running {currentMcpStatus.error ? `(${currentMcpStatus.error.substring(0,150)}${currentMcpStatus.error.length > 150 ? '...' : ''})` : ''}</span>}
          </p>
          {currentMcpStatus.isRunning && <p>Reported Server Version: {currentMcpStatus.version || 'N/A'}</p>}
          {activeConfigDetails && (
            <>
              <p>Expected Server Version: {activeConfigDetails.expectedServerVersion || 'Any'}</p>
              <p>Request Timeout: {activeConfigDetails.requestTimeoutMs ? `${activeConfigDetails.requestTimeoutMs} ms` : 'Default (Browser)'}</p>
            </>
          )}
          <p className="font-medium mt-2 text-textPrimary">Allowed Directories (from server):</p>
          {currentMcpStatus.allowedDirectories && currentMcpStatus.allowedDirectories.length > 0 ? (
            <ul className="list-disc list-inside pl-4">
              {currentMcpStatus.allowedDirectories.map(dir => <li key={dir} className="break-all">{dir}</li>)}
            </ul>
          ) : <p>No directories configured or status unavailable.</p>}
        </div>
        <button onClick={fetchMcpStatus} disabled={isMcpClientLoading || !mcpClient} className="mt-2 text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50">Refresh MCP Status</button>
        
        <div className="mt-4">
          <label htmlFor="new-dir" className="block text-sm font-medium text-textSecondary">Add Allowed Directory (via active MCP connection)</label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              id="new-dir"
              value={newAllowedDir}
              onChange={(e) => setNewAllowedDir(e.target.value)}
              placeholder="/path/to/your/case/files"
              className="flex-grow px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            />
            <button 
              onClick={handleAddDirectory} 
              className="bg-secondary text-white px-4 py-2 rounded-lg hover:bg-secondary-dark transition-colors"
              disabled={newAllowedDir.trim() === '' || !mcpClient || !mcpClient.isReady()}
            >
              Add
            </button>
          </div>
        </div>
      </section>

       <section className="bg-surface p-6 rounded-lg shadow border border-border">
        <h3 className="text-xl font-semibold text-textPrimary mb-2">MCP API Connection Configurations</h3>
        <p className="text-xs text-textSecondary mb-2">
          Edit the JSON below to define API connection profiles. These specify how this application connects to MCP server APIs. 
          You can copy/paste configurations here (e.g., from another app's setup file that defines API connections).
        </p>
        <textarea
            value={apiConfigsJson}
            onChange={(e) => setApiConfigsJson(e.target.value)}
            rows={10}
            className="w-full p-2 font-mono text-xs bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            placeholder={`[
  {
    "configName": "Default Local MCP Server",
    "baseApiUrl": "http://localhost:8081/mcp-api",
    "endpoints": {
      "listDirectory": "/fs/list",
      "readFile": "/fs/read",
      "writeFile": "/fs/write",
      "renameFile": "/fs/rename",
      "deleteFileOrDirectory": "/fs/delete",
      "getDirectoryTree": "/fs/tree",
      "batchRenameFiles": "/fs/batchRename",
      "createZip": "/fs/zip",
      "addAllowedDirectory": "/config/allowDir",
      "getServerStatus": "http://localhost:8081/status"
    },
    "requestTimeoutMs": 20000,
    "expectedServerVersion": "0.1.0"
  }
]`}
            aria-label="MCP API Configurations JSON Editor"
        />
        <button 
            onClick={handleSaveApiConfigs} 
            className="mt-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
        >
            Save & Apply API Connection Configurations
        </button>
      </section>

      <section className="bg-surface p-6 rounded-lg shadow border border-border">
        <h3 className="text-xl font-semibold text-textPrimary mb-4">Audit Log</h3>
        <div className="max-h-96 overflow-y-auto space-y-2 text-sm border border-border p-3 rounded-md bg-background">
          {auditLog.length > 0 ? auditLog.map((entry: AuditLogEntry) => (
            <div key={entry.id} className="p-2 border-b border-border/50 last:border-b-0">
              <p className="font-semibold text-textPrimary">
                {new Date(entry.timestamp).toLocaleString()} - <span className="text-primary">{entry.action}</span>
              </p>
              <p className="text-xs text-textSecondary break-all">{entry.details}</p>
            </div>
          )) : <p className="text-textSecondary text-center py-4">No audit log entries yet.</p>}
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
