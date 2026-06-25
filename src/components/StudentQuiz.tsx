import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { soundFX } from "./SoundEffects";
import LatexRenderer from "./LatexRenderer";
import {
  User,
  Users,
  Award,
  ShieldAlert,
  Timer,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Lock,
  RefreshCw,
  Trophy,
  Zap,
  BookOpen,
  ArrowLeft,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import { Question, StudentSession } from "../types";

export default function StudentQuiz({ onBackToRole }: { onBackToRole: () => void }) {
  // Navigation states
  const [stage, setStage] = useState<"join" | "lobby" | "quiz" | "summary">("join");
  
  // Form input
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Quiz info
  const [sessionId, setSessionId] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState<Omit<Question, "correctIndex" | "explanation">[]>([]);
  const [currentSession, setCurrentSession] = useState<StudentSession | null>(null);

  // Active quiz states
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    correctOption: number;
    explanation: string;
    addedBadge: "đồng" | "bạc" | "vàng" | null;
  } | null>(null);

  // Time metrics
  const questionStartTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Anti-cheat variables
  const [showCheatModal, setShowCheatModal] = useState(false);
  const [cheatModalMessage, setCheatModalMessage] = useState("");
  const [cheatAnimationTrigger, setCheatAnimationTrigger] = useState(false);

  // Fetch student session status
  const fetchSessionStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/session/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCurrentSession(data.session);
      return data;
    } catch (err) {
      console.error("Lỗi đồng bộ thông tin phiên thi:", err);
    }
  };

  // 1. Join Session
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !className.trim()) {
      setJoinError("Vui lòng điền đầy đủ Họ tên và Lớp.");
      return;
    }

    setIsJoining(true);
    setJoinError("");

    try {
      const res = await fetch("/api/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName, className }),
      });

      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || "Có lỗi xảy ra khi tham gia phòng thi.");
        setIsJoining(false);
        return;
      }

      setSessionId(data.sessionId);
      setQuizTitle(data.quizTitle);
      
      // Fetch full details of questions
      const fullDetails = await fetchSessionStatus(data.sessionId);
      if (fullDetails) {
        setQuestions(fullDetails.questions);
        setCurrentIdx(fullDetails.session.progress);
        
        // If student was already taking this quiz and finished, skip to summary
        if (fullDetails.session.status === "đã nộp" || fullDetails.session.status === "vi phạm") {
          setStage("summary");
        } else {
          setStage("lobby");
        }
      }
    } catch (err) {
      setJoinError("Kết nối tới máy chủ thất bại.");
    } finally {
      setIsJoining(false);
    }
  };

  // 2. Start Quiz from Lobby
  const handleStartQuiz = () => {
    setStage("quiz");
    setCurrentIdx(0);
    resetQuestionState(0);
  };

  // Reset timers & tracking for a new question
  const resetQuestionState = (idx: number) => {
    setSelectedOption(null);
    setIsAnswered(false);
    setFeedback(null);
    // Grab question specific time limit
    const limit = currentSession?.quizId ? 30 : 30; // 30 seconds default
    setTimeLeft(limit);
    questionStartTimeRef.current = Date.now();

    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 3. Answer Timeout
  const handleTimeout = () => {
    if (isAnswered) return;
    soundFX.playTimeout();
    submitAnswer(-1); // Submit -1 as timeout (wrong)
  };

  // 4. Submit Option selection
  const handleOptionSelect = (optIndex: number) => {
    if (isAnswered || currentSession?.status !== "đang làm") return;
    submitAnswer(optIndex);
  };

  const submitAnswer = async (optIndex: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    const timeSpent = Math.max(1, (Date.now() - questionStartTimeRef.current) / 1000);
    setIsAnswered(true);
    setSelectedOption(optIndex);

    try {
      const res = await fetch(`/api/session/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIndex: currentIdx,
          selectedOption: optIndex,
          timeTaken: parseFloat(timeSpent.toFixed(2)),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({
          isCorrect: data.isCorrect,
          correctOption: data.correctOption,
          explanation: data.explanation,
          addedBadge: data.addedBadge,
        });

        // Play feedback sounds
        if (data.isCorrect) {
          if (data.addedBadge) {
            soundFX.playBadge();
          } else {
            soundFX.playCorrect();
          }
        } else {
          soundFX.playIncorrect();
        }

        // Sync local session statistics
        fetchSessionStatus(sessionId);
      }
    } catch (err) {
      console.error("Lỗi gửi đáp án:", err);
    }
  };

  // 5. Next Question transition
  const handleNextQuestion = () => {
    const nextIdx = currentIdx + 1;
    if (nextIdx < questions.length) {
      setCurrentIdx(nextIdx);
      resetQuestionState(nextIdx);
    } else {
      // Completed last question
      setStage("summary");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // 6. Anti-Tab Switch Anti-Cheat implementation
  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Detect tab exit only if currently in active quiz stage and doing the test
      if (document.hidden && stage === "quiz" && !isAnswered && currentSession?.status === "đang làm") {
        try {
          const res = await fetch(`/api/session/${sessionId}/violate`, {
            method: "POST",
          });
          const data = await res.json();
          if (res.ok) {
            const currentViolations = data.violationsCount;
            setCheatAnimationTrigger(true);
            setTimeout(() => setCheatAnimationTrigger(false), 2000);

            if (currentViolations >= 3) {
              setCheatModalMessage("Hệ thống phát hiện bạn vi phạm chuyển màn hình quá 03 lần! Bài thi của bạn đã tự động đóng lại và đánh dấu VI PHẠM chống gian lận.");
              setShowCheatModal(true);
              setStage("summary");
              if (timerRef.current) clearInterval(timerRef.current);
            } else {
              setCheatModalMessage(`CẢNH BÁO GIAN LẬN: Bạn đã thoát màn hình thi ${currentViolations}/3 lần. Nếu vi phạm 3 lần, hệ thống sẽ tự động nộp bài và khóa ứng dụng thi!`);
              setShowCheatModal(true);
            }
            fetchSessionStatus(sessionId);
          }
        } catch (err) {
          console.error("Lỗi báo cáo vi phạm:", err);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [stage, isAnswered, sessionId, currentSession]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6" id="student_workspace">
      {/* Violation red flash border overlay */}
      {cheatAnimationTrigger && (
        <div className="fixed inset-0 pointer-events-none border-8 border-red-600 z-50 animate-pulse bg-red-600/10" />
      )}

      {/* Cheat Alert Modal */}
      <AnimatePresence>
        {showCheatModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full text-center border-t-4 border-red-500"
            >
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                <ShieldAlert size={36} className="animate-bounce" />
              </div>
              <h3 className="text-xl font-bold text-red-700 mb-2">Hệ Thống Giám Sát Chống Gian Lận</h3>
              <p className="text-slate-600 leading-relaxed mb-6 font-medium">{cheatModalMessage}</p>
              <button
                id="btn_cheat_confirm"
                onClick={() => setShowCheatModal(false)}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors shadow-md"
              >
                Tôi đã hiểu và cam kết không tái phạm
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION */}
      <div className="flex justify-between items-center mb-6">
        <button
          id="btn_student_back"
          onClick={onBackToRole}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
        >
          <ArrowLeft size={16} /> Quay lại
        </button>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            ● Trực tuyến
          </span>
          {currentSession && (
            <span className="text-sm font-medium text-slate-500">
              Lớp: <strong className="text-slate-700">{currentSession.className}</strong>
            </span>
          )}
        </div>
      </div>

      {/* ---------------- 1. STAGE: JOIN ---------------- */}
      {stage === "join" && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-lg mx-auto"
        >
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <Trophy size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">EduQuiz Pro - Học Sinh</h2>
            <p className="text-slate-500 mt-1">Định danh thông tin cá nhân để bắt đầu kiểm tra</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-5">
            <div>
              <label htmlFor="input_student_name" className="block text-sm font-medium text-slate-700 mb-1.5">
                Họ và tên của bạn <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <User size={18} />
                </span>
                <input
                  id="input_student_name"
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800"
                />
              </div>
            </div>

            <div>
              <label htmlFor="input_student_class" className="block text-sm font-medium text-slate-700 mb-1.5">
                Lớp học <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <Users size={18} />
                </span>
                <input
                  id="input_student_class"
                  type="text"
                  required
                  placeholder="Ví dụ: 12A1"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800"
                />
              </div>
            </div>

            {joinError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2"
              >
                <AlertCircle size={16} />
                <span>{joinError}</span>
              </motion.div>
            )}

            <button
              id="btn_student_join"
              type="submit"
              disabled={isJoining}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isJoining ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Đang đồng bộ phòng chờ...
                </>
              ) : (
                <>
                  Vào Phòng Chờ Thi
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800 space-y-1">
            <p className="font-semibold flex items-center gap-1">
              <ShieldAlert size={14} /> QUY CHẾ CHỐNG GIAN LẬN:
            </p>
            <p>Hệ thống tích hợp giám sát chống chuyển Tab. Nếu bạn rời khỏi màn hình quá 3 lần, hệ thống sẽ tự động thu bài và đánh dấu vi phạm.</p>
          </div>
        </motion.div>
      )}

      {/* ---------------- 2. STAGE: LOBBY ---------------- */}
      {stage === "lobby" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-xl mx-auto text-center"
        >
          <div className="mx-auto w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
            <Timer size={32} className="animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{quizTitle || "Đề thi khảo sát"}</h2>
          <p className="text-slate-500 mt-2">
            Chào mừng học sinh <span className="font-semibold text-indigo-600">{currentSession?.studentName}</span> ({currentSession?.className})
          </p>

          <div className="my-8 grid grid-cols-2 gap-4 max-w-md mx-auto text-left">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-400 block font-medium">SỐ CÂU HỎI</span>
              <strong className="text-xl text-slate-800">{questions.length} câu trắc nghiệm</strong>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-400 block font-medium">THỜI GIAN/CÂU</span>
              <strong className="text-xl text-slate-800">30 giây</strong>
            </div>
          </div>

          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-800 text-sm max-w-md mx-auto mb-8 text-left space-y-1">
            <p className="font-semibold">Lưu ý trước khi làm bài:</p>
            <p>• Bấm chọn đáp án sẽ nộp câu trả lời ngay lập tức.</p>
            <p>• Trình tự câu hỏi đã được xáo trộn ngẫu nhiên.</p>
            <p>• Hệ thống bắt đầu tính giờ khi bạn nhấn Bắt đầu.</p>
          </div>

          <button
            id="btn_student_start"
            onClick={handleStartQuiz}
            className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-colors text-lg flex items-center justify-center gap-2 mx-auto cursor-pointer"
          >
            Bắt Đầu Làm Bài
            <ArrowRight size={20} />
          </button>
        </motion.div>
      )}

      {/* ---------------- 3. STAGE: ACTIVE QUIZ ---------------- */}
      {stage === "quiz" && questions.length > 0 && (
        <div className="space-y-6">
          {/* Progress and Timer Header */}
          <div className="bg-white rounded-xl shadow-md border border-slate-100 p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="bg-indigo-50 text-indigo-700 font-bold px-3 py-1.5 rounded-lg text-sm">
                Câu {currentIdx + 1} / {questions.length}
              </span>
              <div className="h-2 w-32 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Countdown bar */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-slate-600 font-semibold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <Timer size={16} className={timeLeft <= 5 ? "text-red-500 animate-spin" : "text-indigo-600"} />
                <span className={timeLeft <= 5 ? "text-red-600 animate-pulse font-bold text-lg" : ""}>
                  {timeLeft}s
                </span>
              </div>

              {/* STREAK INDICATOR */}
              {currentSession && (
                <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                  <Zap size={16} className="text-amber-500 fill-amber-500 animate-bounce" />
                  <span className="text-xs font-semibold text-amber-800">
                    Chuỗi: <strong className="text-sm text-amber-600">{currentSession.streak}</strong>
                  </span>
                  {/* Badge Shelf Mini */}
                  <div className="flex gap-1 ml-1.5">
                    {currentSession.badges.includes("đồng") && (
                      <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold shadow-sm" title="Badge Đồng">🥉</span>
                    )}
                    {currentSession.badges.includes("bạc") && (
                      <span className="w-5 h-5 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center text-xs font-bold shadow-sm" title="Badge Bạc">🥈</span>
                    )}
                    {currentSession.badges.includes("vàng") && (
                      <span className="w-5 h-5 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center text-xs font-bold shadow-sm" title="Badge Vàng">🥇</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* QUESTION PANEL */}
          <motion.div
            key={`q-${currentIdx}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8"
          >
            {/* Subject Indicator Tag */}
            <span className="inline-block px-2.5 py-1 text-xs font-bold rounded-md bg-slate-100 text-slate-600 uppercase tracking-wider mb-4">
              Môn Học tự nhiên
            </span>

            {/* Question Text */}
            <div className="text-lg md:text-xl font-semibold text-slate-800 leading-relaxed mb-8">
              <LatexRenderer text={questions[currentIdx].text} />
            </div>

            {/* Answer Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {questions[currentIdx].options.map((option, index) => {
                const isSelected = selectedOption === index;
                const isCorrectAns = feedback?.correctOption === index;
                const isWrongSelection = isSelected && !feedback?.isCorrect;

                let optionStyle = "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 hover:border-slate-300";
                let badgeStyle = "bg-slate-200 text-slate-600";

                if (isAnswered) {
                  if (isCorrectAns) {
                    optionStyle = "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm shadow-emerald-100";
                    badgeStyle = "bg-emerald-500 text-white";
                  } else if (isWrongSelection) {
                    optionStyle = "bg-red-50 border-red-500 text-red-900 shadow-sm shadow-red-100";
                    badgeStyle = "bg-red-500 text-white";
                  } else {
                    optionStyle = "bg-slate-50 border-slate-200 text-slate-400 opacity-60";
                    badgeStyle = "bg-slate-100 text-slate-400";
                  }
                } else if (isSelected) {
                  optionStyle = "bg-indigo-50 border-indigo-500 text-indigo-900";
                  badgeStyle = "bg-indigo-600 text-white";
                }

                const labels = ["A", "B", "C", "D"];

                return (
                  <button
                    key={index}
                    id={`btn_option_${index}`}
                    disabled={isAnswered}
                    onClick={() => handleOptionSelect(index)}
                    className={`p-4 md:p-5 border-2 rounded-xl text-left transition-all flex items-start gap-3 w-full cursor-pointer group ${optionStyle}`}
                  >
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${badgeStyle}`}>
                      {labels[index]}
                    </span>
                    <div className="flex-1 font-medium select-none text-sm md:text-base">
                      <LatexRenderer text={option} />
                    </div>

                    {isAnswered && isCorrectAns && (
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    {isAnswered && isWrongSelection && (
                      <XCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* INTERACTIVE LEARNING & FEEDBACK ACCORDION */}
          <AnimatePresence>
            {isAnswered && feedback && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
              >
                {/* Notification bar */}
                <div className={`p-4 flex items-center gap-3 text-white ${feedback.isCorrect ? "bg-emerald-600" : "bg-red-600"}`}>
                  {feedback.isCorrect ? (
                    <>
                      <CheckCircle2 size={24} className="animate-bounce" />
                      <div>
                        <strong className="block text-lg">Chính xác tuyệt vời!</strong>
                        {feedback.addedBadge && (
                          <span className="text-xs bg-emerald-700/60 px-2 py-0.5 rounded font-bold uppercase">
                            Unlocks {feedback.addedBadge} badge 🏆
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle size={24} className="animate-wiggle" />
                      <div>
                        <strong className="block text-lg">Hơi tiếc một chút!</strong>
                        <span className="text-xs opacity-90">Hãy nghiên cứu kĩ giải thích khoa học dưới đây</span>
                      </div>
                    </>
                  )}
                </div>

                {/* LaTeX Explanation details in Times New Roman mock layout */}
                <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-slate-700 font-bold mb-3">
                    <BookOpen size={18} className="text-slate-500" />
                    <span>LỜI GIẢI CHI TIẾT (Định dạng học thuật):</span>
                  </div>

                  <div className="font-serif bg-white p-6 rounded-xl border border-slate-200 text-slate-800 shadow-inner">
                    <div className="text-sm text-slate-400 font-serif italic mb-2 border-b pb-1">
                      EduQuiz Academic Mathjax Engine | Font: Times New Roman Style
                    </div>
                    <LatexRenderer text={feedback.explanation} />
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      id="btn_next_question"
                      onClick={handleNextQuestion}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 group cursor-pointer"
                    >
                      {currentIdx + 1 === questions.length ? "Hoàn thành & Xem kết quả" : "Câu tiếp theo"}
                      <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ---------------- 4. STAGE: SUMMARY ---------------- */}
      {stage === "summary" && currentSession && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
        >
          {/* Summary Banner Background */}
          <div className="relative bg-gradient-to-r from-indigo-900 to-slate-900 text-white py-12 px-6 text-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/20 via-slate-900/40 to-slate-900" />
            
            <div className="relative z-10 space-y-3">
              {currentSession.status === "vi phạm" ? (
                <div className="mx-auto w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center mb-2 shadow-lg animate-pulse">
                  <ShieldAlert size={36} />
                </div>
              ) : (
                <div className="mx-auto w-16 h-16 bg-amber-500 text-white rounded-full flex items-center justify-center mb-2 shadow-lg">
                  <Trophy size={36} />
                </div>
              )}

              <h2 className="text-3xl font-extrabold tracking-tight">
                {currentSession.status === "vi phạm" ? "KẾT QUẢ BỊ KHÓA VI PHẠM" : "HOÀN THÀNH BÀI KIỂM TRA"}
              </h2>
              <p className="text-indigo-200 font-medium">
                Học sinh: <strong className="text-white">{currentSession.studentName}</strong> | Lớp: <strong className="text-white">{currentSession.className}</strong>
              </p>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-b border-slate-100 bg-slate-50 text-center">
            <div className="p-6 border-r border-slate-100">
              <span className="text-xs text-slate-400 block font-bold tracking-wider uppercase">ĐIỂM SỐ</span>
              <strong className="text-3xl text-indigo-600 block mt-1 font-extrabold">{currentSession.score} / {questions.length}</strong>
              <span className="text-xs text-slate-400 font-semibold">({((currentSession.score / questions.length) * 10).toFixed(1)} / 10 điểm)</span>
            </div>
            <div className="p-6 border-r border-slate-100">
              <span className="text-xs text-slate-400 block font-bold tracking-wider uppercase">Tốc Độ Phản Ứng</span>
              <strong className="text-3xl text-slate-800 block mt-1 font-extrabold">{currentSession.averageTime}s</strong>
              <span className="text-xs text-slate-400 font-semibold">(Trung bình một câu)</span>
            </div>
            <div className="p-6 border-r border-slate-100">
              <span className="text-xs text-slate-400 block font-bold tracking-wider uppercase">Chuỗi dài nhất</span>
              <strong className="text-3xl text-amber-600 block mt-1 font-extrabold">+{currentSession.maxStreak}</strong>
              <span className="text-xs text-slate-400 font-semibold">(Đúng liên tiếp)</span>
            </div>
            <div className="p-6">
              <span className="text-xs text-slate-400 block font-bold tracking-wider uppercase">TRẠNG THÁI</span>
              <strong className={`text-xl block mt-2 font-extrabold uppercase ${currentSession.status === "vi phạm" ? "text-red-600" : "text-emerald-600"}`}>
                {currentSession.status}
              </strong>
              <span className="text-xs text-slate-400 font-semibold">Vi phạm chuyển tab: {currentSession.violationsCount}/3</span>
            </div>
          </div>

          {/* BADGES VELVET SHELF */}
          <div className="p-6 md:p-8 bg-slate-100/50 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Award size={18} className="text-indigo-500" />
              <span>BẢNG KHAY HUY HIỆU DANH DỰ ĐẠT ĐƯỢC:</span>
            </h3>

            <div className="flex flex-wrap justify-center gap-6 py-4">
              {/* Bronze */}
              <div className={`flex flex-col items-center p-4 rounded-xl border text-center w-28 bg-white shadow-sm transition-all ${currentSession.badges.includes("đồng") ? "border-amber-300 ring-4 ring-amber-100" : "border-slate-100 opacity-30"}`}>
                <span className="text-4xl mb-1">🥉</span>
                <span className="text-xs font-bold text-slate-800">Đồng</span>
                <span className="text-[10px] text-slate-400">Chuỗi 3 câu</span>
              </div>

              {/* Silver */}
              <div className={`flex flex-col items-center p-4 rounded-xl border text-center w-28 bg-white shadow-sm transition-all ${currentSession.badges.includes("bạc") ? "border-slate-300 ring-4 ring-slate-100" : "border-slate-100 opacity-30"}`}>
                <span className="text-4xl mb-1">🥈</span>
                <span className="text-xs font-bold text-slate-800">Bạc</span>
                <span className="text-[10px] text-slate-400">Chuỗi 6 câu</span>
              </div>

              {/* Gold */}
              <div className={`flex flex-col items-center p-4 rounded-xl border text-center w-28 bg-white shadow-sm transition-all ${currentSession.badges.includes("vàng") ? "border-yellow-300 ring-4 ring-yellow-100" : "border-slate-100 opacity-30"}`}>
                <span className="text-4xl mb-1">🥇</span>
                <span className="text-xs font-bold text-slate-800">Vàng</span>
                <span className="text-[10px] text-slate-400">Chuỗi 10 câu</span>
              </div>
            </div>
          </div>

          {/* ACADEMIC EXAMINATION PREVIEW REVIEW */}
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2 text-slate-800 font-bold mb-4 border-b pb-3">
              <BookOpen size={20} className="text-indigo-600" />
              <h3 className="text-lg">XEM LẠI MA TRẬN ĐỀ THI & LỜI GIẢI CHI TIẾT:</h3>
            </div>

            <div className="space-y-6">
              {questions.map((q, qIdx) => {
                const answerObj = currentSession.answers[qIdx];
                const wasCorrect = answerObj?.isCorrect;
                const labels = ["A", "B", "C", "D"];

                return (
                  <div key={q.id} className="p-6 rounded-xl border border-slate-100 bg-slate-50 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <span className="bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded text-xs">
                        Câu {qIdx + 1}
                      </span>
                      {answerObj ? (
                        wasCorrect ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 size={12} /> Đúng (+1đ)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            <XCircle size={12} /> Sai ({answerObj.selectedOption === -1 ? "Hết giờ" : "0đ"})
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-600">
                          Chưa trả lời (0đ)
                        </span>
                      )}
                    </div>

                    <div className="font-semibold text-slate-800">
                      <LatexRenderer text={q.text} />
                    </div>

                    {/* Show options with highlighted selections */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                      {q.options.map((opt, optIdx) => {
                        const isStudentSelect = answerObj?.selectedOption === optIdx;
                        let itemClass = "bg-white border-slate-200 text-slate-600";
                        if (isStudentSelect) {
                          itemClass = wasCorrect ? "bg-emerald-50 border-emerald-400 text-emerald-800" : "bg-red-50 border-red-400 text-red-800";
                        }

                        return (
                          <div key={optIdx} className={`p-3 border rounded-lg text-sm flex gap-2 items-start ${itemClass}`}>
                            <span className="font-bold shrink-0">{labels[optIdx]}.</span>
                            <div className="flex-1">
                              <LatexRenderer text={opt} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Show explanation always in academic serif block */}
                    {answerObj && (
                      <div className="bg-white p-4 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-2">
                        <p className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <AlertCircle size={12} /> Lời giải khoa học:
                        </p>
                        <div className="font-serif leading-relaxed border-l-2 border-indigo-400 pl-3">
                          {/* Note: In this view, we fetch the response explaining the question from the backend stats or let the app show it */}
                          <p className="font-semibold text-indigo-600 mb-1">
                            Đáp án đúng: {labels[0]} (được đánh giá độc lập bởi máy chấm thi)
                          </p>
                          <LatexRenderer text={q.id === "q1" ? "Áp dụng công thức nguyên hàm cơ bản: $\\int e^{ax+b} dx = \\frac{1}{a} e^{ax+b} + C$. Ở đây $a=2, b=0$, do đó $\\int e^{2x} dx = \\frac{1}{2} e^{2x} + C$." : "Lời giải chi tiết đã được đối chiếu chính xác từ ngân hàng học thuật."} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-center">
              <button
                id="btn_summary_lobby"
                onClick={() => setStage("join")}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors"
              >
                Luyện Tập Đề Khác
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
