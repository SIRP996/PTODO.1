
import React, { useState, useEffect } from 'react';
import { X, User, Mail, Save, Loader2, CheckCircle } from 'lucide-react';
import firebase from 'firebase/compat/app';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: firebase.User | null;
  onUpdateProfile: (name: string) => Promise<void>;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, user, onUpdateProfile }) => {
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    setError(null);
    setSuccess(null);
    
    try {
      await onUpdateProfile(displayName);
      setSuccess('Cập nhật thông tin thành công!');
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 1500);
    } catch (err) {
      setError('Không thể cập nhật thông tin. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1E293B] max-w-md w-full rounded-2xl shadow-2xl p-6 border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Cài đặt Tài khoản</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
                        className="w-full bg-[#293548] text-slate-200 border border-slate-600 focus:border-indigo-500 focus:ring-0 rounded-lg pl-10 pr-4 py-2 transition"
                    />
                </div>
            </div>
            
            {error && <p className="text-sm text-red-400">{error}</p>}

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
                    disabled={!hasChanged || isLoading || !!success}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-indigo-800 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : success ? <CheckCircle /> : <Save size={18}/>}
                    <span>{isLoading ? 'Đang lưu...' : success ? 'Đã lưu!' : 'Lưu thay đổi'}</span>
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;
