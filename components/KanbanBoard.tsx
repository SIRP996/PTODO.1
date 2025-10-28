

import React, { useState } from 'react';
import { Task, TaskStatus } from '../types';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
  tasks: Task[];
  subtasksByParentId: { [key: string]: Task[] };
  onUpdateTaskStatus: (id: string, status: TaskStatus) => void;
  onToggleTaskUrgency: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onStartFocus: (task: Task) => void;
  onToggleTask: (id: string) => void;
  onUpdateTaskNote: (id: string, note: string) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
  tasks, 
  subtasksByParentId, 
  onUpdateTaskStatus, 
  onToggleTaskUrgency, 
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
    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      {columns.map(col => (
        <KanbanColumn
          key={col.status}
          title={col.title}
          status={col.status}
          tasks={col.tasks}
          subtasksByParentId={subtasksByParentId}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          draggedTaskId={draggedTaskId}
          onToggleTaskUrgency={onToggleTaskUrgency}
          onDeleteTask={onDeleteTask}
          onStartFocus={onStartFocus}
          onToggleTask={onToggleTask}
          onUpdateTaskNote={onUpdateTaskNote}
        />
      ))}
    </div>
  );
};

export default KanbanBoard;