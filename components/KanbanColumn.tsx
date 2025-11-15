

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
  style?: React.CSSProperties;
}

const columnStyles: Record<TaskStatus, { header: string; title: string; countBg: string; countText: string; }> = {
    todo: {
        header: 'bg-blue-900/20 border-b border-blue-700/50',
        title: 'text-blue-300',
        countBg: 'bg-blue-500/20',
        countText: 'text-blue-200',
    },
    inprogress: {
        header: 'bg-primary-900/20 border-b border-primary-700/50',
        title: 'text-primary-300',
        countBg: 'bg-primary-500/20',
        countText: 'text-primary-200',
    },
    completed: {
        header: 'bg-emerald-900/20 border-b border-emerald-700/50',
        title: 'text-emerald-300',
        countBg: 'bg-emerald-500/20',
        countText: 'text-emerald-200',
    }
};


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
  onUpdateTaskNote,
  style
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

  const styles = columnStyles[status];

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col transition-colors h-[65vh] animate-fadeIn ${isOver ? 'bg-slate-700/20' : ''}`}
      style={style}
    >
      <div className={`p-4 flex-shrink-0 ${styles.header}`}>
        <h3 className={`font-semibold flex justify-between items-center ${styles.title}`}>
          <span>{title}</span>
          <span className={`text-sm font-normal rounded-full px-2 py-0.5 ${styles.countBg} ${styles.countText}`}>{tasks.length}</span>
        </h3>
      </div>
      <div className="space-y-4 p-4 pr-3 flex-grow overflow-y-auto">
        {sortedTasks.map((task, index) => (
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
            style={{ animationDelay: `${index * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
};

export default KanbanColumn;