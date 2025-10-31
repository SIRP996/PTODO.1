import React, { useState } from 'react';
import { 
  CheckSquare, Zap, Users, BrainCircuit, Code, Database, Palette, BarChart, ArrowRight, Mic, 
  Target, Settings, Sparkles, TrendingUp, BarChart2, Server, Gamepad2
} from 'lucide-react';

interface LandingPageProps {
  onNavigateToAuth: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToAuth }) => {
  const navLinks = ['Giới thiệu', 'Tính năng', 'Dashboard', 'Công nghệ', 'Lộ trình'];
  const [activeTab, setActiveTab] = useState('cot-loi');

  const featureGroups = [
    {
      id: 'cot-loi',
      name: 'Cốt lõi',
      icon: <Database size={20} />,
      title: 'Nhóm 1: Quản lý công việc cốt lõi',
      description: 'Các tính năng nền tảng cho mọi quy trình làm việc, tối ưu cho thao tác nhanh gọn và hiệu suất cao.',
      features: ['Đăng nhập / Đăng ký (Firebase Auth)', 'Thêm / Sửa / Xóa công việc', 'Đánh dấu hoàn thành (Toggle complete)', 'Gắn cờ "Khẩn cấp" (Urgent flag)', 'Subtasks (Công việc con)'],
    },
    {
      id: 'to-chuc',
      name: 'Tổ chức',
      icon: <Settings size={20} />,
      title: 'Nhóm 2: Tổ chức thông minh',
      description: 'Giúp phân loại và tìm kiếm công việc dễ dàng, nhóm việc linh hoạt để không bao giờ lạc mất nhiệm vụ.',
      features: ['Hashtags (ví dụ: #dựán, #họp, #cánhân)', 'Lọc công việc theo thẻ (Filter by tags)', 'Lọc theo trạng thái (Đã xong / Chưa xong)', 'Công việc lặp lại (Recurring tasks)'],
    },
    {
      id: 'ai',
      name: 'AI',
      icon: <Sparkles size={20} />,
      title: 'Nhóm 3: AI & Trí tuệ nhân tạo',
      description: 'Trái tim của PTODO – giúp bạn "Think Less". AI hiểu bạn như một trợ lý thật sự, giảm 90% thời gian nhập liệu.',
      features: ['Hiểu ngôn ngữ tự nhiên (NLP)', 'Chia nhỏ công việc bằng AI (Đề xuất subtasks)', 'Nhập liệu bằng giọng nói (Voice Input)'],
    },
    {
      id: 'hieu-suat',
      name: 'Hiệu suất',
      icon: <TrendingUp size={20} />,
      title: 'Nhóm 4: Tăng cường hiệu suất',
      description: 'Các công cụ giúp bạn tập trung tối đa, không xao nhãng và làm việc hiệu quả trên mọi thiết bị.',
      features: ['Focus Mode (Pomodoro 25 phút)', 'Nhắc nhở thông minh (Push notification)', 'Dark Mode (Chủ đạo, bảo vệ mắt)', 'Responsive UI (Desktop, Tablet, Mobile)'],
    },
    {
      id: 'phan-tich',
      name: 'Phân tích',
      icon: <BarChart2 size={20} />,
      title: 'Nhóm 5: Dashboard & Phân tích dữ liệu',
      description: 'Giúp bạn "Do More" bằng cách hiểu rõ hiệu suất của mình. Nhìn rõ tiến độ, thấy rõ kết quả để cải thiện mỗi ngày.',
      features: ['Dashboard tổng quan (Overview)', 'Theo dõi hiệu suất hôm nay', 'Streak (Chuỗi ngày hoàn thành công việc)', 'Biểu đồ theo thẻ / tuần / tháng', 'Heatmap hoạt động', 'Cá nhân hóa'],
    },
    {
      id: 'du-lieu',
      name: 'Dữ liệu',
      icon: <Server size={20} />,
      title: 'Nhóm 6: Quản lý dữ liệu & Tích hợp',
      description: 'Kết nối PTODO với các công cụ khác của bạn. Dữ liệu của bạn luôn an toàn, được đồng bộ và sao lưu thông minh.',
      features: ['Xuất file CSV (Sao lưu thủ công)', 'Đồng bộ Google Sheets (Tự động cập nhật)', 'Quản lý API Key (Gemini)'],
    },
  ];

  return (
    <div className="bg-[#0F172A] text-slate-300 min-h-screen font-sans scroll-smooth">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0F172A]/80 backdrop-blur-lg border-b border-slate-800">
        <nav className="max-w-7xl mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary-600 p-2 rounded-lg">
              <CheckSquare className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">PTODO</h1>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <a key={link} href={`#${link.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                {link}
              </a>
            ))}
          </div>
          <button
            onClick={onNavigateToAuth}
            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
          >
            Bắt đầu ngay
          </button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Hero Section */}
        <section id="giới-thiệu" className="text-center py-20">
          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4">
            PTODO
          </h1>
          <p className="text-2xl md:text-3xl font-medium text-slate-300 mb-4">Trình Quản Lý Công Việc Cá Nhân Thông Minh</p>
          <p className="text-4xl md:text-5xl font-bold text-primary-400 mb-8">
            Think Less. Do More.
          </p>
          <button
            onClick={onNavigateToAuth}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-transform hover:scale-105"
          >
            Trải nghiệm miễn phí
          </button>
        </section>

        {/* Problem & Solution Section */}
        <section id="vấn-đề" className="py-16">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#1E293B]/60 p-8 rounded-2xl border border-red-800/50">
                <h3 className="text-2xl font-bold text-red-400 mb-4">Vấn đề hiện nay</h3>
                <p className="text-lg text-slate-400 mb-4 font-semibold">"Người dùng ngày nay quá tải vì phải nhớ quá nhiều việc."</p>
                <ul className="list-disc list-inside space-y-2 text-slate-400">
                    <li>Ghi chú rời rạc, các ứng dụng to-do nhàm chán, thiếu gợi ý thông minh.</li>
                    <li>Thiếu công cụ hỗ trợ phân tích hiệu suất cá nhân để cải thiện.</li>
                </ul>
            </div>
            <div className="bg-[#1E293B]/60 p-8 rounded-2xl border border-green-800/50">
                <h3 className="text-2xl font-bold text-green-400 mb-4">Giải pháp của PTODO</h3>
                <p className="text-lg text-slate-400 mb-4 font-semibold">"Một trợ lý công việc thông minh, tích hợp AI toàn diện."</p>
                 <ul className="list-disc list-inside space-y-2 text-slate-400">
                    <li>Tự động hiểu, sắp xếp, nhắc nhở và phân tích công việc của bạn.</li>
                    <li>Giúp bạn thực sự làm ít hơn nhưng đạt hiệu quả cao hơn.</li>
                </ul>
            </div>
          </div>
        </section>

        {/* Design Philosophy Section */}
        <section className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">Triết lý thiết kế</h2>
            <p className="text-slate-500 mt-2">Nền tảng cho mọi trải nghiệm trên PTODO.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#1E293B]/60 p-8 rounded-2xl border border-slate-800 text-center">
              <div className="flex justify-center mb-4">
                  <div className="bg-primary-600/20 p-3 rounded-full">
                      <Gamepad2 size={24} className="text-primary-400" />
                  </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Tối giản & Hiện đại</h3>
              <p className="text-slate-400">Giao diện dark mode chủ đạo, gọn gàng, không rườm rà, giúp bạn tập trung vào điều quan trọng nhất.</p>
            </div>
            <div className="bg-[#1E293B]/60 p-8 rounded-2xl border border-slate-800 text-center">
              <div className="flex justify-center mb-4">
                  <div className="bg-primary-600/20 p-3 rounded-full">
                      <Users size={24} className="text-primary-400" />
                  </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">UX là trung tâm</h3>
              <p className="text-slate-400">Giảm thiểu số lần nhấp chuột, mọi luồng thao tác đều được thiết kế để mượt mà và trực quan.</p>
            </div>
            <div className="bg-[#1E293B]/60 p-8 rounded-2xl border border-slate-800 text-center">
              <div className="flex justify-center mb-4">
                  <div className="bg-primary-600/20 p-3 rounded-full">
                      <Zap size={24} className="text-primary-400" />
                  </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Tự động & Thông minh</h3>
              <p className="text-slate-400">Giảm thiểu thao tác thủ công, để AI làm những công việc nặng nhọc, giải phóng thời gian cho bạn.</p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="tính-năng" className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">26 Tính năng nổi bật</h2>
            <p className="text-slate-500 mt-2">Được chia thành 6 nhóm chức năng chính, giúp bạn làm chủ mọi công việc.</p>
          </div>
          <div className="bg-[#1E293B]/60 p-2 rounded-2xl border border-slate-800 max-w-4xl mx-auto">
            <div className="flex flex-wrap justify-center gap-1">
              {featureGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => setActiveTab(group.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-colors duration-200 ${
                    activeTab === group.id ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {group.icon}
                  <span>{group.name}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 p-6">
              {featureGroups.map(group => (
                activeTab === group.id && (
                  <div key={group.id} className="animate-fadeIn">
                    <h3 className="text-2xl font-bold text-white mb-2">{group.title}</h3>
                    <p className="text-slate-400 mb-6">{group.description}</p>
                    <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                      {group.features.map(feature => (
                        <li key={feature} className="flex items-start gap-3">
                          <CheckSquare className="h-5 w-5 mt-1 text-primary-400 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              ))}
            </div>
          </div>
        </section>

        {/* Dashboard Section */}
        <section id="dashboard" className="py-16">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-white">Dashboard & Phân tích Trực quan</h2>
                <p className="text-slate-500 mt-2">Hiểu rõ hiệu suất của bạn để cải thiện mỗi ngày.</p>
            </div>
            <div className="bg-[#1E293B]/60 p-6 rounded-2xl border border-slate-800">
                <p className="text-center text-slate-400 mb-4">Đây là hình ảnh minh họa cho dashboard phân tích mạnh mẽ trong ứng dụng, giúp bạn theo dõi tiến độ, chuỗi ngày làm việc, và hơn thế nữa.</p>
                <div className="aspect-video bg-slate-900/50 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-700 p-4">
                  <svg viewBox="0 0 500 281.25" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full object-contain rounded-md">
                      <defs>
                          <style>
                              {`
                              .bar {
                                  animation: bar-pulse 2.5s ease-in-out infinite;
                              }
                              @keyframes bar-pulse {
                                  0%, 100% { transform: scaleY(1); }
                                  50% { transform: scaleY(0.8); }
                              }
                              .donut-arc {
                                  animation: donut-rotate 10s linear infinite;
                                  transform-origin: 50px 45px;
                              }
                              @keyframes donut-rotate {
                                  from { transform: rotate(0deg); }
                                  to { transform: rotate(360deg); }
                              }
                              .text-fade {
                                  animation: fade-in-out 3s ease-in-out infinite;
                              }
                              @keyframes fade-in-out {
                                  0%, 100% { opacity: 0.7; }
                                  50% { opacity: 1; }
                              }
                              `}
                          </style>
                      </defs>

                      {/* Main Backgrounds */}
                      <rect width="500" height="281.25" rx="12" fill="#1E293B"/>
                      <rect x="12" y="12" width="120" height="257.25" rx="8" fill="#293548"/>
                      <rect x="144" y="12" width="344" height="257.25" rx="8" fill="#293548"/>

                      {/* Left Panel Content */}
                      <text x="22" y="34" fontFamily="Be Vietnam Pro, sans-serif" fontSize="10" fontWeight="bold" fill="#E2E8F0">Tiến độ tuần</text>
                      <rect x="22" y="44" width="100" height="8" rx="4" fill="#334155"/>
                      <rect x="22" y="44" width="75" height="8" rx="4" fill="var(--color-primary-600)"/>
                      <text x="22" y="68" fontFamily="Be Vietnam Pro, sans-serif" fontSize="9" fill="#94A3B8">Task A</text>
                      <rect x="22" y="75" width="100" height="6" rx="3" fill="#334155"/>
                      <text x="22" y="98" fontFamily="Be Vietnam Pro, sans-serif" fontSize="9" fill="#94A3B8">Task B</text>
                      <rect x="22" y="105" width="80" height="6" rx="3" fill="#334155"/>

                      {/* Main Panel Title */}
                      <rect x="156" y="24" width="150" height="10" rx="5" fill="#334155"/>

                      {/* Top Cards with numbers */}
                      <g transform="translate(156, 48)">
                          <rect width="100" height="60" rx="6" fill="#1E293B"/>
                          <text x="10" y="22" fontFamily="Be Vietnam Pro, sans-serif" fontSize="8" fill="#94A3B8">Hoàn thành</text>
                          <text x="10" y="45" fontFamily="Be Vietnam Pro, sans-serif" fontSize="20" fontWeight="bold" fill="var(--color-primary-500)">12</text>
                      </g>
                      <g transform="translate(268, 48)">
                          <rect width="100" height="60" rx="6" fill="#1E293B"/>
                          <text x="10" y="22" fontFamily="Be Vietnam Pro, sans-serif" fontSize="8" fill="#94A3B8">Đang chờ</text>
                          <text x="10" y="45" fontFamily="Be Vietnam Pro, sans-serif" fontSize="20" fontWeight="bold" fill="var(--color-primary-400)">8</text>
                      </g>
                      <g transform="translate(380, 48)">
                          <rect width="100" height="60" rx="6" fill="#1E293B"/>
                          <text x="10" y="22" fontFamily="Be Vietnam Pro, sans-serif" fontSize="8" fill="#94A3B8">Quá hạn</text>
                          <text x="10" y="45" fontFamily="Be Vietnam Pro, sans-serif" fontSize="20" fontWeight="bold" fill="#a78bfa">3</text>
                      </g>

                      {/* Bar Chart */}
                      <g transform="translate(156, 120)">
                          <rect width="210" height="137.25" rx="6" fill="#1E293B"/>
                          <text x="10" y="22" fontFamily="Be Vietnam Pro, sans-serif" fontSize="10" fontWeight="bold" fill="#E2E8F0">Phân tích Tuần</text>
                          <g>
                              <rect className="bar" style={{animationDelay: '0s', transformOrigin: '20px 127.25px'}} x="10" y="107.25" width="20" height="20" rx="2" fill="var(--color-primary-600)"/>
                              <rect className="bar" style={{animationDelay: '0.2s', transformOrigin: '50px 127.25px'}} x="40" y="77.25" width="20" height="50" rx="2" fill="var(--color-primary-600)"/>
                              <rect className="bar" style={{animationDelay: '0.4s', transformOrigin: '80px 127.25px'}} x="70" y="92.25" width="20" height="35" rx="2" fill="var(--color-primary-500)"/>
                              <rect className="bar" style={{animationDelay: '0.6s', transformOrigin: '110px 127.25px'}} x="100" y="57.25" width="20" height="70" rx="2" fill="var(--color-primary-600)"/>
                              <rect className="bar" style={{animationDelay: '0.8s', transformOrigin: '140px 127.25px'}} x="130" y="87.25" width="20" height="40" rx="2" fill="var(--color-primary-500)"/>
                              <rect className="bar" style={{animationDelay: '1s', transformOrigin: '170px 127.25px'}} x="160" y="27.25" width="20" height="100" rx="2" fill="var(--color-primary-400)"/>
                          </g>
                          <line x1="5" y1="127.25" x2="205" y2="127.25" stroke="#334155" strokeWidth="2"/>
                      </g>
                      
                      {/* Donut Chart */}
                      <g transform="translate(378, 120)">
                          <rect width="100" height="137.25" rx="6" fill="#1E293B"/>
                          <g className="donut-arc">
                              <circle cx="50" cy="45" r="30" fill="none" stroke="#334155" strokeWidth="8"/>
                              <circle cx="50" cy="45" r="30" fill="none" stroke="var(--color-primary-600)" strokeWidth="8" strokeDasharray="141.4 188.5" transform="rotate(-90 50 45)"/>
                          </g>
                          <text className="text-fade" x="50" y="45.5" textAnchor="middle" dominantBaseline="middle" fontFamily="Be Vietnam Pro, sans-serif" fontSize="20" fontWeight="bold" fill="#E2E8F0">75%</text>
                          <text x="50" y="95" textAnchor="middle" fontFamily="Be Vietnam Pro, sans-serif" fontSize="10" fontWeight="bold" fill="#E2E8F0">Tiến độ</text>
                          <rect x="10" y="110" width="80" height="6" rx="3" fill="#334155"/>
                          <rect x="10" y="120" width="60" height="6" rx="3" fill="#334155"/>
                      </g>
                  </svg>
                </div>
            </div>
        </section>

        {/* Architecture and Tech */}
        <section id="công-nghệ" className="py-16 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl font-bold text-white mb-4">Kiến trúc & Công nghệ</h2>
            <p className="text-slate-400 mb-8">Nền tảng vững chắc và hiện đại xây dựng nên PTODO.</p>
            <h3 className="text-xl font-semibold text-white mb-4">Kiến trúc tổng thể</h3>
            <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
              <div className="bg-slate-700 px-4 py-2 rounded-lg">Người dùng</div>
              <ArrowRight className="text-slate-500" />
              <div className="bg-primary-600 text-white px-4 py-2 rounded-lg">Frontend (React)</div>
              <ArrowRight className="text-slate-500" />
              <div className="bg-slate-700 px-4 py-2 rounded-lg">Backend (Firebase)</div>
              <ArrowRight className="text-slate-500" />
              <div className="bg-primary-600 text-white px-4 py-2 rounded-lg">AI (Gemini)</div>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-4">Công nghệ chính</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-[#1E293B]/60 p-4 rounded-lg border border-slate-800"><Code className="text-primary-400" /><div><h4 className="font-semibold text-white">React + TypeScript</h4><p className="text-xs text-slate-500">Frontend</p></div></div>
                <div className="flex items-center gap-3 bg-[#1E293B]/60 p-4 rounded-lg border border-slate-800"><Palette className="text-primary-400" /><div><h4 className="font-semibold text-white">Tailwind CSS</h4><p className="text-xs text-slate-500">UI/UX</p></div></div>
                <div className="flex items-center gap-3 bg-[#1E293B]/60 p-4 rounded-lg border border-slate-800"><Database className="text-primary-400" /><div><h4 className="font-semibold text-white">Firebase</h4><p className="text-xs text-slate-500">Auth & Firestore</p></div></div>
                <div className="flex items-center gap-3 bg-[#1E293B]/60 p-4 rounded-lg border border-slate-800"><BrainCircuit className="text-primary-400" /><div><h4 className="font-semibold text-white">Gemini API</h4><p className="text-xs text-slate-500">AI thông minh</p></div></div>
                <div className="flex items-center gap-3 bg-[#1E293B]/60 p-4 rounded-lg border border-slate-800"><BarChart className="text-primary-400" /><div><h4 className="font-semibold text-white">Recharts</h4><p className="text-xs text-slate-500">Biểu đồ</p></div></div>
                <div className="flex items-center gap-3 bg-[#1E293B]/60 p-4 rounded-lg border border-slate-800"><Mic className="text-primary-400" /><div><h4 className="font-semibold text-white">Web API</h4><p className="text-xs text-slate-500">Speech & Worker</p></div></div>
            </div>
          </div>
        </section>

        {/* Development Roadmap */}
        <section id="lộ-trình" className="py-16">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-white">Lộ trình phát triển</h2>
                <p className="text-slate-500 mt-2">Từ trợ lý công việc đến trợ lý cá nhân toàn diện.</p>
            </div>
            <div className="relative max-w-2xl mx-auto">
                <div className="absolute left-4 top-0 h-full w-0.5 bg-slate-700"></div>
                
                <div className="relative pl-12 pb-12">
                    <div className="absolute left-0 top-0 h-8 w-8 bg-primary-600 rounded-full border-4 border-[#0F172A] flex items-center justify-center"><Target size={16} className="text-white"/></div>
                    <h3 className="text-xl font-semibold text-white mb-1">2025 (Hiện tại)</h3>
                    <p className="text-slate-400">Hoàn thiện 26 tính năng cốt lõi, tập trung tối ưu hóa hiệu năng, AI và trải nghiệm người dùng.</p>
                </div>
                
                <div className="relative pl-12 pb-12">
                     <div className="absolute left-0 top-0 h-8 w-8 bg-slate-600 rounded-full border-4 border-[#0F172A]"></div>
                    <h3 className="text-xl font-semibold text-white mb-1">2026 (Ngắn hạn)</h3>
                    <p className="text-slate-400">Tích hợp sâu với Lịch (Google Calendar) và Email (Gmail) để quản lý mọi thứ ở một nơi duy nhất.</p>
                </div>

                <div className="relative pl-12">
                    <div className="absolute left-0 top-0 h-8 w-8 bg-slate-600 rounded-full border-4 border-[#0F172A]"></div>
                    <h3 className="text-xl font-semibold text-white mb-1">Tương lai (Dài hạn)</h3>
                    <p className="text-slate-400">Phát triển AI Voice Chat cho phép trò chuyện và ra lệnh, mở API cho các doanh nghiệp nhỏ và đội nhóm.</p>
                </div>
            </div>
        </section>

      </main>
      
      <footer className="border-t border-slate-800 mt-16">
        <div className="max-w-7xl mx-auto text-center py-8 px-4">
            <p className="text-slate-500">&copy; {new Date().getFullYear()} PTODO Project. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;