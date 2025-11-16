
export type TaskStatus = 'todo' | 'inprogress' | 'completed';
export type Theme = 'default' | 'crimson' | 'emerald' | 'amber' | 'sapphire' | 'slate' | 'noir';
export type SectionKey = 'dashboard' | 'advancedDashboard' | 'utilities';

export interface UserSettings {
  apiKey?: string;
  googleSheetUrl?: string;
  theme?: Theme;
  avatarUrl?: string;
  isGoogleCalendarLinked?: boolean;
  sidebarLayout?: SectionKey[];
  telegramChatId?: number;
  telegramUsername?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
}

export interface Invitation {
  id: string;
  projectId: string;
  projectName: string;
  inviterId: string;
  inviterName: string;
  inviteeEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}


export interface Project {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: string;
  color: string;
  isVisible?: boolean;
}

export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  createdAt: string;
  dueDate: string | null;
  hashtags: string[];
  reminderSent: boolean;
  isUrgent: boolean;
  recurrenceRule?: 'none' | 'daily' | 'weekly' | 'monthly';
  userId?: string;
  parentId?: string;
  note?: string;
  googleCalendarEventId?: string;
  projectId?: string;
  assigneeIds: string[];
}

export interface SubtaskTemplate {
  id: string;
  text: string;
}

export interface TaskTemplate {
  id: string;
  userId: string;
  name: string;
  icon: string;
  createdAt: string;
  subtasks: SubtaskTemplate[];
}

export type Filter =
  | { type: 'all' }
  | { type: 'today' }
  | { type: 'next7days' }
  | { type: 'urgent' }
  | { type: 'project'; id: string };

// --- CHAT TYPES ---

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  createdAt: string; // ISO string
  isDeleted?: boolean;
}

export interface ChatRoom {
  id: string;
  type: 'project' | 'dm';
  memberIds: string[];
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: string;
  };
  // for project rooms
  projectId?: string;
  name: string;
  projectColor?: string;
  // for dm rooms
  memberProfiles?: { [key: string]: { displayName: string, photoURL?: string | null } };
}
