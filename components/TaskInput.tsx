import React, { useState, KeyboardEvent } from 'react';
import { Plus, X, Flag, Sparkles, Loader2 } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

interface TaskInputProps {
  onAddTask: (text: string, tags: string[], dueDate: string | null, isUrgent: boolean, recurrenceRule: 'none' | 'daily' | 'weekly' | 'monthly') => void;
}

const TaskInput: React.FC<TaskInputProps> = ({ onAddTask }) => {
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currentTag, setCurrentTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [isParsing, setIsParsing] = useState(false);

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

  const handleParseTask = async () => {
    if (!text.trim()) {
      alert("Vui lòng nhập nội dung công việc để AI phân tích.");
      return;
    }
    setIsParsing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an intelligent task parsing assistant for a to-do list application. The user is Vietnamese.

        Current Context:
        - Current Date (UTC): ${new Date().toISOString()}
        - User's Timezone: Asia/Ho_Chi_Minh (UTC+7)
        
        Your Instructions:
        1.  **Timezone is Key**: All times mentioned by the user (e.g., "10 giờ sáng", "4h chiều") are in their local timezone (UTC+7).
        2.  **Output in UTC**: Your final \`dueDate\` output MUST be an ISO 8601 string in UTC. You must convert the parsed local time to UTC. For example, "10 giờ sáng" (10:00 local) should be converted to 'T03:00:00.000Z' in the output.
        3.  **Smart Date Logic**: If the year is not specified, choose the nearest upcoming date. For example, if it's October 2024 and the user says "November 6th", you use 2024. If it's December 2024, you use 2025.
        4.  **Language**: The input is in Vietnamese. "sáng" = AM, "chiều"/"tối" = PM.
        5.  **Defaults**: If no specific time is mentioned for a given date, default to 17:00 (5 PM) local time. If no date is mentioned at all, \`dueDate\` must be null.
        6.  **Content**: Extract the core task description.
        7.  **Tags**: Extract all hashtags (words starting with '#'). In the output array, remove the '#' prefix and use lowercase.
        8.  **Strict JSON**: Return ONLY a valid JSON object matching the schema. No markdown.
        
        User Input: "${text}"`,
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

    } catch (error) {
      console.error("AI parsing failed:", error);
      alert("AI không thể phân tích công việc. Vui lòng thử lại hoặc nhập thủ công.");
    } finally {
      setIsParsing(false);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onAddTask(text, tags, dueDate || null, isUrgent, recurrenceRule);
      setText('');
      setDueDate('');
      setTags([]);
      setCurrentTag('');
      setIsUrgent(false);
      setRecurrenceRule('none');
    }
  };
  
  const recurrenceOptions: Array<{id: 'none' | 'daily' | 'weekly' | 'monthly', label: string}> = [
      { id: 'none', label: 'Không lặp lại'},
      { id: 'daily', label: 'Hàng ngày'},
      { id: 'weekly', label: 'Hàng tuần'},
      { id: 'monthly', label: 'Hàng tháng'},
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="task-content" className="block text-sm font-medium text-slate-400 mb-1">Nội dung công việc</label>
        <textarea
          id="task-content"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ví dụ: Gặp đội thiết kế vào 4h chiều mai #họp"
          className="w-full bg-[#293548] text-slate-200 border border-indigo-600 focus:border-indigo-500 focus:ring-0 rounded-lg px-4 py-2 transition"
          rows={3}
        />
      </div>
      
      <div>
        <label htmlFor="task-tags" className="block text-sm font-medium text-slate-400 mb-1">Thẻ (gõ rồi nhấn Enter)</label>
        <div className="flex flex-wrap items-center gap-2 p-2 bg-[#293548] border border-indigo-600 rounded-lg focus-within:border-indigo-500">
            {tags.map(tag => (
              <span key={tag} className="flex items-center bg-indigo-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                #{tag}
                <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 text-indigo-200 hover:text-white">
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div>
          <label htmlFor="task-duedate" className="block text-sm font-medium text-slate-400 mb-1">Thời hạn (bắt buộc cho lặp lại)</label>
          <input
            id="task-duedate"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full bg-[#293548] text-slate-200 border border-indigo-600 focus:border-indigo-500 focus:ring-0 rounded-lg px-4 py-2 transition"
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
                            ${recurrenceRule === opt.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:bg-slate-700'}`
                        }
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
      </div>
      
      <div className="flex justify-end items-center gap-2 pt-2">
            <button
                type="button"
                onClick={handleParseTask}
                disabled={isParsing || !text.trim()}
                className="p-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 disabled:bg-purple-800 disabled:cursor-not-allowed"
                title="Phân tích công việc bằng AI"
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 disabled:bg-indigo-800 disabled:cursor-not-allowed"
                disabled={!text.trim() || (recurrenceRule !== 'none' && !dueDate)}
            >
                <Plus size={20} />
                <span>Thêm</span>
            </button>
      </div>
    </form>
  );
};

export default TaskInput;
