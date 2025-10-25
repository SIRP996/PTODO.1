export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  dueDate: string | null;
  hashtags: string[];
  reminderSent: boolean;
  isUrgent: boolean;
  recurrenceRule?: 'none' | 'daily' | 'weekly' | 'monthly';
  userId?: string;
}