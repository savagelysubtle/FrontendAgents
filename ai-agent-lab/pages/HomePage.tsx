import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import AgentIcon from '../components/icons/AgentIcon';
import ToolIcon from '../components/icons/ToolIcon';
import ChatIcon from '../components/icons/ChatIcon';
import { localStorageService } from '../services/localStorageService';
// import { ACCENT_COLOR } from '../constants'; // ACCENT_COLOR might not be directly used if CSS vars cover all cases
import { usePWAInstall } from '../hooks/usePWAInstall';

const HomePage: React.FC = () => {
  const agents = localStorageService.getAgents();
  const mcpServers = localStorageService.getMcpServers(); // Changed from getTools()
  const [deferredPrompt, triggerInstallPrompt, isAppInstalled] = usePWAInstall();

  const QuickActionCard: React.FC<{ title: string; description: string; linkTo: string; icon: React.ReactNode }> = ({ title, description, linkTo, icon }) => (
    <div className={`bg-white dark:bg-zinc-900 shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow duration-200 border-l-4 border-[var(--accent-text)]`}> {/* Used --accent-text for border color */}
      <div className="flex items-center space-x-4">
        <div className={`p-3 rounded-full bg-[var(--accent-soft-bg)] text-[var(--accent-soft-text)]`}>
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{description}</p>
        </div>
      </div>
      <div className="mt-4">
        <Link to={linkTo}>
          <Button variant="primary" size="sm" className="w-full">
            Go to {title}
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <Card>
        <div className="text-center">
          <h1 className={`text-3xl font-bold text-[var(--text-primary)]`}>Welcome to the <span className={`text-[var(--accent-text)]`}>AI Agent Lab</span></h1>
          <p className="mt-2 text-lg text-[var(--text-secondary)]">Manage, test, and improve your AI agents and tools efficiently.</p>
          {!isAppInstalled && deferredPrompt && (
            <div className="mt-6">
              <Button onClick={triggerInstallPrompt} variant="primary" size="lg">
                Install AI Agent Lab App
              </Button>
              <p className="text-xs text-[var(--text-subtle)] mt-2">For the best experience, install this app to your device.</p>
            </div>
          )}
           {isAppInstalled && (
             <p className="mt-4 text-sm text-green-600 dark:text-green-400">App installed. You're all set!</p>
           )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <QuickActionCard 
          title="Manage Agents" 
          description={`Currently tracking ${agents.length} agent(s). Register, monitor, and configure your A2A agents.`}
          linkTo="/agents"
          icon={<AgentIcon className="w-6 h-6" />}
        />
        <QuickActionCard 
          title="Manage Tools" 
          description={`Manage ${mcpServers.length} MCP server(s). Connect to access and utilize available tools.`} // Updated description
          linkTo="/tools"
          icon={<ToolIcon className="w-6 h-6" />}
        />
        <QuickActionCard 
          title="AI Assistant" 
          description="Interact with your agents and tools via a chat interface. Get AI-generated documentation."
          linkTo="/assistant"
          icon={<ChatIcon className="w-6 h-6" />}
        />
      </div>

      <Card title="Recent Activity (Placeholder)">
        <p className="text-[var(--text-secondary)]">
          This section will display recent activities such as agent status changes, new tool registrations, or important assistant interactions.
        </p>
        <ul className="mt-4 space-y-2">
          <li className={`p-3 rounded-md bg-[var(--list-item-background)]`}>
            <span className="font-medium text-[var(--text-primary)]">Agent "TaskMaster"</span>
            <span className="text-[var(--text-secondary)]"> status changed to </span>
            <span className="text-[var(--accent-text)]">Online</span>.
            <span className="text-[var(--text-subtle)]"> (10 min ago)</span>
          </li>
          <li className={`p-3 rounded-md bg-[var(--list-item-background)]`}>
            <span className="font-medium text-[var(--text-primary)]">Tool "ImageResizer"</span>
            <span className="text-[var(--text-secondary)]"> v1.2 registered. </span>
            <span className="text-[var(--text-subtle)]"> (1 hour ago)</span>
          </li>
        </ul>
      </Card>
    </div>
  );
};

export default HomePage;