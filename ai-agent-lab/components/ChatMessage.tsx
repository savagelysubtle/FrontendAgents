import React from 'react';
import { ChatMessage as ChatMessageType, MessageSender, DocumentationContent } from '../types';
import { ACCENT_COLOR } from '../constants';
import AgentIcon from './icons/AgentIcon'; // Assuming AI is an "agent"
import SpinnerIcon from './icons/SpinnerIcon'; // For loading state

const ChatMessage: React.FC<{ message: ChatMessageType }> = ({ message }) => {
  const isUser = message.sender === MessageSender.USER;
  const isSystem = message.sender === MessageSender.SYSTEM;

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className={`text-[var(--accent-text)] hover:underline`}>{part}</a>;
      }
      return part;
    });
  };
  
  const renderDocumentation = (doc: DocumentationContent) => (
    <div className="mt-2 p-3 bg-gray-50 dark:bg-zinc-800 rounded-md border border-[var(--border-secondary)]">
      <h4 className="font-semibold text-md text-[var(--text-primary)]">{doc.title}</h4>
      {doc.installGuide && doc.installGuide.length > 0 && (
        <div className="mt-2">
          <h5 className="font-medium text-sm text-[var(--text-secondary)]">Installation Guide:</h5>
          <ul className="list-disc list-inside ml-4 text-sm text-[var(--text-secondary)]">
            {doc.installGuide.map((step, i) => <li key={i}>{step}</li>)}
          </ul>
        </div>
      )}
      {doc.usage && doc.usage.length > 0 && (
        <div className="mt-2">
          <h5 className="font-medium text-sm text-[var(--text-secondary)]">Usage:</h5>
          {doc.usage.map((item, i) => (
            <div key={i} className="ml-4 mt-1">
              <code className={`block bg-gray-200 dark:bg-zinc-700 p-1 rounded text-xs text-[var(--text-secondary)]`}>{item.command}</code>
              <p className="text-sm text-[var(--text-secondary)]">{item.description}</p>
            </div>
          ))}
        </div>
      )}
      {doc.faq && doc.faq.length > 0 && (
        <div className="mt-2">
          <h5 className="font-medium text-sm text-[var(--text-secondary)]">FAQ:</h5>
          {doc.faq.map((item, i) => (
            <div key={i} className="ml-4 mt-1">
              <p className="font-semibold text-sm text-[var(--text-secondary)]">{item.question}</p>
              <p className="text-sm text-[var(--text-secondary)]">{item.answer}</p>
            </div>
          ))}
        </div>
      )}
      {doc.improvementSuggestions && doc.improvementSuggestions.length > 0 && (
        <div className="mt-2">
          <h5 className="font-medium text-sm text-[var(--text-secondary)]">Improvement Suggestions:</h5>
          <ul className="list-disc list-inside ml-4 text-sm text-[var(--text-secondary)]">
            {doc.improvementSuggestions.map((suggestion, i) => <li key={i}>{suggestion}</li>)}
          </ul>
        </div>
      )}
    </div>
  );

  if (isSystem) {
    return (
      <div className="my-2 text-center">
        <span className="px-2 py-1 bg-gray-200 dark:bg-zinc-800 text-xs text-[var(--text-subtle)] rounded-full">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex my-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-end max-w-xs md:max-w-md lg:max-w-lg ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className={`flex-shrink-0 h-8 w-8 rounded-full bg-gray-300 dark:bg-zinc-700 flex items-center justify-center mr-2`}>
            <AgentIcon className={`h-5 w-5 text-[var(--accent-text)]`} />
          </div>
        )}
        <div
          className={`px-4 py-2 rounded-lg shadow ${
            isUser 
            ? `bg-[var(--accent-bg)] text-[var(--accent-text-on-bg)]` 
            : 'bg-[var(--input-background)] text-[var(--text-primary)]' // Changed from bg-white dark:bg-zinc-800
          }`}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words">
            {message.isLoading && <SpinnerIcon className="w-5 h-5 inline-block mr-2" />}
            {renderTextWithLinks(message.text)}
          </div>
          {message.data && message.data.documentation && renderDocumentation(message.data.documentation as DocumentationContent)}
          <div className={`text-xs mt-1 ${isUser ? 'text-gray-200 dark:text-zinc-300 text-right' : 'text-[var(--text-subtle)] text-left'}`}>
            {formatTimestamp(message.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;