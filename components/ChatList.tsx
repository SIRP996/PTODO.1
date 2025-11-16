import React, { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { ChatRoom, UserProfile, Project } from '../types';
import { MessageSquare, Users, Folder, Plus, UserCircle, X, Check, ChevronDown, ChevronRight } from 'lucide-react';

interface ChatListProps {
  rooms: ChatRoom[];
  currentUser: User | null;
  profiles: Map<string, UserProfile>;
  allUsers: UserProfile[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onCreateChat: (memberIds: string[], type: 'dm' | 'group', name?: string) => Promise<string | null>;
  projects: Project[];
}

const CreateChatModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    allUsers: UserProfile[];
    currentUser: User;
    onCreateChat: ChatListProps['onCreateChat'];
}> = ({ isOpen, onClose, allUsers, currentUser, onCreateChat }) => {
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [groupName, setGroupName] = useState('');

    const otherUsers = useMemo(() => allUsers.filter(u => u.uid !== currentUser.uid), [allUsers, currentUser]);

    if (!isOpen) return null;

    const handleToggleUser = (userId: string) => {
        setSelectedUserIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    const handleCreate = async () => {
        const memberIds = Array.from(selectedUserIds);
        if (memberIds.length === 0) return;

        const type = memberIds.length > 1 ? 'group' : 'dm';
        const name = type === 'group' ? groupName.trim() : undefined;

        const newRoomId = await onCreateChat(memberIds, type, name);
        if (newRoomId) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
            <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-white/10 max-w-md w-full rounded-2xl shadow-2xl flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">Tạo cuộc trò chuyện mới</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
                </div>
                <div className="p-4 space-y-4">
                    {selectedUserIds.size > 1 && (
                        <input
                            type="text"
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            placeholder="Đặt tên nhóm (tùy chọn)"
                            className="w-full bg-[#293548] text-slate-200 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                        />
                    )}
                    <div className="max-h-60 overflow-y-auto space-y-1 pr-2">
                        {otherUsers.map(user => (
                            <button
                                key={user.uid}
                                onClick={() => handleToggleUser(user.uid)}
                                className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${selectedUserIds.has(user.uid) ? 'bg-primary-600/20' : 'hover:bg-slate-700/50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 overflow-hidden">
                                        {user.photoURL ? <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-slate-400 m-auto" />}
                                    </div>
                                    <span className="text-sm text-slate-200">{user.displayName}</span>
                                </div>
                                {selectedUserIds.has(user.uid) && <Check size={16} className="text-primary-400" />}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleCreate}
                        disabled={selectedUserIds.size === 0}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-700 disabled:cursor-not-allowed"
                    >
                        {selectedUserIds.size > 1 ? 'Tạo nhóm' : selectedUserIds.size === 1 ? 'Bắt đầu trò chuyện' : 'Chọn một người'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const ChatList: React.FC<ChatListProps> = ({ rooms, currentUser, profiles, allUsers, selectedRoomId, onSelectRoom, onCreateChat, projects }) => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
    const [isGeneralExpanded, setIsGeneralExpanded] = useState(true);

    const getRoomDisplayName = (room: ChatRoom) => {
        if (room.type !== 'dm' || !currentUser) return room.name;
        const otherUserId = room.memberIds.find(id => id !== currentUser.uid);
        if (!otherUserId) return room.name;
        return profiles.get(otherUserId)?.displayName || room.name;
    };

    const isUnread = (room: ChatRoom) => {
        if (!currentUser || !room.lastMessage?.timestamp || room.lastMessage.senderId === currentUser.uid) {
            return false;
        }
        const lastReadTimestamp = room.lastRead?.[currentUser.uid];
        if (!lastReadTimestamp) return true; // Never read
        return new Date(room.lastMessage.timestamp) > new Date(lastReadTimestamp);
    };

    const filteredRooms = useMemo(() => {
        if (!searchTerm) return rooms;
        return rooms.filter(room => 
            getRoomDisplayName(room).toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [rooms, searchTerm, currentUser, profiles]);

    const { projectChats, generalChats } = useMemo(() => {
        const projectChats: ChatRoom[] = [];
        const generalChats: ChatRoom[] = [];
        filteredRooms.forEach(room => {
            if (room.type === 'project') {
                projectChats.push(room);
            } else {
                generalChats.push(room);
            }
        });
        return { projectChats, generalChats };
    }, [filteredRooms]);
    
    const getRoomDisplayAvatar = (room: ChatRoom) => {
        if (room.type === 'project') {
            const project = projects.find(p => p.id === room.projectId);
            return <Folder size={18} style={{ color: project?.color || '#94a3b8' }} />;
        }
        if (room.type === 'group') return <Users size={18} className="text-slate-400" />;
        if (room.type === 'dm' && currentUser) {
            const otherUserId = room.memberIds.find(id => id !== currentUser.uid);
            if (otherUserId) {
                const profile = profiles.get(otherUserId);
                if (profile?.photoURL) {
                    return <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />;
                }
            }
        }
        return <UserCircle size={18} className="text-slate-400" />;
    };

    return (
        <div className="flex flex-col h-full">
            {currentUser && <CreateChatModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} allUsers={allUsers} currentUser={currentUser} onCreateChat={onCreateChat} />}

            <div className="p-4 border-b border-white/10 flex justify-between items-center flex-shrink-0">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><MessageSquare size={20} /> Danh sách</h3>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-700 transition-colors"
                    title="Trò chuyện mới"
                >
                    <Plus size={18} />
                </button>
            </div>
            
            <div className="p-4 flex-shrink-0 border-b border-white/10">
                <input 
                    type="text" 
                    placeholder="Tìm kiếm..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900/50 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                />
            </div>

            <div className="flex-grow overflow-y-auto p-2">
                {/* Project Chats */}
                <div 
                    className="flex justify-between items-center px-2 py-2 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-400"
                    onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                >
                    <span>Dự án</span>
                    {isProjectsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                {isProjectsExpanded && (
                    <ul className="space-y-1">
                        {projectChats.map(room => {
                            const unread = isUnread(room);
                            return (
                            <li key={room.id}>
                                <button
                                    onClick={() => onSelectRoom(room.id)}
                                    className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-left transition-colors ${selectedRoomId === room.id ? 'bg-primary-600/80' : 'hover:bg-slate-700/50'}`}
                                >
                                    <div className="w-7 h-7 rounded-lg bg-slate-700 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                        {getRoomDisplayAvatar(room)}
                                    </div>
                                    <div className="flex-grow truncate">
                                        <p className={`text-sm truncate ${selectedRoomId === room.id ? 'text-white' : 'text-slate-200'} ${unread ? 'font-bold text-white' : 'font-semibold'}`}>{getRoomDisplayName(room)}</p>
                                        <p className={`text-xs truncate ${selectedRoomId === room.id ? 'text-primary-200' : 'text-slate-400'} ${unread ? 'font-semibold text-white' : ''}`}>
                                        {room.lastMessage ? `${room.lastMessage.senderName}: ${room.lastMessage.text}` : `${room.memberIds.length} thành viên`}
                                        </p>
                                    </div>
                                    {unread && <div className="w-2.5 h-2.5 bg-primary-400 rounded-full flex-shrink-0" title="Tin nhắn mới"></div>}
                                </button>
                            </li>
                        )})}
                    </ul>
                )}

                {/* General Chats */}
                <div 
                    className="flex justify-between items-center px-2 py-2 mt-2 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-400"
                    onClick={() => setIsGeneralExpanded(!isGeneralExpanded)}
                >
                    <span>Tin nhắn</span>
                    {isGeneralExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                 {isGeneralExpanded && (
                    <ul className="space-y-1">
                        {generalChats.map(room => {
                             const unread = isUnread(room);
                             return (
                            <li key={room.id}>
                                <button
                                    onClick={() => onSelectRoom(room.id)}
                                    className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-left transition-colors ${selectedRoomId === room.id ? 'bg-primary-600/80' : 'hover:bg-slate-700/50'}`}
                                >
                                    <div className="w-7 h-7 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                        {getRoomDisplayAvatar(room)}
                                    </div>
                                    <div className="flex-grow truncate">
                                        <p className={`text-sm truncate ${selectedRoomId === room.id ? 'text-white' : 'text-slate-200'} ${unread ? 'font-bold text-white' : 'font-semibold'}`}>{getRoomDisplayName(room)}</p>
                                        <p className={`text-xs truncate ${selectedRoomId === room.id ? 'text-primary-200' : 'text-slate-400'} ${unread ? 'font-semibold text-white' : ''}`}>
                                        {room.lastMessage ? `${room.lastMessage.senderName}: ${room.lastMessage.text}` : 'Bắt đầu trò chuyện...'}
                                        </p>
                                    </div>
                                     {unread && <div className="w-2.5 h-2.5 bg-primary-400 rounded-full flex-shrink-0" title="Tin nhắn mới"></div>}
                                </button>
                            </li>
                        )})}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default ChatList;