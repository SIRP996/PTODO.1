import React, { useMemo } from 'react';
import { Task } from '../types';
import TaskItem from './TaskItem';
import { ClipboardList } from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTaskDueDate: (id: string, newDueDate: string | null) => void;
  onToggleTaskUrgency: (id: string) => void;
  onStartFocus: (task: Task) => void;
  onAddSubtasksBatch: (parentId: string, subtaskTexts: string[]) => Promise<void>;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, onToggleTask, onDeleteTask, onUpdateTaskDueDate, onToggleTaskUrgency, onStartFocus, onAddSubtasksBatch }) => {

  const { parentTasks, subtasksByParent } = useMemo(() => {
    const parentTasks: Task[] = [];
    const subtasksByParent: { [key: string]: Task[] } = {};

    tasks.forEach(task => {
      if (task.parentId) {
        if (!subtasksByParent[task.parentId]) {
          subtasksByParent[task.parentId] = [];
        }
        subtasksByParent[task.parentId].push(task);
      } else {
        parentTasks.push(task);
      }
    });
    
    // Sort subtasks by creation date
    for (const parentId in subtasksByParent) {
      subtasksByParent[parentId].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    
    return { parentTasks, subtasksByParent };
  }, [tasks]);

  const sortedTasks = [...parentTasks].sort((a, b) => {
    if (!a.completed && !b.completed) {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (parentTasks.length === 0) {
    return (
        <div className="text-center py-10 border-2 border-dashed border-slate-700 rounded-lg">
          <ClipboardList className="mx-auto h-12 w-12 text-slate-500" />
          <h3 className="mt-2 text-lg font-medium text-slate-200">Không có công việc nào</h3>
          <p className="mt-1 text-sm text-slate-400">Không có công việc nào phù hợp với bộ lọc hiện tại.</p>
        </div>
    );
  }

  return (
    <div className="rounded-lg bg-slate-800/40 max-h-[500px] overflow-y-auto pr-2">
      {sortedTasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          subtasks={subtasksByParent[task.id] || []}
          onToggleTask={onToggleTask}
          onDeleteTask={onDeleteTask}
          onUpdateTaskDueDate={onUpdateTaskDueDate}
          onToggleTaskUrgency={onToggleTaskUrgency}
          onStartFocus={onStartFocus}
          onAddSubtasksBatch={onAddSubtasksBatch}
        />
      ))}
    </div>
  );
};

export default TaskList;