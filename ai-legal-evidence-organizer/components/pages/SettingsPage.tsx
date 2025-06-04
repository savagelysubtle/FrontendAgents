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
  const [importedFileError, setImportedFileError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentMcpStatus(contextMcpStatus);
  }, [contextMcpStatus]);

  useEffect(() => {
    setApiConfigsJson(JSON.stringify(mcpApiConfigs, null, 2));
    setSelectedActiveConfigInDropdown(activeApiConfigName || (mcpApiConfigs.length > 0 ? mcpApiConfigs[0].configName : ''));
  }, [mcpApiConfigs, activeApiConfigName]);


  const fetchMcpStatus = async () => {
    if (mcpClient && mcpClient.ready) {
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
    if (newAllowedDir.trim() === '' || !mcpClient || !mcpClient.ready) {
        setError(!mcpClient || !mcpClient.ready ? "MCP Client not ready." : "Directory path cannot be empty.");
        return;
    }
    try {
      const success = await mcpClient.addAllowedDirectory(newAllowedDir);
      if (success) {
        addAuditLogEntry('MCP_DIRECTORY_ADDED_CLIENT', `Directory "${newAllowedDir}" add request sent to server.`);
        setNewAllowedDir('');
        await fetchMcpStatus();
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
    setError(null);
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
    setError(null);
    setImportedFileError(null);
    try {
      const parsedConfigs: McpApiConfig[] = JSON.parse(apiConfigsJson);
      if (!Array.isArray(parsedConfigs) || !parsedConfigs.every(c => c.configName && c.baseApiUrl && c.endpoints)) {
        throw new Error("Invalid JSON structure. Ensure it's an array of McpApiConfig objects, each with configName, baseApiUrl, and endpoints.");
      }

      updateMcpApiConfigs(parsedConfigs); // Update the list in context first

      let configNameToActivate: string | null = null;
      if (parsedConfigs.length > 0) {
        // Try to keep current selection if valid, otherwise pick first
        const currentSelectionIsValid = parsedConfigs.find(c => c.configName === selectedActiveConfigInDropdown);
        if (currentSelectionIsValid) {
          configNameToActivate = selectedActiveConfigInDropdown;
        } else {
          configNameToActivate = parsedConfigs[0].configName;
        }
      }
      // If parsedConfigs.length is 0, configNameToActivate remains null

      await setActiveApiConfig(configNameToActivate); // This will handle null correctly

      // Sync local dropdown state with what was actually activated
      setSelectedActiveConfigInDropdown(configNameToActivate || '');

      if (configNameToActivate) {
        // alert("API Configurations saved and applied!"); // Optional: replace with a more subtle notification
        addAuditLogEntry('MCP_API_CONFIGS_SAVED_UI', `${parsedConfigs.length} API configurations saved. Active: ${configNameToActivate}.`);
      } else {
        setError("API Configurations saved, but no configurations are available to make active.");
        addAuditLogEntry('MCP_API_CONFIGS_SAVED_UI_EMPTY', 'API configurations saved (empty list). Active config cleared.');
      }

    } catch (e: any) {
      const errorMsg = `Error saving API configurations: ${e.message}. Please ensure it's valid JSON.`;
      setError(errorMsg);
      addAuditLogEntry('MCP_API_CONFIGS_SAVE_ERROR_UI', errorMsg);
    }
  };

  const handleActiveApiConfigChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newActiveName = e.target.value;
    setSelectedActiveConfigInDropdown(newActiveName); // Update local state for dropdown
    if (newActiveName) { // Only call setActiveApiConfig if a valid name is selected
        await setActiveApiConfig(newActiveName);
    } else { // If dropdown selection becomes empty (e.g. "No API configurations loaded")
        await setActiveApiConfig(null);
    }
  };

  const handleImportApiConfigsFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportedFileError(null);
    setError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsedData: McpApiConfig[] = JSON.parse(text);

        // Basic validation
        if (!Array.isArray(parsedData)) {
          throw new Error("Imported file is not a JSON array.");
        }
        if (parsedData.length > 0 && !parsedData.every(c => c.configName && c.baseApiUrl && c.endpoints && typeof c.endpoints === 'object')) {
          throw new Error("Imported JSON array does not match the expected McpApiConfig structure. Each object must have 'configName', 'baseApiUrl', and 'endpoints'.");
        }

        setApiConfigsJson(JSON.stringify(parsedData, null, 2));
        addAuditLogEntry('MCP_API_CONFIGS_FILE_PREPARED', `Configurations from file ${file.name} loaded into editor.`);
        alert(`Configurations from "${file.name}" loaded into the editor. Review and click "Save & Apply" to persist.`);
      } catch (err: any) {
        const errorMsg = `Error processing imported file "${file.name}": ${err.message}`;
        setImportedFileError(errorMsg);
        setError(errorMsg); // Also show in global error display
        addAuditLogEntry('MCP_API_CONFIGS_FILE_IMPORT_ERROR', errorMsg);
      }
    };
    reader.onerror = () => {
      const errorMsg = `Error reading file "${file.name}".`;
      setImportedFileError(errorMsg);
      setError(errorMsg);
      addAuditLogEntry('MCP_API_CONFIGS_FILE_READ_ERROR', errorMsg);
    }
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  const activeConfigDetails = mcpApiConfigs.find(c => c.configName === activeApiConfigName);

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-semibold text-textPrimary">Settings</h2>

      <section className="bg-surface p-6 rounded-lg shadow-modern-md dark:shadow-modern-md-dark border border-border">
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

      <section className="bg-surface p-6 rounded-lg shadow-modern-md dark:shadow-modern-md-dark border border-border">
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

      <section className="bg-surface p-6 rounded-lg shadow-modern-md dark:shadow-modern-md-dark border border-border">
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
         {!isMcpClientLoading && mcpClient && !mcpClient.ready && (
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
              disabled={newAllowedDir.trim() === '' || !mcpClient || !mcpClient.ready}
            >
              Add
            </button>
          </div>
        </div>
      </section>

       <section className="bg-surface p-6 rounded-lg shadow-modern-md dark:shadow-modern-md-dark border border-border">
        <h3 className="text-xl font-semibold text-textPrimary mb-2">MCP API Connection Profiles</h3>
        <p className="text-xs text-textSecondary mb-2">
          Define or import sets of API connection profiles. This application uses these to connect to MCP server APIs.
          The structure should be an array of McpApiConfig objects.
        </p>

        <div className="my-4">
            <label htmlFor="import-api-configs" className="block text-sm font-medium text-textSecondary">Import API Connection Profiles File</label>
            <input
                type="file"
                id="import-api-configs"
                accept=".json"
                onChange={handleImportApiConfigsFile}
                className="mt-1 block w-full text-sm text-textSecondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-light file:text-primary hover:file:bg-primary-light/80 dark:file:bg-primary-dark dark:file:text-primary-light dark:hover:file:bg-primary-dark/80 cursor-pointer"
            />
            {importedFileError && <p className="mt-1 text-xs text-red-500">{importedFileError}</p>}
        </div>

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
      /* ... other endpoints ... */
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

      <section className="bg-surface p-6 rounded-lg shadow-modern-md dark:shadow-modern-md-dark border border-border">
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
