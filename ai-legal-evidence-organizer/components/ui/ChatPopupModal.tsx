
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { ChatMessage as AppChatMessage, EvidenceFile, WcatCase } from '../../types';
import { getChatResponse, resetChatSession as resetMainChatSession } from '../../services/geminiService'; // resetMainChatSession not used here directly
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal'; // Using the existing Modal component
import { SIMULATED_CONTEXT_WINDOW_TOKENS, SIMULATED_TOKEN_WARNING_THRESHOLD } from '../../constants';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface ChatPopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEvidenceContext?: EvidenceFile[];
  initialWcatContext?: WcatCase[];
}

const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" /></svg>;
const AiIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.22 5.222a.75.75 0 011.06 0l1.25 1.25a.75.75 0 010 1.06l-1.25 1.25a.75.75 0 01-1.06 0l-1.25-1.25a.75.75 0 010-1.06l1.25-1.25zM4.47 9.47a.75.75 0 011.06 0l1.25 1.25a.75.75 0 010 1.06l-1.25 1.25a.75.75 0 01-1.06-1.06l1.25-1.25a.75.75 0 010-1.06l-1.25-1.25a.75.75 0 010-1.06zM11.97 9.47a.75.75 0 011.06 0l1.25 1.25a.75.75 0 010 1.06l-1.25 1.25a.75.75 0 01-1.06-1.06l1.25-1.25a.75.75 0 010-1.06l-1.25-1.25a.75.75 0 010-1.06zM10 3a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 0110 3zM10 15a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 0110 15zM4.646 4.646a.75.75 0 011.061 0l.5.5a.75.75 0 01-1.06 1.061l-.5-.5a.75.75 0 010-1.061zM13.793 13.793a.75.75 0 011.06 0l.5.5a.75.75 0 01-1.06 1.06l-.5-.5a.75.75 0 010-1.06zM3.75 10a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75zm11.75 0a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75zM5.707 13.793a.75.75 0 010-1.06l.5-.5a.75.75 0 111.06 1.06l-.5.5a.75.75 0 01-1.06 0zM12.732 5.707a.75.75 0 010-1.06l.5-.5a.75.75 0 011.061 1.06l-.5.5a.75.75 0 01-1.06 0z" clipRule="evenodd" /></svg>;

// Simple token estimation heuristic
const estimateTokens = (text: string = ''): number => Math.ceil(text.length / 4);

const ChatPopupModal: React.FC<ChatPopupModalProps> = ({ 
    isOpen, 
    onClose, 
    initialEvidenceContext = [], 
    initialWcatContext = [] 
}) => {
  const { setIsLoading: setAppIsLoading, setError: setAppError, apiKey, addAuditLogEntry } = useAppContext();
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [currentTotalEstTokens, setCurrentTotalEstTokens] = useState(0);

  const getStorageKey = useCallback(() => {
    if (!initialEvidenceContext.length && !initialWcatContext.length) return null;
    const eIds = initialEvidenceContext.map(f => f.id).sort().join('_');
    const wIds = initialWcatContext.map(c => c.id).sort().join('_');
    return `chatHistory_popup_e_${eIds}_w_${wIds}`;
  }, [initialEvidenceContext, initialWcatContext]);

  // Load chat history from localStorage
  useEffect(() => {
    if (!isOpen) return;
    const storageKey = getStorageKey();
    if (storageKey) {
      const storedHistory = localStorage.getItem(storageKey);
      if (storedHistory) {
        setChatHistory(JSON.parse(storedHistory));
      } else {
        setChatHistory([]); // Start fresh if no history for this pair
      }
    } else {
        setChatHistory([]); // No context, no specific history
    }
  }, [isOpen, getStorageKey]);

  // Save chat history to localStorage
  useEffect(() => {
    const storageKey = getStorageKey();
    if (storageKey && chatHistory.length > 0) { // Only save if there's history
      localStorage.setItem(storageKey, JSON.stringify(chatHistory));
    }
  }, [chatHistory, getStorageKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Calculate estimated tokens
  useEffect(() => {
    let tokens = 0;
    tokens += estimateTokens(userInput);
    chatHistory.forEach(msg => tokens += estimateTokens(msg.text));
    initialEvidenceContext.forEach(f => tokens += estimateTokens(f.summary) + estimateTokens(f.content)); // Or just summary for brevity
    initialWcatContext.forEach(c => tokens += estimateTokens(c.aiSummary) + estimateTokens(c.rawTextContent)); // Or just aiSummary
    setCurrentTotalEstTokens(tokens);
  }, [userInput, chatHistory, initialEvidenceContext, initialWcatContext]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentInput = userInput.trim();
    if (currentInput === '' || isSending) return;

    if (!apiKey) {
      setAppError("Gemini API Key is not set. Please configure it in Settings.");
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5) + '_user',
      sender: 'user',
      text: currentInput,
      timestamp: new Date().toISOString(),
    };
    setChatHistory(prev => [...prev, userMsg]);
    setUserInput('');
    setIsSending(true);
    setAppError(null);

    try {
      const appChatHistoryForGemini: AppChatMessage[] = chatHistory.map(msg => ({
          ...msg, 
          relatedFileIds: msg.sender === 'user' ? initialEvidenceContext.map(f=>f.id) : undefined,
          relatedWcatCaseIds: msg.sender === 'user' ? initialWcatContext.map(c=>c.id) : undefined,
      }));

      const aiResponse = await getChatResponse(
        appChatHistoryForGemini, 
        currentInput, 
        initialEvidenceContext, 
        initialWcatContext
      );
      
      const aiMsg: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5) + '_ai',
        sender: 'ai',
        text: aiResponse.text,
        timestamp: new Date().toISOString(),
      };
      setChatHistory(prev => [...prev, aiMsg]);
      addAuditLogEntry('POPUP_CHAT_MESSAGE', `Context: ${initialEvidenceContext.map(f=>f.name).join('/') || 'N/A'} & ${initialWcatContext.map(c=>c.decisionNumber).join('/') || 'N/A'}. User: ${currentInput.substring(0,30)}... AI: ${aiResponse.text.substring(0,30)}...`);

       if (aiResponse.groundingSources && aiResponse.groundingSources.length > 0) {
        const sourcesText = aiResponse.groundingSources.map(s => `Source: ${s.title} (${s.uri})`).join('\n');
        const sourcesMsg: ChatMessage = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5) + '_ai_src',
            sender: 'ai',
            text: `Grounding sources:\n${sourcesText}`,
            timestamp: new Date().toISOString(),
        };
        setChatHistory(prev => [...prev, sourcesMsg]);
      }

    } catch (err: any) {
      const errorText = `AI Chat Error: ${err.message}`;
      const errorMsg: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5) + '_ai_err',
        sender: 'ai',
        text: errorText,
        timestamp: new Date().toISOString(),
      };
      setChatHistory(prev => [...prev, errorMsg]);
      setAppError(errorText);
    } finally {
      setIsSending(false);
      setAppIsLoading(false);
    }
  };

  const handleClearChatHistory = () => {
    if (window.confirm("Are you sure you want to clear the chat history for this specific comparison?")) {
        setChatHistory([]);
        const storageKey = getStorageKey();
        if (storageKey) {
            localStorage.removeItem(storageKey);
        }
        addAuditLogEntry('POPUP_CHAT_CLEARED', `History cleared for context: ${getStorageKey()}`);
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
        title="AI Chat Agent"
        footer={
            <form onSubmit={handleSendMessage} className="flex gap-2 p-1 items-center">
                <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Ask about these documents..."
                    className="flex-grow px-3 py-2 bg-background border border-border rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    disabled={isSending || !apiKey}
                />
                <button
                    type="submit"
                    disabled={isSending || userInput.trim() === '' || !apiKey}
                    className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                    Send
                </button>
            </form>
        }
    >
      <div className="h-[65vh] flex flex-col"> {/* Increased height slightly */}
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
            {chatHistory.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-md p-2.5 rounded-lg shadow ${
                    msg.sender === 'user' 
                    ? 'bg-primary text-white' 
                    : 'bg-background text-textPrimary border border-border'
                }`}>
                <div className="flex items-center mb-1">
                    {msg.sender === 'user' ? <UserIcon /> : <AiIcon />}
                    <span className="font-semibold ml-2 text-xs">{msg.sender === 'user' ? 'You' : 'AI Agent'}</span>
                </div>
                <pre className="whitespace-pre-wrap text-sm">{msg.text}</pre>
                <p className="text-xs opacity-70 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </div>
            ))}
            {isSending && (
            <div className="flex justify-start">
                <div className="max-w-lg p-3 rounded-lg shadow bg-background text-textPrimary border border-border">
                    <LoadingSpinner size="sm" message="AI is thinking..." />
                </div>
            </div>
            )}
            {chatHistory.length === 0 && !isSending && (
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
