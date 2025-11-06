import React, { useState, useEffect } from 'react';
import { X, User, Mail, Save, Loader2, Image, Trash2, Calendar, RefreshCw } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Theme } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  onUpdateProfile: (name: string) => Promise<void>;
  syncExistingTasksToCalendar: () => Promise<void>;
}

const themes: { id: Theme; name: string; color: string; }[] = [
    { id: 'default', name: 'Mặc định', color: 'bg-indigo-500' },
    { id: 'azure', name: 'Thiên thanh', color: 'bg-sky-500' },
    { id: 'teal', name: 'Xanh ngọc', color: 'bg-teal-500' },
    { id: 'sunset', name: 'Hoàng hôn', color: 'bg-amber-500' },
    { id: 'ocean', name: 'Đại dương', color: 'bg-cyan-500' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, user, onUpdateProfile, syncExistingTasksToCalendar }) => {
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncingOld, setIsSyncingOld] = useState(false);
  const { addToast } = useToast();
  const { userSettings, updateUserSettings, linkGoogleAccount, unlinkGoogleAccount } = useAuth();
  
  const userAvatarUrl = userSettings?.avatarUrl || user?.photoURL;
  const googleProviderData = user?.providerData.find(p => p.providerId === 'google.com');

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
    if (!hasChanged) {
        onClose(); // Still close the modal if nothing changed but user hit save
        return;
    };
    
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && updateUserSettings) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          await updateUserSettings({ avatarUrl: base64String });
          addToast("Đã cập nhật ảnh đại diện!", 'success');
        } catch (err) {
          addToast("Không thể cập nhật ảnh đại diện.", 'error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetAvatar = async () => {
    if (updateUserSettings) {
        try {
            await updateUserSettings({ avatarUrl: '' }); // Set to empty string to clear it
            addToast("Đã khôi phục ảnh đại diện mặc định.", 'info');
        } catch (err) {
            addToast("Không thể đặt lại ảnh đại diện.", 'error');
        }
    }
  };

  const handleLinkGoogle = async () => {
    setIsLinking(true);
    try {
        await linkGoogleAccount();
        addToast("Đã kết nối thành công với Lịch Google!", 'success');
    } catch (error: any) {
        console.error("Google Link Error:", error);
        let errorMessage = `Không thể kết nối. ${error.message || 'Vui lòng thử lại.'}`;

        switch (error.code) {
            case 'auth/popup-closed-by-user':
            case 'auth/cancelled-popup-request':
                errorMessage = ''; // No toast for user cancellation
                break;
            case 'auth/popup-blocked':
                errorMessage = "Trình duyệt đã chặn cửa sổ đăng nhập. Vui lòng cho phép pop-up và thử lại.";
                break;
            case 'auth/credential-already-in-use':
                errorMessage = "Tài khoản Google này đã được liên kết với một tài khoản PTODO khác.\n\nVui lòng đăng xuất, sau đó sử dụng tùy chọn 'Đăng nhập với Google' để truy cập tài khoản đã liên kết.";
                break;
            case 'auth/operation-not-allowed':
                 errorMessage = "Lỗi cấu hình: Đăng nhập bằng Google chưa được bật. Vui lòng liên hệ quản trị viên.";
                 break;
            case 'auth/unauthorized-domain':
                const domain = window.location.hostname;
                errorMessage = `Lỗi Cấu Hình - Tên Miền Chưa Được Phép\n\nĐể khắc phục:\n1. Mở Firebase Console cho dự án của bạn.\n2. Đi đến mục Authentication > Settings > Authorized domains.\n3. Nhấn "Add domain" và nhập vào: ${domain}`;
                break;
        }
        if (errorMessage) {
            addToast(errorMessage, 'error');
        }
    } finally {
        setIsLinking(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    setIsLinking(true);
    try {
        await unlinkGoogleAccount();
        addToast("Đã ngắt kết nối Lịch Google.", 'info');
    } catch(error) {
        addToast("Không thể ngắt kết nối. Vui lòng thử lại.", 'error');
        console.error("Google Unlink Error:", error);
    } finally {
        setIsLinking(false);
    }
  }
  
  const handleSyncOldTasks = async () => {
    setIsSyncingOld(true);
    await syncExistingTasksToCalendar();
    setIsSyncingOld(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#1E293B] max-w-lg w-full rounded-2xl shadow-2xl p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Cài đặt tài khoản</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Info Section */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-300 border-b border-slate-700 pb-2">Thông tin cá nhân</h4>
            <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-full overflow-hidden bg-slate-700 group flex-shrink-0">
                    {userAvatarUrl ? (
                        <img src={userAvatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <User size={32} className="text-slate-400" />
                        </div>
                    )}
                    <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Image size={24} />
                    </label>
                    <input id="avatar-upload" type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} />
                </div>
                {userSettings?.avatarUrl && (
                     <button type="button" onClick={handleResetAvatar} className="p-2 bg-slate-700 hover:bg-red-900/50 text-slate-300 hover:text-red-400 rounded-full transition-colors" title="Khôi phục ảnh mặc định">
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            <div>
              <label htmlFor="display-name" className="block text-sm font-medium text-slate-400 mb-1">Tên hiển thị</label>
              <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500"><User size={16} /></span>
                  <input
                      id="display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-[#293548] text-slate-200 border border-slate-600 focus:border-primary-500 focus:ring-0 rounded-lg pl-10 pr-4 py-2 transition"
                  />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-1">Email</label>
              <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500"><Mail size={16} /></span>
                  <input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full bg-slate-800/50 text-slate-400 border border-slate-700 rounded-lg pl-10 pr-4 py-2"
                  />
              </div>
            </div>
          </div>
          
           {/* Theme Section */}
           <div className="space-y-4">
            <h4 className="font-semibold text-slate-300 border-b border-slate-700 pb-2">Chủ đề</h4>
            <div className="flex flex-wrap gap-3">
                {themes.map(theme => (
                    <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleThemeChange(theme.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-colors ${
                            (userSettings?.theme === theme.id || (!userSettings?.theme && theme.id === 'default'))
                            ? 'border-primary-500 bg-primary-900/30'
                            : 'border-transparent hover:border-slate-600'
                        }`}
                    >
                        <div className={`w-6 h-6 rounded-md ${theme.color}`}></div>
                        <span className="text-sm font-medium text-slate-300">{theme.name}</span>
                    </button>
                ))}
            </div>
           </div>

           {/* Integrations Section */}
           <div className="space-y-4">
                <h4 className="font-semibold text-slate-300 border-b border-slate-700 pb-2">Tích hợp</h4>
                <div className="bg-slate-800/50 p-4 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-500/20 text-blue-400 p-2 rounded-md"><Calendar size={20} /></div>
                        <div>
                            <p className="font-semibold text-white">Lịch Google</p>
                            {userSettings?.isGoogleCalendarLinked && googleProviderData ? (
                                <>
                                  <p className="text-xs text-slate-400">Đã kết nối với: {googleProviderData.email}</p>
                                  <p className="text-xs text-slate-500 mt-1">Công việc có thời hạn sẽ được đồng bộ tự động.</p>
                                </>
                            ) : (
                                <p className="text-xs text-slate-400">Đồng bộ công việc có thời hạn.</p>
                            )}
                        </div>
                    </div>
                    {userSettings?.isGoogleCalendarLinked ? (
                         <button
                            type="button"
                            onClick={handleUnlinkGoogle}
                            disabled={isLinking}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-1.5 px-3 rounded-md transition-colors disabled:bg-slate-600"
                        >
                            {isLinking ? <Loader2 size={16} className="animate-spin"/> : 'Ngắt kết nối'}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleLinkGoogle}
                            disabled={isLinking}
                            className="bg-slate-600 hover:bg-slate-500 text-white font-semibold text-sm py-1.5 px-3 rounded-md transition-colors disabled:bg-slate-600"
                        >
                           {isLinking ? <Loader2 size={16} className="animate-spin"/> : 'Kết nối'}
                        </button>
                    )}
                </div>
                {userSettings?.isGoogleCalendarLinked && (
                    <div className="pl-4">
                        <button
                            type="button"
                            onClick={handleSyncOldTasks}
                            disabled={isSyncingOld}
                            className="flex items-center gap-2 text-sm text-slate-400 hover:text-primary-400 font-semibold disabled:text-slate-500 disabled:cursor-not-allowed"
                        >
                           {isSyncingOld ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
                           <span>{isSyncingOld ? 'Đang xử lý...' : 'Đồng bộ công việc cũ'}</span>
                        </button>
                        <p className="text-xs text-slate-500 mt-1">Chỉ cần thực hiện một lần để đưa các công việc đã có từ trước lên lịch của bạn.</p>
                    </div>
                )}
           </div>


          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isLoading || !hasChanged}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : <Save size={16} />}
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;