import React, { useState, useEffect } from 'react';
import { TaskTemplate, SubtaskTemplate } from '../types';
import { X, Plus, Trash2, Edit3, Save, ClipboardList, GripVertical } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { v4 as uuidv4 } from 'uuid';

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: TaskTemplate[];
  onAddTemplate: (template: Omit<TaskTemplate, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
  onUpdateTemplate: (templateId: string, data: Partial<Omit<TaskTemplate, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
}

const EMOJI_OPTIONS = ['📋', '🚀', '📝', '✅', '💡', '📅', '🎯', '⚙️', '📈', '📢'];

const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({ isOpen, onClose, templates, onAddTemplate, onUpdateTemplate, onDeleteTemplate }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateIcon, setTemplateIcon] = useState('📋');
  const [subtasks, setSubtasks] = useState<SubtaskTemplate[]>([]);
  const { addToast } = useToast();
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null);


  useEffect(() => {
    if (selectedTemplate) {
      setTemplateName(selectedTemplate.name);
      setTemplateIcon(selectedTemplate.icon);
      setSubtasks(selectedTemplate.subtasks.map(s => ({...s, id: s.id || uuidv4() })));
    } else {
      resetForm();
    }
  }, [selectedTemplate]);

  if (!isOpen) return null;

  const resetForm = () => {
    setTemplateName('');
    setTemplateIcon('📋');
    setSubtasks([{ id: uuidv4(), text: '' }]);
  };

  const handleSelectTemplate = (template: TaskTemplate) => {
    setSelectedTemplate(template);
  };
  
  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    resetForm();
  }

  const handleSubtaskChange = (id: string, newText: string) => {
    setSubtasks(current => current.map(st => st.id === id ? { ...st, text: newText } : st));
  };
  
  const handleAddSubtask = () => {
    setSubtasks(current => [...current, { id: uuidv4(), text: '' }]);
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(current => current.filter(st => st.id !== id));
  };
  
  const handleSave = async () => {
    if (!templateName.trim()) {
      addToast("Tên mẫu không được để trống.", "warn");
      return;
    }
    const finalSubtasks = subtasks.map(({id, text}) => ({id, text})).filter(st => st.text.trim() !== '');

    const templateData = {
      name: templateName,
      icon: templateIcon,
      subtasks: finalSubtasks,
    };

    if (selectedTemplate) {
      await onUpdateTemplate(selectedTemplate.id, templateData);
    } else {
      await onAddTemplate(templateData);
      handleNewTemplate();
    }
  };

  const handleDelete = async () => {
    if (selectedTemplate && window.confirm(`Bạn có chắc chắn muốn xóa mẫu "${selectedTemplate.name}" không?`)) {
      await onDeleteTemplate(selectedTemplate.id);
      setSelectedTemplate(null);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDraggedSubtaskId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
      e.preventDefault();
      if (draggedSubtaskId === null || draggedSubtaskId === targetId) return;

      const newSubtasks = [...subtasks];
      const draggedIndex = newSubtasks.findIndex(st => st.id === draggedSubtaskId);
      const targetIndex = newSubtasks.findIndex(st => st.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      const [removed] = newSubtasks.splice(draggedIndex, 1);
      newSubtasks.splice(targetIndex, 0, removed);

      setSubtasks(newSubtasks);
      setDraggedSubtaskId(null);
  };

  const handleDragEnd = () => {
      setDraggedSubtaskId(null);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#1E293B]/60 backdrop-blur-xl border border-white/10 max-w-4xl w-full rounded-2xl shadow-2xl h-[80vh] flex">
        {/* Left Panel: Template List */}
        <div className="w-1/3 border-r border-white/10 flex flex-col">
          <div className="p-4 border-b border-white/10 flex justify-between items-center flex-shrink-0">
            <h3 className="text-lg font-bold text-white">Quản lý Mẫu</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
          </div>
          <div className="flex-grow overflow-y-auto p-2 space-y-1">
            {templates.map(template => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className={`w-full flex items-center gap-3 p-2 text-sm rounded-md text-left transition-colors ${selectedTemplate?.id === template.id ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
              >
                <span className="text-xl">{template.icon}</span>
                <span className="truncate">{template.name}</span>
              </button>
            ))}
          </div>
          <div className="p-4 border-t border-white/10 flex-shrink-0">
            <button
                onClick={handleNewTemplate}
                className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded-lg"
            >
                <Plus size={16} /> Tạo mẫu mới
            </button>
          </div>
        </div>

        {/* Right Panel: Template Editor */}
        <div className="w-2/3 flex flex-col">
          <div className="p-4 border-b border-white/10 flex justify-between items-center flex-shrink-0">
             <h4 className="text-lg font-semibold text-white">{selectedTemplate ? "Chỉnh sửa mẫu" : "Tạo mẫu mới"}</h4>
             <div>
                {selectedTemplate && (
                    <button onClick={handleDelete} className="text-slate-400 hover:text-red-400 p-2 rounded-full transition-colors mr-2" title="Xóa mẫu"><Trash2 size={18} /></button>
                )}
                <button onClick={handleSave} className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><Save size={16} /> Lưu</button>
             </div>
          </div>
          <div className="flex-grow p-6 overflow-y-auto space-y-6">
            <div className="flex items-center gap-4">
                <div className="relative group">
                    <button className="w-16 h-16 text-4xl bg-slate-800 rounded-lg flex items-center justify-center">{templateIcon}</button>
                    <div className="absolute top-full mt-2 hidden group-hover:grid grid-cols-5 gap-1 bg-[#293548] p-2 rounded-lg border border-slate-600 z-10">
                        {EMOJI_OPTIONS.map(emoji => (
                            <button key={emoji} onClick={() => setTemplateIcon(emoji)} className="p-1 text-2xl rounded-md hover:bg-slate-700">{emoji}</button>
                        ))}
                    </div>
                </div>
                <div className="flex-grow">
                    <label htmlFor="template-name" className="block text-sm font-medium text-slate-400 mb-1">Tên mẫu</label>
                    <input
                        id="template-name"
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Ví dụ: Xuất bản bài blog"
                        className="w-full bg-[#293548] text-slate-200 border border-slate-600 focus:border-primary-500 focus:ring-0 rounded-lg px-4 py-2 transition"
                    />
                </div>
            </div>
             <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Các công việc con</label>
                <div className="space-y-2">
                    {subtasks.map((st, index) => (
                        <div
                          key={st.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, st.id)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, st.id)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-2 group transition-opacity duration-200 ${draggedSubtaskId === st.id ? 'opacity-30' : ''}`}
                        >
                            <span className="text-slate-500 cursor-move p-1"><GripVertical size={16} /></span>
                            <input
                                type="text"
                                value={st.text}
                                onChange={(e) => handleSubtaskChange(st.id, e.target.value)}
                                placeholder={`Công việc con ${index + 1}`}
                                className="flex-grow bg-[#293548] text-slate-300 border border-slate-600 focus:border-primary-500 focus:ring-0 rounded-lg px-3 py-1.5 text-sm transition"
                            />
                            <button onClick={() => handleRemoveSubtask(st.id)} className="text-slate-500 hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                        </div>
                    ))}
                </div>
                <button onClick={handleAddSubtask} className="mt-3 flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 font-semibold">
                    <Plus size={16} /> Thêm công việc con
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateManagerModal;