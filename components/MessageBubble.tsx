
import React from 'react';
import Markdown from 'react-markdown';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isModel = message.role === 'model';

  return (
    <div className={`flex w-full mb-12 ${isModel ? 'justify-start' : 'justify-end'} message-fade-in`}>
      <div 
        className={`max-w-[90%] md:max-w-[80%] px-8 py-8 rounded-[2.5rem] shadow-sm leading-loose transition-all ${
          isModel 
            ? 'glass-card text-indigo-900 rounded-tl-none' 
            : 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-100 shadow-xl'
        }`}
      >
        <div className={`markdown-body text-lg md:text-xl ${isModel ? 'font-serif italic text-indigo-800/90' : 'font-light'}`}>
          <Markdown>{message.text}</Markdown>
        </div>
        <div className={`text-[10px] mt-6 opacity-40 uppercase tracking-[0.2em] font-bold flex items-center ${isModel ? 'justify-start' : 'justify-end'}`}>
          {isModel && <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-2 animate-pulse"></span>}
          {isModel ? 'LuminaSoul Guide' : 'Your Heart'} • {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
