import React, { useMemo } from 'react';
import { Task } from '../types';
import { isPast, parseISO } from 'date-fns';
import { ListTodo, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';


interface DashboardProps {
    tasks: Task[];
}

const Dashboard: React.FC<DashboardProps> = ({ tasks }) => {
    const stats = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const overdue = tasks.filter(t => t.dueDate && t.status !== 'completed' && isPast(parseISO(t.dueDate))).length;
        const urgent = tasks.filter(t => t.isUrgent && t.status !== 'completed').length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, overdue, urgent, percentage };
    }, [tasks]);

    const progressColor = useMemo(() => {
        if (stats.percentage < 40) return 'bg-red-500';
        if (stats.percentage < 75) return 'bg-amber-500';
        return 'bg-green-500';
    }, [stats.percentage]);

    const statCards = [
        { label: 'Tổng công việc', value: stats.total, icon: <ListTodo className="h-6 w-6 text-blue-400" /> },
        { label: 'Hoàn thành', value: stats.completed, icon: <CheckCircle2 className="h-6 w-6 text-green-400" /> },
        { label: 'Quá hạn', value: stats.overdue, icon: <Clock className="h-6 w-6 text-amber-400" /> },
        { label: 'Khẩn cấp', value: stats.urgent, icon: <AlertTriangle className="h-6 w-6 text-red-400" /> },
    ];

    return (
        <div className="space-y-6">
            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-slate-400">Tiến độ chung</span>
                    <span className="text-sm font-bold text-slate-200">{stats.percentage}%</span>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-2.5">
                    <div
                        className={`${progressColor} h-2.5 rounded-full transition-all duration-500`}
                        style={{ width: `${stats.percentage}%` }}
                    ></div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {statCards.map(card => (
                    <div key={card.label} className="bg-slate-800/40 backdrop-blur-md p-4 rounded-xl flex items-center gap-4 border border-slate-700/30">
                        <div className="flex-shrink-0">{card.icon}</div>
                        <div>
                            <p className="text-2xl font-bold text-white">{card.value}</p>
                            <p className="text-sm text-slate-400">{card.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;