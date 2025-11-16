

import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Project, Task, UserProfile, ChatRoom } from '../../types';
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
    chatData: any; // Data from useChat hook
    activeRoom: ChatRoom | null;
    onSelectRoom: (room: ChatRoom) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
    isOpen, 
    onClose, 
    currentUser, 
    projects, 
    tasks, 
    profiles, 
    onUpdateTask,
    chatData,
    activeRoom,
    onSelectRoom,
}) => {
    const { createDmRoom } = chatData;

    const handleSelectUser = async (user: UserProfile) => {
        if (user.uid === currentUser.uid) return;
        const dmRoom = await createDmRoom(user);
        if (dmRoom) {
            onSelectRoom(dmRoom);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-6 right-6 w-[calc(100%-3rem)] max-w-3xl h-[75vh] max-h-[700px] z-40 bg-[#0F172A] flex rounded-2xl shadow-2xl border border-slate-700/50 animate-fadeIn">
            <ChatRoomList 
                currentUser={currentUser}
                projects={projects}
                profiles={profiles}
                activeRoomId={activeRoom?.id || null}
                onSelectRoom={onSelectRoom}
                onSelectUser={handleSelectUser}
                onClose={onClose}
                projectChatRooms={chatData.projectChatRooms}
                dmChatRooms={chatData.dmChatRooms}
                unreadRoomIds={chatData.unreadRoomIds}
            />
            <ChatView 
                key={activeRoom?.id || 'welcome'}
                currentUser={currentUser}
                activeRoom={activeRoom}
                profiles={profiles}
                tasks={tasks}
                onUpdateTask={onUpdateTask}
                messages={chatData.messages}
                loadingMessages={chatData.loadingMessages}
                sendMessage={chatData.sendMessage}
                deleteMessage={chatData.deleteMessage}
            />
        </div>
    );
};

export default ChatPanel;
