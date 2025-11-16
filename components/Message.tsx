import React, { useMemo } from 'react';
import { User } from 'firebase/auth';
import { ChatMessage } from '../types';
import { UserCircle, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface MessageProps {
  message: ChatMessage;
  currentUser: User;
  onDelete: (messageId: string) => void;
}

const Message: React.FC<MessageProps> = ({ message, currentUser, onDelete }) => {
  const isSender = message.senderId === currentUser.uid;
  const isSystem = message.senderId === 'system';

  const formattedTimestamp = useMemo(() => {
    if (!message.createdAt) return '';
    return formatDistanceToNow(new Date(message.createdAt), { addSuffix: true, locale: vi });
  }, [message.createdAt]);

  const renderText = (text: string): React.ReactNode[] => {
    const regex = /\[(user|task):([a-zA-Z0-9]+)\s+text:"([^"]+)"\]/g;
    const matches = Array.from(text.matchAll(regex));

    if (matches.length === 0) {
      return [text]; // No mentions, return plain text
    }

    const resultNodes: React.ReactNode[] = [];
    let lastIndex = 0;

    matches.forEach((match, index) => {
      const [fullMatch, type, id, displayText] = match;
      const matchIndex = match.index!;

      // Add text before the match
      if (matchIndex > lastIndex) {
        resultNodes.push(text.substring(lastIndex, matchIndex));
      }

      // Add the styled mention
      const className = type === 'user'
        ? 'text-primary-400 bg-primary-900/50 px-1 rounded font-semibold'
        : 'text-amber-400 bg-amber-900/50 px-1 rounded font-semibold';
      
      resultNodes.push(
        <strong key={`${id}-${index}`} className={className}>
          {type === 'user' ? `@${displayText.trim()}` : `#${displayText.trim()}`}
        </strong>
      );

      lastIndex = matchIndex + fullMatch.length;
    });

    // Add any remaining text after the last match
    if (lastIndex < text.length) {
      resultNodes.push(text.substring(lastIndex));
    }
    
    return resultNodes;
  };


  if (isSystem) {
      return (
          <div className="text-center text-xs text-slate-400 py-2">
              {message.text}
          </div>
      )
  }

  return (
    <div className={`group flex items-start gap-3 ${isSender ? 'justify-end' : ''}`}>
      {!isSender && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
          {message.senderAvatar ? (
            <img src={message.senderAvatar} alt={message.senderName} className="w-full h-full object-cover" />
          ) : (
            <UserCircle size={20} className="text-slate-400" />
          )}
        </div>
      )}

      {isSender && (
         <div className="flex items-center self-end opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onDelete(message.id)} className="p-1 text-slate-500 hover:text-red-400" title="Xóa tin nhắn">
                <Trash2 size={14}/>
            </button>
        </div>
      )}

      <div className={`max-w-[70%]`}>
        <div className={`px-4 py-2 rounded-xl ${isSender ? 'bg-primary-700 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
          {!isSender && <p className="text-xs font-bold text-primary-300 mb-1">{message.senderName}</p>}
          <p className="text-sm whitespace-pre-wrap">{renderText(message.text)}</p>
        </div>
        <p className={`text-xs text-slate-500 mt-1 ${isSender ? 'text-right' : 'text-left'}`}>{formattedTimestamp}</p>
      </div>

       {!isSender && (
         <div className="flex items-center self-end opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Placeholder for future actions like reply */}
        </div>
      )}

      {isSender && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden">
          {currentUser.photoURL ? (
            <img src={currentUser.photoURL} alt={currentUser.displayName || ''} className="w-full h-full object-cover" />
          ) : (
            <UserCircle size={20} className="text-white" />
          )}
        </div>
      )}
    </div>
  );
};

export default Message;
