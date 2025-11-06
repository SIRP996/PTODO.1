

import React, { useState, useCallback, useMemo, ChangeEvent, DragEvent, useEffect } from 'react';
import { X, UploadCloud, FileText, Mic, Loader2, Sparkles, Trash2, Calendar, Flag, AlertCircle, ArrowLeft, Sheet, Download, Image } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { getGoogleGenAI } from '../utils/gemini';
import { Type } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';

type View = 'select' | 'processing' | 'review';
type Tab = 'text' | 'image' | 'file' | 'csv' | 'audio';

interface ParsedTask {
    text: string;
    dueDate: string | null;
    tags: string[];
    isUrgent: boolean;
}

interface ReviewTask extends ParsedTask {
    id: string;
    isSelected: boolean;
}

interface ImportAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddTasksBatch: (tasks: ParsedTask[]) => Promise<void>;
    onApiKeyError: () => void;
}

const ImportAssistantModal: React.FC<ImportAssistantModalProps> = ({ isOpen, onClose, onAddTasksBatch, onApiKeyError }) => {
    const [view, setView] = useState<View>('select');
    const [activeTab, setActiveTab] = useState<Tab>('text');
    const [isDragging, setIsDragging] = useState(false);
    const [tasksToReview, setTasksToReview] = useState<ReviewTask[]>([]);
    const [processingMessage, setProcessingMessage] = useState('');
    const [rawText, setRawText] = useState('');
    const { addToast } = useToast();
    
    const { transcript, isListening, startListening, stopListening, hasSupport } = useSpeechRecognition();

    useEffect(() => {
        let intervalId: number | undefined;

        if (view === 'processing') {
            const messages = [
                "Đang tải lên và chuẩn bị dữ liệu...",
                "AI đang đọc và nhận dạng nội dung...",
                "Trích xuất các công việc và thông tin liên quan...",
                "Định dạng và sắp xếp kết quả...",
                "Sắp xong rồi, chờ một chút nhé!",
            ];
            let messageIndex = 0;
            setProcessingMessage(messages[messageIndex]);

            intervalId = window.setInterval(() => {
                messageIndex = (messageIndex + 1) % messages.length;
                setProcessingMessage(messages[messageIndex]);
            }, 2500); // Change message every 2.5 seconds
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [view]);

    const resetState = () => {
        setView('select');
        setActiveTab('text');
        setTasksToReview([]);
        setRawText('');
    }

    const handleClose = () => {
        if (isListening) stopListening();
        resetState();
        onClose();
    }

    const processInput = useCallback(async (options: { text?: string; audio?: { data: string; mimeType: string }; image?: { data: string; mimeType: string } }) => {
        if (!options.text && !options.audio && !options.image) {
            addToast("Không có nội dung để phân tích.", "info");
            return;
        }
        
        setView('processing');
        
        try {
            const ai = getGoogleGenAI();
            if (!ai) {
                addToast("Vui lòng thiết lập API Key để sử dụng tính năng này.", "info");
                onApiKeyError();
                setView('select');
                return;
            }
            
            let requestPayload;
            const baseConfig = {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            text: { type: Type.STRING },
                            dueDate: { type: Type.STRING },
                            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                            isUrgent: { type: Type.BOOLEAN },
                        },
                        required: ['text', 'dueDate', 'tags', 'isUrgent'],
                    },
                },
            };
            const commonInstructions = `
                Current Context:
                - Current Date (for relative date calculations, UTC): ${new Date().toISOString()}
                - Current Year: ${new Date().getFullYear()}
                - User's Timezone: Asia/Ho_Chi_Minh (UTC+7)

                Your Instructions:
                1.  **Identify Individual Tasks**: Scrutinize the text (or transcription or image content) to identify distinct, actionable tasks. A single line, a bullet point, a sentence, or a CSV row can represent a task.
                2.  **Detect Due Dates & Apply CRITICAL Year Logic**: 
                    - Identify mentions of dates and times (e.g., "ngày mai", "thứ 5 tuần sau lúc 3h chiều", "cuối tháng", "11/11 19:00").
                    - If no year is specified (e.g., "ngày 11/11"), you MUST use the current year (${new Date().getFullYear()}).
                    - If the calculated date has already passed in the current year, you MUST use the next year (${new Date().getFullYear() + 1}). For example, if today is December 2024 and the user says "15 tháng 1", the date should be for January 15, 2025.
                    - NEVER default to a past year like 2001 or any other arbitrary old year. This is a critical failure.
                3.  **Time Parsing is Crucial**:
                    - **Time Ranges**: If a time range is provided (e.g., "19:00 - 22:00", "8h-17h"), you MUST use the START time of the range for the \`dueDate\`.
                    - **Specific Times**: Parse specific times like "19:00", "8:00", "4h chiều" accurately. "sáng" = AM, "chiều"/"tối" = PM.
                4.  **Timezone Conversion**: All user-mentioned times are in their local timezone (UTC+7). You MUST convert these to UTC and format them as a full ISO 8601 string (YYYY-MM-DDTHH:mm:ss.sssZ).
                5.  **Defaults**: If a specific time isn't mentioned for a date, default to 17:00 (5 PM) local time for that day. If no date is mentioned for a task, \`dueDate\` must be null.
                6.  **Extract Core Content**: For each task, extract the main description, excluding date/time information that you've already processed.
                7.  **Extract Hashtags**: Find words starting with '#'. In the output array, remove the '#' prefix and use lowercase.
                8.  **Detect Urgency**: Look for keywords indicating urgency (e.g., "gấp", "khẩn", "ngay lập tức", "ASAP"). Set \`isUrgent\` to true if found.
                9.  **Strict JSON Output**: Your final output MUST be ONLY a valid JSON array of objects. Do not include any explanatory text, markdown formatting, or anything outside the JSON array.
            `;

            if (options.image) {
                const imagePrompt = `You are an intelligent assistant for the Ptodo application. Your task is to analyze this image (which could be a photo of a whiteboard, notebook, or sticky notes). Identify all actionable to-do items, whether handwritten or printed.
                ${commonInstructions}`;
                
                const imagePart = { inlineData: { mimeType: options.image.mimeType, data: options.image.data } };
                const textPart = { text: imagePrompt };

                requestPayload = {
                    model: "gemini-2.5-flash",
                    contents: { parts: [imagePart, textPart] },
                    config: baseConfig,
                };
            } else if (options.audio) {
                const audioPrompt = `You are an expert task extraction assistant for a Vietnamese to-do list application. 
                Your FIRST step is to accurately transcribe the provided audio into Vietnamese text. 
                Then, perform all subsequent analysis on this transcription to convert it into a structured list of tasks.
                ${commonInstructions}`;
                requestPayload = {
                    model: "gemini-2.5-flash",
                    contents: { parts: [{ inlineData: options.audio }, { text: audioPrompt }] },
                    config: baseConfig,
                };
            } else if (options.text) {
                 const textPrompt = `You are an expert task extraction assistant for a Vietnamese to-do list application. Your goal is to analyze a block of unstructured text and convert it into a structured list of tasks. The text could be plain text, markdown, or even CSV-formatted text.
                ${commonInstructions}
                User Input:
                "${options.text}"`;
                 requestPayload = {
                    model: "gemini-2.5-flash",
                    contents: textPrompt,
                    config: baseConfig
                };
            } else {
                return;
            }

            const response = await ai.models.generateContent(requestPayload);
            const jsonStr = response.text.trim();
            const parsedTasks = JSON.parse(jsonStr) as ParsedTask[];
            
            if (parsedTasks.length === 0) {
                 addToast("AI không tìm thấy công việc nào trong nội dung bạn cung cấp.", "info");
                 setView('select');
                 return;
            }

            setTasksToReview(parsedTasks.map(task => ({
                ...task,
                id: uuidv4(),
                isSelected: true,
            })));
            setView('review');

        } catch (error: any) {
            console.error("AI batch parsing failed:", error);
            const errorMessage = error?.message?.toLowerCase() || '';
            if (errorMessage.includes('api key not valid') || errorMessage.includes('permission_denied')) {
                onApiKeyError();
            } else {
                addToast("AI không thể phân tích nội dung. Vui lòng kiểm tra lại định dạng hoặc thử lại.", "error");
            }
            setView('select');
        }
    }, [addToast, onApiKeyError]);

    const readTextFile = (file: File) => {
        if (file.type !== 'text/plain' && file.type !== 'text/markdown') {
            addToast('Chỉ hỗ trợ tệp .txt và .md', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const textContent = event.target?.result as string;
            processInput({ text: textContent });
        };
        reader.readAsText(file);
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) readTextFile(file);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) readTextFile(file);
    };

    const readAndProcessAudioFile = (file: File) => {
        if (!file.type.startsWith('audio/')) {
            addToast('Tệp không hợp lệ. Vui lòng chọn một tệp âm thanh.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const [header, base64Data] = dataUrl.split(',');
            if (!header || !base64Data) {
                addToast('Không thể đọc tệp âm thanh.', 'error');
                return;
            }
            const mimeType = header.split(':')[1].split(';')[0];
            processInput({ audio: { data: base64Data, mimeType } });
        };
        reader.readAsDataURL(file);
    };

    const handleAudioFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) readAndProcessAudioFile(file);
    };

    const handleAudioDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) readAndProcessAudioFile(file);
    };
    
    const readAndProcessImageFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            addToast('Tệp không hợp lệ. Vui lòng chọn một tệp hình ảnh.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const [header, base64Data] = dataUrl.split(',');
            if (!header || !base64Data) {
                addToast('Không thể đọc tệp hình ảnh.', 'error');
                return;
            }
            const mimeType = header.split(':')[1].split(';')[0];
            processInput({ image: { data: base64Data, mimeType } });
        };
        reader.readAsDataURL(file);
    };

    const handleImageFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) readAndProcessImageFile(file);
    };
    
    const handleImageDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) readAndProcessImageFile(file);
    };

    const processCsvFile = async (file: File) => {
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            addToast('Chỉ hỗ trợ tệp .csv', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            // Explicitly decode the file content as UTF-8 to handle Vietnamese characters correctly.
            const csvText = new TextDecoder('utf-8').decode(arrayBuffer);
            processInput({ text: csvText });
        };
        reader.readAsArrayBuffer(file);
    };

    const handleCsvFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processCsvFile(file);
    };

    const handleCsvDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processCsvFile(file);
    };
    
    const handleUpdateTask = (id: string, field: keyof ReviewTask, value: any) => {
        setTasksToReview(prev => prev.map(task => task.id === id ? { ...task, [field]: value } : task));
    };

    const handleToggleSelect = (id: string) => {
        setTasksToReview(prev => prev.map(task => task.id === id ? { ...task, isSelected: !task.isSelected } : task));
    };
    
    const handleDeleteReviewTask = (id: string) => {
        setTasksToReview(prev => prev.filter(task => task.id !== id));
    };

    const selectedTasks = useMemo(() => tasksToReview.filter(t => t.isSelected), [tasksToReview]);

    const handleAddTasks = async () => {
        if (selectedTasks.length === 0) {
            addToast("Vui lòng chọn ít nhất một công việc để thêm.", "info");
            return;
        }
        await onAddTasksBatch(selectedTasks);
        handleClose();
    };

    const handleDownloadTemplate = () => {
        const headers = "text,dueDate,tags,isUrgent";
        const exampleRow1 = `"Hoàn thành báo cáo quý 4 #báocáo","2024-12-20T17:00:00Z","báo cáo;công ty",true`;
        const exampleRow2 = `"Đi siêu thị mua đồ ăn tối","","cá nhân;mua sắm",false`;
        const csvContent = `${headers}\n${exampleRow1}\n${exampleRow2}`;
    
        // Add UTF-8 BOM to ensure Excel opens the file with correct encoding for Vietnamese characters.
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "ptodo_template.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderSelectView = () => (
        <>
            <div className="flex border-b border-slate-700 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('text')}
                    className={`flex-shrink-0 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'text' ? 'text-primary-400 border-b-2 border-primary-400' : 'text-slate-400 hover:text-white'}`}
                >
                    <FileText size={16} /> Dán văn bản
                </button>
                <button 
                    onClick={() => setActiveTab('image')}
                    className={`flex-shrink-0 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'image' ? 'text-primary-400 border-b-2 border-primary-400' : 'text-slate-400 hover:text-white'}`}
                >
                    <Image size={16} /> Tải lên ảnh
                </button>
                <button 
                    onClick={() => setActiveTab('file')}
                    className={`flex-shrink-0 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'file' ? 'text-primary-400 border-b-2 border-primary-400' : 'text-slate-400 hover:text-white'}`}
                >
                    <UploadCloud size={16} /> Tải lên tệp .txt
                </button>
                 <button 
                    onClick={() => setActiveTab('csv')}
                    className={`flex-shrink-0 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'csv' ? 'text-primary-400 border-b-2 border-primary-400' : 'text-slate-400 hover:text-white'}`}
                >
                    <Sheet size={16} /> Tải lên CSV
                </button>
                <button
                    onClick={() => setActiveTab('audio')}
                    className={`flex-shrink-0 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'audio' ? 'text-primary-400 border-b-2 border-primary-400' : 'text-slate-400 hover:text-white'}`}
                >
                    <Mic size={16} /> Ghi âm & Âm thanh
                </button>
            </div>
            <div className="p-6">
                {activeTab === 'text' && (
                    <div className="space-y-4">
                        <textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder={'Dán danh sách công việc của bạn vào đây. Mỗi công việc trên một dòng hoặc ở dạng bảng.\n\nVí dụ:\n- Hoàn thành báo cáo Q4 #báo_cáo GẤP deadline 17h thứ 6 tuần sau\n- Họp team marketing 9h sáng mai'}
                            className="w-full h-48 bg-[#293548] text-slate-200 border border-slate-600 focus:border-primary-500 focus:ring-0 rounded-lg p-3 transition text-sm resize-y"
                        />
                        <button
                            onClick={() => processInput({ text: rawText })}
                            disabled={!rawText.trim()}
                            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors duration-200 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                        >
                            <Sparkles size={18} />
                            Phân tích văn bản
                        </button>
                    </div>
                )}
                 {activeTab === 'image' && (
                    <div 
                        onDragEnter={() => setIsDragging(true)}
                        onDragLeave={() => setIsDragging(false)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleImageDrop}
                        className={`p-8 border-2 border-dashed rounded-lg text-center transition-colors ${isDragging ? 'border-primary-500 bg-primary-900/20' : 'border-slate-600'}`}
                    >
                        <Image className="mx-auto h-12 w-12 text-slate-500" />
                        <h3 className="mt-2 text-sm font-medium text-slate-300">Tải lên hình ảnh</h3>
                        <p className="mt-1 text-xs text-slate-500">Kéo thả ảnh chụp bảng trắng, sổ tay, ghi chú vào đây.</p>
                        <label htmlFor="image-upload" className="mt-4 cursor-pointer inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700">
                            Chọn ảnh
                        </label>
                        <input id="image-upload" name="image-upload" type="file" className="sr-only" onChange={handleImageFileChange} accept="image/*" />
                    </div>
                )}
                {activeTab === 'file' && (
                    <div 
                        onDragEnter={() => setIsDragging(true)}
                        onDragLeave={() => setIsDragging(false)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        className={`p-8 border-2 border-dashed rounded-lg text-center transition-colors ${isDragging ? 'border-primary-500 bg-primary-900/20' : 'border-slate-600'}`}
                    >
                        <UploadCloud className="mx-auto h-12 w-12 text-slate-500" />
                        <h3 className="mt-2 text-sm font-medium text-slate-300">Tải lên tệp văn bản</h3>
                        <p className="mt-1 text-xs text-slate-500">Kéo thả tệp .txt hoặc .md vào đây để AI phân tích.</p>
                        <label htmlFor="file-upload" className="mt-4 cursor-pointer inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700">
                            Chọn tệp
                        </label>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".txt,.md" />
                    </div>
                )}
                {activeTab === 'csv' && (
                     <div 
                        onDragEnter={() => setIsDragging(true)}
                        onDragLeave={() => setIsDragging(false)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleCsvDrop}
                        className={`p-8 border-2 border-dashed rounded-lg text-center transition-colors ${isDragging ? 'border-primary-500 bg-primary-900/20' : 'border-slate-600'}`}
                    >
                        <Sheet className="mx-auto h-12 w-12 text-slate-500" />
                        <h3 className="mt-2 text-sm font-medium text-slate-300">Tải lên tệp CSV</h3>
                        <p className="mt-1 text-xs text-slate-500">AI sẽ phân tích nội dung tệp CSV của bạn. Vui lòng lưu tệp với định dạng UTF-8 để xử lý đúng tiếng Việt.</p>
                        <div className="mt-4 flex items-center justify-center gap-4">
                            <label htmlFor="csv-upload" className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700">
                                Chọn tệp .csv
                            </label>
                            <input id="csv-upload" name="csv-upload" type="file" className="sr-only" onChange={handleCsvFileChange} accept=".csv" />
                            <button
                                type="button"
                                onClick={handleDownloadTemplate}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-600 text-xs font-medium rounded-md text-slate-300 hover:bg-slate-800"
                            >
                                <Download size={14} />
                                Tải tệp mẫu
                            </button>
                        </div>
                    </div>
                )}
                {activeTab === 'audio' && (
                    <div className="space-y-6">
                        {hasSupport ? (
                            <div className="text-center p-4 rounded-lg bg-slate-800/50">
                                <button onClick={isListening ? stopListening : startListening} className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-primary-600 text-white'}`}>
                                    <Mic size={28} />
                                </button>
                                <p className="mt-3 text-sm text-slate-400">{isListening ? 'Đang lắng nghe...' : 'Nhấn để bắt đầu ghi âm trực tiếp'}</p>
                                {transcript && <button onClick={() => processInput({ text: transcript })} className="mt-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-1.5 px-3 rounded-lg text-xs">Phân tích nội dung đã ghi</button>}
                            </div>
                        ) : (
                             <div className="flex items-start gap-2 bg-red-900/50 border border-red-700 text-red-300 text-sm p-3 rounded-lg">
                                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                                <span>Trình duyệt của bạn không hỗ trợ nhận dạng giọng nói. Vui lòng thử trên Chrome hoặc Edge.</span>
                            </div>
                        )}
                        <div 
                            onDragEnter={() => setIsDragging(true)}
                            onDragLeave={() => setIsDragging(false)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleAudioDrop}
                            className={`p-6 border-2 border-dashed rounded-lg text-center transition-colors ${isDragging ? 'border-primary-500 bg-primary-900/20' : 'border-slate-600'}`}
                        >
                            <UploadCloud className="mx-auto h-10 w-10 text-slate-500" />
                            <p className="mt-1 text-xs text-slate-500">Hoặc kéo thả tệp âm thanh (.mp3, .wav, .m4a) vào đây.</p>
                             <label htmlFor="audio-upload" className="mt-3 cursor-pointer inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700">
                                Chọn tệp âm thanh
                            </label>
                            <input id="audio-upload" name="audio-upload" type="file" className="sr-only" onChange={handleAudioFileChange} accept="audio/*" />
                        </div>
                    </div>
                )}
            </div>
        </>
    );

    const renderProcessingView = () => (
        <div className="flex flex-col items-center justify-center p-20 text-center">
            <Loader2 className="h-12 w-12 text-primary-400 animate-spin" />
            <p className="mt-4 text-lg text-slate-300">AI đang phân tích...</p>
            <p className="text-sm text-slate-500 min-h-[20px] transition-opacity duration-300">
                {processingMessage}
            </p>
        </div>
    );
    
    const renderReviewView = () => (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-700 flex-shrink-0">
                <div className="flex justify-between items-center">
                    <button onClick={() => setView('select')} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Quay lại</button>
                    <h3 className="text-lg font-bold text-white">Xem lại và xác nhận</h3>
                    <div className="w-16"></div>
                </div>
            </div>
            <div className="p-4 flex-grow overflow-y-auto space-y-3">
                {tasksToReview.map((task, index) => (
                    <div key={task.id} className="bg-slate-800 p-3 rounded-lg flex items-start gap-3">
                       <input 
                            type="checkbox"
                            checked={task.isSelected}
                            onChange={() => handleToggleSelect(task.id)}
                            className="mt-1 h-4 w-4 rounded bg-slate-700 border-slate-500 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="flex-grow space-y-2">
                           <input type="text" value={task.text} onChange={e => handleUpdateTask(task.id, 'text', e.target.value)} className="w-full bg-transparent text-slate-200 focus:ring-0 border-0 p-0 text-sm font-medium focus:border-b focus:border-primary-500" />
                           <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1">
                                    <Calendar size={14} className="text-slate-500" />
                                    <input 
                                        type="datetime-local" 
                                        value={task.dueDate ? new Date(new Date(task.dueDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                        onChange={e => handleUpdateTask(task.id, 'dueDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                                        className="bg-transparent text-slate-400 text-xs focus:ring-0 border-0 p-0" />
                                </div>
                                 <div className="flex items-center gap-1">
                                    <Flag size={14} className={task.isUrgent ? 'text-red-500' : 'text-slate-500'} />
                                    <input type="checkbox" checked={task.isUrgent} onChange={e => handleUpdateTask(task.id, 'isUrgent', e.target.checked)} className="h-3 w-3 rounded bg-slate-700 border-slate-500 text-primary-600 focus:ring-primary-500" />
                                </div>
                           </div>
                           <input type="text" value={task.tags.join(', ')} onChange={e => handleUpdateTask(task.id, 'tags', e.target.value.split(',').map(t => t.trim()))} placeholder="Thêm tags, cách nhau bởi dấu phẩy" className="w-full bg-transparent text-slate-400 focus:ring-0 border-0 p-0 text-xs" />
                        </div>
                        <button onClick={() => handleDeleteReviewTask(task.id)} className="text-slate-500 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
            <div className="p-4 border-t border-slate-700 flex-shrink-0">
                <button onClick={handleAddTasks} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 px-4 rounded-lg">
                    Thêm {selectedTasks.length} công việc đã chọn
                </button>
            </div>
        </div>
    );


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-[#1E293B] max-w-3xl w-full rounded-2xl shadow-2xl border border-slate-700 h-[70vh] flex flex-col">
                {view !== 'review' && (
                     <div className="flex justify-between items-center p-4 border-b border-slate-700 flex-shrink-0">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles size={20} className="text-primary-400" /> Trợ lý Nhập liệu Thông minh</h3>
                        <button onClick={handleClose} className="text-slate-400 hover:text-white"><X /></button>
                    </div>
                )}
               
                <div className="flex-grow overflow-y-auto">
                    {view === 'select' && renderSelectView()}
                    {view === 'processing' && renderProcessingView()}
                    {view === 'review' && renderReviewView()}
                </div>
            </div>
        </div>
    );
};

export default ImportAssistantModal;