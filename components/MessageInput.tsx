import React, { useState, FormEvent, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Smile, Loader2 } from 'lucide-react';
import { Task, UserProfile } from '../types';

interface Suggestion {
  type: 'user' | 'task';
  query: string;
  triggerIndex: number;
}

interface MessageInputProps {
  onSendMessage: (text: string) => Promise<void>;
  tasks: Task[];
  members: UserProfile[];
  projectId?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, tasks, members, projectId }) => {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestions, setSuggestions] = useState<(UserProfile | Task)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (suggestion) {
        let filtered: (UserProfile | Task)[] = [];
        if (suggestion.type === 'user') {
            filtered = members.filter(m => m.displayName.toLowerCase().includes(suggestion.query.toLowerCase()));
        } else if (suggestion.type === 'task') {
            const relevantTasks = projectId ? tasks.filter(t => t.projectId === projectId) : tasks;
            filtered = relevantTasks.filter(t => t.text.toLowerCase().includes(suggestion.query.toLowerCase()) && t.status !== 'completed');
        }
        setSuggestions(filtered.slice(0, 5)); // Limit to 5 suggestions
        setActiveIndex(0);
    } else {
        setSuggestions([]);
    }
  }, [suggestion, members, tasks, projectId]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newText.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)([@#])(\w*)$/);

    if (mentionMatch) {
      const [, trigger, query] = mentionMatch;
      setSuggestion({
        type: trigger === '@' ? 'user' : 'task',
        query,
        triggerIndex: textBeforeCursor.lastIndexOf(trigger),
      });
    } else {
      setSuggestion(null);
    }
    setText(newText);
  };
  
  const handleSelectSuggestion = (item: UserProfile | Task) => {
    if (!suggestion || !textareaRef.current) return;

    const isUser = 'displayName' in item;
    const type = isUser ? 'user' : 'task';
    const id = isUser ? item.uid : item.id;
    const displayText = isUser ? item.displayName : item.text;

    const mentionText = `[${type}:${id} text:"${displayText}"] `;
    
    const textBefore = text.substring(0, suggestion.triggerIndex);
    const textAfter = text.substring(textareaRef.current.selectionStart);
    
    const newText = textBefore + mentionText + textAfter;
    
    setText(newText);
    setSuggestion(null);
    
    // Move cursor after the inserted mention
    const newCursorPos = (textBefore + mentionText).length;
    setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };
  
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestion && suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            handleSelectSuggestion(suggestions[activeIndex]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setSuggestion(null);
        }
    } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
    }
  };


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSending) return;

    setIsSending(true);
    await onSendMessage(text);
    setText('');
    setIsSending(false);
  };

  const renderSuggestionPopup = () => {
    if (!suggestion || suggestions.length === 0) return null;

    return (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#293548] border border-slate-600 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
            {suggestions.map((item, index) => {
                const isUser = 'displayName' in item;
                const displayText = isUser ? `@${item.displayName}` : `#${item.text}`;
                return (
                    <button
                        key={isUser ? item.uid : item.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className={`w-full text-left px-3 py-2 text-sm truncate ${index === activeIndex ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                    >
                        {displayText}
                    </button>
                );
            })}
        </div>
    );
  };


  return (
    <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
      {renderSuggestionPopup()}
      <div className="relative flex-grow">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn..."
          className="w-full bg-[#293548] text-slate-200 border border-slate-600 focus:border-primary-500 focus:ring-0 rounded-lg px-4 py-2 transition text-sm pr-12 resize-none"
          rows={1}
          disabled={isSending}
        />
        <button
            type="button"
            className="absolute top-1/2 right-3 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-white"
            title="Thêm icon"
        >
            <Smile size={18} />
        </button>
      </div>
      <button
        type="submit"
        disabled={isSending || !text.trim()}
        className="bg-primary-600 hover:bg-primary-700 text-white p-2.5 rounded-lg transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed"
      >
        {isSending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
      </button>
    </form>
  );
};

export default MessageInput;
