import React, { useState, FormEvent } from 'react';
import { Lock, Mail, CheckSquare, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type AuthMode = 'login' | 'register' | 'forgotPassword';

const AuthInput = ({ icon, ...props }: { icon: React.ReactNode; [key: string]: any }) => (
  <div className="relative">
    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
      {icon}
    </span>
    <input
      {...props}
      className="w-full bg-[#293548] text-slate-200 border border-slate-600 focus:border-primary-500 focus:ring-0 rounded-lg pl-10 pr-4 py-2 transition disabled:opacity-50"
    />
  </div>
);

const GoogleIcon = () => (
    <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
        <path d="M1 1h22v22H1z" fill="none"></path>
    </svg>
);


const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const { signup, login, resetPassword, loginWithGoogle } = useAuth();

  const handleResponse = () => {
    setLoading(false);
    setError(null);
    setMessage(null);
  };

  const getFriendlyErrorMessage = (err: any): string => {
    switch (err.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Email hoặc mật khẩu không đúng.';
      case 'auth/email-already-in-use':
        return 'Email này đã được sử dụng cho một tài khoản khác.';
      case 'auth/weak-password':
        return 'Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn (ít nhất 6 ký tự).';
      case 'auth/invalid-email':
        return 'Địa chỉ email không hợp lệ.';
      case 'auth/too-many-requests':
          return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
          return 'Cửa sổ đăng nhập đã bị đóng. Vui lòng thử lại.';
      case 'auth/account-exists-with-different-credential':
          return 'Tài khoản đã tồn tại với một phương thức đăng nhập khác (ví dụ: mật khẩu). Vui lòng đăng nhập bằng phương thức đó.';
      default:
        console.error(err);
        return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.';
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await login(email, password);
      sessionStorage.removeItem('ptodo-is-guest');
      // No need to handle navigation, AuthContext will do it.
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Mật khẩu xác nhận không khớp.');
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await signup(email, password);
      // No need to handle navigation, AuthContext will do it. AuthContext handles guest data migration.
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
      setLoading(false);
    }
  };
  
  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await resetPassword(email);
      setMessage('Đã gửi liên kết khôi phục. Vui lòng kiểm tra email của bạn!');
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
        await loginWithGoogle();
        // Navigation is handled by AuthContext
    } catch (err: any) {
        setError(getFriendlyErrorMessage(err));
        setLoading(false);
    }
  };
  
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    handleResponse();
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };


  const renderForm = () => {
    switch (mode) {
      case 'register':
        return (
          <form onSubmit={handleRegister} className="space-y-4">
            <h2 className="text-2xl font-bold text-center text-white mb-1">Tạo tài khoản</h2>
            <p className="text-center text-slate-400 text-sm mb-6">Bắt đầu quản lý công việc của bạn.</p>
            <AuthInput icon={<Mail size={18} />} type="email" placeholder="Email" required value={email} onChange={(e: any) => setEmail(e.target.value)} disabled={loading} />
            <AuthInput icon={<Lock size={18} />} type="password" placeholder="Mật khẩu" required value={password} onChange={(e: any) => setPassword(e.target.value)} disabled={loading} />
            <AuthInput icon={<Lock size={18} />} type="password" placeholder="Xác nhận mật khẩu" required value={confirmPassword} onChange={(e: any) => setConfirmPassword(e.target.value)} disabled={loading} />
            <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : 'Đăng ký'}
            </button>
          </form>
        );
      case 'forgotPassword':
        return (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <h2 className="text-2xl font-bold text-center text-white mb-1">Quên mật khẩu</h2>
            <p className="text-center text-slate-400 text-sm mb-6">Chúng tôi sẽ gửi một liên kết khôi phục cho bạn.</p>
            <AuthInput icon={<Mail size={18} />} type="email" placeholder="Email của bạn" required value={email} onChange={(e: any) => setEmail(e.target.value)} disabled={loading} />
            <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : 'Gửi liên kết'}
            </button>
          </form>
        );
      case 'login':
      default:
        return (
          <form onSubmit={handleLogin} className="space-y-4">
            <h2 className="text-2xl font-bold text-center text-white mb-1">Chào mừng trở lại!</h2>
            <p className="text-center text-slate-400 text-sm mb-6">Đăng nhập để tiếp tục.</p>
            <AuthInput icon={<Mail size={18} />} type="email" placeholder="Email" required value={email} onChange={(e: any) => setEmail(e.target.value)} disabled={loading} />
            <AuthInput icon={<Lock size={18} />} type="password" placeholder="Mật khẩu" required value={password} onChange={(e: any) => setPassword(e.target.value)} disabled={loading} />
             <div className="text-right">
                <button type="button" onClick={() => switchMode('forgotPassword')} className="text-sm text-primary-400 hover:underline">
                  Quên mật khẩu?
                </button>
              </div>
            <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <><LogIn size={18} /><span>Đăng nhập</span></>}
            </button>
          </form>
        );
    }
  };

  const renderFooter = () => {
    switch (mode) {
      case 'register':
        return (
          <p>
            Đã có tài khoản?{' '}
            <button onClick={() => switchMode('login')} className="font-semibold text-primary-400 hover:underline">
              Đăng nhập
            </button>
          </p>
        );
       case 'forgotPassword':
        return (
           <p>
            Nhớ mật khẩu rồi?{' '}
            <button onClick={() => switchMode('login')} className="font-semibold text-primary-400 hover:underline">
              Quay lại đăng nhập
            </button>
          </p>
        );
      case 'login':
      default:
        return (
          <p>
            Chưa có tài khoản?{' '}
            <button onClick={() => switchMode('register')} className="font-semibold text-primary-400 hover:underline">
              Đăng ký ngay
            </button>
          </p>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-4">
      <div className="flex items-center mb-8">
          <div className="bg-primary-600 p-3 rounded-xl mr-4">
              <CheckSquare className="h-8 w-8 text-white" />
          </div>
          <div>
              <h1 className="text-3xl font-bold text-white">PTODO</h1>
              <p className="text-slate-400">Trình quản lý công việc cá nhân của bạn</p>
          </div>
      </div>
      <div className="w-full max-w-sm">
        <div className="bg-[#1E293B]/60 p-8 rounded-2xl shadow-lg border border-slate-700">
          {error && <p className="bg-red-900/50 border border-red-700 text-red-300 text-sm p-3 rounded-lg mb-4 text-center">{error}</p>}
          {message && <p className="bg-green-900/50 border border-green-700 text-green-300 text-sm p-3 rounded-lg mb-4 text-center">{message}</p>}
          {renderForm()}
          {mode !== 'forgotPassword' && (
            <>
                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-slate-600" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="bg-[#1E293B] px-2 text-slate-500">Hoặc</span>
                    </div>
                </div>
                <button 
                    type="button" 
                    onClick={handleGoogleLogin} 
                    className="w-full bg-white text-slate-700 hover:bg-slate-200 font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-3" 
                    disabled={loading}
                >
                    <GoogleIcon />
                    <span>{mode === 'login' ? 'Đăng nhập với Google' : 'Đăng ký với Google'}</span>
                </button>
            </>
          )}
        </div>
        <div className="text-center mt-6 text-slate-400 text-sm">
          {renderFooter()}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;