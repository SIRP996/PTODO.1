export type TaskStatus = 'todo' | 'inprogress' | 'completed';
export type Theme = 'default' | 'azure' | 'teal' | 'sunset' | 'ocean';

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
}