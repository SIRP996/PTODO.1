
import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { Project, UserProfile, ChatRoom } from '../../types';
import { useChat } from '../../hooks/useChat';
import { X, UserCircle, Users, Hash } from 'lucide-react';

interface ChatRoomListProps {
    currentUser: User;
    projects: Project[];
    profiles: Map<string, UserProfile>;
    activeRoomId: string | null;
    onSelectRoom: (room: ChatRoom) => void;
    onSelectUser: (user: UserProfile) => void;
    onClose: () => void;
}

const ChatRoomList: React.FC<ChatRoomListProps> = ({ 
    currentUser, 
    projects, 
    profiles, 
    activeRoomId, 
    onSelectRoom,
    onSelectUser,
    onClose
}) => {
    const { projectChatRooms, dmChatRooms, loadingRooms } = useChat(currentUser, projects);
    const [searchTerm, setSearchTerm] = useState('');

    const otherUsers = useMemo(() => {
        const userSet = new Map<string, UserProfile>();
        projects.forEach(p => {
            p.memberIds.forEach(id => {
                if (id !== currentUser.uid && !userSet.has(id)) {
                    const profile = profiles.get(id);
                    if (profile) userSet.set(id, profile);
                }
            })
        });
        return Array.from(userSet.values());
    }, [projects, profiles, currentUser.uid]);
    
    const filteredUsers = useMemo(() => {
        if (!searchTerm) return otherUsers;
        return otherUsers.filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [otherUsers, searchTerm]);
    
    const filteredProjectRooms = useMemo(() => {
        if (!searchTerm) return projectChatRooms;
        return projectChatRooms.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [projectChatRooms, searchTerm]);

    const getDmRoomName = (room: ChatRoom): string => {
        if (room.memberProfiles) {
            const otherMemberId = room.memberIds.find(id => id !== currentUser.uid);
            if (otherMemberId) {
                return room.memberProfiles[otherMemberId]?.displayName || 'Unknown User';
            }
        }
        return 'Direct Message';
    };

    const getDmRoomAvatar = (room: ChatRoom): string | null | undefined => {
        const otherMemberId = room.memberIds.find(id => id !== currentUser.uid);
        if (otherMemberId && room.memberProfiles) {
            return room.memberProfiles[otherMemberId]?.photoURL;
        }
        return null;
    };


    return (
        <div className="w-1/3 bg-slate-800/30 border-r border-slate-700 flex flex-col h-full">
            <div className="p-4 border-b border-slate-700 flex-shrink-0 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Trò chuyện</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden">
                    <X />
                </button>
            </div>
            <div className="p-2 flex-shrink-0">
                <input 
                    type="text"
                    placeholder="Tìm kiếm..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-800/50 text-slate-200 border border-slate-600 rounded-lg px-3 py-1.5 text-sm"
                />
            </div>
            <div className="flex-grow overflow-y-auto">
                {/* Project Rooms */}
                <div className="p-2">
                    <h3 className="px-2 text-xs font-semibold text-slate-400 uppercase mb-1">Dự án</h3>
                    {filteredProjectRooms.map(room => (
                        <button 
                            key={room.id}
                            onClick={() => onSelectRoom(room)}
                            className={`w-full text-left flex items-center gap-3 p-2 rounded-md ${activeRoomId === room.id ? 'bg-primary-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                        >
                            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: room.projectColor || '#475569' }}>
                                <Hash size={14} />
                            </div>
                            <div className="truncate">
                                <p className="text-sm font-semibold truncate">{room.name}</p>
                            </div>
                        </button>
                    ))}
                </div>

                 {/* DM Rooms */}
                <div className="p-2">
                    <h3 className="px-2 text-xs font-semibold text-slate-400 uppercase mb-1">Tin nhắn trực tiếp</h3>
                    {dmChatRooms.map(room => (
                         <button 
                            key={room.id}
                            onClick={() => onSelectRoom(room)}
                            className={`w-full text-left flex items-center gap-3 p-2 rounded-md ${activeRoomId === room.id ? 'bg-primary-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                        >
                            <div className="w-6 h-6 rounded-full flex-shrink-0 bg-slate-700 overflow-hidden">
                                {getDmRoomAvatar(room) ? <img src={getDmRoomAvatar(room)!} className="w-full h-full object-cover" /> : <UserCircle className="text-slate-400"/>}
                            </div>
                            <div className="truncate">
                                <p className="text-sm font-semibold truncate">{getDmRoomName(room)}</p>
                            </div>
                        </button>
                    ))}
                    {filteredUsers.map(user => {
                        const existingDm = dmChatRooms.find(r => r.memberIds.includes(user.uid));
                        if(existingDm) return null; // Don't show user if a chat already exists
                        return (
                            <button 
                                key={user.uid}
                                onClick={() => onSelectUser(user)}
                                className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-700 text-slate-300"
                            >
                                <div className="w-6 h-6 rounded-full flex-shrink-0 bg-slate-700 overflow-hidden">
                                    {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <UserCircle className="text-slate-400"/>}
                                </div>
                                <p className="text-sm font-semibold truncate">{user.displayName}</p>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

export default ChatRoomList;
