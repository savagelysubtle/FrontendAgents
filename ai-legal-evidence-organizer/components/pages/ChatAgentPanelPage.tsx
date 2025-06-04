
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../contexts/AppContext';
import { ChatMessage as AppChatMessage, EvidenceFile, WcatCase, AiTool as AppAiTool, DynamicMarker } from '../../types'; 
import { 
    getChatResponseStream as oldGetChatResponseStream, 
    resetChatSession, 
    summarizeEvidenceText,
    extractWcatCaseInfoFromText 
} from '../../services/geminiService';
import { searchWcatDecisions, fetchAndProcessWcatPdf } from '../../services/wcatService';
import LoadingSpinner from '../ui/LoadingSpinner';
import { SIMULATED_CONTEXT_WINDOW_TOKENS, SIMULATED_TOKEN_WARNING_THRESHOLD } from '../../constants';
import ChatContextSidebar from '../ui/ChatContextSidebar';
import { v4 as uuidv4 } from 'uuid';

// AG-UI Imports
import { GeminiAgUiAgent } from '../../services/AgUiAgentService';
import { 
    RunAgentInput, BaseEvent, EventType, Message as AgUiMessage, Tool as AgUiToolDefinition, Context as AgUiClientContextType, ToolCall, Message, CustomEvent, // Renamed Context to AgUiClientContextType
    RunStartedEvent, TextMessageStartEvent, TextMessageContentEvent, TextMessageEndEvent, ToolCallStartEvent, ToolCallArgsEvent, ToolCallEndEvent, RunFinishedEvent, RunErrorEvent
} from "@ag-ui/client";
import { Observable, Subscription } from "rxjs";

const UserIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" /></svg>;
const AiIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.22 5.222a.75.75 0 011.06 0l1.25 1.25a.75.75 0 010 1.06l-1.25 1.25a.75.75 0 01-1.06 0l-1.25-1.25a.75.75 0 010-1.06l1.25-1.25zM4.47 9.47a.75.75 0 011.06 0l1.25 1.25a.75.75 0 010 1.06l-1.25 1.25a.75.75 0 01-1.06-1.06l1.25-1.25a.75.75 0 010-1.06l-1.25-1.25a.75.75 0 010-1.06zM11.97 9.47a.75.75 0 011.06 0l1.25 1.25a.75.75 0 010 1.06l-1.25 1.25a.75.75 0 01-1.06-1.06l1.25-1.25a.75.75 0 010-1.06l-1.25-1.25a.75.75 0 010-1.06zM10 3a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 0110 3zM10 15a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 0110 15zM4.646 4.646a.75.75 0 011.061 0l.5.5a.75.75 0 01-1.06 1.061l-.5-.5a.75.75 0 010-1.061zM13.793 13.793a.75.75 0 011.06 0l.5.5a.75.75 0 01-1.06 1.06l-.5-.5a.75.75 0 010-1.06zM3.75 10a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75zm11.75 0a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75zM5.707 13.793a.75.75 0 010-1.06l.5-.5a.75.75 0 111.06 1.06l-.5.5a.75.75 0 01-1.06 0zM12.732 5.707a.75.75 0 010-1.06l.5-.5a.75.75 0 011.061 1.06l-.5.5a.75.75 0 01-1.06 0z" clipRule="evenodd" /></svg>;
const SaveIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

const estimateTokens = (text: string = ''): number => Math.ceil(text.length / 4);

// Assuming Context type from @ag-ui/client is structurally { value: string; description: string; }
// This is based on the error messages. If it's different, this needs to change.
interface AgUiClientContext {
  value: string;
  description: string;
}


const ChatAgentPanelPage: React.FC = () => {
  const {
    chatHistory: appChatHistory, addChatMessage: addCompleteChatMessageToAppContext, clearChatHistory,
    files, wcatCases, policyManuals, 
    setIsLoading: setAppIsLoading, isLoading: isAppLoading,
    setError, addAuditLogEntry, apiKey,
    mcpClient, isMcpClientLoading, updateFile, getFileById,
    addWcatCase, getWcatCaseByDecisionNumber, generateAndAssignWcatPatternTags, getWcatCaseById,
    saveChatSession, loadChatSession: loadSessionFromContext,
    tools: appTools, selectedToolIdsForContext, toggleToolContext,
    selectedFileIdsForContext, toggleFileContext,
    selectedWcatCaseIdsForContext, toggleWcatCaseContext,
    setDynamicMarkersForFile 
  } = useAppContext();

  const [userInput, setUserInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [currentTotalEstTokens, setCurrentTotalEstTokens] = useState(0);
  const [isContextSidebarHidden, setIsContextSidebarHidden] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // AG-UI specific state
  const [agUiAgent, setAgUiAgent] = useState<GeminiAgUiAgent | null>(null);
  const [currentAgUiSubscription, setCurrentAgUiSubscription] = useState<Subscription | null>(null);
  const [streamingAgUiMessage, setStreamingAgUiMessage] = useState<AgUiMessage | null>(null);
  const [currentToolCalls, setCurrentToolCalls] = useState<Record<string, Partial<ToolCall & { argsString?: string }>>>({}); 
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string>(uuidv4()); 


  useEffect(() => {
    const agent = new GeminiAgUiAgent({ mcpClient: mcpClient });
    setAgUiAgent(agent);
    
    return () => {
      currentAgUiSubscription?.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcpClient]); 

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [appChatHistory, streamingAgUiMessage]);

  useEffect(() => {
    let tokens = 0;
    tokens += estimateTokens(userInput);
    appChatHistory.forEach(msg => tokens += estimateTokens(msg.text));
    if (streamingAgUiMessage) tokens += estimateTokens(streamingAgUiMessage.content as string);
    
    files.filter(f => selectedFileIdsForContext.includes(f.id)).forEach(f => {
        tokens += estimateTokens(f.summary) + estimateTokens(f.content);
    });
    wcatCases.filter(c => selectedWcatCaseIdsForContext.includes(c.id)).forEach(c => {
        tokens += estimateTokens(c.aiSummary) + estimateTokens(c.rawTextContent);
    });
    appTools.filter(t => selectedToolIdsForContext.includes(t.id)).forEach(t => {
        tokens += estimateTokens(t.name) + estimateTokens(t.description) + estimateTokens(t.usageExample);
    });
    setCurrentTotalEstTokens(tokens);
  }, [userInput, appChatHistory, files, selectedFileIdsForContext, wcatCases, selectedWcatCaseIdsForContext, appTools, selectedToolIdsForContext, streamingAgUiMessage]);

  const frontendAgUiTools: AgUiToolDefinition[] = [
    {
      name: "deepSearchWcat",
      description: "Performs a deep search for WCAT precedents using specific criteria, ingests them, and generates pattern tags.",
      parameters: { 
        type: "object",
        properties: {
          query: { type: "string", description: "The search query for WCAT cases." },
        },
        required: ["query"],
      }
    },
    {
      name: "extractMarkersFromFile",
      description: "Extracts key legal markers (admissions, contradictions, etc.) from a specified evidence file's content or summary. The AI may also return a structured payload 'AI_MARKERS_PAYLOAD: [...]' for direct display.",
      parameters: {
        type: "object",
        properties: { fileId: { type: "string", description: "The ID of the evidence file to analyze." } },
        required: ["fileId"]
      }
    }
  ];

  const executeFrontendTool = async (toolName: string, args: any): Promise<any> => {
    addAuditLogEntry('AGUI_TOOL_EXEC_START', `Executing AG-UI tool: ${toolName} with args: ${JSON.stringify(args)}`);
    let result: any;
    try {
        switch (toolName) {
            case "deepSearchWcat":
                if (!args.query || typeof args.query !== 'string') {
                    throw new Error("Missing or invalid 'query' argument for deepSearchWcat.");
                }
                await handleDeepWcatSearchAndIngest(args.query);
                result = `WCAT deep search for "${args.query}" initiated. Check chat history for progress and results.`;
                break;
            case "extractMarkersFromFile":
                if (!args.fileId || typeof args.fileId !== 'string') {
                    throw new Error("Missing or invalid 'fileId' argument for extractMarkersFromFile.");
                }
                const fileToAnalyze = getFileById(args.fileId);
                if (!fileToAnalyze) throw new Error(`File with ID "${args.fileId}" not found.`);
                
                let textToAnalyze = fileToAnalyze.content || fileToAnalyze.summary || '';
                if (!textToAnalyze && fileToAnalyze.mcpPath && mcpClient && mcpClient.ready) {
                    addCompleteChatMessageToAppContext({ sender: 'ai', text: `Fetching content for ${fileToAnalyze.name} to extract markers...` });
                    const mcpFile = await mcpClient.readFile(fileToAnalyze.mcpPath);
                    if (mcpFile?.content) {
                        textToAnalyze = mcpFile.content;
                        updateFile(fileToAnalyze.id, { content: textToAnalyze }); 
                    } else {
                        throw new Error(`Could not load content for ${fileToAnalyze.name} from MCP.`);
                    }
                }
                if (!textToAnalyze) throw new Error(`No content available for ${fileToAnalyze.name}.`);
                
                result = await summarizeEvidenceText(textToAnalyze); 
                break;
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
        addAuditLogEntry('AGUI_TOOL_EXEC_SUCCESS', `Tool ${toolName} executed. Result: ${JSON.stringify(result).substring(0,100)}...`);
        return result;
    } catch (error: any) {
        addAuditLogEntry('AGUI_TOOL_EXEC_ERROR', `Error executing tool ${toolName}: ${error.message}`);
        return { error: error.message };
    }
  };
  
  const handleDeepWcatSearchAndIngest = async (originalQuery: string): Promise<string> => {
    let logMessages: string[] = [`Starting deep WCAT search for: "${originalQuery}"...`];
    addCompleteChatMessageToAppContext({sender: 'ai', text: logMessages[logMessages.length - 1]});
    
    let currentQuery = originalQuery;
    try {
        logMessages.push("Expanding search query with AI...");
        addCompleteChatMessageToAppContext({sender: 'ai', text: logMessages[logMessages.length - 1]});
        currentQuery = await summarizeEvidenceText(`Expand this search query: ${originalQuery}`); 
        logMessages.push(`Expanded query: "${currentQuery}". Now searching WCAT (simulated deep search)...`);
        addCompleteChatMessageToAppContext({sender: 'ai', text: logMessages[logMessages.length - 1]});
    } catch (expansionError: any) {
        logMessages.push(`Could not expand query: ${expansionError.message}. Proceeding with original query.`);
        addCompleteChatMessageToAppContext({sender: 'ai', text: logMessages[logMessages.length - 1]});
    }
    const searchResults = await searchWcatDecisions(currentQuery, undefined, undefined, 'all', true);
    if (searchResults.length === 0) {
        logMessages.push("No WCAT decisions found for your query.");
        addCompleteChatMessageToAppContext({sender: 'ai', text: logMessages[logMessages.length - 1]});
        return logMessages.join("\n");
    }
    logMessages.push(`Found ${searchResults.length} potential WCAT decisions. Starting ingestion and analysis... (This may take some time)`);
    addCompleteChatMessageToAppContext({sender: 'ai', text: logMessages[logMessages.length - 1]});
    let ingestedCount = 0;
    for (const sr of searchResults) {
      if (getWcatCaseByDecisionNumber(sr.decisionNumber)) {
        logMessages.push(`Case ${sr.decisionNumber} already in database. Skipping.`);
        addCompleteChatMessageToAppContext({sender: 'ai', text: logMessages[logMessages.length - 1]});
        continue;
      }
      try {
        logMessages.push(`Processing ${sr.decisionNumber}...`);
        addCompleteChatMessageToAppContext({sender: 'ai', text: logMessages[logMessages.length - 1]});
        const caseDataPartial = await fetchAndProcessWcatPdf(sr.pdfUrl, sr.decisionNumber, addAuditLogEntry, mcpClient);
        const newCase = await addWcatCase(caseDataPartial as Omit<WcatCase, 'id' | 'ingestedAt' | 'tags'>);
        await generateAndAssignWcatPatternTags(newCase.id);
        const finalCase = getWcatCaseById(newCase.id); 
        const patternNames = finalCase?.tags.filter(t => t.scope === 'wcat_pattern').map(t => t.name).join(', ') || 'None';
        logMessages.push(`Successfully ingested ${sr.decisionNumber}. MCP Path: ${newCase.mcpPath || 'N/A'}. Identified patterns: ${patternNames}`);
        addCompleteChatMessageToAppContext({sender: 'ai', text: logMessages[logMessages.length - 1]});
        ingestedCount++;
      } catch (ingestError: any) {
        logMessages.push(`Failed to ingest ${sr.decisionNumber}: ${ingestError.message}`);
        addCompleteChatMessageToAppContext({sender: 'ai', text: logMessages[logMessages.length - 1]});
      }
    }
    logMessages.push(`Deep search and ingestion complete. ${ingestedCount} new cases processed.`);
    addCompleteChatMessageToAppContext({sender: 'ai', text: logMessages[logMessages.length - 1]});
    return logMessages.join("\n");
  };


  const runAgentWithInput = (messages: AgUiMessage[], currentRunIdOverride?: string) => {
    if (!agUiAgent || !agUiAgent.publicRun) return; 

    currentAgUiSubscription?.unsubscribe(); 

    const runInputId = currentRunIdOverride || uuidv4();
    if (!currentRunIdOverride) { 
        setCurrentRunId(runInputId);
    }

    const relevantContextFiles = files.filter(f => selectedFileIdsForContext.includes(f.id));
    const relevantContextWcatCases = wcatCases.filter(c => selectedWcatCaseIdsForContext.includes(c.id));
    const relevantContextAppAiTools = appTools.filter(t => selectedToolIdsForContext.includes(t.id));

    const contextPayload = {
        appRelevantFiles: relevantContextFiles,
        appRelevantWcatCases: relevantContextWcatCases,
        appRelevantAppAiTools: relevantContextAppAiTools,
        appSelectedFileIdsForContext: selectedFileIdsForContext,
        appSelectedWcatCaseIdsForContext: selectedWcatCaseIdsForContext,
        appSelectedAppAiToolIdsForContext: selectedToolIdsForContext,
    };
    
    const agUiContextForRun: AgUiClientContext[] = [
        {
            value: JSON.stringify(contextPayload),
            description: "Aggregated application context for the AI Legal Evidence Organizer chat agent."
        }
    ];
    
    const runAgentInputTyped: RunAgentInput = { 
      runId: runInputId,
      threadId: currentThreadId, 
      messages, 
      tools: frontendAgUiTools,
      context: agUiContextForRun as AgUiClientContextType[], // Cast to library's Context[] type if AgUiClientContext is a local alias
    };

    setAppIsLoading(true);
    const runObservable = agUiAgent.publicRun(runAgentInputTyped); 

    const subscription = runObservable.subscribe({
      next: (event: BaseEvent) => {
        const eventRunId = (event as any).runId || runInputId; 
        switch (event.type) {
          case EventType.RUN_STARTED:
            const runStartedEvent = event as RunStartedEvent;
            addAuditLogEntry('AGUI_RUN_STARTED', `Run ID: ${runStartedEvent.runId}`);
            setStreamingAgUiMessage(null); 
            break;
          case EventType.TEXT_MESSAGE_START:
            const textMessageStartEvent = event as TextMessageStartEvent;
            setStreamingAgUiMessage({
              id: textMessageStartEvent.messageId,
              role: "assistant", 
              content: "", 
            });
            break;
          case EventType.TEXT_MESSAGE_CONTENT:
            const textMessageContentEvent = event as TextMessageContentEvent;
            setStreamingAgUiMessage(prev => prev ? { ...prev, content: (prev.content || "") + textMessageContentEvent.delta } : null);
            break;
          case EventType.TEXT_MESSAGE_END:
            if (streamingAgUiMessage && streamingAgUiMessage.content) {
              addCompleteChatMessageToAppContext({
                sender: 'ai',
                text: streamingAgUiMessage.content as string,
                relatedFileIds: selectedFileIdsForContext,
                relatedWcatCaseIds: selectedWcatCaseIdsForContext,
                relatedToolIds: selectedToolIdsForContext,
              });
            }
            setStreamingAgUiMessage(null);
            break;
          case EventType.TOOL_CALL_START:
            const toolCallStartEvent = event as ToolCallStartEvent;
            const newToolCallEntry: Partial<ToolCall & { argsString?: string }> = {
                id: toolCallStartEvent.toolCallId,
                type: "function",
                function: { name: toolCallStartEvent.toolCallName, arguments: "" },
                argsString: ""
            };
            setCurrentToolCalls(prev => ({
                ...prev,
                [toolCallStartEvent.toolCallId]: newToolCallEntry
            }));
            addCompleteChatMessageToAppContext({ sender: 'ai', text: `🤖 Requesting tool: ${toolCallStartEvent.toolCallName}...` });
            break;
          case EventType.TOOL_CALL_ARGS:
            const toolCallArgsEvent = event as ToolCallArgsEvent;
            setCurrentToolCalls(prev => {
                const existing = prev[toolCallArgsEvent.toolCallId];
                return {
                    ...prev,
                    [toolCallArgsEvent.toolCallId]: { ...existing, argsString: (existing?.argsString || "") + toolCallArgsEvent.delta } 
                };
            });
            break;
          case EventType.TOOL_CALL_END:
            const toolCallEndEvent = event as ToolCallEndEvent;
            const toolCallInfo = currentToolCalls[toolCallEndEvent.toolCallId];
            if (toolCallInfo && toolCallInfo.function?.name) {
                let parsedArgs = {};
                try {
                    if (toolCallInfo.argsString) parsedArgs = JSON.parse(toolCallInfo.argsString);
                } catch (parseError) {
                    console.error("Failed to parse tool call args:", parseError, toolCallInfo.argsString);
                    setError(`AI sent invalid arguments for tool ${toolCallInfo.function.name}.`);
                    setAppIsLoading(false);
                    const errorToolResponse: Message = {
                        id: uuidv4(),
                        role: "tool",
                        toolCallId: toolCallEndEvent.toolCallId,
                        content: JSON.stringify({ error: `Invalid arguments: ${parseError}` }),
                    };
                    runAgentWithInput([...runAgentInputTyped.messages, errorToolResponse], runInputId); 
                    return; 
                }

                addCompleteChatMessageToAppContext({ sender: 'ai', text: `Executing tool: ${toolCallInfo.function.name} with args: ${JSON.stringify(parsedArgs).substring(0, 100)}...` });
                
                executeFrontendTool(toolCallInfo.function.name, parsedArgs).then(toolResult => {
                    const toolResponseMessage: Message = {
                        id: uuidv4(),
                        role: "tool", 
                        toolCallId: toolCallEndEvent.toolCallId,
                        content: JSON.stringify(toolResult), 
                    };
                    
                    const nextMessages: AgUiMessage[] = [
                        ...runAgentInputTyped.messages, 
                        toolResponseMessage
                    ];
                    runAgentWithInput(nextMessages, runInputId); 
                
                }).catch(toolExecError => {
                    setError(`Error during tool execution ${toolCallInfo.function?.name}: ${toolExecError.message}`);
                    setAppIsLoading(false);
                    const errorToolResponse: Message = {
                        id: uuidv4(),
                        role: "tool",
                        toolCallId: toolCallEndEvent.toolCallId,
                        content: JSON.stringify({ error: `Frontend execution error: ${toolExecError.message}` }),
                    };
                    const nextMessages: AgUiMessage[] = [...runAgentInputTyped.messages, errorToolResponse]; 
                    runAgentWithInput(nextMessages, runInputId);
                });
            }
            setCurrentToolCalls(prev => {
                const newState = {...prev};
                delete newState[toolCallEndEvent.toolCallId];
                return newState;
            });
            break;
          case EventType.RUN_FINISHED:
            const runFinishedEvent = event as RunFinishedEvent;
            addAuditLogEntry('AGUI_RUN_FINISHED', `Run ID: ${runFinishedEvent.runId} completed.`);
            setAppIsLoading(false);
            if (runFinishedEvent.runId === currentRunId) { 
                setCurrentRunId(null);
            }
            break;
          case EventType.RUN_ERROR:
            const runErrorEvent = event as RunErrorEvent;
            setError(`AG-UI Run Error: ${runErrorEvent.message}`);
            addAuditLogEntry('AGUI_RUN_ERROR', `Run ID: ${eventRunId}, Error: ${runErrorEvent.message}`); 
            setAppIsLoading(false);
             if (eventRunId === currentRunId) { 
                setCurrentRunId(null);
            }
            break;
          case EventType.CUSTOM:
            const customEvent = event as CustomEvent; 
             if (customEvent.name === 'groundingSources' && Array.isArray(customEvent.value)) { 
                const sources = customEvent.value as Array<{uri:string, title: string}>; 
                if (sources.length > 0) {
                    const sourcesText = sources.map(s => `Source: [${s.title || 'Untitled'}](${s.uri})`).join('\n');
                    addCompleteChatMessageToAppContext({ sender: 'ai', text: `Grounding sources:\n${sourcesText}` });
                }
             } else if (customEvent.name === 'displayEvidenceMarkers' && customEvent.value) { 
                const markerData = customEvent.value as { fileId: string; markers: DynamicMarker[] }; 
                if (markerData.fileId && Array.isArray(markerData.markers)) {
                    setDynamicMarkersForFile(markerData.fileId, markerData.markers);
                    addCompleteChatMessageToAppContext({ sender: 'ai', text: `📝 AI identified ${markerData.markers.length} potential markers in file ${files.find(f=>f.id === markerData.fileId)?.name || markerData.fileId}. View them in the Document Viewer.` });
                }
             }
            break;
          default:
            break;
        }
      },
      error: (err) => {
        setError(`AG-UI Observable Error: ${err.message || 'Unknown error'}`);
        setAppIsLoading(false);
        addAuditLogEntry('AGUI_OBSERVABLE_ERROR', `Error: ${err.message}`);
        if (runInputId === currentRunId) {
            setCurrentRunId(null);
        }
      },
      complete: () => {
      }
    });
    setCurrentAgUiSubscription(subscription);
  };


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentInput = userInput.trim();
    if (currentInput === '' || isAppLoading || !agUiAgent) return;

    addCompleteChatMessageToAppContext({ 
        sender: 'user', 
        text: currentInput, 
        relatedFileIds: selectedFileIdsForContext, 
        relatedWcatCaseIds: selectedWcatCaseIdsForContext,
        relatedToolIds: selectedToolIdsForContext 
    });
    setUserInput('');
    setAppIsLoading(true);
    setError(null);
    
    const currentAppHistoryForRun: AppChatMessage[] = [...appChatHistory]; 
     const agUiMessages: AgUiMessage[] = currentAppHistoryForRun
      .map(msg => ({
        id: msg.id,
        role: msg.sender === 'ai' ? 'assistant' : 'user',
        content: msg.text,
      } as AgUiMessage)); 

    agUiMessages.push({
        id: uuidv4(), 
        role: 'user',
        content: currentInput
    } as Message ); 
    
    const newRunId = uuidv4();
    runAgentWithInput(agUiMessages, newRunId);
  };


  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear the chat history and reset AI session? This will also clear selected context items and AG-UI thread.")) {
      clearChatHistory(); 
      resetChatSession(); 
      setCurrentToolCalls({});
      setStreamingAgUiMessage(null);
      currentAgUiSubscription?.unsubscribe();
      setCurrentAgUiSubscription(null);
      setCurrentRunId(null);
      setCurrentThreadId(uuidv4()); 
      addAuditLogEntry('AGUI_CHAT_CLEARED', 'AG-UI chat session cleared by user.');
    }
  };

  const handleSaveCurrentSession = () => {
    if (appChatHistory.length === 0 && !streamingAgUiMessage) {
        setError("Cannot save an empty chat session.");
        return;
    }
    const sessionName = window.prompt("Enter a name for this chat session:", `Chat Session ${new Date().toLocaleString()}`);
    if (sessionName) {
        const messagesToSave = streamingAgUiMessage && streamingAgUiMessage.content ? 
            [...appChatHistory, { sender: 'ai', text: streamingAgUiMessage.content as string, id: streamingAgUiMessage.id || uuidv4(), timestamp: new Date().toISOString() } as AppChatMessage] 
            : appChatHistory;
        saveChatSession(sessionName, messagesToSave, selectedFileIdsForContext, selectedWcatCaseIdsForContext, selectedToolIdsForContext);
        alert(`Session "${sessionName}" saved!`);
    }
  };

  const handleLoadSession = (sessionId: string) => {
    const loadedSession = loadSessionFromContext(sessionId);
    if (loadedSession) {
        setIsContextSidebarHidden(true);
        setStreamingAgUiMessage(null);
        currentAgUiSubscription?.unsubscribe(); 
        setCurrentRunId(null);
        setCurrentThreadId(uuidv4()); 
    } else {
        setError("Failed to load the selected chat session.");
    }
  };
  
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDraggingOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingOver(false);
    try {
      const dataString = event.dataTransfer.getData("application/json");
      if (dataString) {
        const droppedItem: { id: string; type: 'evidence' | 'wcat' | 'tool' } = JSON.parse(dataString);
        if (droppedItem.type === 'evidence') {
          toggleFileContext(droppedItem.id); 
        } else if (droppedItem.type === 'wcat') {
          toggleWcatCaseContext(droppedItem.id); 
        } else if (droppedItem.type === 'tool') {
          toggleToolContext(droppedItem.id); 
        }
        addAuditLogEntry('CONTEXT_ITEM_DROPPED_AGUI', `${droppedItem.type} ID ${droppedItem.id} added to context via D&D.`);
        setIsContextSidebarHidden(false);
      }
    } catch (e) {
      console.error("Error processing drop event:", e);
      setError("Failed to add item to context from drag and drop.");
    }
  };

  const tokenInfoColor = currentTotalEstTokens > SIMULATED_TOKEN_WARNING_THRESHOLD
    ? 'text-red-500'
    : (currentTotalEstTokens > SIMULATED_CONTEXT_WINDOW_TOKENS * 0.5 ? 'text-yellow-500' : 'text-textSecondary');
  const chatAreaHeight = `calc(100vh - var(--header-height, 64px) - 3rem)`;

  return (
    <div className="flex flex-col h-full" style={{ height: chatAreaHeight }}>
        <div className="flex justify-between items-center px-6 pt-6 pb-2">
            <h2 className="text-3xl font-semibold text-textPrimary">AI Chat Agent (AG-UI)</h2>
            <div className="flex items-center space-x-3">
                {isContextSidebarHidden && (
                    <button
                        onClick={() => setIsContextSidebarHidden(false)}
                        className="text-sm px-3 py-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-textPrimary border border-border"
                        title="Open Context Sidebar"
                        aria-label="Open Context Sidebar"
                    >
                        Chat Context & Tools
                    </button>
                )}
                 <button
                    onClick={handleSaveCurrentSession}
                    disabled={appChatHistory.length === 0 && !streamingAgUiMessage}
                    className="text-sm text-green-600 hover:text-green-700 dark:hover:text-green-500 px-3 py-1.5 border border-green-600 rounded-md flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <SaveIcon /> Save Session
                </button>
                <button
                    onClick={handleClearChat}
                    className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 px-3 py-1.5 border border-red-500 rounded-md"
                >
                    Clear & Reset Session
                </button>
            </div>
        </div>
        { (isMcpClientLoading || (mcpClient && !mcpClient.ready)) && selectedFileIdsForContext.length > 0 && (
            <div className="p-2 mx-6 text-xs bg-yellow-100 dark:bg-yellow-900 border border-yellow-500 text-yellow-700 dark:text-yellow-300 rounded-md">
            MCP Client Status: {isMcpClientLoading ? 'Initializing...' : (mcpClient?.getInitializationError() || 'Not ready.')} Fetching file content for AI context might fail.
            </div>
        )}
        {!apiKey && (
            <div className="p-4 mx-6 bg-yellow-100 dark:bg-yellow-900 border border-yellow-500 text-yellow-700 dark:text-yellow-300 rounded-md">
            Warning: Gemini API Key is not set. AI features will not work. Please go to Settings to configure it.
            </div>
        )}

        <div className="flex flex-grow min-h-0 relative">
            <div className="flex-grow flex flex-col p-6 pr-2 gap-4">
                <div
                  className={`flex-grow overflow-y-auto bg-surface p-4 rounded-lg shadow border border-border space-y-4 transition-colors ${isDraggingOver ? 'border-primary ring-2 ring-primary' : 'border-border'}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                    {appChatHistory.map((msg) => ( 
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xl p-3 rounded-lg shadow ${
                            msg.sender === 'user'
                            ? 'bg-primary text-white'
                            : 'bg-background text-textPrimary border border-border'
                        }`}>
                        <div className="flex items-center mb-1">
                            {msg.sender === 'user' ? <UserIcon /> : <AiIcon />}
                            <span className="font-semibold ml-2 text-sm">{msg.sender === 'user' ? 'You' : 'AI Agent'}</span>
                        </div>
                        <pre className="whitespace-pre-wrap text-sm">{msg.text}</pre>
                        {msg.relatedFileIds && msg.relatedFileIds.length > 0 && (
                            <p className="text-xs opacity-70 mt-1">Context Files: {msg.relatedFileIds.map(id => files.find(f=>f.id===id)?.name || id).join(', ')}</p>
                        )}
                        {msg.relatedWcatCaseIds && msg.relatedWcatCaseIds.length > 0 && (
                            <p className="text-xs opacity-70 mt-1">Context WCAT: {msg.relatedWcatCaseIds.map(id => wcatCases.find(f=>f.id===id)?.decisionNumber || id).join(', ')}</p>
                        )}
                        {msg.relatedToolIds && msg.relatedToolIds.length > 0 && (
                            <p className="text-xs opacity-70 mt-1">Context Tools: {msg.relatedToolIds.map(id => appTools.find(t=>t.id===id)?.name || id).join(', ')}</p>
                        )}
                        <p className="text-xs opacity-70 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                        </div>
                    </div>
                    ))}
                    {streamingAgUiMessage && ( 
                       <div className="flex justify-start">
                            <div className={`max-w-xl p-3 rounded-lg shadow bg-background text-textPrimary border border-border`}>
                                <div className="flex items-center mb-1">
                                    <AiIcon />
                                    <span className="font-semibold ml-2 text-sm">AI Agent</span>
                                </div>
                                <pre className="whitespace-pre-wrap text-sm">{streamingAgUiMessage.content}<span className="animate-pulse">▋</span></pre>
                                <p className="text-xs opacity-70 mt-1 text-right">{new Date().toLocaleTimeString()}</p>
                            </div>
                        </div>
                    )}
                    {isAppLoading && !streamingAgUiMessage && appChatHistory.length > 0 &&
                        appChatHistory[appChatHistory.length-1]?.sender === 'user' && (
                    <div className="flex justify-start">
                        <div className="max-w-lg p-3 rounded-lg shadow bg-background text-textPrimary border border-border">
                            <LoadingSpinner size="sm" message="AI is thinking..." />
                        </div>
                    </div>
                    )}
                    {appChatHistory.length === 0 && !streamingAgUiMessage && !isAppLoading && (
                    <p className="text-center text-textSecondary">
                        {isDraggingOver ? "Drop item here to add to context" : "No messages yet. Select context from the sidebar and start by asking a question!"}
                    </p>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="mt-auto space-y-2">
                    <div className={`text-xs px-2 pb-1 text-right ${tokenInfoColor}`}>
                        Estimated Tokens: {currentTotalEstTokens.toLocaleString()} / {SIMULATED_CONTEXT_WINDOW_TOKENS.toLocaleString()}
                        {currentTotalEstTokens > SIMULATED_TOKEN_WARNING_THRESHOLD && (
                        <span className="ml-2 font-semibold">Warning: Approaching context limit!</span>
                        )}
                    </div>

                    <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="Ask a question or use a command..."
                        className="flex-grow px-4 py-2 bg-background border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        disabled={isAppLoading || !apiKey || !agUiAgent}
                    />
                    <button
                        type="submit"
                        disabled={isAppLoading || userInput.trim() === '' || !apiKey || !agUiAgent}
                        className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                    >
                        Send
                    </button>
                    </form>
                </div>
            </div>

            {!isContextSidebarHidden && (
                <ChatContextSidebar
                    onToggleCollapse={() => setIsContextSidebarHidden(true)}
                    files={files}
                    wcatCases={wcatCases}
                    selectedFileIds={selectedFileIdsForContext} 
                    onToggleFileContext={toggleFileContext} 
                    selectedWcatCaseIds={selectedWcatCaseIdsForContext} 
                    onToggleWcatCaseContext={toggleWcatCaseContext} 
                    onLoadSession={handleLoadSession}
                    tools={appTools} 
                    selectedToolIds={selectedToolIdsForContext} 
                    onToggleToolContext={toggleToolContext} 
                />
            )}
        </div>
    </div>
  );
};

export default ChatAgentPanelPage;
