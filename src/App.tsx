import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import StudentQuiz from "./components/StudentQuiz";
import TeacherDashboard from "./components/TeacherDashboard";
import {
  Trophy,
  Users,
  GraduationCap,
  Sparkles,
  Award,
  Clock,
  ShieldCheck,
  BookOpen,
  Settings,
  Eye,
  EyeOff,
  ExternalLink,
  Lock,
  X,
  Key
} from "lucide-react";

export default function App() {
  const [role, setRole] = useState<null | "student" | "teacher">(null);
  
  // Custom API Key & Model Configuration States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem("gemini_user_api_key") || "");
  const [userModel, setUserModel] = useState(() => localStorage.getItem("gemini_user_model") || "gemini-3-flash-preview");
  const [showKey, setShowKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(userApiKey);
  const [tempModel, setTempModel] = useState(userModel);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Force settings modal if no key is configured yet
  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_user_api_key");
    if (!savedKey) {
      setIsSettingsOpen(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans transition-colors duration-300">
      {/* Background Grid Pattern Accent */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none opacity-40" />

      {/* Global Header */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm relative">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setRole(null)}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <Sparkles size={16} />
          </div>
          <span className="font-black text-slate-800 tracking-tight text-lg">
            EduQuiz <span className="text-indigo-600">Pro</span>
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <a 
            href="https://aistudio.google.com/api-keys" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-[10px] sm:text-xs text-red-600 font-bold hover:underline"
          >
            Lấy API key để sử dụng app
          </a>
          
          <button
            onClick={() => {
              setTempApiKey(userApiKey);
              setTempModel(userModel);
              setIsSettingsOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-lg transition-colors cursor-pointer"
          >
            <Settings size={14} />
            <span className="hidden xs:inline">Cài đặt API</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative flex-1 flex flex-col justify-center py-10 z-10">
        <AnimatePresence mode="wait">
          {role === null && (
            <motion.div
              key="portal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-4xl mx-auto px-4"
            >
              {/* Brand Header */}
              <div className="text-center mb-12 space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-extrabold uppercase tracking-wider shadow-sm animate-pulse">
                  <Sparkles size={14} /> EdTech Gamification Platform
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-800">
                  EduQuiz <span className="text-indigo-600">Pro</span>
                </h1>
                <p className="text-slate-500 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
                  Hệ thống trò chơi trắc nghiệm tương tác thông minh kết hợp các yếu tố Gamification, số hóa bóc tách đề bằng AI & OCR, cùng giải thuật xáo trộn đề ngẫu nhiên.
                </p>
              </div>

              {/* Portal Roles Selection cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* 1. STUDENT CARD */}
                <button
                  id="btn_portal_student"
                  onClick={() => setRole("student")}
                  className="bg-white rounded-2xl border border-slate-100 hover:border-indigo-400 p-8 text-left transition-all duration-300 shadow-sm hover:shadow-xl group flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm duration-300">
                      <GraduationCap size={28} />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        Màn hình Học Sinh
                      </h2>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        Tham gia làm bài thi tương tác trực tuyến, trải nghiệm chuỗi Streak tăng tốc, tích lũy Badge danh dự đồng/bạc/vàng và học tập qua lời giải LaTeX chi tiết.
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-50 flex items-center gap-1.5 text-xs font-bold text-indigo-600 group-hover:gap-3 transition-all duration-300">
                    Bắt đầu thi cử công bằng <span className="text-base">&rarr;</span>
                  </div>
                </button>

                {/* 2. TEACHER CARD */}
                <button
                  id="btn_portal_teacher"
                  onClick={() => setRole("teacher")}
                  className="bg-white rounded-2xl border border-slate-100 hover:border-indigo-400 p-8 text-left transition-all duration-300 shadow-sm hover:shadow-xl group flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm duration-300">
                      <Users size={28} />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        Màn hình Giáo Viên
                      </h2>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        Theo dõi live tiến trình thi real-time, số hóa bóc tách các file chụp bài thi LaTeX qua AI OCR, phân tích biểu đồ phổ điểm hình chuông, và xuất file Excel chuẩn Bộ Giáo dục.
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-50 flex items-center gap-1.5 text-xs font-bold text-indigo-600 group-hover:gap-3 transition-all duration-300">
                    Quản trị lớp học thông minh <span className="text-base">&rarr;</span>
                  </div>
                </button>
              </div>

              {/* Bottom Feature trust highlights */}
              <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto text-center border-t border-slate-200 pt-8">
                <div className="space-y-1 flex flex-col items-center">
                  <ShieldCheck className="text-indigo-500 w-5 h-5 mb-1" />
                  <h4 className="text-xs font-bold text-slate-700">Chống gian lận tuyệt đối</h4>
                  <p className="text-[10px] text-slate-400 max-w-[200px]">Cảnh báo và tự động nộp bài khi cố tình chuyển đổi Tab thi.</p>
                </div>
                <div className="space-y-1 flex flex-col items-center">
                  <Clock className="text-indigo-500 w-5 h-5 mb-1" />
                  <h4 className="text-xs font-bold text-slate-700">Hệ thống Real-time</h4>
                  <p className="text-[10px] text-slate-400 max-w-[200px]">Giám sát thời gian thực tiến trình, tốc độ và kết quả lớp học.</p>
                </div>
                <div className="space-y-1 flex flex-col items-center">
                  <BookOpen className="text-indigo-500 w-5 h-5 mb-1" />
                  <h4 className="text-xs font-bold text-slate-700">LaTeX học thuật</h4>
                  <p className="text-[10px] text-slate-400 max-w-[200px]">Mọi công thức toán học, vật lý, hóa học hiển thị sắc nét, chuẩn quy chuẩn khoa học.</p>
                </div>
              </div>
            </motion.div>
          )}

          {role === "student" && (
            <motion.div
              key="student_screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <StudentQuiz onBackToRole={() => setRole(null)} />
            </motion.div>
          )}

          {role === "teacher" && (
            <motion.div
              key="teacher_screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TeacherDashboard onBackToRole={() => setRole(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Academic Standard Footer */}
      <footer className="py-6 border-t border-slate-200 text-center text-[10px] text-slate-400 relative z-10 bg-white">
        &copy; 2026 EduQuiz Pro - Hệ thống trò chơi trắc nghiệm khoa học tự nhiên. Bản quyền thuộc về Bộ phận Số hóa Giáo dục THPT.
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden relative z-50"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock size={18} className="text-indigo-400" />
                  <h3 className="font-extrabold text-sm sm:text-base">Thiết lập Model & API Key</h3>
                </div>
                {!localStorage.getItem("gemini_user_api_key") ? null : (
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    Cấu hình này được lưu trực tiếp trên trình duyệt cá nhân của bạn (<code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-[10px]">localStorage</code>) và không gửi lên máy chủ lưu trữ.
                  </p>
                  <p className="text-xs text-red-500 font-bold flex flex-wrap items-center gap-1 mt-1">
                    <span>⚠️ Bạn phải tự cung cấp API Key để sử dụng app.</span>
                    <a 
                      href="https://aistudio.google.com/api-keys" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="underline text-indigo-600 hover:text-indigo-700 font-extrabold flex items-center gap-0.5"
                    >
                      Nhấp vào đây để lấy API key miễn phí <ExternalLink size={10} />
                    </a>
                  </p>
                </div>

                {/* API Key Input */}
                <div className="space-y-1.5">
                  <label htmlFor="modal_api_key_input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Google Gemini API Key
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 text-slate-400 pointer-events-none">
                      <Key size={16} />
                    </div>
                    <input
                      id="modal_api_key_input"
                      type={showKey ? "text" : "password"}
                      value={tempApiKey}
                      onChange={(e) => {
                        setTempApiKey(e.target.value);
                        setSaveSuccess(false);
                      }}
                      placeholder="Nhập khóa API (AIzaSy...)"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none"
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Model cards */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Lựa chọn Model AI mặc định
                  </label>
                  <div className="grid grid-cols-1 gap-2.5">
                    {/* Card 1: gemini-3-flash-preview */}
                    <button
                      onClick={() => {
                        setTempModel("gemini-3-flash-preview");
                        setSaveSuccess(false);
                      }}
                      className={`flex items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${tempModel === "gemini-3-flash-preview" ? "border-indigo-600 bg-indigo-50/40 shadow-sm" : "border-slate-100 hover:border-slate-300"}`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 mr-3 ${tempModel === "gemini-3-flash-preview" ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>
                        {tempModel === "gemini-3-flash-preview" && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">gemini-3-flash-preview</span>
                          <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full font-bold text-[8px] uppercase">Mặc định</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Mô hình thế hệ mới nhất, tốc độ cực nhanh, bóc tách LaTeX mượt mà.</p>
                      </div>
                    </button>

                    {/* Card 2: gemini-3-pro-preview */}
                    <button
                      onClick={() => {
                        setTempModel("gemini-3-pro-preview");
                        setSaveSuccess(false);
                      }}
                      className={`flex items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${tempModel === "gemini-3-pro-preview" ? "border-indigo-600 bg-indigo-50/40 shadow-sm" : "border-slate-100 hover:border-slate-300"}`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 mr-3 ${tempModel === "gemini-3-pro-preview" ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>
                        {tempModel === "gemini-3-pro-preview" && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">gemini-3-pro-preview</span>
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded-full font-bold text-[8px] uppercase">Cao cấp</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Khả năng suy luận logic toán học phức tạp, phân tích chuyên sâu.</p>
                      </div>
                    </button>

                    {/* Card 3: gemini-2.5-flash */}
                    <button
                      onClick={() => {
                        setTempModel("gemini-2.5-flash");
                        setSaveSuccess(false);
                      }}
                      className={`flex items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${tempModel === "gemini-2.5-flash" ? "border-indigo-600 bg-indigo-50/40 shadow-sm" : "border-slate-100 hover:border-slate-300"}`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 mr-3 ${tempModel === "gemini-2.5-flash" ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>
                        {tempModel === "gemini-2.5-flash" && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">gemini-2.5-flash</span>
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded-full font-bold text-[8px] uppercase">Ổn định</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Hoạt động ổn định, dự phòng hiệu quả khi các bản preview quá tải.</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Status indicator / messages */}
                {saveSuccess && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold rounded-lg text-center animate-bounce">
                    ✓ Cấu hình đã được lưu thành công!
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  {!localStorage.getItem("gemini_user_api_key") ? (
                    <button
                      onClick={() => {
                        if (!tempApiKey.trim()) {
                          alert("Vui lòng nhập API Key để bắt đầu sử dụng ứng dụng!");
                          return;
                        }
                        localStorage.setItem("gemini_user_api_key", tempApiKey.trim());
                        localStorage.setItem("gemini_user_model", tempModel);
                        setUserApiKey(tempApiKey.trim());
                        setUserModel(tempModel);
                        setSaveSuccess(true);
                        setTimeout(() => {
                          setIsSettingsOpen(false);
                          setSaveSuccess(false);
                        }, 800);
                      }}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm cursor-pointer shadow-md transition-colors text-center animate-pulse"
                    >
                      Lưu và Bắt Đầu Sử Dụng App
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsSettingsOpen(false)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm cursor-pointer transition-colors"
                      >
                        Đóng
                      </button>
                      <button
                        onClick={() => {
                          if (!tempApiKey.trim()) {
                            alert("Vui lòng nhập API Key!");
                            return;
                          }
                          localStorage.setItem("gemini_user_api_key", tempApiKey.trim());
                          localStorage.setItem("gemini_user_model", tempModel);
                          setUserApiKey(tempApiKey.trim());
                          setUserModel(tempModel);
                          setSaveSuccess(true);
                          setTimeout(() => {
                            setSaveSuccess(false);
                          }, 2000);
                        }}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm cursor-pointer shadow-md transition-colors"
                      >
                        Lưu cấu hình
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
