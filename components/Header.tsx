
import React from 'react';
import { Download, CheckSquare, LogOut } from 'lucide-react';
import { Task } from '../types';

interface HeaderProps {
    tasks: Task[];
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ tasks, onLogout }) => {
    
    const exportToCSV = () => {
        if (tasks.length === 0) {
            alert("Không có công việc nào để xuất.");
            return;
        }

        const headers = "ID,Text,Completed,CreatedAt,DueDate,Hashtags\n";
        const rows = tasks.map(task => 
            [
                task.id,
                `"${task.text.replace(/"/g, '""')}"`,
                task.completed,
                task.createdAt,
                task.dueDate || '',
                `"${task.hashtags.join(',')}"`
            ].join(',')
        ).join('\n');

        const csvContent = "\uFEFF" + headers + rows; // Add BOM for Excel compatibility
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `tasks_export_${new Date().toISOString().slice(0,10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="flex items-center mb-4 sm:mb-0">
                <div className="bg-[#4F46E5] p-3 rounded-xl mr-4">
                    <CheckSquare className="h-8 w-8 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">PTODO</h1>
                    <p className="text-slate-400">Trình quản lý công việc cá nhân của bạn</p>
                </div>
            </div>
             <div className="w-full sm:w-auto flex items-center gap-2">
                <button 
                    onClick={exportToCSV}
                    className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                    title="Xuất tất cả công việc ra tệp CSV, tương thích với Google Sheets."
                >
                    <Download className="h-4 w-4" />
                    <span>Xuất CSV</span>
                </button>
                <button 
                    onClick={onLogout}
                    className="flex items-center justify-center gap-2 bg-red-800 hover:bg-red-700 text-red-200 font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                    title="Đăng xuất"
                >
                    <LogOut className="h-4 w-4" />
                    <span>Đăng xuất</span>
                </button>
            </div>
        </header>
    );
};

export default Header;
