
import React, { useState, useEffect, useRef, useMemo, ChangeEvent } from 'react';
import { ChatMessage as ChatMessageType, MessageSender, Agent, McpServer, AppSettings } from '../types'; 
import { geminiService } from '../services/geminiService';
import { localStorageService } from '../services/localStorageService';
import useLocalStorage from '../hooks/useLocalStorage'; 
import ChatMessage from '../components/ChatMessage';
import Textarea from '../components/Textarea'; // Changed from Input
import Button from '../components/Button';
// Removed Card import as layout changes
import { Chat } from '@google/genai'; 
import { ACCENT_COLOR, LOCAL_STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants';
import SpinnerIcon from '../components/icons/SpinnerIcon';
import ChatIcon from '../components/icons/ChatIcon'; 
import SettingsIcon from '../components/icons/SettingsIcon';
import SendIcon from '../components/icons/SendIcon';
import PanelLeftIcon from '../components/icons/PanelLeftIcon';
import ChevronDoubleLeftIcon from '../components/icons/ChevronDoubleLeftIcon';
import ChatToolsPane from '../components/ChatToolsPane';
import { telemetryService } from '../services/telemetryService';
import { mcpClientService } from '../services/mcpClientService'; 
import { Link } from 'react-router-dom';

const AssistantPage: React.FC = () => {
  const [messages, setMessages] = useLocalStorage<ChatMessageType[]>(LOCAL_STORAGE_KEYS.CHAT_HISTORY, []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [appSettings] = useLocalStorage<AppSettings>(LOCAL_STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);

  const [isToolsPaneOpen, setIsToolsPaneOpen] = useState(false);

  const assistantConfig = useMemo(() => ({
    model: appSettings.assistantModel,
    temperature: appSettings.assistantTemperature,
    systemInstruction: appSettings.assistantSystemPrompt,
    topK: appSettings.assistantTopK,
    topP: appSettings.assistantTopP,
    enableThinking: appSettings.assistantEnableThinking,
  }), [
    appSettings.assistantModel, 
    appSettings.assistantTemperature, 
    appSettings.assistantSystemPrompt,
    appSettings.assistantTopK,
    appSettings.assistantTopP,
    appSettings.assistantEnableThinking,
  ]);

  const [agents, setAgents] = useState<Agent[]>([]); // Still fetching agents for /list agents etc.
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);

  useEffect(() => {
    setAgents(localStorageService.getAgents());
    setMcpServers(localStorageService.getMcpServers()); // Fetch MCP servers for the tools pane
  }, []); 

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    console.log("Assistant config changed, re-initializing chat session.", assistantConfig);
    chatSessionRef.current = null; 
  }, [assistantConfig]);

  useEffect(() => {
    if (!chatSessionRef.current) {
        try {
            console.log("Initializing new chat session with config:", assistantConfig);
            chatSessionRef.current = geminiService.createChatSession(assistantConfig);
        } catch (error) {
            console.error("Failed to initialize chat session:", error);
            setMessages(prev => {
              if (prev.find(m => m.text.includes("Error: Could not initialize AI Assistant chat session"))) return prev;
              return [...prev, {
                id: crypto.randomUUID(),
                sender: MessageSender.SYSTEM,
                text: "Error: Could not initialize AI Assistant chat session. Please check API Key and settings.",
                timestamp: Date.now(),
              }];
            });
            telemetryService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'chat_session_init' });
        }
    }
  }, [assistantConfig]);


  const handleCommand = async (command: string, args: string[]): Promise<boolean> => {
    setIsLoading(true);
    let aiResponseText = '';
    let responseData: Record<string, any> | undefined;
    let isCmdResponse = true;


    const currentAgents = localStorageService.getAgents(); // Re-fetch fresh data
    const currentMcpServers = localStorageService.getMcpServers();

    try {
      if (command === '/help') {
        if (args.length === 0) {
          aiResponseText = `Available commands:
  /help [item_name] - Get help for an agent.
  /run <agent_name> [input...] - Simulate running an agent.
  /list agents - List available agents.
  /mcp list-servers - List registered MCP servers and their status.
  /mcp list-tools <server_name_alias> - List tools for a connected MCP server.
  /mcp call-tool <server_name_alias> <tool_name> [JSON_params] - Call a tool on an MCP server.
  /clear - Clear chat history.`;
        } else {
          const itemName = args[0];
          const agent = currentAgents.find(a => a.name.toLowerCase() === itemName.toLowerCase());
          if (agent) {
            const loadingDocMsgId = crypto.randomUUID();
            setMessages(prev => [...prev, {
              id: loadingDocMsgId, sender: MessageSender.ASSISTANT,
              text: `Generating documentation for agent "${agent.name}"...`, timestamp: Date.now(), isLoading: true,
            }]);
            const doc = await geminiService.generateDocumentation(agent.name, 'agent');
            setMessages(prev => prev.map(m => m.id === loadingDocMsgId ? 
              { ...m, text: `Documentation for Agent: ${agent.name}`, data: { documentation: doc }, isLoading: false, isCommandResponse: false } : m
            ));
            aiResponseText = ""; 
            isCmdResponse = false;
            telemetryService.logEvent('command_help_agent_doc_generated', { agentName: agent.name });
          } else {
            aiResponseText = `No agent found named "${itemName}". Try /list agents. For MCP tools, use /mcp list-tools <server_name>.`;
          }
        }
      } else if (command === '/run' && args.length > 0) {
        const agentName = args[0];
        const agentInput = args.slice(1).join(' ');
        const agent = currentAgents.find(a => a.name.toLowerCase() === agentName.toLowerCase());
        if (agent && agent.isEnabled) {
          const simulatedPrompt = `The user wants to run an AI agent named "${agent.name}" (description: ${agent.description}) with the input "${agentInput}". Provide a plausible, concise, simulated output from this agent.`;
          const simulatedOutput = await geminiService.generateText(simulatedPrompt);
          aiResponseText = `Simulating running agent "${agent.name}" with input: "${agentInput}".\n\nSimulated Output:\n${simulatedOutput}`;
          isCmdResponse = false;
          telemetryService.logEvent('command_run_agent', { agentName, input: agentInput });
        } else if (agent && !agent.isEnabled) {
          aiResponseText = `Agent "${agentName}" is disabled. Enable it from the Agents page to run.`;
        } else {
          aiResponseText = `Agent "${agentName}" not found. Try /list agents.`;
        }
      } else if (command === '/list' && args[0] === 'agents') {
         aiResponseText = currentAgents.length > 0 
            ? "Available Agents:\n" + currentAgents.map(a => `- ${a.name} (${a.isEnabled ? 'Enabled' : 'Disabled'})`).join('\n')
            : "No agents registered.";
      
      } else if (command === '/mcp') {
        const subCommand = args[0];
        if (subCommand === 'list-servers') {
          aiResponseText = currentMcpServers.length > 0
            ? "Registered MCP Servers:\n" + currentMcpServers.map(s => `- ${s.name} (${s.configType === 'sse' ? s.url : `STDIO: ${s.stdioConfig?.command}`}) - Status: ${s.status}`).join('\n')
            : "No MCP servers registered. Add them on the Tools page.";
        } else if (subCommand === 'list-tools' && args.length > 1) {
          const serverNameAlias = args[1];
          const server = currentMcpServers.find(s => s.name.toLowerCase() === serverNameAlias.toLowerCase());
          if (server && server.status === 'connected') {
            const tools = await mcpClientService.listTools(server.id);
            aiResponseText = tools.length > 0
              ? `Tools available on server "${server.name}":\n` + tools.map(t => `- ${t.name}${t.description ? ` (${t.description})` : ''}`).join('\n')
              : `No tools found or reported by server "${server.name}".`;
          } else if (server) {
            aiResponseText = `MCP Server "${server.name}" is not connected. Please connect it via the Tools page.`;
          } else {
            aiResponseText = `MCP Server with alias "${serverNameAlias}" not found. Try /mcp list-servers.`;
          }
        } else if (subCommand === 'call-tool' && args.length > 2) {
          const serverNameAlias = args[1];
          const toolName = args[2];
          const paramsString = args.slice(3).join(' ');
          let params = {};
          if (paramsString) {
            try {
              params = JSON.parse(paramsString);
            } catch (e) {
              aiResponseText = `Error: Invalid JSON parameters provided for ${toolName}. Please provide a valid JSON string. Example: {"param_name": "value"}`;
              setIsLoading(false); 
              setMessages(prev => [...prev, { id: crypto.randomUUID(), sender: MessageSender.ASSISTANT, text: aiResponseText, timestamp: Date.now(), isCommandResponse: true }]);
              return true;
            }
          }

          const server = currentMcpServers.find(s => s.name.toLowerCase() === serverNameAlias.toLowerCase());
          if (server && server.status === 'connected') {
            const callingMsgId = crypto.randomUUID();
            setMessages(prev => [...prev, {
              id: callingMsgId, sender: MessageSender.ASSISTANT,
              text: `Calling tool "${toolName}" on server "${server.name}" with params: ${JSON.stringify(params)}...`, 
              timestamp: Date.now(), isLoading: true, isCommandResponse: true
            }]);
            try {
              const result = await mcpClientService.callTool(server.id, toolName, params);
              setMessages(prev => prev.map(m => m.id === callingMsgId ? 
                { ...m, text: `Result from tool "${toolName}":\n${JSON.stringify(result, null, 2)}`, isLoading: false, isCommandResponse: true } : m
              ));
              aiResponseText = ""; 
              telemetryService.logEvent('mcp_tool_called_via_chat', { serverName: server.name, toolName });
            } catch (e) {
              const err = e instanceof Error ? e : new Error(String(e));
              setMessages(prev => prev.map(m => m.id === callingMsgId ?
                {...m, text: `Error calling tool "${toolName}" on "${server.name}": ${err.message}`, isLoading: false, isCommandResponse: true } : m
              ));
              aiResponseText = ""; 
              telemetryService.logError(err, { context: 'mcp_call_tool_chat' });
            }
          } else if (server) {
            aiResponseText = `MCP Server "${server.name}" is not connected.`;
          } else {
            aiResponseText = `MCP Server alias "${serverNameAlias}" not found.`;
          }
        } else {
          aiResponseText = "Unknown /mcp command. Try /help for available MCP commands.";
        }
      } else if (command === '/clear') {
        setMessages([{
            id: crypto.randomUUID(), sender: MessageSender.SYSTEM,
            text: "Chat history cleared by user.", timestamp: Date.now(),
        }]);
        telemetryService.logEvent('chat_cleared');
        setIsLoading(false);
        return true; 
      }
      else {
        setIsLoading(false);
        return false; 
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      aiResponseText = `Error processing command: ${err.message}`;
      telemetryService.logError(err, { context: 'chat_command_processing', command, args });
    } finally {
      if (aiResponseText) { 
          setMessages(prev => [...prev, {
          id: crypto.randomUUID(), sender: MessageSender.ASSISTANT,
          text: aiResponseText, timestamp: Date.now(), data: responseData, isCommandResponse: isCmdResponse
        }]);
      }
      setIsLoading(false);
    }
    return true; 
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(), sender: MessageSender.USER,
      text: trimmedInput, timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    if (trimmedInput.startsWith('/')) {
      const parts = trimmedInput.split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);
      setIsLoading(true); 
      const commandHandled = await handleCommand(command, args);
      if (commandHandled) {
        return;
      }
      setIsLoading(false);
    }
    
    if (!chatSessionRef.current) {
        const errorMsg = "AI Assistant is not available (chat session not initialized or API key missing). Please check settings.";
        setMessages(prev => [...prev, {
            id: crypto.randomUUID(), sender: MessageSender.ASSISTANT,
            text: errorMsg, timestamp: Date.now(),
        }]);
        setIsLoading(false); 
        telemetryService.logError(new Error("Chat session not initialized for sending message."), { context: 'chat_send_message' });
        return;
    }
    
    setIsLoading(true); 
    const assistantLoadingMessageId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantLoadingMessageId, sender: MessageSender.ASSISTANT,
      text: "", timestamp: Date.now(), isLoading: true,
    }]);

    let accumulatedText = "";
    try {
      await geminiService.sendMessageStream(
        chatSessionRef.current, trimmedInput,
        (chunkText) => { 
          accumulatedText += chunkText;
          setMessages(prev => prev.map(m => 
            m.id === assistantLoadingMessageId ? { ...m, text: accumulatedText, isLoading: true } : m
          ));
        },
        (error) => { 
          console.error("Streaming error in AssistantPage:", error);
          setMessages(prev => prev.map(m => 
            m.id === assistantLoadingMessageId ? { ...m, text: `Error: ${error.message}`, isLoading: false } : m
          ));
          telemetryService.logError(error, { context: 'chat_stream_error' });
          setIsLoading(false); 
        },
        () => { 
          setMessages(prev => prev.map(m => 
            m.id === assistantLoadingMessageId 
              ? { 
                  ...m, 
                  text: accumulatedText.trim() || "[Assistant provided no response]", 
                  isLoading: false 
                } 
              : m
          ));
          setIsLoading(false); 
        }
      );
      telemetryService.logEvent('chat_message_sent', { inputLength: trimmedInput.length });
    } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setMessages(prev => prev.map(m => 
          m.id === assistantLoadingMessageId ? { ...m, text: `Error communicating with AI: ${err.message}`, isLoading: false } : m
        ));
        setIsLoading(false);
        telemetryService.logError(err, { context: 'chat_send_message_gemini' });
    }
  };

  const handleToolPaneSelect = (serverName: string, toolName: string) => {
    const commandText = `/mcp call-tool ${serverName} ${toolName} `;
    setInput(commandText);
    inputRef.current?.focus();
  };

  const currentThemeMode = useMemo(() => {
    if (appSettings.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return appSettings.theme;
  }, [appSettings.theme]);


  return (
    <div className="flex flex-col h-full"> {/* Outer container uses card-background by default from Layout */}
      <div className="flex flex-grow overflow-hidden bg-[var(--card-background)] shadow-md rounded-lg">
        {isToolsPaneOpen && (
          <div className={`w-56 md:w-64 flex-shrink-0 border-r ${currentThemeMode === 'dark' ? 'border-zinc-700' : 'border-gray-300'} transition-all duration-300 ease-in-out`}>
            <ChatToolsPane
              mcpServers={mcpServers.filter(s => s.status === 'connected')}
              currentTheme={currentThemeMode}
              onToolSelect={handleToolPaneSelect}
            />
          </div>
        )}
        <div className="flex-grow flex flex-col overflow-hidden">
          <div className="flex-grow overflow-y-auto p-4 space-y-2 bg-[var(--chat-area-background)]">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <ChatIcon className={`w-16 h-16 text-gray-400 dark:text-zinc-600 mb-4`} />
                <p className="text-lg text-gray-600 dark:text-zinc-400">AI Assistant Ready</p>
                <p className="text-sm text-gray-500 dark:text-zinc-500">Type a message or command (e.g., /help) to get started. Toggle tools with the panel icon.</p>
              </div>
            )}
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className={`p-3 border-t ${currentThemeMode === 'dark' ? 'border-zinc-700' : 'border-gray-300'} bg-[var(--card-background)]`}> {/* Use card-background for consistency */}
            <div className="flex items-end space-x-2">
              <Button
                variant="ghost"
                size="md" 
                onClick={() => setIsToolsPaneOpen(!isToolsPaneOpen)}
                title={isToolsPaneOpen ? "Hide Tools Pane" : "Show Tools Pane"}
                aria-label={isToolsPaneOpen ? "Hide Tools Pane" : "Show Tools Pane"}
                className="p-2 self-center" 
              >
                {isToolsPaneOpen ? <ChevronDoubleLeftIcon className="w-5 h-5" /> : <PanelLeftIcon className="w-5 h-5" />}
              </Button>
              <Textarea
                ref={inputRef}
                placeholder="Type your message or command (e.g. /help)..."
                value={input}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-grow"
                disabled={isLoading}
                textareaClassName="py-2.5 rounded-md min-h-[44px] max-h-32 resize-none" 
                rows={1} 
              />
              <Button 
                onClick={handleSend} 
                isLoading={isLoading} 
                disabled={!input.trim()} 
                className="px-4 py-2.5 self-end" 
                aria-label="Send message"
              >
                {isLoading ? <SpinnerIcon className="w-5 h-5" /> : <SendIcon className="w-5 h-5" />}
              </Button>
            </div>
            <div className="mt-2 text-right">
                <Link to="/settings#assistant" className={`text-xs text-[var(--accent-text)] hover:underline`}>
                  <SettingsIcon className="w-3 h-3 inline-block mr-1" />
                  Assistant Settings
                </Link>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantPage;