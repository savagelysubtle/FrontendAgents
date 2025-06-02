import React, { useState, useEffect, useCallback } from 'react';
import { Agent } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS, ACCENT_COLOR } from '../constants';
import Button from '../components/Button';
import Input from '../components/Input';
import Textarea from '../components/Textarea'; // Added import
import Modal from '../components/Modal';
import ToggleSwitch from '../components/ToggleSwitch';
import Card from '../components/Card';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import EditIcon from '../components/icons/EditIcon';
import RefreshIcon from '../components/icons/RefreshIcon';
import SpinnerIcon from '../components/icons/SpinnerIcon';
import { telemetryService } from '../services/telemetryService';

const AgentCard: React.FC<{ agent: Agent; onToggle: (id: string) => void; onRefresh: (agent: Agent) => void; onEdit: (agent: Agent) => void; onDelete: (id: string) => void; isLoadingRefresh: boolean;}> = 
  ({ agent, onToggle, onRefresh, onEdit, onDelete, isLoadingRefresh }) => {
  return (
    <Card className="relative">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-zinc-50">{agent.name}</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400 truncate max-w-xs" title={agent.url}>{agent.url}</p>
          {agent.description && <p className="mt-1 text-sm text-gray-600 dark:text-zinc-300">{agent.description}</p>}
        </div>
        <ToggleSwitch checked={agent.isEnabled} onChange={() => onToggle(agent.id)} />
      </div>
      
      {agent.version && <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">Version: {agent.version}</p>}
      {agent.author && <p className="text-xs text-gray-500 dark:text-zinc-400">Author: {agent.author}</p>}
      {agent.lastRefreshed && <p className="text-xs text-gray-500 dark:text-zinc-400">Last Refreshed: {new Date(agent.lastRefreshed).toLocaleString()}</p>}
      
      {agent.status && (
        <div className={`mt-2 text-xs font-medium inline-flex items-center px-2 py-0.5 rounded-full
          ${agent.status === 'online' ? `bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100` : ''}
          ${agent.status === 'offline' ? `bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100` : ''}
          ${agent.status === 'error' ? `bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100` : ''}
          ${agent.status === 'loading' ? `bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100` : ''}
        `}>
          {agent.status === 'loading' && <SpinnerIcon className="w-3 h-3 mr-1" />}
          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800 flex space-x-2">
        <Button variant="ghost" size="sm" onClick={() => onRefresh(agent)} disabled={isLoadingRefresh} title="Refresh Agent Data">
          {isLoadingRefresh && agent.status === 'loading' ? <SpinnerIcon className="w-4 h-4" /> : <RefreshIcon className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(agent)} title="Edit Agent">
          <EditIcon className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(agent.id)} className={`text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-700`} title="Delete Agent">
          <TrashIcon className="w-4 h-4" />
        </Button>
      </div>
       {agent.metadata && Object.keys(agent.metadata).length > 0 && (
        <details className="mt-3 text-xs">
          <summary className={`cursor-pointer text-${ACCENT_COLOR}-600 dark:text-${ACCENT_COLOR}-400`}>View Metadata</summary>
          <pre className="mt-1 p-2 bg-gray-100 dark:bg-zinc-800 rounded text-gray-700 dark:text-zinc-300 max-h-40 overflow-auto">
            {JSON.stringify(agent.metadata, null, 2)}
          </pre>
        </details>
      )}
    </Card>
  );
};

const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useLocalStorage<Agent[]>(LOCAL_STORAGE_KEYS.AGENTS, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [newAgentUrl, setNewAgentUrl] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshingAgentId, setRefreshingAgentId] = useState<string | null>(null);


  const fetchAgentJson = useCallback(async (url: string, existingAgentId?: string): Promise<Partial<Agent>> => {
    if (!url.trim()) throw new Error("Agent URL cannot be empty.");
    if (!url.endsWith('agent.json')) {
       console.warn("Agent URL does not end with agent.json. Proceeding, but this might not be a valid agent manifest.");
    }
    
    const response = await fetch(url, { mode: 'cors' }); // Add cors mode
    if (!response.ok) {
      throw new Error(`Failed to fetch agent.json: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    
    // Basic validation of agent.json structure (can be expanded)
    if (!data.name || !data.description) {
      throw new Error('Invalid agent.json: missing name or description.');
    }

    return {
      id: existingAgentId || crypto.randomUUID(),
      url,
      name: data.name,
      description: data.description,
      version: data.version,
      author: data.author,
      capabilities: data.capabilities,
      isEnabled: existingAgentId ? agents.find(a => a.id === existingAgentId)?.isEnabled : true,
      lastRefreshed: new Date().toISOString(),
      status: 'online',
      metadata: data, // Store the whole fetched JSON as metadata
    };
  }, [agents]);


  const handleAddAgent = async () => {
    setError(null);
    if (!newAgentUrl.trim()) {
      setError("Agent URL is required.");
      return;
    }
    setIsLoading(true);
    try {
      const agentData = await fetchAgentJson(newAgentUrl);
      setAgents(prev => [...prev, agentData as Agent]);
      setNewAgentUrl('');
      setIsModalOpen(false);
      telemetryService.logEvent('agent_registered', { url: newAgentUrl });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err.message);
      telemetryService.logError(err, { context: 'add_agent', url: newAgentUrl });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEditAgent = async () => {
    if (!editingAgent) return;
    setError(null);
    setIsLoading(true);
    try {
      // If URL changed, re-fetch. Otherwise, just update local fields.
      let updatedData: Partial<Agent> = { 
        name: agentName, 
        description: agentDescription,
      };

      if (editingAgent.url !== newAgentUrl && newAgentUrl.trim()) {
         // URL changed, refetch agent.json
        updatedData = { ...updatedData, ...(await fetchAgentJson(newAgentUrl, editingAgent.id))};
      } else {
        // URL did not change or newAgentUrl is empty, keep original URL
        updatedData.url = editingAgent.url;
      }
      
      setAgents(prev => prev.map(a => a.id === editingAgent.id ? { ...a, ...updatedData } : a));
      setEditingAgent(null);
      setIsModalOpen(false);
      telemetryService.logEvent('agent_updated', { agentId: editingAgent.id });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err.message);
      telemetryService.logError(err, { context: 'edit_agent', agentId: editingAgent.id });
    } finally {
      setIsLoading(false);
    }
  };


  const openModalForEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setNewAgentUrl(agent.url);
    setAgentName(agent.name);
    setAgentDescription(agent.description);
    setError(null);
    setIsModalOpen(true);
  };

  const openModalForAdd = () => {
    setEditingAgent(null);
    setNewAgentUrl('');
    setAgentName('');
    setAgentDescription('');
    setError(null);
    setIsModalOpen(true);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAgent(null);
    setError(null);
  }

  const toggleAgentEnabled = (id: string) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, isEnabled: !a.isEnabled } : a));
  };

  const deleteAgent = (id: string) => {
    if (window.confirm("Are you sure you want to delete this agent?")) {
      setAgents(prev => prev.filter(a => a.id !== id));
      telemetryService.logEvent('agent_deleted', { agentId: id });
    }
  };

  const refreshAgentData = useCallback(async (agentToRefresh: Agent) => {
    setRefreshingAgentId(agentToRefresh.id);
    setAgents(prev => prev.map(a => a.id === agentToRefresh.id ? { ...a, status: 'loading' } : a));
    try {
      const refreshedData = await fetchAgentJson(agentToRefresh.url, agentToRefresh.id);
      setAgents(prev => prev.map(a => a.id === agentToRefresh.id ? { ...a, ...refreshedData, status: 'online' } : a));
      telemetryService.logEvent('agent_refreshed', { agentId: agentToRefresh.id });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error(`Failed to refresh agent ${agentToRefresh.name}:`, err);
      setAgents(prev => prev.map(a => a.id === agentToRefresh.id ? { ...a, status: 'error', lastRefreshed: new Date().toISOString() } : a));
      telemetryService.logError(err, { context: 'refresh_agent', agentId: agentToRefresh.id });
    } finally {
      setRefreshingAgentId(null);
    }
  }, [fetchAgentJson, setAgents]);
  
  // Periodically refresh enabled agents (example: every 5 minutes)
  // This is a basic implementation. A more robust solution might use WebSockets or server-sent events.
  useEffect(() => {
    const intervalId = setInterval(() => {
      agents.forEach(agent => {
        if (agent.isEnabled && agent.status !== 'loading') { // Don't auto-refresh if already loading
          // console.log(`Auto-refreshing agent: ${agent.name}`);
          // refreshAgentData(agent); // This could cause too many requests.
                                  // For now, let's just log. User can manually refresh.
        }
      });
    }, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(intervalId);
  }, [agents, refreshAgentData]);


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-zinc-50">Manage Agents</h1>
        <Button onClick={openModalForAdd} leftIcon={<PlusIcon className="w-5 h-5" />}>
          Register Agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <Card>
          <p className="text-center text-gray-600 dark:text-zinc-400 py-8">
            No agents registered yet. Click "Register Agent" to add your first A2A agent.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map(agent => (
            <AgentCard 
              key={agent.id} 
              agent={agent} 
              onToggle={toggleAgentEnabled} 
              onRefresh={refreshAgentData}
              onEdit={openModalForEdit}
              onDelete={deleteAgent}
              isLoadingRefresh={refreshingAgentId === agent.id && agent.status === 'loading'}
            />
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingAgent ? "Edit Agent" : "Register New Agent"}>
        <div className="space-y-4">
          <Input
            label="Agent Manifest URL (agent.json)"
            type="url"
            placeholder="https://example.com/agent.json"
            value={newAgentUrl}
            onChange={(e) => setNewAgentUrl(e.target.value)}
            required
          />
          {editingAgent && ( // Only show name/desc fields if editing, as they are primarily from agent.json
            <>
              <Input
                label="Agent Name (Overrides manifest if set)"
                type="text"
                placeholder="My Awesome Agent"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
              />
              <Textarea
                label="Agent Description (Overrides manifest if set)"
                placeholder="Describe what this agent does..."
                value={agentDescription}
                onChange={(e) => setAgentDescription(e.target.value)}
                textareaClassName="h-24"
              />
            </>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <Button variant="secondary" onClick={closeModal}>Cancel</Button>
          <Button onClick={editingAgent ? handleEditAgent : handleAddAgent} isLoading={isLoading}>
            {editingAgent ? "Save Changes" : "Register Agent"}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default AgentsPage;