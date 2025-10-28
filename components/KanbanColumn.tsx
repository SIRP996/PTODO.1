

import React, { useState, useMemo } from 'react';
import { Task, TaskStatus } from '../types';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  title: string;
  status: TaskStatus;
  tasks: Task[];
  subtasksByParentId: { [key: string]: Task[] };
  onDrop: (status: TaskStatus) => void;
  onDragStart: (taskId: string) => void;
  draggedTaskId: string | null;
  onToggleTaskUrgency: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onStartFocus: (task: Task) => void;
  onToggleTask: (id: string) => void;
  onUpdateTaskNote: (id: string, note: string) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ 
  title, 
  status, 
  tasks, 
  subtasksByParentId, 
  onDrop, 
  onDragStart, 
  draggedTaskId, 
  onToggleTaskUrgency, 
  onDeleteTask, 
  onStartFocus,
  onToggleTask,
  onUpdateTaskNote
}) => {
  const [isOver, setIsOver] = useState(false);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // For 'todo' and 'inprogress' columns, prioritize urgent tasks.
      if (status !== 'completed') {
          if (a.isUrgent && !b.isUrgent) return -1; // a is urgent, b is not -> a comes first
          if (!a.isUrgent && b.isUrgent) return 1;  // b is urgent, a is not -> b comes first
      }
      // For tasks with same urgency or in 'completed' column, sort by creation date (newest first).
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks, status]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    onDrop(status);
    setIsOver(false);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-slate-900/50 rounded-xl flex flex-col transition-colors md:h-[600px] ${isOver ? 'bg-slate-700/50' : ''}`}
    >
      <div className="p-4 border-b border-slate-700/50 flex-shrink-0">
        <h3 className="font-semibold text-white flex justify-between items-center">
          <span>{title}</span>
          <span className="text-sm font-normal bg-slate-700 text-slate-300 rounded-full px-2 py-0.5">{tasks.length}</span>
        </h3>
      </div>
      <div className="space-y-4 p-4 pr-3 min-h-[150px] flex-grow overflow-y-auto">
        {sortedTasks.map(task => (
          <KanbanCard
            key={task.id}
            task={task}
            subtasks={subtasksByParentId[task.id] || []}
            onDragStart={onDragStart}
            isDragging={draggedTaskId === task.id}
            onToggleTaskUrgency={onToggleTaskUrgency}
            onDeleteTask={onDeleteTask}
            onStartFocus={onStartFocus}
            onToggleTask={onToggleTask}
            onUpdateTaskNote={onUpdateTaskNote}
          />
        ))}
      </div>
    </div>
  );
};

export default KanbanColumn;