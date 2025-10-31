
import React, { useState, useEffect } from 'react';
import { X, User, Mail, Save, Loader2 } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Theme } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  onUpdateProfile: (name: string) => Promise<void>;
}

const themes: { id: Theme; name: string; color: string; }[] = [
    { id: 'default', name: 'Mặc định', color: 'bg-indigo-500' },
    { id: 'azure', name: 'Thiên thanh', color: 'bg-sky-500' },
    { id: 'teal', name: 'Xanh ngọc', color: 'bg-teal-500' },
    { id: 'sunset', name: 'Hoàng hôn', color: 'bg-amber-500' },
    { id: 'ocean', name: 'Đại dương', color: 'bg-cyan-500' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, user, onUpdateProfile }) => {
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();
  const { userSettings, updateUserSettings } = useAuth();

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
    }
  }, [user]);

  if (!isOpen) {
    return null;
  }
  
  const originalName = user?.displayName || '';
  const hasChanged = displayName !== originalName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanged) return;
    
    setIsLoading(true);
    
    try {
      await onUpdateProfile(displayName);
      addToast('Cập nhật thông tin thành công!', 'success');
      onClose();
    } catch (err) {
      addToast('Không thể cập nhật thông tin. Vui lòng thử lại.', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleThemeChange = async (theme: Theme) => {
    if (!updateUserSettings) return;
    try {
      await updateUserSettings({ theme });
      addToast('Đã đổi chủ đề!', 'success');
    } catch (err) {
        addToast('Không thể đổi chủ đề.', 'error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1E293B] max-w-md w-full rounded-2xl shadow-2xl p-6 border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Cài đặt Tài khoản</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Mail size={18} />
                    </span>
                    <input
                        id="email"
                        type="email"
                        value={user?.email || ''}
                        readOnly
                        className="w-full bg-[#293548] text-slate-400 border border-slate-600 rounded-lg pl-10 pr-4 py-2 cursor-not-allowed"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-slate-400 mb-1">Họ và tên</label>
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <User size={18} />
                    </span>
                    <input
                        id="displayName"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Tên của bạn"
                        className="w-full bg-[#293548] text-slate-200 border border-slate-600 focus:border-primary-500 focus:ring-0 rounded-lg pl-10 pr-4 py-2 transition"
                    />
                </div>
            </div>

             <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Chủ đề</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {themes.map(theme => (
                        <button
                            type="button"
                            key={theme.id}
                            onClick={() => handleThemeChange(theme.id)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                                userSettings?.theme === theme.id || (!userSettings?.theme && theme.id === 'default')
                                ? 'border-primary-500 bg-primary-900/40'
                                : 'border-slate-600 hover:border-slate-500'
                            }`}
                        >
                            <div className={`w-8 h-8 rounded-full ${theme.color}`}></div>
                            <span className="text-xs font-medium text-slate-300">{theme.name}</span>
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="flex justify-end items-center gap-3 pt-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                    Hủy
                </button>
                <button
                    type="submit"
                    disabled={!hasChanged || isLoading}
                    className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-primary-800 disabled:cursor-not-allowed min-w-[140px]"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : <Save size={18}/>}
                    <span>{isLoading ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;