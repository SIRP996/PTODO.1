
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
