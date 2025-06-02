
import React from 'react';
import { ChatMessage, MessageSender } from '../types';

interface ChatMessageItemProps {
  message: ChatMessage;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isUser = message.sender === MessageSender.USER;
  const isSystem = message.sender === MessageSender.SYSTEM;

  const messageClass = isUser
    ? 'bg-blue-600 text-white self-end'
    : isSystem
    ? 'bg-amber-100 dark:bg-yellow-600 dark:bg-opacity-30 text-amber-800 dark:text-yellow-300 self-center w-full md:w-3/4 lg:w-2/3 text-xs italic'
    : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 self-start';
  
  const containerAlign = isUser ? 'items-end' : isSystem ? 'items-center' : 'items-start';

  // Basic markdown for bold and italics, and newlines
  const formatText = (text: string) => {
    let formattedText = text;
    // Replace **bold** with <strong>
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Replace *italic* or _italic_ with <em>
    formattedText = formattedText.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
    // Replace newlines with <br />
    formattedText = formattedText.replace(/\n/g, '<br />');
    return <span dangerouslySetInnerHTML={{ __html: formattedText }} />;
  };

  return (
    <div className={`flex flex-col ${containerAlign} mb-3`}>
      <div
        className={`max-w-xl lg:max-w-2xl px-3 py-2 rounded-lg shadow-md ${messageClass} ${message.isCommandResponse ? 'font-mono text-sm' : 'text-sm'}`}
      >
        <div className="whitespace-pre-wrap">{formatText(message.text)}</div>
        {message.isLoading && <span className="italic text-xs opacity-70"> (typing...)</span>}
      </div>
      <p className={`text-xs opacity-60 mt-1 px-1 ${isUser ? 'text-right self-end' : 'text-left self-start'}`}>
        {message.sender.charAt(0).toUpperCase() + message.sender.slice(1)} - {message.timestamp.toLocaleTimeString()}
      </p>
    </div>
  );
};

export default ChatMessageItem;