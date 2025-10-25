import React from 'react';
import { KeyRound, ShieldAlert } from 'lucide-react';

interface ApiKeyPromptProps {
    onSelectKey: () => void;
}

const ApiKeyPrompt: React.FC<ApiKeyPromptProps> = ({ onSelectKey }) => {
    return (
        <div className="fixed inset-0 bg-[#0F172A] flex items-center justify-center z-50">
            <div className="bg-[#1E293B]/60 p-8 rounded-2xl shadow-lg border border-slate-700 text-center max-w-md mx-4">
                <div className="mx-auto bg-indigo-600/20 text-indigo-400 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                    <KeyRound size={32} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Yêu cầu API Key</h1>
                <p className="text-slate-400 mb-6">
                    Để sử dụng các tính năng AI, bạn cần chọn một API Key từ Google AI Studio. Việc này đảm bảo quyền truy cập an toàn vào các mô hình của Gemini.
                </p>
                <button
                    onClick={onSelectKey}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    Chọn API Key
                </button>
                <div className="mt-6 text-xs text-slate-500 flex items-start gap-2 text-left bg-slate-800/50 p-3 rounded-lg">
                    <ShieldAlert size={28} className="flex-shrink-0 text-amber-500 mt-0.5" />
                    <div>
                        <strong>Lưu ý về thanh toán:</strong> Các lệnh gọi API tới mô hình Gemini có thể phát sinh chi phí. Hãy đảm bảo bạn đã thiết lập thông tin thanh toán trong dự án Google Cloud của mình.
                        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline ml-1">Tìm hiểu thêm</a>.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyPrompt;
