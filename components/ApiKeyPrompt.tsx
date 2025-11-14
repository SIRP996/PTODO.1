

import React, { useState } from 'react';
import { KeyRound, ShieldAlert, AlertCircle, X } from 'lucide-react';

interface ApiKeyPromptProps {
    onSelectKey: () => void;
    onSaveManualKey: (key: string) => void;
    isStudioEnv: boolean;
    error?: string | null;
    onSkip?: () => void;
    isModal?: boolean;
    onClose?: () => void;
}

const ApiKeyPrompt: React.FC<ApiKeyPromptProps> = ({ 
    onSelectKey, 
    onSaveManualKey, 
    isStudioEnv, 
    error, 
    onSkip,
    isModal = false,
    onClose
}) => {
    const [manualKey, setManualKey] = useState('');

    const handleSave = () => {
        if (manualKey.trim()) {
            onSaveManualKey(manualKey.trim());
        }
    };

    const promptContent = (
        <div className="relative bg-[#1E293B]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-lg text-center max-w-md mx-4">
            {isModal && onClose && (
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                    <X size={24} />
                </button>
            )}
            <div className="mx-auto bg-primary-600/20 text-primary-400 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                <KeyRound size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{isModal ? 'Cập nhật API Key' : 'Yêu cầu API Key'}</h1>

            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm p-3 rounded-lg mb-4 text-left flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <p className="text-slate-400 mb-6">
                {isStudioEnv 
                    ? "Để sử dụng các tính năng AI, bạn cần chọn một API Key từ Google AI Studio. Việc này đảm bảo quyền truy cập an toàn vào các mô hình của Gemini."
                    : "Vui lòng dán API Key của bạn từ Google AI Studio vào đây để kích hoạt các tính năng AI. Key sẽ được lưu trữ an toàn trong trình duyệt của bạn."
                }
            </p>

            {isStudioEnv ? (
                <button
                    onClick={onSelectKey}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    Chọn API Key
                </button>
            ) : (
                <div className="flex flex-col gap-4">
                    <input
                        type="password"
                        value={manualKey}
                        onChange={(e) => setManualKey(e.target.value)}
                        placeholder="Dán API Key của bạn tại đây"
                        className="w-full bg-[#293548] text-slate-200 border border-slate-600 focus:border-primary-500 focus:ring-0 rounded-lg px-4 py-3 transition"
                    />
                    <button
                        onClick={handleSave}
                        disabled={!manualKey.trim()}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-primary-800 disabled:cursor-not-allowed"
                    >
                        Lưu và Tiếp tục
                    </button>
                </div>
            )}
            
            {!isModal && onSkip && (
                 <button onClick={onSkip} className="mt-4 text-slate-400 hover:text-white text-sm">Bỏ qua cho bây giờ</button>
            )}
            
            <div className="mt-6 text-xs text-slate-500 flex items-start gap-2 text-left bg-slate-800/50 p-3 rounded-lg">
                <ShieldAlert size={28} className="flex-shrink-0 text-amber-500 mt-0.5" />
                <div>
                    <strong>Lưu ý về thanh toán:</strong> Các lệnh gọi API tới mô hình Gemini có thể phát sinh chi phí. Hãy đảm bảo bạn đã thiết lập thông tin thanh toán trong dự án Google Cloud của mình.
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline ml-1">Tìm hiểu thêm</a>.
                </div>
            </div>
        </div>
    );
    
    return isModal ? (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            {promptContent}
        </div>
    ) : (
        <div className="fixed inset-0 bg-[#0F172A] flex items-center justify-center z-50">
            {promptContent}
        </div>
    );
};

export default ApiKeyPrompt;