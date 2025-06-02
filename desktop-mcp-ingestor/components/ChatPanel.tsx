
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, AgentToolDefinition } from '../types'; // Added AgentToolDefinition
import { Icons } from '../constants';
import ChatMessageItem from './ChatMessageItem';
import ChatToolsPane from './ChatToolsPane';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isSending: boolean; // Represents agent processing now
  currentTheme: 'dark' | 'light';
  availableAgentTools: AgentToolDefinition[]; // Tools from the backend agent
  toolStates: Record<string, boolean>; 
  onToolSelect: (toolName: string) => void; 
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
  messages, 
  onSendMessage, 
  isSending, 
  currentTheme,
  availableAgentTools, // New prop
  toolStates,
  onToolSelect
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isToolsPaneOpen, setIsToolsPaneOpen] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
  };

  const handleSendMessageClick = async () => {
    if (inputText.trim() && !isSending) {
      await onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isSending) {
      e.preventDefault();
      handleSendMessageClick();
    }
  };

  const inputBgClass = currentTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-100';
  const inputBorderClass = currentTheme === 'dark' ? 'border-gray-700': 'border-gray-300';
  const textColorClass = currentTheme === 'dark' ? 'text-gray-100' : 'text-gray-900';
  const panelToolsPaneBorderClass = currentTheme === 'dark' ? 'border-gray-700' : 'border-gray-300';


  return (
    <div className="flex flex-col h-full panel">
      <div className="flex flex-grow overflow-hidden">
        {isToolsPaneOpen && (
          <div className={`w-48 md:w-56 shrink-0 border-r ${panelToolsPaneBorderClass} transition-all duration-300 ease-in-out`}>
            <ChatToolsPane
              availableAgentTools={availableAgentTools} // Pass down agent tools
              toolStates={toolStates}
              onToolSelect={onToolSelect}
              currentTheme={currentTheme}
            />
          </div>
        )}

        <div className="flex flex-col flex-grow p-2 md:p-4 overflow-hidden">
          <div className="flex-grow overflow-y-auto mb-4 pr-2 space-y-1">
            {messages.map((msg) => (
              <ChatMessageItem key={msg.id} message={msg} />
            ))}
            {/* The loading indicator for agent typing is now handled by ChatMessageItem's isLoading prop for the last agent message */}
            <div ref={messagesEndRef} />
          </div>

          <div className={`flex items-center space-x-2 p-2 rounded-md ${inputBgClass} border ${inputBorderClass}`}>
             <button
              onClick={() => setIsToolsPaneOpen(!isToolsPaneOpen)}
              className={`p-2 rounded-md hover:opacity-75 ${currentTheme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'}`}
              title={isToolsPaneOpen ? "Hide Tools Pane" : "Show Tools Pane"}
              aria-label={isToolsPaneOpen ? "Hide Tools Pane" : "Show Tools Pane"}
            >
              {isToolsPaneOpen ? Icons.chevronDoubleLeft : Icons.sidebarToggle}
            </button>
            <textarea
              value={inputText}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type your message to the agent..."
              className={`flex-grow p-2 bg-transparent focus:outline-none resize-none ${textColorClass}`}
              rows={Math.min(3, Math.max(1, inputText.split('\n').length))}
              disabled={isSending}
              aria-label="Chat input"
            />
            <button
              onClick={handleSendMessageClick}
              disabled={isSending || !inputText.trim()}
              className="p-2 button-accent rounded-full"
              aria-label="Send message"
            >
              {isSending ? (
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: currentTheme === 'dark' ? 'var(--accent-text-dark)' : 'var(--accent-text-light)', borderTopColor: 'transparent' }}>
                </div>
              ) : Icons.send}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
