import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { EvidenceFile, WcatCase, ChatMessage } from '../../types';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';
import { SIMULATED_CONTEXT_WINDOW_TOKENS, SIMULATED_TOKEN_WARNING_THRESHOLD } from '../../constants';
import { summarizeEvidenceText } from '../../services/geminiService';

// AG-UI Imports
import { GeminiAgUiAgent } from '../../services/AgUiAgentService';
import {
    RunAgentInput, BaseEvent, EventType, Message as AgUiMessage, Tool as AgUiToolDefinition, Context as AgUiClientContextType, ToolCall, Message, CustomEvent, // Renamed Context to AgUiClientContextType
    RunStartedEvent, TextMessageStartEvent, TextMessageContentEvent, TextMessageEndEvent, ToolCallStartEvent, ToolCallArgsEvent, ToolCallEndEvent, RunFinishedEvent, RunErrorEvent
} from "@ag-ui/client";
import { Observable, Subscription } from "rxjs";
import { v4 as uuidv4 } from 'uuid';


interface ChatPopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEvidenceContext?: EvidenceFile[];
  initialWcatContext?: WcatCase[];
}

// Assuming Context type from @ag-ui/client is structurally { value: string; description: string; }
// This is based on the error messages. If it's different, this needs to change.
interface AgUiClientContext {
  value: string;
  description: string;
}

const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" /></svg>;
const AiIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.22 5.222a.75.75 0 011.06 0l1.25 1.25a.75.75 0 010 1.06l-1.25 1.25a.75.75 0 01-1.06 0l-1.25-1.25a.75.75 0 010-1.06l1.25-1.25zM4.47 9.47a.75.75 0 011.06 0l1.25 1.25a.75.75 0 010 1.06l-1.25 1.25a.75.75 0 01-1.06-1.06l1.25-1.25a.75.75 0 010-1.06l-1.25-1.25a.75.75 0 010-1.06zM11.97 9.47a.75.75 0 011.06 0l1.25 1.25a.75.75 0 010 1.06l-1.25 1.25a.75.75 0 01-1.06-1.06l1.25-1.25a.75.75 0 010-1.06l-1.25-1.25a.75.75 0 010-1.06zM10 3a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 0110 3zM10 15a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 0110 15zM4.646 4.646a.75.75 0 011.061 0l.5.5a.75.75 0 01-1.06 1.061l-.5-.5a.75.75 0 010-1.061zM13.793 13.793a.75.75 0 011.06 0l.5.5a.75.75 0 01-1.06 1.06l-.5-.5a.75.75 0 010-1.06zM3.75 10a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75zm11.75 0a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75zM5.707 13.793a.75.75 0 010-1.06l.5-.5a.75.75 0 111.06 1.06l-.5.5a.75.75 0 01-1.06 0zM12.732 5.707a.75.75 0 010-1.06l.5-.5a.75.75 0 011.061 1.06l-.5.5a.75.75 0 01-1.06 0z" clipRule="evenodd" /></svg>;

const estimateTokens = (text: string = ''): number => Math.ceil(text.length / 4);

const ChatPopupModal: React.FC<ChatPopupModalProps> = ({
    isOpen,
    onClose,
    initialEvidenceContext = [],
    initialWcatContext = []
}) => {
  const { setIsLoading: setAppIsLoading, setError: setAppError, apiKey, addAuditLogEntry, mcpClient, updateFile, getFileById } = useAppContext();
  const [userInput, setUserInput] = useState('');
  const [localChatHistory, setLocalChatHistory] = useState<AgUiMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [currentTotalEstTokens, setCurrentTotalEstTokens] = useState(0);

  const [agUiAgentModal, setAgUiAgentModal] = useState<GeminiAgUiAgent | null>(null);
  const [currentAgUiSubscriptionModal, setCurrentAgUiSubscriptionModal] = useState<Subscription | null>(null);
  const [streamingAgUiMessageModal, setStreamingAgUiMessageModal] = useState<AgUiMessage | null>(null);
  const [currentToolCallsModal, setCurrentToolCallsModal] = useState<Record<string, Partial<ToolCall & { argsString?: string }>>>({});
  const [currentRunIdModal, setCurrentRunIdModal] = useState<string | null>(null);

  // Stable thread ID for this modal's context, persisting across open/close for the same context.
  const [stableThreadIdForStorage, setStableThreadIdForStorage] = useState(() => uuidv4());

  useEffect(() => { // Reset thread ID and history when the initial context changes
    setStableThreadIdForStorage(uuidv4());
    setLocalChatHistory([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEvidenceContext.map(f=>f.id).join(','), initialWcatContext.map(c=>c.id).join(',')]); // Depend on stringified IDs for stability


  const getStorageKey = useCallback(() => {
    const eIds = initialEvidenceContext.map(f => f.id).sort().join('_');
    const wIds = initialWcatContext.map(c => c.id).sort().join('_');
    // Removed stableThreadIdForStorage from key if history is per context pair, not per thread per pair
    // return `chatHistory_popup_agui_e_${eIds}_w_${wIds}_thread_${stableThreadIdForStorage}`;
    return `chatHistory_popup_agui_e_${eIds}_w_${wIds}`; // History per context pair
  }, [initialEvidenceContext, initialWcatContext]);

  useEffect(() => {
    const agent = new GeminiAgUiAgent({ mcpClient });
    setAgUiAgentModal(agent);
    return () => {
      currentAgUiSubscriptionModal?.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcpClient]);


  useEffect(() => {
    if (!isOpen) {
        currentAgUiSubscriptionModal?.unsubscribe();
        setCurrentRunIdModal(null);
        return;
    }
    const storageKey = getStorageKey();
    const storedHistory = localStorage.getItem(storageKey);
    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) {
            setLocalChatHistory(parsedHistory);
        } else {
            setLocalChatHistory([]);
        }
      } catch (e) {
        console.error("Failed to parse chat history from localStorage for popup modal:", e);
        setLocalChatHistory([]);
      }
    } else {
      setLocalChatHistory([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, getStorageKey]); // Removed currentAgUiSubscriptionModal from deps, cleanup in return

  useEffect(() => {
    const storageKey = getStorageKey();
    if (localChatHistory.length > 0) { // Only save if there's something to save
      localStorage.setItem(storageKey, JSON.stringify(localChatHistory));
    } else { // If history becomes empty, remove from storage
      localStorage.removeItem(storageKey);
    }
  }, [localChatHistory, getStorageKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localChatHistory, streamingAgUiMessageModal]);

  useEffect(() => {
    let tokens = 0;
    tokens += estimateTokens(userInput);
    localChatHistory.forEach(msg => tokens += estimateTokens(msg.content as string));
    if(streamingAgUiMessageModal) tokens += estimateTokens(streamingAgUiMessageModal.content as string);
    initialEvidenceContext.forEach(f => tokens += estimateTokens(f.summary) + estimateTokens(f.content));
    initialWcatContext.forEach(c => tokens += estimateTokens(c.aiSummary) + estimateTokens(c.rawTextContent));
    setCurrentTotalEstTokens(tokens);
  }, [userInput, localChatHistory, initialEvidenceContext, initialWcatContext, streamingAgUiMessageModal]);

  const frontendAgUiToolsModal: AgUiToolDefinition[] = [
    {
      name: "summarizeSelf",
      description: "Summarizes one of the documents currently in the comparison context.",
      parameters: {
        type: "object",
        properties: {
            documentId: { type: "string", description: "The ID of the document (EvidenceFile or WCAT Case) to summarize from the current context." },
            type: { type: "string", description: "The type of the document: 'evidence' or 'wcat'."}
        },
        required: ["documentId", "type"],
      }
    }
  ];

  const executeFrontendToolModal = async (toolName: string, args: any): Promise<any> => {
    addAuditLogEntry('AGUI_TOOL_EXEC_MODAL_START', `Modal Tool: ${toolName}, Args: ${JSON.stringify(args)}`);
    try {
        if (toolName === "summarizeSelf") {
            if (!args.documentId || !args.type) throw new Error("Missing documentId or type for summarizeSelf tool.");
            let textToSummarize = "";
            let docName = "";
            if (args.type === 'evidence') {
                const file = initialEvidenceContext.find(f => f.id === args.documentId);
                if (!file) throw new Error(`Evidence file ID ${args.documentId} not in current context.`);
                docName = file.name;
                textToSummarize = file.content || file.summary || "";
                 if (!textToSummarize && file.mcpPath && mcpClient && mcpClient.ready) {
                    const mcpFile = await mcpClient.readFile(file.mcpPath);
                    if (mcpFile?.content) {
                        textToSummarize = mcpFile.content;
                        // Optionally update file in global context if content was fetched
                        // updateFile(file.id, { content: textToSummarize });
                    } else {
                        throw new Error(`Could not load content for ${file.name} from MCP.`);
                    }
                }
            } else if (args.type === 'wcat') {
                const wcase = initialWcatContext.find(c => c.id === args.documentId);
                if (!wcase) throw new Error(`WCAT case ID ${args.documentId} not in current context.`);
                docName = wcase.decisionNumber;
                textToSummarize = wcase.rawTextContent || wcase.aiSummary || "";
            } else {
                throw new Error(`Unknown document type "${args.type}" for summarizeSelf.`);
            }
            if (!textToSummarize) return `No content found to summarize for ${docName}.`;
            return await summarizeEvidenceText(textToSummarize);
        }
        throw new Error(`Unknown tool in modal: ${toolName}`);
    } catch (error: any) {
        addAuditLogEntry('AGUI_TOOL_EXEC_MODAL_ERROR', `Modal Tool ${toolName} Error: ${error.message}`);
        return { error: error.message };
    }
  };

  const runAgentWithInputModal = (messages: AgUiMessage[], runIdForContinuation?: string) => {
    if (!agUiAgentModal || !agUiAgentModal.publicRun) return;
    currentAgUiSubscriptionModal?.unsubscribe();

    const runId = runIdForContinuation || uuidv4();
     if (!runIdForContinuation) {
        setCurrentRunIdModal(runId);
    }

    const contextPayload = {
        appRelevantFiles: initialEvidenceContext,
        appRelevantWcatCases: initialWcatContext,
    };

    const agUiContextForRun: AgUiClientContext[] = [
        {
            value: JSON.stringify(contextPayload),
            description: "Context for comparing specific evidence file and WCAT case."
        }
    ];

    const runAgentInputTyped: RunAgentInput = {
      runId,
      threadId: stableThreadIdForStorage, // Use the stable thread ID for AG-UI runs
      messages,
      tools: frontendAgUiToolsModal,
      context: agUiContextForRun as AgUiClientContextType[], // Cast to library's Context[] type
    };

    setIsSending(true);
    setAppIsLoading(true);
    const runObservable = agUiAgentModal.publicRun(runAgentInputTyped);

    const subscription = runObservable.subscribe({
      next: (event: BaseEvent) => {
        const eventRunId = (event as any).runId || runId;
        switch (event.type) {
          case EventType.RUN_STARTED:
            setStreamingAgUiMessageModal(null);
            break;
          case EventType.TEXT_MESSAGE_START:
            const textMessageStartEvent = event as TextMessageStartEvent;
            setStreamingAgUiMessageModal({ id: textMessageStartEvent.messageId, role: "assistant", content: "" });
            break;
          case EventType.TEXT_MESSAGE_CONTENT:
            const textMessageContentEvent = event as TextMessageContentEvent;
            setStreamingAgUiMessageModal((prev: AgUiMessage | null) => prev ? { ...prev, content: (prev.content || "") + textMessageContentEvent.delta } : null);
            break;
          case EventType.TEXT_MESSAGE_END:
            if (streamingAgUiMessageModal && streamingAgUiMessageModal.content) {
              setLocalChatHistory(prev => [...prev, { ...streamingAgUiMessageModal, id: streamingAgUiMessageModal.id || uuidv4() }]);
            }
            setStreamingAgUiMessageModal(null);
            break;
          case EventType.TOOL_CALL_START:
            const toolCallStartEvent = event as ToolCallStartEvent;
            const newToolCallEntry: Partial<ToolCall & { argsString?: string }> = {
                id: toolCallStartEvent.toolCallId,
                type: "function",
                function: { name: toolCallStartEvent.toolCallName, arguments: "" },
                argsString: ""
            };
             setCurrentToolCallsModal(prev => ({
                ...prev,
                [toolCallStartEvent.toolCallId]: newToolCallEntry
            }));
            setLocalChatHistory(prev => [...prev, {id: uuidv4(), role:'assistant', content: `🤖 Requesting tool: ${toolCallStartEvent.toolCallName}...`}]);
            break;
          case EventType.TOOL_CALL_ARGS:
            const toolCallArgsEvent = event as ToolCallArgsEvent;
            setCurrentToolCallsModal(prev => {
                const existing = prev[toolCallArgsEvent.toolCallId];
                return { ...prev, [toolCallArgsEvent.toolCallId]: { ...existing, argsString: (existing?.argsString || "") + toolCallArgsEvent.delta }};
            });
            break;
          case EventType.TOOL_CALL_END:
            const toolCallEndEvent = event as ToolCallEndEvent;
            const toolCallInfo = currentToolCallsModal[toolCallEndEvent.toolCallId];
            if (toolCallInfo && toolCallInfo.function && typeof toolCallInfo.function.name === 'string') {
                const toolName = toolCallInfo.function.name;
                let parsedArgs = {};
                try { if (toolCallInfo.argsString) parsedArgs = JSON.parse(toolCallInfo.argsString); }
                catch (e) { console.error("Failed to parse modal tool args:", e); }

                setLocalChatHistory(prev => [...prev, {id: uuidv4(), role:'assistant', content: `Executing tool: ${toolName} with args: ${JSON.stringify(parsedArgs).substring(0,50)}...`}]);

                executeFrontendToolModal(toolName, parsedArgs).then(toolResult => {
                    const toolResponse: Message = { id: uuidv4(), role: "tool", toolCallId: toolCallEndEvent.toolCallId, content: JSON.stringify(toolResult) };
                    const nextMessages: AgUiMessage[] = [...runAgentInputTyped.messages, toolResponse];
                    runAgentWithInputModal(nextMessages, runId);
                }).catch(toolExecError => {
                    setAppError(`Modal Tool Error ${toolCallInfo.function?.name}: ${toolExecError.message}`);
                    const errorResponse: Message = { id: uuidv4(), role: "tool", toolCallId: toolCallEndEvent.toolCallId, content: JSON.stringify({error: toolExecError.message}) };
                    runAgentWithInputModal([...runAgentInputTyped.messages, errorResponse], runId);
                });
            }
            setCurrentToolCallsModal(prev => { const newState = {...prev}; delete newState[toolCallEndEvent.toolCallId]; return newState; });
            break;
          case EventType.RUN_FINISHED:
            const runFinishedEvent = event as RunFinishedEvent;
            setIsSending(false);
            setAppIsLoading(false);
            if (runFinishedEvent.runId === currentRunIdModal) setCurrentRunIdModal(null);
            break;
          case EventType.RUN_ERROR:
            const runErrorEvent = event as RunErrorEvent;
            setAppError(`Modal AG-UI Error: ${runErrorEvent.message}`);
            setIsSending(false);
            setAppIsLoading(false);
            if (eventRunId === currentRunIdModal) setCurrentRunIdModal(null);
            break;
           case EventType.CUSTOM:
            const customEvent = event as CustomEvent;
             if (customEvent.name === 'groundingSources' && Array.isArray(customEvent.value)) {
                const sources = customEvent.value as Array<{uri:string, title: string}>;
                if (sources.length > 0) {
                    const sourcesText = sources.map(s => `Source: [${s.title || 'Untitled'}](${s.uri})`).join('\n');
                    setLocalChatHistory(prev => [...prev, {id: uuidv4(), role:'assistant', content: `Grounding sources:\n${sourcesText}`}]);
                }
             }
            break;
        }
      },
      error: (err) => {
        setAppError(`Modal AG-UI Observable Error: ${err.message || 'Unknown'}`);
        setIsSending(false);
        setAppIsLoading(false);
        if (runId === currentRunIdModal) setCurrentRunIdModal(null);
      }
    });
    setCurrentAgUiSubscriptionModal(subscription);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const currentInput = userInput.trim();
    if (currentInput === '' || isSending || !agUiAgentModal) return;

    const userMsg: AgUiMessage = {
      id: uuidv4(),
      role: 'user',
      content: currentInput,
    };
    setLocalChatHistory(prev => [...prev, userMsg]);
    setUserInput('');

    const messagesForRun: AgUiMessage[] = [...localChatHistory];
    runAgentWithInputModal(messagesForRun);
  };

  const handleClearChatHistory = () => {
    if (window.confirm("Are you sure you want to clear the chat history for this specific comparison?")) {
        setLocalChatHistory([]);
        // localStorage.removeItem(getStorageKey()); // History clearing is handled by useEffect on localChatHistory
        currentAgUiSubscriptionModal?.unsubscribe();
        setCurrentAgUiSubscriptionModal(null);
        setCurrentRunIdModal(null);
        // stableThreadIdForStorage remains, tied to the comparison context
        addAuditLogEntry('POPUP_MODAL_CHAT_CLEARED', `History cleared for context: ${getStorageKey()}`);
    }
  };

  const contextFileNames = initialEvidenceContext.map(f => f.name).join(', ');
  const contextCaseNumbers = initialWcatContext.map(c => c.decisionNumber).join(', ');
  const contextDescription = `Comparing: ${contextFileNames || 'N/A'} AND ${contextCaseNumbers || 'N/A'}`;

  const tokenInfoColor = currentTotalEstTokens > SIMULATED_TOKEN_WARNING_THRESHOLD
    ? 'text-red-500'
    : (currentTotalEstTokens > SIMULATED_CONTEXT_WINDOW_TOKENS * 0.5 ? 'text-yellow-500' : 'text-textSecondary');

  return (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="AI Chat Agent (Comparison)"
        footer={
            <form onSubmit={handleSendMessage} className="flex gap-2 p-1 items-center">
                <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Ask about these documents..."
                    className="flex-grow px-3 py-2 bg-background border border-border rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    disabled={isSending || !apiKey || !agUiAgentModal}
                />
                <button
                    type="submit"
                    disabled={isSending || userInput.trim() === '' || !apiKey || !agUiAgentModal}
                    className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                    Send
                </button>
            </form>
        }
    >
      <div className="h-[65vh] flex flex-col">
        <div className="flex justify-between items-start text-xs text-textSecondary mb-2 p-2 bg-background rounded border border-dashed border-border">
            <div>
                <strong>Context:</strong> {contextDescription}
            </div>
            <button
                onClick={handleClearChatHistory}
                className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 px-1.5 py-0.5 border border-red-500 rounded-md"
                title="Clear chat history for this comparison"
            >
                Clear History
            </button>
        </div>
         <div className={`text-xs px-2 pb-1 ${tokenInfoColor}`}>
            Estimated Tokens: {currentTotalEstTokens.toLocaleString()} / {SIMULATED_CONTEXT_WINDOW_TOKENS.toLocaleString()}
            {currentTotalEstTokens > SIMULATED_TOKEN_WARNING_THRESHOLD && (
              <span className="ml-2 font-semibold">Warning: Approaching context limit!</span>
            )}
        </div>
        <div className="flex-grow overflow-y-auto space-y-3 pr-1">
            {localChatHistory.map((msg, index) => (
            <div key={msg.id || `msg-${index}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-md p-2.5 rounded-lg shadow ${
                    msg.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-background text-textPrimary border border-border'
                }`}>
                <div className="flex items-center mb-1">
                    {msg.role === 'user' ? <UserIcon /> : <AiIcon />}
                    <span className="font-semibold ml-2 text-xs">{msg.role === 'user' ? 'You' : 'AI Agent'}</span>
                </div>
                <pre className="whitespace-pre-wrap text-sm">{msg.content as string}</pre>
                <p className="text-xs opacity-70 mt-1 text-right">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </div>
            ))}
            {streamingAgUiMessageModal && (
            <div className="flex justify-start">
                <div className={`max-w-md p-2.5 rounded-lg shadow bg-background text-textPrimary border border-border`}>
                    <div className="flex items-center mb-1"> <AiIcon /> <span className="font-semibold ml-2 text-xs">AI Agent</span></div>
                    <pre className="whitespace-pre-wrap text-sm">{streamingAgUiMessageModal.content as string}<span className="animate-pulse">▋</span></pre>
                    <p className="text-xs opacity-70 mt-1 text-right">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </div>
            )}
            {isSending && !streamingAgUiMessageModal && localChatHistory.length > 0 &&
                localChatHistory[localChatHistory.length-1]?.role === 'user' && (
            <div className="flex justify-start">
                <div className="max-w-lg p-3 rounded-lg shadow bg-background text-textPrimary border border-border">
                    <LoadingSpinner size="sm" message="AI is thinking..." />
                </div>
            </div>
            )}
            {localChatHistory.length === 0 && !isSending && (
            <p className="text-center text-sm text-textSecondary py-4">Ask questions about the documents being compared.</p>
            )}
             {!apiKey && (
                <p className="text-center text-sm text-yellow-600 dark:text-yellow-400 py-4">
                    Gemini API Key not set. AI Chat is disabled.
                </p>
             )}
            <div ref={chatEndRef} />
        </div>
      </div>
    </Modal>
  );
};

export default ChatPopupModal;
