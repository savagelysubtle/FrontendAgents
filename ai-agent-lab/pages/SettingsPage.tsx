import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, ClientCapabilitiesConfig, McpLoggingLevel } from '../types'; 
import useLocalStorage from '../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS, DEFAULT_SETTINGS, ACCENT_COLOR, AVAILABLE_ASSISTANT_MODELS, DEFAULT_ASSISTANT_SYSTEM_PROMPT, GEMINI_TEXT_MODEL, GEMINI_PRO_TEXT_MODEL_EXPERIMENTAL } from '../constants';
import Button from '../components/Button';
import ToggleSwitch from '../components/ToggleSwitch';
import Card from '../components/Card';
import Input from '../components/Input';
import Textarea from '../components/Textarea';
import { useTheme } from '../hooks/useTheme';
import { localStorageService } from '../services/localStorageService';
import { downloadJsonFile, readJsonFile } from '../utils/fileUtils';
import { telemetryService } from '../services/telemetryService';
import { usePWAInstall } from '../hooks/usePWAInstall';
import DownloadIcon from '../components/icons/DownloadIcon';
import UploadIcon from '../components/icons/UploadIcon';
import { useLocation, useNavigate } from 'react-router-dom';

type SettingsTab = 'general' | 'assistant' | 'mcp' | 'data';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useLocalStorage<AppSettings>(LOCAL_STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  const [currentTheme, setTheme] = useTheme(); 
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deferredInstallPrompt, triggerInstallPrompt, isAppInstalled] = usePWAInstall();
  
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash === 'assistant' || hash === 'mcp' || hash === 'data') {
      setActiveTab(hash as SettingsTab);
    } else {
      setActiveTab('general');
    }
  }, [location.hash]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    navigate(`/settings#${tab}`);
    telemetryService.logEvent('settings_tab_changed', { tab });
  };


  const handleThemeChange = (themeValue: string) => {
    setTheme(themeValue as AppSettings['theme']);
    telemetryService.logEvent('theme_changed', { theme: themeValue });
  };

  const handleTelemetryToggle = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, telemetryEnabled: enabled }));
    telemetryService.logEvent('telemetry_toggled', { enabled });
  };

  const handleIntegrationToggle = (integrationName: keyof AppSettings['integrations'], enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      integrations: {
        ...prev.integrations,
        [integrationName]: enabled,
      },
    }));
    telemetryService.logEvent('integration_toggled', { integration: integrationName, enabled });
  };
  
  const handleMcpCapabilityChange = (capability: keyof ClientCapabilitiesConfig, value: any) => {
    setSettings(prev => ({
      ...prev,
      mcpClientCapabilities: {
        ...prev.mcpClientCapabilities,
        [capability]: value,
      },
    }));
     telemetryService.logEvent('mcp_capability_changed', { capability, value });
  };

  const handleAssistantSettingChange = (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value, }));
    telemetryService.logEvent('assistant_setting_changed', { key, value });
  };
  
  const handleResetAssistantSystemPrompt = () => {
    handleAssistantSettingChange('assistantSystemPrompt', DEFAULT_ASSISTANT_SYSTEM_PROMPT);
  };


  const handleExportConfig = () => {
    const configData = {
      settings: localStorageService.getSettings(),
      agents: localStorageService.getAgents(),
      legacyTools: localStorageService.getLegacyTools(), 
      mcpServers: localStorageService.getMcpServers(),
      chatHistory: localStorageService.getChatHistory(), 
    };
    downloadJsonFile(configData, 'ai_agent_lab_config.json');
    telemetryService.logEvent('config_exported');
  };

  const handleImportConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportError(null);
      setImportSuccess(null);
      try {
        const importedData = await readJsonFile<any>(file);
        if (importedData.settings && typeof importedData.settings === 'object') {
          // Ensure default values for new settings if not present in imported file
          const completeDefaultSettings = DEFAULT_SETTINGS;
          const importedAppSettings = importedData.settings;
          const mergedSettings = { 
            ...completeDefaultSettings, 
            ...importedAppSettings,
            mcpClientCapabilities: { // Deep merge for nested objects
              ...completeDefaultSettings.mcpClientCapabilities,
              ...(importedAppSettings.mcpClientCapabilities || {})
            },
            integrations: {
                ...completeDefaultSettings.integrations,
                ...(importedAppSettings.integrations || {})
            }
          };
          localStorageService.setSettings(mergedSettings as AppSettings);
          setSettings(mergedSettings as AppSettings); 
          setTheme(mergedSettings.theme); 
        }
        if (importedData.agents && Array.isArray(importedData.agents)) {
          localStorageService.setAgents(importedData.agents);
        }
        if (importedData.legacyTools && Array.isArray(importedData.legacyTools)) {
          localStorageService.setLegacyTools(importedData.legacyTools);
        }
        if (importedData.mcpServers && Array.isArray(importedData.mcpServers)) {
          localStorageService.setMcpServers(importedData.mcpServers);
        }
        if (importedData.chatHistory && Array.isArray(importedData.chatHistory)) {
          localStorageService.setChatHistory(importedData.chatHistory);
        }
        setImportSuccess('Configuration imported successfully. Some changes may require a page refresh to fully apply.');
        telemetryService.logEvent('config_imported');
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setImportError(`Failed to import configuration: ${err.message}`);
        telemetryService.logError(err, { context: 'config_import_error' });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ''; 
        }
      }
    }
  };

  const ThemeOption: React.FC<{ value: AppSettings['theme']; label: string; current: AppSettings['theme'] }> = 
  ({ value, label, current }) => (
    <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
      <input
        type="radio"
        name="theme"
        value={value}
        checked={current === value}
        onChange={() => handleThemeChange(value)}
        className={`form-radio h-4 w-4 text-[var(--accent-text)] border-[var(--input-border)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-[var(--input-focus-ring)] bg-[var(--input-background)]`}
      />
      <span className="text-[var(--text-secondary)]">{label}</span>
    </label>
  );

  const TabButton: React.FC<{ tabId: SettingsTab; label: string }> = ({ tabId, label }) => (
    <button
      onClick={() => handleTabChange(tabId)}
      className={`px-4 py-2 font-medium text-sm rounded-md transition-colors
        ${activeTab === tabId 
          ? `bg-[var(--accent-bg)] text-[var(--accent-text-on-bg)]`
          : `text-[var(--text-secondary)] hover:bg-gray-200 dark:hover:bg-zinc-800`}
      `}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">Settings</h1>

      <div className="mb-6 border-b border-[var(--border-primary)]">
        <nav className="flex space-x-1 overflow-x-auto pb-px -mb-px">
          <TabButton tabId="general" label="General" />
          <TabButton tabId="assistant" label="AI Assistant" />
          <TabButton tabId="mcp" label="MCP Client" />
          <TabButton tabId="data" label="Data Management" />
        </nav>
      </div>

      {activeTab === 'general' && (
        <div className="space-y-8">
          <Card title="Appearance">
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">Choose your preferred theme. "System" will match your OS settings.</p>
              <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
                <ThemeOption value="light" label="Light" current={currentTheme} />
                <ThemeOption value="dark" label="Dark" current={currentTheme} />
                <ThemeOption value="system" label="System" current={currentTheme} />
              </div>
            </div>
          </Card>
          
          <Card title="PWA Settings">
            {!isAppInstalled && deferredInstallPrompt && (
              <div className="space-y-2">
                <p className="text-sm text-[var(--text-secondary)]">
                  Install AI Agent Lab as an app on your device for a better experience, including offline access.
                </p>
                <Button onClick={triggerInstallPrompt} variant="primary">
                  Install App
                </Button>
              </div>
            )}
            {isAppInstalled && (
              <p className="text-sm text-green-600 dark:text-green-400">
                AI Agent Lab is installed on this device.
              </p>
            )}
            {!deferredInstallPrompt && !isAppInstalled && (
                <p className="text-sm text-[var(--text-subtle)]">
                    Your browser may not support PWA installation, or the app is already installed.
                </p>
            )}
          </Card>

          <Card title="Privacy">
            <ToggleSwitch
              label="Enable Telemetry"
              checked={settings.telemetryEnabled}
              onChange={handleTelemetryToggle}
            />
            <p className="mt-2 text-xs text-[var(--text-subtle)]">
              Help improve AI Agent Lab by sending anonymized error and usage reports. No personal data is collected.
            </p>
          </Card>

          <Card title="Integrations (Future Roadmap)">
            <p className="mb-4 text-sm text-[var(--text-secondary)]">
              Configure integrations with external services. These are currently placeholders.
            </p>
            <div className="space-y-3">
              <ToggleSwitch
                label="Google Cloud Sync"
                checked={settings.integrations.googleCloud}
                onChange={(enabled) => handleIntegrationToggle('googleCloud', enabled)}
              />
              <ToggleSwitch
                label="GitHub Repositories"
                checked={settings.integrations.github}
                onChange={(enabled) => handleIntegrationToggle('github', enabled)}
              />
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'assistant' && (
        <div className="space-y-8">
          <Card title="AI Assistant Configuration">
             <p className="mb-4 text-sm text-[var(--text-secondary)]">
              Customize the behavior of the AI Assistant. Changes will apply to new chat sessions.
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="assistantModel" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Assistant Model</label>
                <select
                  id="assistantModel"
                  value={settings.assistantModel}
                  onChange={(e) => handleAssistantSettingChange('assistantModel', e.target.value)}
                  className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-[var(--input-border)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-[var(--input-focus-ring)] focus:border-[var(--input-focus-ring)] sm:text-sm rounded-md bg-[var(--input-background)] text-[var(--input-text)]`}
                >
                  {AVAILABLE_ASSISTANT_MODELS.map(model => (
                    <option key={model} value={model}>
                      {model}
                      {model === GEMINI_TEXT_MODEL && " (Recommended)"}
                      {model === GEMINI_PRO_TEXT_MODEL_EXPERIMENTAL && " (Experimental Pro)"}
                    </option>
                  ))}
                   {AVAILABLE_ASSISTANT_MODELS.length === 0 && <option disabled>No models configured</option>}
                </select>
                <p className="mt-1 text-xs text-[var(--text-subtle)]">
                  The AI Assistant uses generative models for text tasks. According to the application's Gemini API guidelines, '{GEMINI_TEXT_MODEL}' is the recommended model for these tasks.
                  Other models listed are for experimental purposes and may not be optimized or officially supported for this application's use case, and their availability or performance is not guaranteed.
                  Selecting models not explicitly recommended by the guidelines might lead to unexpected behavior or errors.
                </p>
              </div>

              <div>
                <label htmlFor="assistantTemperature" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Temperature: <span className={`font-semibold text-[var(--accent-text)]`}>{settings.assistantTemperature.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  id="assistantTemperature"
                  min="0"
                  max="1" 
                  step="0.1"
                  value={settings.assistantTemperature}
                  onChange={(e) => handleAssistantSettingChange('assistantTemperature', parseFloat(e.target.value))}
                  className={`w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-${ACCENT_COLOR}-600 dark:accent-${ACCENT_COLOR}-500`}
                />
                <p className="text-xs text-[var(--text-subtle)] mt-1">Controls randomness. Lower is more deterministic, higher is more creative.</p>
              </div>

              <Textarea
                label="System Prompt"
                value={settings.assistantSystemPrompt}
                onChange={(e) => handleAssistantSettingChange('assistantSystemPrompt', e.target.value)}
                textareaClassName="h-32 text-sm"
                placeholder="Define the assistant's role and personality..."
              />
              <Button variant="ghost" size="sm" onClick={handleResetAssistantSystemPrompt}>Reset to Default Prompt</Button>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                    label="TopK (Optional)"
                    type="number"
                    placeholder="API Default"
                    value={settings.assistantTopK ?? ''}
                    onChange={(e) => handleAssistantSettingChange('assistantTopK', e.target.value ? parseInt(e.target.value) : undefined)}
                    min="0"
                />
                <Input
                    label="TopP (Optional)"
                    type="number"
                    placeholder="API Default"
                    value={settings.assistantTopP ?? ''}
                    onChange={(e) => handleAssistantSettingChange('assistantTopP', e.target.value ? parseFloat(e.target.value) : undefined)}
                    min="0" max="1" step="0.01"
                />
              </div>
              
              {settings.assistantModel === GEMINI_TEXT_MODEL && ( 
                <ToggleSwitch
                  label="Enable Thinking (for Flash model)"
                  checked={settings.assistantEnableThinking ?? true} 
                  onChange={(enabled) => handleAssistantSettingChange('assistantEnableThinking', enabled)}
                />
              )}
            </div>
          </Card>
        </div>
      )}
      
      {activeTab === 'mcp' && (
         <Card title="Default MCP Client Capabilities">
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            Configure default capabilities the client will request when connecting to an MCP server. These can be overridden per server if the server edit allows.
          </p>
          <div className="space-y-3">
            <ToggleSwitch
              label="Request Roots Support"
              checked={settings.mcpClientCapabilities.roots}
              onChange={(enabled) => handleMcpCapabilityChange('roots', enabled)}
            />
            <ToggleSwitch
              label="Request Sampling Support"
              checked={settings.mcpClientCapabilities.sampling}
              onChange={(enabled) => handleMcpCapabilityChange('sampling', enabled)}
            />
            <div>
              <label htmlFor="mcpLoggingLevel" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Default Logging Level for MCP
              </label>
              <select
                id="mcpLoggingLevel"
                name="mcpLoggingLevel"
                className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-[var(--input-border)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-background)] focus:ring-[var(--input-focus-ring)] focus:border-[var(--input-focus-ring)] sm:text-sm rounded-md bg-[var(--input-background)] text-[var(--input-text)]`}
                value={settings.mcpClientCapabilities.loggingLevel === undefined ? '' : settings.mcpClientCapabilities.loggingLevel}
                onChange={(e) => handleMcpCapabilityChange('loggingLevel', e.target.value ? parseInt(e.target.value) as McpLoggingLevel : undefined)}
              >
                <option value="">Not Set (Server Default)</option>
                {Object.entries(McpLoggingLevel).filter(([, value]) => typeof value === 'number').map(([key, value]) => (
                  <option key={value as number} value={value as number}>{key} ({value})</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--text-subtle)]">
                Set the minimum logging level the client requests from MCP servers.
              </p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'data' && (
         <Card title="Configuration Management">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Export all your settings, agents, tools and MCP server configurations into a single JSON file.</p>
              <Button onClick={handleExportConfig} leftIcon={<DownloadIcon className="w-5 h-5"/>}>
                Export Configuration
              </Button>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Import configuration from a previously exported JSON file. This will overwrite existing data.</p>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportConfig}
                className="hidden"
                ref={fileInputRef}
                id="import-config-input"
              />
              <Button onClick={() => fileInputRef.current?.click()} leftIcon={<UploadIcon className="w-5 h-5"/>}>
                Import Configuration
              </Button>
              {importError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{importError}</p>}
              {importSuccess && <p className="mt-2 text-sm text-green-600 dark:text-green-400">{importSuccess}</p>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default SettingsPage;