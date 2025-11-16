import React, { useMemo, useEffect, useState } from 'react';
import { Task } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    format, 
    isWithinInterval, 
    parseISO,
    startOfMonth,
    endOfMonth,
    getWeek,
    eachWeekOfInterval,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

interface AdvancedDashboardProps {
    tasks: Task[];
}

const AdvancedDashboard: React.FC<AdvancedDashboardProps> = ({ tasks }) => {
    const { userSettings } = useAuth();
    const [primaryColor, setPrimaryColor] = useState('#818cf8');
    const [primaryColor400, setPrimaryColor400] = useState('#a78bfa');
    
    useEffect(() => {
        // This is necessary to get CSS variable values into JS for the chart library,
        // as it doesn't support CSS variables in its props directly.
        const p500 = getComputedStyle(document.documentElement).getPropertyValue('--color-primary-500').trim();
        const p400 = getComputedStyle(document.documentElement).getPropertyValue('--color-primary-400').trim();
        if (p500) setPrimaryColor(p500);
        if (p400) setPrimaryColor400(p400);
    }, [userSettings?.theme]);
    
    const chartTagColors = useMemo(() => [primaryColor, primaryColor400, '#c084fc', '#f472b6', '#fb7185'], [primaryColor, primaryColor400]);

    const completedTasks = useMemo(() => tasks.filter(t => t.status === 'completed' && t.createdAt), [tasks]);

    const dailyStats = useMemo(() => {
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        const todaysIncompleteTasks = tasks.filter(t => t.status !== 'completed' && t.dueDate && format(parseISO(t.dueDate), 'yyyy-MM-dd') === todayStr).length;
        const completedToday = completedTasks.filter(t => format(parseISO(t.createdAt), 'yyyy-MM-dd') === todayStr).length;
        const totalToday = completedToday + todaysIncompleteTasks;
        
        return {
            total: totalToday,
            completed: completedToday,
            percentage: totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0,
        };
    }, [tasks, completedTasks]);

    const currentStreak = useMemo(() => {
        if (completedTasks.length === 0) return 0;
        // FIX: Cast to string[] to resolve type inference issue where Set was producing unknown[].
        const completionDates = ([...new Set(completedTasks.map(t => format(parseISO(t.createdAt), 'yyyy-MM-dd')))] as string[]).sort((a, b) => b.localeCompare(a));
        
        let streak = 0;
        let currentDate = new Date();
        
        if (!completionDates.includes(format(currentDate, 'yyyy-MM-dd'))) {
            currentDate.setDate(currentDate.getDate() - 1);
        }
        
        for (const dateStr of completionDates) {
            if (dateStr === format(currentDate, 'yyyy-MM-dd')) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                if (streak === 0) break;
                const dayDiff = (new Date(format(currentDate, 'yyyy-MM-dd')).getTime() - new Date(dateStr).getTime()) / (1000 * 3600 * 24);
                if (dayDiff > 1) break;
            }
        }
        return streak;
    }, [completedTasks]);
    
    const tagStats = useMemo(() => {
        const allTags = tasks.flatMap(t => t.hashtags);
        const tagCounts = allTags.reduce((acc, tag) => {
            acc[tag] = (acc[tag] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });
        
        // FIX: Cast `value` to `number` as Object.entries infers it as `unknown`.
        return Object.entries(tagCounts)
            .map(([name, value]): { name: string; value: number } => ({ name: `#${name}`, value: value as number }))
            .sort((a, b) => b.value - a.value);
    }, [tasks]);

    const weeklyStats = useMemo(() => {
        const today = new Date();
        const start = startOfWeek(today, { locale: vi });
        const end = endOfWeek(today, { locale: vi });
        const weekDays = eachDayOfInterval({ start, end });

        return weekDays.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const count = completedTasks.filter(t => format(parseISO(t.createdAt), 'yyyy-MM-dd') === dayStr).length;
            return { name: format(day, 'EEEEEE', { locale: vi }), value: count };
        });
    }, [completedTasks]);

    const monthlyStats = useMemo(() => {
        const today = new Date();
        const start = startOfMonth(today);
        const end = endOfMonth(today);
        const weeks = eachWeekOfInterval({ start, end }, { locale: vi, weekStartsOn: 1 });
        
        return weeks.map(weekStart => {
            const weekNumber = getWeek(weekStart, { locale: vi, weekStartsOn: 1 });
            const weekEnd = endOfWeek(weekStart, { locale: vi });
            
            const count = completedTasks.filter(t => {
                const createdAt = parseISO(t.createdAt);
                return isWithinInterval(createdAt, { start: weekStart, end: weekEnd });
            }).length;

            return { name: `Tuần ${weekNumber}`, value: count };
        });
    }, [completedTasks]);

    const peakHoursHeatmapData = useMemo(() => {
        const days = 7; // Mon-Sun
        const slots = 5; // Sáng, Trưa, Chiều, Tối, Đêm
        const grid = Array.from({ length: days }, () => Array(slots).fill(0));
        let maxCount = 0;

        const getTimeSlotIndex = (hour: number) => {
            if (hour >= 5 && hour < 12) return 0; // Sáng
            if (hour >= 12 && hour < 14) return 1; // Trưa
            if (hour >= 14 && hour < 18) return 2; // Chiều
            if (hour >= 18 && hour < 22) return 3; // Tối
            return 4; // Đêm (22-4)
        };
        
        completedTasks.forEach(task => {
            const createdAt = parseISO(task.createdAt);
            // getDay(): 0=Sun, 1=Mon... We want Mon=0, ..., Sun=6
            const day = createdAt.getDay();
            const dayIndex = day === 0 ? 6 : day - 1;
            
            const hour = createdAt.getHours();
            const slotIndex = getTimeSlotIndex(hour);
            grid[dayIndex][slotIndex]++;
            if (grid[dayIndex][slotIndex] > maxCount) {
                maxCount = grid[dayIndex][slotIndex];
            }
        });

        return { grid, maxCount };
    }, [completedTasks]);

    const getPeakHoursColor = (count: number, maxCount: number) => {
        if (count === 0) return 'bg-slate-700/50';
        if (maxCount === 0) return 'bg-slate-700/50';

        const intensity = count / maxCount;
        if (intensity > 0.75) return 'bg-purple-400';
        if (intensity > 0.5) return 'bg-purple-500';
        if (intensity > 0.75) return `bg-primary-400`;
        if (intensity > 0.5) return `bg-primary-500`;
        if (intensity > 0.25) return `bg-primary-700`;
        return `bg-primary-900`;
    };
    
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/30 p-4 rounded-xl text-center">
                    <p className="text-sm text-slate-400">Hiệu suất hôm nay</p>
                    <p className="text-3xl font-bold text-white mt-1">{dailyStats.completed}/{dailyStats.total}</p>
                    <p className="text-xs text-slate-500">Công việc hoàn thành</p>
                </div>
                <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/30 p-4 rounded-xl text-center">
                    <p className="text-sm text-slate-400 flex items-center justify-center gap-1.5"><span className="text-amber-400">🔥</span> Chuỗi hiện tại</p>
                    <p className="text-3xl font-bold text-white mt-1">{currentStreak}</p>
                    <p className="text-xs text-slate-500">Ngày hoàn thành liên tiếp</p>
                </div>

                {/* 🔧 Vòng tròn tiến độ căn giữa, nhỏ hơn */}
                <div className="flex items-center justify-center">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <path
                                className="text-slate-700/50"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                            />
                            <path
                                className="text-primary-500 transition-all duration-500"
                                strokeDasharray={`${dailyStats.percentage}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold text-white">{dailyStats.percentage}%</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/30 p-4 rounded-xl h-[230px] flex flex-col">
                    <h3 className="text-md font-semibold text-slate-300 mb-2">Thống kê theo Thẻ</h3>
                    {tagStats.length > 0 ? (
                        <div className="flex-grow overflow-y-auto pr-2 custom-scroll" style={{ scrollbarWidth: 'thin' }}>
                            <style>
                                {`
                                .flex-grow::-webkit-scrollbar {
                                    width: 2px;
                                }
                                .flex-grow::-webkit-scrollbar-thumb {
                                    background-color: #6366f1;
                                    border-radius: 2px;
                                }
                                .flex-grow::-webkit-scrollbar-track {
                                    background: transparent;
                                }
                                `}
                            </style>

                            {/* 👇 Giảm chiều cao mỗi dòng từ 40 → 26 */}
                            <ResponsiveContainer width="100%" height={tagStats.length * 16}>
                                <BarChart data={tagStats} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#94a3b8', fontSize: 11 }} 
                                        width={80}
                                        interval={0}
                                    />
                                    <Tooltip 
                                        cursor={{ fill: 'rgba(71, 85, 105, 0.5)' }}
                                        contentStyle={{ 
                                            background: '#1e293b', 
                                            border: '1px solid #334155',
                                            borderRadius: '0.5rem',
                                        }}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        <LabelList dataKey="value" position="right" offset={8} style={{ fill: '#cbd5e1', fontSize: 11 }} /> 
                                        {tagStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={chartTagColors[index % chartTagColors.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-grow flex items-center justify-center">
                            <p className="text-sm text-slate-500">Không có thẻ nào.</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/30 p-4 rounded-xl">
                        <h3 className="text-md font-semibold text-slate-300 mb-4">Tổng kết tuần này</h3>
                        <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={weeklyStats}>
                                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} width={20} />
                                <Tooltip cursor={{fill: 'rgba(71, 85, 105, 0.5)'}} contentStyle={{background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem'}}/>
                                <Bar dataKey="value" fill={primaryColor} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/30 p-4 rounded-xl">
                        <h3 className="text-md font-semibold text-slate-300 mb-4">Tổng kết tháng này</h3>
                        <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={monthlyStats}>
                                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} width={20}/>
                                <Tooltip cursor={{fill: 'rgba(71, 85, 105, 0.5)'}} contentStyle={{background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem'}}/>
                                <Bar dataKey="value" fill={primaryColor400} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/30 p-4 rounded-xl">
                    <h3 className="text-md font-semibold text-slate-300 mb-4">Heatmap hoạt động (Giờ cao điểm)</h3>
                    <div className="grid grid-cols-[1.75rem_repeat(5,1fr)] gap-1 text-xs">
                        {/* Top Headers */}
                        <div></div> {/* Corner */}
                        {['Sáng', 'Trưa', 'Chiều', 'Tối', 'Đêm'].map(header => (
                            <div key={header} className="text-center text-slate-400 font-medium pb-1">{header}</div>
                        ))}

                        {/* Rows */}
                        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((dayLabel, dayIndex) => (
                            <React.Fragment key={dayLabel}>
                                <div className="flex items-center justify-end text-slate-400 font-medium">{dayLabel}</div>
                                {peakHoursHeatmapData.grid[dayIndex].map((count, slotIndex) => (
                                    <div
                                      key={slotIndex}
                                      className={`w-full h-5 rounded-sm ${getPeakHoursColor(count, peakHoursHeatmapData.maxCount)}`}
                                      title={`${count} công việc hoàn thành`}
                                    ></div>
                                ))}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdvancedDashboard;
