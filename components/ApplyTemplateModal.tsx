import React, { useState, KeyboardEvent, useEffect } from 'react';
import { TaskTemplate, Project } from '../types';
import { X, Calendar, Flag, Folder, Check, Tag } from 'lucide-react';

interface ApplyTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: TaskTemplate;
  projects: Project[];
  onApply: (details: {
    dueDate: string | null;
    tags: string[];
    isUrgent: boolean;
    projectId: string;
  }) => void;
}

const ApplyTemplateModal: React.FC<ApplyTemplateModalProps> = ({
  isOpen,
  onClose,
  template,
  projects,
  onApply,
}) => {
  const [dueDate, setDueDate] = useState('');
  const [currentTag, setCurrentTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [projectId, setProjectId] = useState('');

  // Reset state when the modal is opened
  useEffect(() => {
    if (isOpen) {
      setDueDate('');
      setCurrentTag('');
      setTags([]);
      setIsUrgent(false);
      setProjectId('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

  const handleSubmit = () => {
    onApply({
      dueDate: dueDate || null,
      tags,
      isUrgent,
      projectId,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#1E293B]/60 backdrop-blur-xl border border-white/10 max-w-lg w-full rounded-2xl shadow-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <span className="text-2xl">{template.icon}</span>
            <span>Áp dụng mẫu: {template.name}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
        </div>
        
        <div className="space-y-4">
            {/* Project */}
            <div>
              <label htmlFor="template-project" className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2"><Folder size={16}/> Dự án</label>
              <select
                id="template-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-[#293548] text-slate-200 border border-slate-600 focus:border-primary-500 focus:ring-0 rounded-lg px-4 py-2 transition"
              >
                <option value="">Không thuộc dự án nào</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label htmlFor="template-duedate" className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2"><Calendar size={16}/> Thời hạn</label>
              <input
                id="template-duedate"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#293548] text-slate-200 border border-slate-600 focus:border-primary-500 focus:ring-0 rounded-lg px-4 py-2 transition"
              />
            </div>

            {/* Tags */}
            <div>
                <label htmlFor="template-tags" className="block text-sm font-medium text-slate-400 mb-1 flex items-center gap-2"><Tag size={16}/> Thẻ (gõ rồi nhấn Enter)</label>
                <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#293548] border border-slate-600 rounded-lg focus-within:border-primary-500">
                    {tags.map(tag => (
                      <span key={tag} className="flex items-center bg-primary-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                        #{tag}
                        <button type="button" onClick={() => removeTag(tag)} className="ml-1.5 text-primary-200 hover:text-white">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <input
                      id="template-tags"
                      type="text"
                      value={currentTag}
                      onChange={(e) => setCurrentTag(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder={tags.length > 0 ? '' : 'Thêm thẻ...'}
                      className="flex-grow bg-transparent focus:ring-0 border-0 p-0 text-sm"
                    />
                </div>
            </div>
            
            {/* Urgent Toggle */}
            <div className="flex items-center justify-between bg-[#293548] p-3 rounded-lg">
                <label htmlFor="template-urgent" className="flex items-center gap-2 text-sm font-medium text-slate-300 cursor-pointer">
                    <Flag size={16} className={isUrgent ? 'text-red-400' : 'text-slate-500'}/>
                    Đánh dấu là khẩn cấp?
                </label>
                <button 
                    type="button"
                    role="switch"
                    id="template-urgent"
                    aria-checked={isUrgent}
                    onClick={() => setIsUrgent(!isUrgent)}
                    className={`${isUrgent ? 'bg-primary-600' : 'bg-slate-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                >
                    <span className={`${isUrgent ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
                </button>
            </div>
        </div>

        <div className="mt-6 flex justify-end">
            <button
              onClick={handleSubmit}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Check size={16} />
              <span>Áp dụng mẫu</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default ApplyTemplateModal;
