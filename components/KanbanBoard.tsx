
import React, { useState } from 'react';
import { Task, TaskStatus, UserProfile, Project } from '../types';
import KanbanColumn from './KanbanColumn';
import type { User as FirebaseUser } from 'firebase/auth';

interface KanbanBoardProps {
  tasks: Task[];
  subtasksByParentId: { [key: string]: Task[] };
  profiles: Map<string, UserProfile>;
  currentUser: FirebaseUser | null;
  projects: Project[];
  onUpdateTaskStatus: (id: string, status: TaskStatus) => void;
  toggleTaskUrgency: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onStartFocus: (task: Task) => void;
  onToggleTask: (id: string) => void;
  onUpdateTaskNote: (id: string, note: string) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
  tasks, 
  subtasksByParentId, 
  profiles,
  currentUser,
  projects,
  onUpdateTaskStatus, 
  toggleTaskUrgency, 
  onDeleteTask, 
  onStartFocus, 
  onToggleTask,
  onUpdateTaskNote
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleDragStart = (taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const handleDrop = (newStatus: TaskStatus) => {
    if (draggedTaskId) {
      const task = tasks.find(t => t.id === draggedTaskId);
      if (task && task.status !== newStatus) {
        onUpdateTaskStatus(draggedTaskId, newStatus);
      }
    }
    setDraggedTaskId(null); // Reset after drop
  };
  
  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inprogressTasks = tasks.filter(t => t.status === 'inprogress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const columns: { title: string; status: TaskStatus; tasks: Task[] }[] = [
    { title: 'Cần làm', status: 'todo', tasks: todoTasks },
    { title: 'Đang làm', status: 'inprogress', tasks: inprogressTasks },
    { title: 'Hoàn thành', status: 'completed', tasks: completedTasks },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {columns.map((col, index) => (
        <KanbanColumn
          key={col.status}
          title={col.title}
          status={col.status}
          tasks={col.tasks}
          subtasksByParentId={subtasksByParentId}
          profiles={profiles}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          draggedTaskId={draggedTaskId}
          onToggleTaskUrgency={toggleTaskUrgency}
          onDeleteTask={onDeleteTask}
          onStartFocus={onStartFocus}
          onToggleTask={onToggleTask}
          onUpdateTaskNote={onUpdateTaskNote}
          style={{ animationDelay: `${index * 100}ms` }}
          currentUser={currentUser}
          projects={projects}
        />
      ))}
    </div>
  );
};

export default KanbanBoard;
