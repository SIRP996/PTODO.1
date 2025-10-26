import React from 'react';
import { CheckSquare, Zap, Users, BrainCircuit, Code, Database, Palette, BarChart, ArrowRight, Mic } from 'lucide-react';

interface LandingPageProps {
  onNavigateToAuth: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToAuth }) => {
  const navLinks = ['Giới thiệu', 'Công nghệ', 'Tính năng', 'Dashboard', 'Tầm nhìn'];

  return (
    <div className="bg-[#0F172A] text-slate-300 min-h-screen font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0F172A]/80 backdrop-blur-lg border-b border-slate-800">
        <nav className="max-w-7xl mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#4F46E5] p-2 rounded-lg">
              <CheckSquare className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">PTODO</h1>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <a key={link} href={`#${link.toLowerCase().replace(' ', '-')}`} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                {link}
              </a>
            ))}
          </div>
          <button
            onClick={onNavigateToAuth}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
          >
            Bắt đầu ngay
          </button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Hero Section */}
        <section id="giới-thiệu" className="text-center py-20">
          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4">
            Quản lý công việc. <span className="text-indigo-400">Tối ưu hiệu suất.</span>
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-slate-400 mb-8">
            PTODO là trình quản lý công việc thông minh, tích hợp AI để giúp bạn hoàn thành nhiều việc hơn với ít công sức hơn.
          </p>
          <button
            onClick={onNavigateToAuth}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-transform hover:scale-105"
          >
            Trải nghiệm miễn phí
          </button>
        </section>

        {/* Design Philosophy */}
        <section id="triết-lý-thiết-kế" className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">Triết lý thiết kế</h2>
            <p className="text-slate-500 mt-2">Nền tảng cho mọi trải nghiệm trên PTODO.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="bg-[#1E293B]/60 p-8 rounded-2xl border border-slate-800">
              <Palette size={40} className="mx-auto text-indigo-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Tối giản & Hiện đại</h3>
              <p className="text-slate-400">Giao diện dark mode chủ đạo, gọn gàng, không rườm rà, giúp bạn tập trung vào điều quan trọng nhất.</p>
            </div>
            <div className="bg-[#1E293B]/60 p-8 rounded-2xl border border-slate-800">
              <Users size={40} className="mx-auto text-indigo-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">UX là trung tâm</h3>
              <p className="text-slate-400">Giảm thiểu số lần nhấp chuột, mọi luồng thao tác đều được thiết kế để mượt mà và trực quan.</p>
            </div>
            <div className="bg-[#1E293B]/60 p-8 rounded-2xl border border-slate-800">
              <Zap size={40} className="mx-auto text-indigo-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Tự động & Thông minh</h3>
              <p className="text-slate-400">Giảm thiểu thao tác thủ công, để AI làm những công việc nặng nhọc, giải phóng thời gian cho bạn.</p>
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
              <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg">Frontend (React)</div>
              <ArrowRight className="text-slate-500" />
              <div className="bg-slate-700 px-4 py-2 rounded-lg">Backend (Firebase)</div>
              <ArrowRight className="text-slate-500" />
              <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg">AI (Gemini)</div>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-4">Công nghệ chính</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-[#1E293B]/60 p-4 rounded-lg border border-slate-800"><Code className="text-indigo-400" /><div><h4 className="font-semibold text-white">React + TypeScript</h4><p className="text-xs text-slate-500">Frontend</p></div></div>
                <div className="flex items-center gap-3 bg-[#1E293B]/60 p-4 rounded-lg border border-slate-800"><Palette className="text-indigo-400" /><div><h4 className="font-semibold text-white">Tailwind CSS</h4><p className="text-xs text-slate-500">UI/UX</p></div></div>
                <div className="flex items-center gap-3 bg-[#1E293B]/60 p-4 rounded-lg border border-slate-800"><Database className="text-indigo-400" /><div><h4 className="font-semibold text-white">Firebase</h4><p className="text-xs text-slate-500">Auth & Firestore</p></div></div>
                <div className="flex items-center gap-3 bg-[#1E293B]/60 p-4 rounded-lg border border-slate-800"><BrainCircuit className="text-indigo-400" /><div><h4 className="font-semibold text-white">Gemini API</h4><p className="text-xs text-slate-500">AI thông minh</p></div></div>
                <div className="flex items-center gap-3 bg-[#1E293B]/60 p-4 rounded-lg border border-slate-800"><BarChart className="text-indigo-400" /><div><h4 className="font-semibold text-white">Recharts</h4><p className="text-xs text-slate-500">Biểu đồ</p></div></div>
                <div className="flex items-center gap-3 bg-[#1E293B]/60 p-4 rounded-lg border border-slate-800"><Mic className="text-indigo-400" /><div><h4 className="font-semibold text-white">Web API</h4><p className="text-xs text-slate-500">Speech & Worker</p></div></div>
            </div>
          </div>
        </section>

        {/* Development Process */}
        <section id="tầm-nhìn" className="py-16">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-white">Quá trình phát triển</h2>
                <p className="text-slate-500 mt-2">Hành trình xây dựng và hoàn thiện PTODO.</p>
            </div>
            <div className="relative max-w-2xl mx-auto">
                {/* Timeline Line */}
                <div className="absolute left-4 top-0 h-full w-0.5 bg-slate-700"></div>
                
                <div className="relative pl-12 pb-12">
                    <div className="absolute left-0 top-0 h-8 w-8 bg-indigo-600 rounded-full border-4 border-[#0F172A] flex items-center justify-center text-white font-bold">1</div>
                    <h3 className="text-xl font-semibold text-white mb-1">Giai đoạn 1: Ý tưởng (Q1)</h3>
                    <p className="text-slate-400">Hình thành ý tưởng, nghiên cứu thị trường và xác định các tính năng cốt lõi.</p>
                </div>
                
                <div className="relative pl-12 pb-12">
                    <div className="absolute left-0 top-0 h-8 w-8 bg-indigo-600 rounded-full border-4 border-[#0F172A] flex items-center justify-center text-white font-bold">2</div>
                    <h3 className="text-xl font-semibold text-white mb-1">Giai đoạn 2: Phát triển (Q2-Q3)</h3>
                    <p className="text-slate-400">Xây dựng lõi ứng dụng, tích hợp Firebase & React, hoàn thiện giao diện người dùng.</p>
                </div>

                <div className="relative pl-12">
                    <div className="absolute left-0 top-0 h-8 w-8 bg-indigo-600 rounded-full border-4 border-[#0F172A] flex items-center justify-center text-white font-bold">3</div>
                    <h3 className="text-xl font-semibold text-white mb-1">Giai đoạn 3: Hoàn thiện (Q4)</h3>
                    <p className="text-slate-400">Tích hợp AI (Gemini), tối ưu UX, ra mắt Dashboard phân tích và triển khai ứng dụng.</p>
                </div>
            </div>
        </section>

      </main>
    </div>
  );
};

export default LandingPage;
