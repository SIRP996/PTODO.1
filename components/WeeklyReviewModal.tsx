import React, { useState, useEffect } from 'react';
import { X, Loader2, Sparkles, Wind, TrendingUp, AlertTriangle } from 'lucide-react';
import { Task } from '../types';
import { getGoogleGenAI } from '../utils/gemini';
import { useToast } from '../context/ToastContext';
import { subDays, isAfter, formatISO } from 'date-fns';

interface WeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onApiKeyError: () => void;
}

// Simple markdown to HTML converter
const markdownToHtml = (text: string) => {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>')     // Italic
        .replace(/^- (.*)/gm, '<li class="flex items-start gap-2"><span class="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-400"></span><span>$1</span></li>') // List items
        .replace(/(<li>.*<\/li>)/gs, '<ul class="space-y-1 list-none pl-2">$1</ul>') // Wrap lists
        .replace(/(\r\n|\n|\r)/g, '<br/>'); // Line breaks
};

const WeeklyReviewModal: React.FC<WeeklyReviewModalProps> = ({ isOpen, onClose, tasks, onApiKeyError }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [review, setReview] = useState('');
    const { addToast } = useToast();

    useEffect(() => {
        const generateReview = async () => {
            if (!isOpen) return;
            setIsLoading(true);
            setReview('');

            try {
                const ai = getGoogleGenAI();
                if (!ai) {
                    addToast("Vui lòng thiết lập API Key để sử dụng tính năng này.", "info");
                    onApiKeyError();
                    onClose();
                    return;
                }

                const oneWeekAgo = subDays(new Date(), 7);
                const completedLastWeek = tasks.filter(t => t.status === 'completed' && isAfter(new Date(t.createdAt), oneWeekAgo));
                const pendingTasks = tasks.filter(t => t.status !== 'completed');

                if (completedLastWeek.length === 0 && pendingTasks.length === 0) {
                    setReview("Không có dữ liệu công việc để phân tích. Hãy hoàn thành một vài công việc và thử lại nhé anh.");
                    setIsLoading(false);
                    return;
                }
                
                const prompt = `Bạn là Em, một trợ lý AI tận tâm và chu đáo cho ứng dụng PTODO. Bạn sẽ xưng là "em" và gọi người dùng là "anh".
                Nhiệm vụ của em là tạo một bản "Tổng kết & Kế hoạch Tuần".
                
                Dữ liệu công việc của anh:
                - Các công việc đã hoàn thành trong 7 ngày qua: ${JSON.stringify(completedLastWeek.map(t => t.text))}
                - Các công việc đang chờ hoặc đang làm: ${JSON.stringify(pendingTasks.map(t => ({ text: t.text, dueDate: t.dueDate ? formatISO(new Date(t.dueDate)) : 'Không có' })))}
                
                Dựa vào dữ liệu trên, hãy viết một bản báo cáo ngắn gọn, động viên và hữu ích theo cấu trúc sau (sử dụng markdown):
                
                **✨ Tổng kết tuần qua**
                - Đưa ra lời khen và nhận xét tích cực về số lượng công việc đã hoàn thành.
                - Chọn 1-2 công việc hoàn thành nổi bật (nếu có) để nhấn mạnh.
                
                **👀 Những việc cần chú ý**
                - Nhẹ nhàng nhắc nhở về các công việc còn tồn đọng hoặc quá hạn (nếu có).
                - Gợi ý cách giải quyết nếu thấy có quá nhiều việc đang chờ.
                
                **🎯 Gợi ý cho tuần tới**
                - Dựa vào các công việc đang chờ, đề xuất 2-3 mục tiêu ưu tiên cho tuần mới.
                - Kết thúc bằng một lời chúc hoặc động viên để anh có một tuần làm việc hiệu quả.
                
                Lưu ý: Giọng văn phải thân thiện, tích cực và mang tính xây dựng.`;

                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: prompt,
                });

                setReview(response.text);

            } catch (error: any) {
                console.error("AI review generation failed:", error);
                const errorMessage = error?.message?.toLowerCase() || '';
                if (errorMessage.includes('api key not valid') || errorMessage.includes('permission_denied')) {
                    onApiKeyError();
                    onClose();
                } else {
                    addToast("AI không thể tạo báo cáo. Vui lòng thử lại.", "error");
                }
            } finally {
                setIsLoading(false);
            }
        };

        generateReview();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-[#1E293B] max-w-2xl w-full rounded-2xl shadow-2xl p-6 border border-slate-700 h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <Sparkles className="text-primary-400" />
                        Tổng kết Tuần với AI
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2 text-slate-300">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <Loader2 className="h-12 w-12 text-primary-400 animate-spin" />
                            <p className="mt-4 text-lg">Em đang phân tích dữ liệu...</p>
                            <p className="text-sm text-slate-500">Việc này có thể mất một vài giây.</p>
                        </div>
                    ) : (
                        <div className="space-y-6" dangerouslySetInnerHTML={{ __html: markdownToHtml(review) }}>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WeeklyReviewModal;
