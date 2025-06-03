
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../contexts/AppContext';
import { ChatMessage as AppChatMessage, EvidenceFile, WcatCase, SavedChatSession, PolicyEntry, AiTool, GenerateContentResponse } from '../../types'; // Corrected import for ChatMessage
import { getChatResponseStream, resetChatSession, expandWcatSearchQuery, summarizeEvidenceText } from '../../services/geminiService';
import { searchWcatDecisions, fetchAndProcessWcatPdf } from '../../services/wcatService';
import LoadingSpinner from '../ui/LoadingSpinner';
import { SIMULATED_CONTEXT_WINDOW_TOKENS, SIMULATED_TOKEN_WARNING_THRESHOLD } from '../../constants';
import ChatContextSidebar from '../ui/ChatContextSidebar';
import { v4 as uuidv4 } from 'uuid'; // For unique streaming message ID

const UserIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" /></svg>;
const AiIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.22 5.222a.75.75 0 011.06 0l1.25 1.25a.75.75 0 010 1.06l-1.25 1.25a.75.75 0 01-1.06 0l-1.25-1.25a.75.75 0 010-1.06l1.25-1.25zM4.47 9.47a.75.75 0 011.06 0l1.25 1.25a.75.75 0 010 1.06l-1.25 1.25a.75.75 0 01-1.06-1.06l1.25-1.25a.75.75 0 010-1.06l-1.25-1.25a.75.75 0 010-1.06zM11.97 9.47a.75.75 0 011.06 0l1.25 1.25a.75.75 0 010 1.06l-1.25 1.25a.75.75 0 01-1.06-1.06l1.25-1.25a.75.75 0 010-1.06l-1.25-1.25a.75.75 0 010-1.06zM10 3a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 0110 3zM10 15a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 0110 15zM4.646 4.646a.75.75 0 011.061 0l.5.5a.75.75 0 01-1.06 1.061l-.5-.5a.75.75 0 010-1.061zM13.793 13.793a.75.75 0 011.06 0l.5.5a.75.75 0 01-1.06 1.06l-.5-.5a.75.75 0 010-1.06zM3.75 10a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75zm11.75 0a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75zM5.707 13.793a.75.75 0 010-1.06l.5-.5a.75.75 0 111.06 1.06l-.5.5a.75.75 0 01-1.06 0zM12.732 5.707a.75.75 0 010-1.06l.5-.5a.75.75 0 011.061 1.06l-.5.5a.75.75 0 01-1.06 0z" clipRule="evenodd" /></svg>;
const SaveIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);


const estimateTokens = (text: string = ''): number => Math.ceil(text.length / 4);

const ChatAgentPanelPage: React.FC = () => {
  const {
    chatHistory, addChatMessage: addCompleteChatMessage, clearChatHistory,
    files, wcatCases, policyManuals, 
    setIsLoading: setAppIsLoading, isLoading: isAppLoading,
    setError, addAuditLogEntry, apiKey,
    mcpClient, isMcpClientLoading, updateFile,
    addWcatCase, getWcatCaseByDecisionNumber, generateAndAssignWcatPatternTags, getWcatCaseById,
    saveChatSession, loadChatSession: loadSessionFromContext,
    tools, selectedToolIdsForContext, toggleToolContext, // Tool related context
    selectedFileIdsForContext, toggleFileContext,       // File context
    selectedWcatCaseIdsForContext, toggleWcatCaseContext // WCAT context
  } = useAppContext();

  const [userInput, setUserInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [currentTotalEstTokens, setCurrentTotalEstTokens] = useState(0);
  const [isContextSidebarHidden, setIsContextSidebarHidden] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [streamingAiMessage, setStreamingAiMessage] = useState<AppChatMessage | null>(null);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, streamingAiMessage]);

  useEffect(() => {
    let tokens = 0;
    tokens += estimateTokens(userInput);
    chatHistory.forEach(msg => tokens += estimateTokens(msg.text));
    if (streamingAiMessage) tokens += estimateTokens(streamingAiMessage.text);
    
    files.filter(f => selectedFileIdsForContext.includes(f.id)).forEach(f => {
        tokens += estimateTokens(f.summary) + estimateTokens(f.content);
    });
    wcatCases.filter(c => selectedWcatCaseIdsForContext.includes(c.id)).forEach(c => {
        tokens += estimateTokens(c.aiSummary) + estimateTokens(c.rawTextContent);
    });
    tools.filter(t => selectedToolIdsForContext.includes(t.id)).forEach(t => {
        tokens += estimateTokens(t.name) + estimateTokens(t.description) + estimateTokens(t.usageExample);
    });

    setCurrentTotalEstTokens(tokens);
  }, [userInput, chatHistory, files, selectedFileIdsForContext, wcatCases, selectedWcatCaseIdsForContext, tools, selectedToolIdsForContext, streamingAiMessage]);

  const handleDeepWcatSearchAndIngest = async (originalQuery: string) => {
    addCompleteChatMessage({sender: 'ai', text: `Starting deep WCAT search for: "${originalQuery}"...`});
    let currentQuery = originalQuery;
    try {
      addCompleteChatMessage({sender: 'ai', text: "Expanding search query with AI..."});
      currentQuery = await expandWcatSearchQuery(originalQuery);
      addCompleteChatMessage({sender: 'ai', text: `Expanded query: "${currentQuery}". Now searching WCAT (simulated deep search)...`});
    } catch (expansionError: any) {
      addCompleteChatMessage({sender: 'ai', text: `Could not expand query: ${expansionError.message}. Proceeding with original query.`});
    }
    const searchResults = await searchWcatDecisions(currentQuery, undefined, undefined, 'all', true);
    if (searchResults.length === 0) {
      addCompleteChatMessage({sender: 'ai', text: "No WCAT decisions found for your query."});
      return;
    }
    addCompleteChatMessage({sender: 'ai', text: `Found ${searchResults.length} potential WCAT decisions. Starting ingestion and analysis... (This may take some time)`});
    let ingestedCount = 0;
    for (const sr of searchResults) {
      if (getWcatCaseByDecisionNumber(sr.decisionNumber)) {
        addCompleteChatMessage({sender: 'ai', text: `Case ${sr.decisionNumber} already in database. Skipping.`});
        continue;
      }
      try {
        addCompleteChatMessage({sender: 'ai', text: `Processing ${sr.decisionNumber}...`});
        const caseDataPartial = await fetchAndProcessWcatPdf(sr.pdfUrl, sr.decisionNumber, addAuditLogEntry, mcpClient);
        const newCase = await addWcatCase(caseDataPartial as Omit<WcatCase, 'id' | 'ingestedAt' | 'tags'>);
        await generateAndAssignWcatPatternTags(newCase.id);
        const finalCase = getWcatCaseById(newCase.id);
        const patternNames = finalCase?.tags.filter(t => t.scope === 'wcat_pattern').map(t => t.name).join(', ') || 'None';
        addCompleteChatMessage({sender: 'ai', text: `Successfully ingested ${sr.decisionNumber}. MCP Path: ${newCase.mcpPath || 'N/A'}. Identified patterns: ${patternNames}`});
        ingestedCount++;
      } catch (ingestError: any) {
        addCompleteChatMessage({sender: 'ai', text: `Failed to ingest ${sr.decisionNumber}: ${ingestError.message}`});
      }
    }
    addCompleteChatMessage({sender: 'ai', text: `Deep search and ingestion complete. ${ingestedCount} new cases processed.`});
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentInput = userInput.trim();
    if (currentInput === '' || isAppLoading) return;

    addCompleteChatMessage({ 
        sender: 'user', 
        text: currentInput, 
        relatedFileIds: selectedFileIdsForContext, 
        relatedWcatCaseIds: selectedWcatCaseIdsForContext,
        relatedToolIds: selectedToolIdsForContext 
    });
    setUserInput('');
    setAppIsLoading(true);
    setError(null);
    
    const extractMarkersMatch = currentInput.match(/^\/extract_markers\s+(.+)/i);
    const lookupPolicyMatch = currentInput.match(/^\/lookup_policy\s+([A-Za-z0-9.-]+)/i);
    const summarizeWcatMatch = currentInput.match(/^\/summarize_wcat\s+([\w-]+)/i);
    const deepSearchMatch = currentInput.match(/^(?:deep search wcat for|search wcat for|wcat deep search|find wcat cases about)[:\s]*(.+)/i);

    if (!apiKey && (extractMarkersMatch || deepSearchMatch)) {
        addCompleteChatMessage({ sender: 'ai', text: "Gemini API Key is not set. This command requires AI. Please configure it in Settings." });
        setAppIsLoading(false);
        return;
    }
     if ((isMcpClientLoading || (mcpClient && !mcpClient.isReady())) && selectedFileIdsForContext.length > 0) {
         addCompleteChatMessage({ sender: 'ai', text: `MCP Client is not ready to fetch file context. Status: ${isMcpClientLoading ? 'Loading...' : (mcpClient?.getInitializationError() || 'Error')}` });
         setAppIsLoading(false);
         return;
    }


    if (extractMarkersMatch) {
        const docName = extractMarkersMatch[1].trim();
        const fileToAnalyze = files.find(f => f.name.toLowerCase() === docName.toLowerCase());
        if (fileToAnalyze) {
            const textToAnalyze = fileToAnalyze.content || fileToAnalyze.summary || '';
            if (textToAnalyze) {
                try {
                    addAuditLogEntry('COMMAND_EXTRACT_MARKERS', `User requested marker extraction for: ${docName}`);
                    const markers = await summarizeEvidenceText(textToAnalyze); 
                    addCompleteChatMessage({ sender: 'ai', text: `Markers for "${fileToAnalyze.name}":\n${markers}` });
                } catch (err: any) {
                    addCompleteChatMessage({ sender: 'ai', text: `Error extracting markers for "${docName}": ${err.message}` });
                }
            } else {
                addCompleteChatMessage({ sender: 'ai', text: `No content or summary available for "${docName}" to extract markers.` });
            }
        } else {
            addCompleteChatMessage({ sender: 'ai', text: `Document "${docName}" not found.` });
        }
        setAppIsLoading(false);
        return;
    }

    if (lookupPolicyMatch) {
        const policyNum = lookupPolicyMatch[1].trim();
        addAuditLogEntry('COMMAND_LOOKUP_POLICY', `User requested lookup for policy: ${policyNum}`);
        let foundEntries: { manualName: string, entry: PolicyEntry }[] = [];
        policyManuals.forEach(manual => {
            const entry = manual.policyEntries.find(pe => pe.policyNumber === policyNum);
            if (entry) {
                foundEntries.push({ manualName: manual.manualName, entry });
            }
        });
        if (foundEntries.length > 0) {
            const responseText = foundEntries.map(fe => 
                `Found in "${fe.manualName}":\nPolicy: ${fe.entry.policyNumber} - ${fe.entry.title || 'Untitled'}\nPage: ${fe.entry.page || 'N/A'}\nSnippet: ${fe.entry.snippet || 'N/A'}`
            ).join('\n\n---\n\n');
            addCompleteChatMessage({ sender: 'ai', text: responseText });
        } else {
            addCompleteChatMessage({ sender: 'ai', text: `Policy "${policyNum}" not found in any loaded manuals.` });
        }
        setAppIsLoading(false);
        return;
    }

    if (summarizeWcatMatch) {
        const decisionNum = summarizeWcatMatch[1].trim();
        addAuditLogEntry('COMMAND_SUMMARIZE_WCAT', `User requested summary for WCAT case: ${decisionNum}`);
        const wcase = wcatCases.find(c => c.decisionNumber === decisionNum);
        if (wcase) {
            const responseText = `Summary for WCAT Case ${wcase.decisionNumber} (${wcase.year}):\nOutcome: ${wcase.outcomeSummary}\nAI Summary: ${wcase.aiSummary || 'Not available.'}`;
            addCompleteChatMessage({ sender: 'ai', text: responseText });
        } else {
            addCompleteChatMessage({ sender: 'ai', text: `WCAT Case "${decisionNum}" not found.` });
        }
        setAppIsLoading(false);
        return;
    }
    
    if (deepSearchMatch && deepSearchMatch[1]) {
        const searchQuery = deepSearchMatch[1].trim();
        await handleDeepWcatSearchAndIngest(searchQuery);
        setAppIsLoading(false);
        return;
    }

    const placeholderAiMessage: AppChatMessage = {
      id: uuidv4(),
      sender: 'ai',
      text: '',
      timestamp: new Date().toISOString(),
    };
    setStreamingAiMessage(placeholderAiMessage);

    try {
      let filesForAiContext: EvidenceFile[] = [];
      if (mcpClient && selectedFileIdsForContext.length > 0) {
        for (const fileId of selectedFileIdsForContext) {
          let file = files.find(f => f.id === fileId);
          if (file) {
            if (!file.content && file.mcpPath && file.type !== 'img') {
              addAuditLogEntry('CHAT_MCP_READ_START', `Fetching content for ${file.name} for AI context.`);
              const mcpFile = await mcpClient.readFile(file.mcpPath);
              if (mcpFile && mcpFile.content) {
                updateFile(file.id, { content: mcpFile.content });
                file = { ...file, content: mcpFile.content };
                addAuditLogEntry('CHAT_MCP_READ_SUCCESS', `Content fetched for ${file.name}.`);
              } else {
                 addAuditLogEntry('CHAT_MCP_READ_FAIL', `Failed to fetch content for ${file.name}. Using existing summary/name.`);
              }
            }
            filesForAiContext.push(file);
          }
        }
      } else {
        filesForAiContext = files.filter(f => selectedFileIdsForContext.includes(f.id));
      }
      const relevantWcatContextCases = wcatCases.filter(c => selectedWcatCaseIdsForContext.includes(c.id));
      const relevantTools = tools.filter(t => selectedToolIdsForContext.includes(t.id)); // Get selected tools

      const stream = await getChatResponseStream(currentInput, filesForAiContext, relevantWcatContextCases, relevantTools); // Pass tools
      let accumulatedText = "";
      let lastChunkProcessed: GenerateContentResponse | null = null;

      for await (const chunk of stream) {
        accumulatedText += chunk.text;
        setStreamingAiMessage(prev => prev ? { ...prev, text: accumulatedText } : null);
        lastChunkProcessed = chunk;
      }

      if (accumulatedText) {
        addCompleteChatMessage({ sender: 'ai', text: accumulatedText });
      }
      addAuditLogEntry('AI_CHAT_STREAM_SUCCESS', `User: ${currentInput.substring(0,50)}... AI: ${accumulatedText.substring(0,50)}...`);
      
      if (lastChunkProcessed) {
        const groundingMetadata = lastChunkProcessed.candidates?.[0]?.groundingMetadata;
        const groundingSources = groundingMetadata?.groundingChunks
            ?.filter(chunkItem => chunkItem.web && chunkItem.web.uri)
            .map(chunkItem => ({ uri: chunkItem.web.uri, title: chunkItem.web.title || chunkItem.web.uri })) || [];
        if (groundingSources.length > 0) {
            const sourcesText = groundingSources.map(s => `Source: [${s.title || 'Untitled'}](${s.uri})`).join('\n');
            addCompleteChatMessage({ sender: 'ai', text: `Grounding sources:\n${sourcesText}` });
        }
      }

    } catch (err: any) {
      console.error("Error sending message:", err);
      const errorMsg = `AI Chat Error: ${err.message}. Try again or check API key/MCP connection.`;
      addCompleteChatMessage({ sender: 'ai', text: errorMsg });
      setError(errorMsg);
    } finally {
      setStreamingAiMessage(null);
      setAppIsLoading(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear the chat history and reset AI session? This will also clear selected context items.")) {
      clearChatHistory(); // This now clears all selected context IDs globally
      addAuditLogEntry('AI_CHAT_CLEARED', 'Chat history, AI session, and context items cleared by user.');
    }
  };

  const handleSaveCurrentSession = () => {
    if (chatHistory.length === 0 && !streamingAiMessage) {
        setError("Cannot save an empty chat session.");
        return;
    }
    const sessionName = window.prompt("Enter a name for this chat session:", `Chat Session ${new Date().toLocaleString()}`);
    if (sessionName) {
        const messagesToSave = streamingAiMessage && streamingAiMessage.text ? [...chatHistory, streamingAiMessage] : chatHistory;
        saveChatSession(sessionName, messagesToSave, selectedFileIdsForContext, selectedWcatCaseIdsForContext, selectedToolIdsForContext); // Save tool IDs
        alert(`Session "${sessionName}" saved!`);
    }
  };

  const handleLoadSession = (sessionId: string) => {
    const loadedSession = loadSessionFromContext(sessionId);
    if (loadedSession) {
        setIsContextSidebarHidden(true);
        setStreamingAiMessage(null);
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
          addAuditLogEntry('CONTEXT_ITEM_DROPPED', `Evidence file ID ${droppedItem.id} added to context via D&D.`);
        } else if (droppedItem.type === 'wcat') {
          toggleWcatCaseContext(droppedItem.id); 
          addAuditLogEntry('CONTEXT_ITEM_DROPPED', `WCAT case ID ${droppedItem.id} added to context via D&D.`);
        } else if (droppedItem.type === 'tool') {
          toggleToolContext(droppedItem.id); 
          addAuditLogEntry('CONTEXT_ITEM_DROPPED', `Tool ID ${droppedItem.id} added to context via D&D.`);
        }
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
            <h2 className="text-3xl font-semibold text-textPrimary">AI Chat Agent</h2>
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
                    disabled={chatHistory.length === 0 && !streamingAiMessage}
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
         { (isMcpClientLoading || (mcpClient && !mcpClient.isReady())) && selectedFileIdsForContext.length > 0 && (
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
                    {chatHistory.map((msg) => (
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
                            <p className="text-xs opacity-70 mt-1">Context Tools: {msg.relatedToolIds.map(id => tools.find(t=>t.id===id)?.name || id).join(', ')}</p>
                        )}
                        <p className="text-xs opacity-70 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                        </div>
                    </div>
                    ))}
                    {streamingAiMessage && (
                       <div className="flex justify-start">
                            <div className={`max-w-xl p-3 rounded-lg shadow bg-background text-textPrimary border border-border`}>
                                <div className="flex items-center mb-1">
                                    <AiIcon />
                                    <span className="font-semibold ml-2 text-sm">AI Agent</span>
                                </div>
                                <pre className="whitespace-pre-wrap text-sm">{streamingAiMessage.text}<span className="animate-pulse">▋</span></pre>
                                <p className="text-xs opacity-70 mt-1 text-right">{new Date(streamingAiMessage.timestamp).toLocaleTimeString()}</p>
                            </div>
                        </div>
                    )}
                    {isAppLoading && !streamingAiMessage && chatHistory.length > 0 &&
                        chatHistory[chatHistory.length-1]?.sender === 'user' && (
                    <div className="flex justify-start">
                        <div className="max-w-lg p-3 rounded-lg shadow bg-background text-textPrimary border border-border">
                            <LoadingSpinner size="sm" message="AI is thinking..." />
                        </div>
                    </div>
                    )}
                    {chatHistory.length === 0 && !streamingAiMessage && !isAppLoading && (
                    <p className="text-center text-textSecondary">
                        {isDraggingOver ? "Drop item here to add to context" : "No messages yet. Select context from the sidebar and start by asking a question! Try '/extract_markers DocumentName', '/lookup_policy PolicyNumber', or '/summarize_wcat DecisionNumber'."}
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
                        placeholder="Ask a question or use a command like /extract_markers <doc_name>"
                        className="flex-grow px-4 py-2 bg-background border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        disabled={isAppLoading || !apiKey}
                    />
                    <button
                        type="submit"
                        disabled={isAppLoading || userInput.trim() === '' || !apiKey}
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
                    tools={tools} 
                    selectedToolIds={selectedToolIdsForContext} 
                    onToggleToolContext={toggleToolContext} 
                />
            )}
        </div>
    </div>
  );
};

export default ChatAgentPanelPage;
