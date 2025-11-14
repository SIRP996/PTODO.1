

import React, { useState, KeyboardEvent, useEffect, useRef } from 'react';
import { Plus, X, Flag, Sparkles, Loader2, Mic, UploadCloud, ClipboardPaste, ListTree } from 'lucide-react';
import { Type } from '@google/genai';
import { getGoogleGenAI } from '../utils/gemini';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useToast } from '../context/ToastContext';
import { Project, TaskTemplate } from '../types';

interface TaskInputProps {
  onAddTask: (text: string, tags: string[], dueDate: string | null, isUrgent: boolean, recurrenceRule: 'none' | 'daily' | 'weekly' | 'monthly', projectId?: string) => Promise<string | undefined>;
  onApiKeyError: () => void;
  hasApiKey: boolean;
  onOpenImportModal: () => void;
  projects: Project[];
  selectedProjectId: string | null;
  templates: TaskTemplate[];
  onOpenApplyTemplateModal: (template: TaskTemplate) => void;
  onOpenPlannerModal: (text: string) => void;
}

const TaskInput: React.FC<TaskInputProps> = ({ onAddTask, onApiKeyError, hasApiKey, onOpenImportModal, projects, selectedProjectId, templates, onOpenApplyTemplateModal, onOpenPlannerModal }) => {
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currentTag, setCurrentTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [isParsing, setIsParsing] = useState(false);
  const [projectId, setProjectId] = useState<string>('');
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const { addToast } = useToast();
  const templateMenuRef = useRef<HTMLDivElement>(null);

  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    hasSupport: hasSpeechRecognitionSupport,
  } = useSpeechRecognition();
  
  useEffect(() => {
      setProjectId(selectedProjectId || '');
  }, [selectedProjectId]);

  useEffect(() => {
    if (transcript) {
      setText(transcript);
      handleParseTask(transcript);
    }
  }, [transcript]);
  
   useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(event.target as Node)) {
        setIsTemplateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && currentTag.trim()) {
      e.preventDefault();
      if (!tags.includes(currentTag.trim().toLowerCase())) {
        setTags([...tags, currentTag.trim().toLowerCase()]);
      }
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleParseTask = async (textToParseOverride?: string) => {
    const textToParse = textToParseOverride || text;
    if (!textToParse.trim()) {
      addToast("Vui lòng nhập nội dung công việc để AI phân tích.", "info");
      return;
    }
    setIsParsing(true);
    try {
      const ai = getGoogleGenAI();
      if (!ai) {
          addToast("Vui lòng thiết lập API Key để sử dụng tính năng AI.", "info");
          setIsParsing(false);
          return;
      }
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an intelligent task parsing assistant for a to-do list application. The user is Vietnamese.

        Current Context:
        - Current Date (UTC): ${new Date().toISOString()}
        - Current Year: ${new Date().getFullYear()}
        - User's Timezone: Asia/Ho_Chi_Minh (UTC+7)
        
        Your Instructions:
        1.  **Year Logic is CRITICAL**: 
            - If the user does not specify a year (e.g., "ngày 11/11", "thứ 6 tuần sau"), you MUST use the current year (${new Date().getFullYear()}).
            - If the calculated date has already passed in the current year, you MUST use the next year (${new Date().getFullYear() + 1}). For example, if today is December 2024 and the user says "15 tháng 1", the date should be for January 15, 2025.
            - NEVER default to a past year like 2001 or any other arbitrary old year. This is a critical failure.
        2.  **Time Parsing is Crucial**:
            - **Time Ranges**: If a time range is provided (e.g., "19:00 - 22:00", "8h-17h"), you MUST use the START time of the range for the \`dueDate\`.
            - **Specific Times**: Parse specific times like "19:00", "8:00", "4h chiều" accurately. "sáng" = AM, "chiều"/"tối" = PM.
        3.  **Timezone is Key**: All times mentioned by the user are in their local timezone (UTC+7).
        4.  **Output in UTC**: Your final \`dueDate\` output MUST be a full ISO 8601 string in UTC (format: YYYY-MM-DDTHH:mm:ss.sssZ). You must convert the parsed local time to UTC.
        5.  **Defaults**: If no specific time is mentioned for a given date, default to 17:00 (5 PM) local time. If no date is mentioned at all, \`dueDate\` must be null.
        6.  **Content**: Extract the core task description, excluding date/time information that you've already processed.
        7.  **Tags**: Extract all hashtags (words starting with '#'). In the output array, remove the '#' prefix and use lowercase.
        8.  **Strict JSON**: Return ONLY a valid JSON object matching the schema. No markdown.
        
        User Input: "${textToParse}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              content: {
                type: Type.STRING,
                description: 'The main content or description of the task.',
              },
              dueDate: {
                type: Type.STRING,
                description: 'The due date in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ) or null if not specified.',
              },
              tags: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: 'An array of hashtags associated with the task, without the # prefix and in lowercase.',
              },
            },
            required: ['content', 'dueDate', 'tags'],
          },
        },
      });

      const jsonStr = response.text.trim();
      const parsed = JSON.parse(jsonStr);
      
      if (parsed.content) {
        setText(parsed.content);
      }
      if (parsed.tags && Array.isArray(parsed.tags)) {
        setTags(prevTags => [...new Set([...prevTags, ...parsed.tags])]); // Merge and deduplicate
      }
      if (parsed.dueDate) {
        // Convert ISO string (UTC) to a format suitable for datetime-local input (local timezone)
        const localDate = new Date(parsed.dueDate);
        
        if (!isNaN(localDate.getTime())) {
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            const hours = String(localDate.getHours()).padStart(2, '0');
            const minutes = String(localDate.getMinutes()).padStart(2, '0');
            
            const formattedDueDate = `${year}-${month}-${day}T${hours}:${minutes}`;
            setDueDate(formattedDueDate);
        }
      }
      addToast("AI đã phân tích xong công việc!", 'success');
    } catch (error: any) {
      console.error("AI parsing failed:", error);
      const errorMessage = error?.message?.toLowerCase() || '';
      if (errorMessage.includes('api key not valid') || errorMessage.includes('permission_denied')) {
        onApiKeyError();
      } else {
        addToast("AI không thể phân tích công việc. Vui lòng thử lại hoặc nhập thủ công.", 'error');
      }
    } finally {
      setIsParsing(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      await onAddTask(text, tags, dueDate || null, isUrgent, recurrenceRule, projectId || undefined);
      setText('');
      setDueDate('');
      setTags([]);
      setCurrentTag('');
      setIsUrgent(false);
      setRecurrenceRule('none');
    }
  };
  
  const handleUseTemplate = (template: TaskTemplate) => {
    setIsTemplateMenuOpen(false);
    onOpenApplyTemplateModal(template);
  };

  const recurrenceOptions: Array<{id: 'none' | 'daily' | 'weekly' | 'monthly', label: string}> = [
      { id: 'none', label: 'Không lặp lại'},
      { id: 'daily', label: 'Hàng ngày'},
      { id: 'weekly', label: 'Hàng tuần'},
      { id: 'monthly', label: 'Hàng tháng'},
  ];

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <label htmlFor="task-content" className="block text-sm font-medium text-slate-400 mb-1">Nội dung công việc</label>
          <textarea
            id="task-content"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ví dụ: Gặp đội thiết kế vào 4h chiều mai #họp"
            className="w-full bg-[#293548] text-slate-200 border border-primary-600 focus:border-primary-500 focus:ring-0 rounded-lg px-4 py-2 transition pr-12"
            rows={2}
          />
          {hasSpeechRecognitionSupport && (
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`absolute bottom-2.5 right-2.5 p-2 rounded-full transition-colors duration-200 ${
                  isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
              title={isListening ? "Dừng ghi âm" : "Ghi âm công việc"}
            >
              <Mic size={18} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-project" className="block text-sm font-medium text-slate-400 mb-1">Dự án</label>
              <select
                id="task-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-[#293548] text-slate-200 border border-primary-600 focus:border-primary-500 focus:ring-0 rounded-lg px-4 py-2 transition"
              >
                <option value="">Không thuộc dự án nào</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-tags" className="block text-sm font-medium text-slate-400 mb-1">Thẻ (gõ rồi nhấn Enter)</label>
              <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#293548] border border-primary-600 rounded-lg focus-within:border-primary-500">
                  {tags.map(tag => (
                    <span key={tag} className="flex items-center bg-primary-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                      #{tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 text-primary-200 hover:text-white">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    id="task-tags"
                    type="text"
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder={tags.length > 0 ? '' : 'Thêm thẻ...'}
                    className="flex-grow bg-transparent focus:ring-0 border-0 p-0 text-sm"
                  />
              </div>
            </div>
          </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label htmlFor="task-duedate" className="block text-sm font-medium text-slate-400 mb-1">Thời hạn (bắt buộc cho lặp lại)</label>
            <input
              id="task-duedate"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-[#293548] text-slate-200 border border-primary-600 focus:border-primary-500 focus:ring-0 rounded-lg px-4 py-2 transition"
            />
          </div>
          <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Quy tắc lặp lại</label>
              <div className="flex items-center gap-1 p-1 bg-slate-900/50 border border-slate-700 rounded-lg">
                  {recurrenceOptions.map(opt => (
                      <button
                          key={opt.id}
                          type="button"
                          onClick={() => setRecurrenceRule(opt.id)}
                          disabled={!dueDate && opt.id !== 'none'}
                          className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed
                              ${recurrenceRule === opt.id ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:bg-slate-700'}`
                          }
                      >
                          {opt.label}
                      </button>
                  ))}
              </div>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-end items-center gap-2 pt-2">
              <div className="relative" ref={templateMenuRef}>
                  <button
                      type="button"
                      onClick={() => setIsTemplateMenuOpen(p => !p)}
                      disabled={templates.length === 0}
                      className="flex items-center gap-2 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-lg transition-colors duration-200 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                      title={templates.length > 0 ? "Sử dụng mẫu công việc" : "Chưa có mẫu nào, hãy tạo trong phần Tiện ích"}
                  >
                      <ClipboardPaste size={20} />
                      <span className="hidden sm:inline">Mẫu</span>
                  </button>
                  {isTemplateMenuOpen && (
                      <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#293548] border border-slate-600 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                          {templates.map(template => (
                              <button
                                  key={template.id}
                                  type="button"
                                  onClick={() => handleUseTemplate(template)}
                                  className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-slate-700 transition-colors"
                              >
                                  <span className="text-lg">{template.icon}</span>
                                  <span className="text-sm text-slate-200 truncate">{template.name}</span>
                              </button>
                          ))}
                      </div>
                  )}
              </div>
              <button
                  type="button"
                  onClick={onOpenImportModal}
                  disabled={!hasApiKey}
                  className="flex items-center gap-2 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-lg transition-colors duration-200 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                  title={hasApiKey ? "Nhập liệu thông minh từ tệp hoặc giọng nói" : "Thêm API Key để sử dụng tính năng này"}
              >
                  <UploadCloud size={20} />
                  <span className="hidden sm:inline">Nhập liệu AI</span>
              </button>
              <button
                  type="button"
                  onClick={() => onOpenPlannerModal(text)}
                  disabled={!text.trim() || !hasApiKey}
                  className="flex items-center gap-2 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-lg transition-colors duration-200 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                  title={hasApiKey ? "Lập kế hoạch dự án bằng AI" : "Thêm API Key để sử dụng tính năng này"}
              >
                  <ListTree size={20} />
                  <span className="hidden sm:inline">Kế hoạch AI</span>
              </button>
              <button
                  type="button"
                  onClick={() => handleParseTask()}
                  disabled={isParsing || !text.trim() || !hasApiKey}
                  className="p-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                  title={hasApiKey ? "Phân tích nội dung hiện tại bằng AI" : "Thêm API Key để sử dụng tính năng AI"}
              >
                  {isParsing ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
              </button>
              <button 
                  type="button"
                  onClick={() => setIsUrgent(!isUrgent)}
                  className={`p-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 ${isUrgent && '!bg-red-600 !text-white'}`}
                  title="Đánh dấu là GẤP"
              >
                  <Flag size={20} />
              </button>
              <button 
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 disabled:bg-primary-800 disabled:cursor-not-allowed"
                  disabled={!text.trim() || (recurrenceRule !== 'none' && !dueDate)}
              >
                  <Plus size={20} />
                  <span>Thêm</span>
              </button>
        </div>
      </form>
    </>
  );
};

export default TaskInput;