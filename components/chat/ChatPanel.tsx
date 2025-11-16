
import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Project, Task, UserProfile, ChatRoom } from '../../types';
import { useChat } from '../../hooks/useChat';
import ChatRoomList from './ChatRoomList';
import ChatView from './ChatView';

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
    projects: Project[];
    tasks: Task[];
    profiles: Map<string, UserProfile>;
    onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
    isOpen, 
    onClose, 
    currentUser, 
    projects, 
    tasks, 
    profiles, 
    onUpdateTask 
}) => {
    const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
    const { createDmRoom } = useChat(currentUser, projects);

    const handleSelectRoom = (room: ChatRoom) => {
        setActiveRoom(room);
    };
    
    const handleSelectUser = async (user: UserProfile) => {
        if (user.uid === currentUser.uid) return;
        const dmRoom = await createDmRoom(user);
        if (dmRoom) {
            setActiveRoom(dmRoom);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-40 flex justify-end animate-simpleFadeIn">
            <div 
                className="fixed inset-0"
                onClick={onClose}
                aria-hidden="true"
            ></div>
            <div className="relative w-full max-w-4xl h-full bg-[#0F172A] flex animate-slideInLeft lg:animate-none">
                <ChatRoomList 
                    currentUser={currentUser}
                    projects={projects}
                    profiles={profiles}
                    activeRoomId={activeRoom?.id || null}
                    onSelectRoom={handleSelectRoom}
                    onSelectUser={handleSelectUser}
                    onClose={onClose}
                />
                <ChatView 
                    key={activeRoom?.id || 'welcome'}
                    currentUser={currentUser}
                    activeRoom={activeRoom}
                    profiles={profiles}
                    tasks={tasks}
                    onUpdateTask={onUpdateTask}
                />
            </div>
        </div>
    );
};

export default ChatPanel;
