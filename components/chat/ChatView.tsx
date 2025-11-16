

import React, { useState, useEffect, useRef, FormEvent, useMemo } from 'react';
import { User } from 'firebase/auth';
import { ChatRoom, UserProfile, Task, ChatMessage } from '../../types';
import { Send, Loader2, UserCircle, MessageSquare, Trash2, AtSign, Hash } from 'lucide-react';
import { formatRelative } from 'date-fns';
import { vi } from 'date-fns/locale';

interface MessageItemProps {
    message: any;
    isOwn: boolean;
    senderProfile?: UserProfile;
    onDelete: (messageId: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, isOwn, senderProfile, onDelete }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    if (message.isDeleted) {
        return (
            <div className={`flex items-center gap-3 ${isOwn ? 'justify-end' : ''}`}>
                <div className="px-4 py-2 rounded-xl bg-slate-800">
                    <p className="text-sm text-slate-500 italic">Tin nhắn đã được thu hồi</p>
                </div>
            </div>
        );
    }
    
    const formattedDate = formatRelative(new Date(message.createdAt), new Date(), { locale: vi });
    
    const renderTextWithMentions = (text: string) => {
        const mentionRegex = /\[(user|task):([^\]]+?) text:"([^"]+?)"\]/g;
        const parts = text.split(mentionRegex);
        
        const renderedParts = [];
        for (let i = 0; i < parts.length; i += 4) {
            renderedParts.push(<span key={`text-${i}`}>{parts[i]}</span>);
            if (parts[i+1]) {
                const type = parts[i+1]; // 'user' or 'task'
                const text = parts[i+3];
                renderedParts.push(
                    <span key={`mention-${i}`} className={`font-semibold ${type === 'user' ? 'text-primary-300' : 'text-amber-300'}`}>
                        {type === 'user' ? '@' : '#'}
                        {text}
                    </span>
                );
            }
        }
        return renderedParts;
    }


    return (
        <div 
            className={`flex items-start gap-2 group ${isOwn ? 'justify-end' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {!isOwn && (
                 <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 overflow-hidden mt-1">
                    {senderProfile?.photoURL ? <img src={senderProfile.photoURL} className="w-full h-full object-cover" /> : <UserCircle className="text-slate-400 w-full h-full" />}
                </div>
            )}
            <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl ${isOwn ? 'bg-primary-700 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
                    {!isOwn && <p className="text-xs font-bold text-primary-300 mb-1">{senderProfile?.displayName || 'Unknown'}</p>}
                    <p className="text-sm whitespace-pre-wrap">{renderTextWithMentions(message.text)}</p>
                    <p className={`text-[10px] mt-1 ${isOwn ? 'text-primary-200' : 'text-slate-400'} text-right`}>{formattedDate}</p>
                </div>
                {isOwn && isHovered && (
                     <button onClick={() => onDelete(message.id)} className="text-slate-500 hover:text-red-400 transition-opacity"><Trash2 size={14}/></button>
                )}
            </div>
        </div>
    );
};


interface ChatViewProps {
    currentUser: User;
    activeRoom: ChatRoom | null;
    profiles: Map<string, UserProfile>;
    tasks: Task[];
    onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
    messages: ChatMessage[];
    loadingMessages: boolean;
    sendMessage: (roomId: string, text: string, onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>) => Promise<void>;
    deleteMessage: (roomId: string, messageId: string) => Promise<void>;
}

const ChatView: React.FC<ChatViewProps> = ({ 
    currentUser, 
    activeRoom, 
    profiles, 
    tasks, 
    onUpdateTask,
    messages,
    loadingMessages,
    sendMessage,
    deleteMessage
}) => {
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionType, setMentionType] = useState<'user' | 'task' | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = text.substring(0, cursorPos);

        const userMatch = textBeforeCursor.match(/@(\w*)$/);
        const taskMatch = textBeforeCursor.match(/#(\w*)$/);
        
        if (userMatch) {
            setMentionType('user');
            setMentionQuery(userMatch[1]);
        } else if (taskMatch) {
            setMentionType('task');
            setMentionQuery(taskMatch[1]);
        } else {
            setMentionType(null);
        }

        setInputValue(text);
    };
    
    const handleMentionSelect = (type: 'user' | 'task', item: UserProfile | Task) => {
        const text = inputRef.current?.value || '';
        const cursorPos = inputRef.current?.selectionStart || 0;
        const textBeforeCursor = text.substring(0, cursorPos);
        
        // FIX: Use `uid` for UserProfile and `id`/`text` for Task, with proper casting. This resolves type errors where properties like `id` and `text` do not exist on the `UserProfile` type.
        const replacement = type === 'user'
            ? `[user:${(item as UserProfile).uid} text:"${(item as UserProfile).displayName}"] `
            : `[task:${(item as Task).id} text:"${(item as Task).text}"] `;
        
        const regex = type === 'user' ? /@\w*$/ : /#\w*$/;
        const newText = textBeforeCursor.replace(regex, replacement) + text.substring(cursorPos);
        
        setInputValue(newText);
        setMentionType(null);
        inputRef.current?.focus();
    };

    const mentionableUsers = useMemo(() => {
        if (!activeRoom) return [];
        return activeRoom.memberIds
            .map(id => profiles.get(id))
            .filter((p): p is UserProfile => !!p)
            .filter(p => p.displayName.toLowerCase().includes(mentionQuery.toLowerCase()));
    }, [activeRoom, profiles, mentionQuery]);

    const mentionableTasks = useMemo(() => {
        if (!activeRoom || activeRoom.type !== 'project') return [];
        return tasks.filter(t => t.projectId === activeRoom.projectId && t.text.toLowerCase().includes(mentionQuery.toLowerCase()));
    }, [activeRoom, tasks, mentionQuery]);


    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || !activeRoom) return;
        
        setIsSending(true);
        await sendMessage(activeRoom.id, inputValue.trim(), onUpdateTask);
        setInputValue('');
        setIsSending(false);
    };

    if (!activeRoom) {
        return (
            <div className="w-2/3 flex flex-col items-center justify-center text-slate-500">
                <MessageSquare size={48} />
                <h3 className="mt-4 text-lg font-semibold">Chọn một cuộc trò chuyện</h3>
                <p className="text-sm">Chọn một dự án hoặc một người để bắt đầu nhắn tin.</p>
            </div>
        );
    }

    return (
        <div className="w-2/3 flex flex-col h-full bg-slate-900/50 rounded-r-2xl">
            <div className="p-4 border-b border-slate-700 flex-shrink-0">
                <h3 className="font-bold text-white truncate">{activeRoom.name}</h3>
            </div>

            <div className="flex-grow p-4 overflow-y-auto space-y-4">
                {loadingMessages ? (
                     <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-primary-400" /></div>
                ) : (
                    messages.map(msg => (
                        <MessageItem
                            key={msg.id}
                            message={msg}
                            isOwn={msg.senderId === currentUser.uid}
                            senderProfile={profiles.get(msg.senderId)}
                            onDelete={(id) => deleteMessage(activeRoom.id, id)}
                        />
                    ))
                )}
                 <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-700 flex-shrink-0 relative">
                {mentionType && (
                    <div className="absolute bottom-full left-4 mb-2 w-[calc(100%-2rem)] max-h-48 overflow-y-auto bg-slate-800 border border-slate-600 rounded-lg shadow-lg">
                        {mentionType === 'user' && mentionableUsers.map(user => (
                            <button key={user.uid} onClick={() => handleMentionSelect('user', user)} className="w-full text-left flex items-center gap-2 p-2 hover:bg-slate-700">
                                <AtSign size={14} className="text-primary-300"/>
                                <span className="text-sm text-slate-200">{user.displayName}</span>
                            </button>
                        ))}
                        {mentionType === 'task' && mentionableTasks.map(task => (
                            <button key={task.id} onClick={() => handleMentionSelect('task', task)} className="w-full text-left flex items-center gap-2 p-2 hover:bg-slate-700">
                                <Hash size={14} className="text-amber-300"/>
                                <span className="text-sm text-slate-200 truncate">{task.text}</span>
                            </button>
                        ))}
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                            }
                        }}
                        placeholder="Nhập tin nhắn..."
                        className="w-full bg-[#293548] text-slate-200 border border-slate-600 rounded-lg p-2 text-sm resize-none"
                        rows={1}
                        style={{ height: 'auto', maxHeight: '100px' }}
                        disabled={isSending}
                    />
                    <button type="submit" disabled={isSending || !inputValue.trim()} className="bg-primary-600 hover:bg-primary-700 text-white p-2.5 rounded-lg disabled:bg-slate-700">
                        {isSending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatView;
