import React, { useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import {
  Sparkles,
  Search,
  Upload,
  RefreshCw,
  Users,
  Award,
  ShieldAlert,
  FileSpreadsheet,
  Clock,
  BookOpen,
  Trash2,
  ListRestart,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  FileText,
  TrendingUp,
  Sliders,
  ChevronRight,
  AlertTriangle,
  Save,
  Check,
  X,
  Edit3,
  Key,
  Eye,
  EyeOff
} from "lucide-react";
import LatexRenderer from "./LatexRenderer";
import { DashboardStats, StudentSession } from "../types";

export default function TeacherDashboard({ onBackToRole }: { onBackToRole: () => void }) {
  // Tabs
  const [activeTab, setActiveTab] = useState<"monitor" | "ai_setup" | "reports" | "api_keys">("monitor");

  // API Key state
  const [apiKeyStatus, setApiKeyStatus] = useState<any>(null);
  const [rawKey, setRawKey] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [keysMessage, setKeysMessage] = useState("");
  const [isSavingKeys, setIsSavingKeys] = useState(false);
  const [isResettingKeys, setIsResettingKeys] = useState(false);
  const [rotationLogs, setRotationLogs] = useState<string[]>([]);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // AI Setup form
  const [topic, setTopic] = useState("");
  const [teacherName, setTeacherName] = useState("Thầy Phạm Dũng Lê Hoàng Chiêu");
  const [timeLimit, setTimeLimit] = useState("30");
  const [docText, setDocText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorMessage, setGeneratorMessage] = useState("");
  const [generatorSuccess, setGeneratorSuccess] = useState<any>(null);

  // Draft Quiz editor states
  const [draftQuiz, setDraftQuiz] = useState<any>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [generatorWarning, setGeneratorWarning] = useState("");

  // Live monitor states
  const [activeQuiz, setActiveQuiz] = useState<{ title: string; questionCount: number } | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step Statuses for AI digitalized extraction
  const [stepStatuses, setStepStatuses] = useState<
    { title: string; status: "idle" | "loading" | "success" | "failed"; error?: string }[]
  >([
    { title: "Bước 1: Bóc tách & Trích xuất câu hỏi từ tài liệu", status: "idle" },
    { title: "Bước 2: Chuẩn hóa công thức khoa học sang LaTeX", status: "idle" },
    { title: "Bước 3: Tạo giải thích chi tiết & Đáp án", status: "idle" }
  ]);

  // Polling logic
  const fetchDashboardData = async () => {
    try {
      const res = await fetch("/api/teacher/stats");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActiveQuiz(data.activeQuiz);
      setStats(data.stats);
      setStudentsList(data.students);
    } catch (err) {
      console.error("Lỗi cập nhật dữ liệu giám sát:", err);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        setApiKeyStatus(data.key || null);
        if (data.rawKey) {
          setRawKey(data.rawKey);
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải API Key:", err);
    }
  };

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingKeys(true);
    setKeysMessage("");
    try {
      const res = await fetch("/api/keys/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: rawKey }),
      });
      
      let data: any = {};
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { error: text.slice(0, 150) || `Lỗi Server (Mã: ${res.status})` };
      }

      if (res.ok) {
        setApiKeyStatus(data.key);
        setKeysMessage("✓ Đã lưu cấu hình API Key thành công!");
        setTimeout(() => setKeysMessage(""), 4000);
      } else {
        throw new Error(data.error || "Gặp lỗi khi lưu API key.");
      }
    } catch (err: any) {
      setKeysMessage(`Lỗi: ${err.message}`);
    } finally {
      setIsSavingKeys(false);
    }
  };

  const handleResetKeysStatus = async () => {
    setIsResettingKeys(true);
    setKeysMessage("");
    try {
      const res = await fetch("/api/keys/reset", { method: "POST" });
      
      let data: any = {};
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { error: text.slice(0, 150) || `Lỗi Server (Mã: ${res.status})` };
      }

      if (res.ok) {
        setApiKeyStatus(data.key);
        setKeysMessage("✓ Đã đặt lại trạng thái hoạt động cho API Key.");
        setTimeout(() => setKeysMessage(""), 4000);
      } else {
        throw new Error(data.error || "Lỗi đặt lại trạng thái.");
      }
    } catch (err: any) {
      setKeysMessage(`Lỗi: ${err.message}`);
    } finally {
      setIsResettingKeys(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchApiKeys(); // Load API keys on mount
    let interval: NodeJS.Timeout | null = null;
    if (isPolling) {
      interval = setInterval(fetchDashboardData, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPolling]);

  // Handle Drag-and-Drop / Upload
  const processFile = (file: File) => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    const isImage = fileType.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
    const isPdf = fileType === "application/pdf" || fileName.endsWith(".pdf");
    const isDocx = fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.endsWith(".docx");

    if (!isImage && !isPdf && !isDocx) {
      alert("Vui lòng tải lên file định dạng hình ảnh (PNG, JPG, JPEG), file Word (.docx) hoặc file PDF để quét số hóa.");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const clearUploadedImage = () => {
    setImageFile(null);
    setImageBase64("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Submit AI generation
  const handleAIGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGeneratorSuccess(null);
    setDraftQuiz(null);
    setRotationLogs([]);
    setGeneratorWarning("");

    const userKey = localStorage.getItem("gemini_user_api_key") || "";
    const userModel = localStorage.getItem("gemini_user_model") || "gemini-3-flash-preview";

    const baseHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (userKey) {
      baseHeaders["x-api-key"] = userKey;
    }

    const currentStatuses = [
      { title: "Bước 1: Bóc tách & Trích xuất câu hỏi từ tài liệu", status: "loading" as const },
      { title: "Bước 2: Chuẩn hóa công thức khoa học sang LaTeX", status: "idle" as const },
      { title: "Bước 3: Tạo giải thích chi tiết & Đáp án", status: "idle" as const }
    ];
    setStepStatuses([...currentStatuses]);
    setGeneratorMessage("Đang tiến hành bóc tách tài liệu (Bước 1)...");

    let step1Questions: any[] = [];
    let step2Questions: any[] = [];

    // Step 1: Bóc tách & Trích xuất câu hỏi thô
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({
          topic,
          teacherName,
          timeLimit,
          docText,
          base64Image: imageBase64 || null,
          model: userModel,
          step: 1
        }),
      });

      let data: any = {};
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { error: text.slice(0, 150) || `Lỗi kết nối Server (Mã: ${res.status})` };
      }

      if (!res.ok) {
        throw new Error(data.error || "Lỗi bóc tách tài liệu.");
      }

      if (data.isFallback) {
        // Fallback triggered early
        setDraftQuiz(data.quiz);
        setGeneratorWarning(data.warning);
        currentStatuses[0].status = "success";
        currentStatuses[1].status = "success";
        currentStatuses[2].status = "success";
        setStepStatuses([...currentStatuses]);
        setGeneratorMessage("");
        fetchApiKeys();
        setIsGenerating(false);
        setTimeout(() => {
          const el = document.getElementById("draft_review_section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 300);
        return;
      }

      step1Questions = data.questions || [];
      if (data.rotationLogs) {
        setRotationLogs(prev => [...prev, ...data.rotationLogs]);
      }

      currentStatuses[0].status = "success";
      currentStatuses[1].status = "loading";
      setStepStatuses([...currentStatuses]);
      setGeneratorMessage("Đang chuyển đổi công thức sang định dạng LaTeX (Bước 2)...");
    } catch (err: any) {
      const errorMsg = err.message || "Lỗi chưa xác định ở Bước 1.";
      currentStatuses[0].status = "failed";
      currentStatuses[0].error = errorMsg;
      currentStatuses[1].status = "failed";
      currentStatuses[1].error = "Đã dừng do lỗi";
      currentStatuses[2].status = "failed";
      currentStatuses[2].error = "Đã dừng do lỗi";
      setStepStatuses([...currentStatuses]);
      setGeneratorMessage(`Thất bại: ${errorMsg}`);
      fetchApiKeys();
      setIsGenerating(false);
      return;
    }

    // Step 2: Chuẩn hóa công thức khoa học sang LaTeX
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({
          model: userModel,
          step: 2,
          questions: step1Questions
        }),
      });

      let data: any = {};
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { error: text.slice(0, 150) || `Lỗi kết nối Server (Mã: ${res.status})` };
      }

      if (!res.ok) {
        throw new Error(data.error || "Lỗi chuẩn hóa LaTeX.");
      }

      step2Questions = data.questions || [];
      if (data.rotationLogs) {
        setRotationLogs(prev => [...prev, ...data.rotationLogs]);
      }

      currentStatuses[1].status = "success";
      currentStatuses[2].status = "loading";
      setStepStatuses([...currentStatuses]);
      setGeneratorMessage("Đang xây dựng lời giải sư phạm và đáp án chi tiết (Bước 3)...");
    } catch (err: any) {
      const errorMsg = err.message || "Lỗi chưa xác định ở Bước 2.";
      currentStatuses[1].status = "failed";
      currentStatuses[1].error = errorMsg;
      currentStatuses[2].status = "failed";
      currentStatuses[2].error = "Đã dừng do lỗi";
      setStepStatuses([...currentStatuses]);
      setGeneratorMessage(`Thất bại: ${errorMsg}`);
      fetchApiKeys();
      setIsGenerating(false);
      return;
    }

    // Step 3: Tạo giải thích chi tiết & Đáp án
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({
          topic,
          teacherName,
          timeLimit,
          model: userModel,
          step: 3,
          questions: step2Questions
        }),
      });

      let data: any = {};
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { error: text.slice(0, 150) || `Lỗi kết nối Server (Mã: ${res.status})` };
      }

      if (!res.ok) {
        throw new Error(data.error || "Lỗi tạo lời giải chi tiết.");
      }

      setDraftQuiz(data.quiz);
      if (data.rotationLogs) {
        setRotationLogs(prev => [...prev, ...data.rotationLogs]);
      }

      currentStatuses[2].status = "success";
      setStepStatuses([...currentStatuses]);
      setGeneratorMessage("");
      fetchApiKeys();
      setTimeout(() => {
        const el = document.getElementById("draft_review_section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 300);
    } catch (err: any) {
      const errorMsg = err.message || "Lỗi chưa xác định ở Bước 3.";
      currentStatuses[2].status = "failed";
      currentStatuses[2].error = errorMsg;
      setStepStatuses([...currentStatuses]);
      setGeneratorMessage(`Thất bại: ${errorMsg}`);
      fetchApiKeys();
    } finally {
      setIsGenerating(false);
    }
  };

  // Cập nhật thông tin chung của đề nháp
  const handleUpdateDraftMeta = (key: string, value: any) => {
    if (!draftQuiz) return;
    setDraftQuiz({
      ...draftQuiz,
      [key]: value
    });
  };

  // Cập nhật câu hỏi cụ thể trong đề nháp
  const handleUpdateDraftQuestion = (questionIndex: number, field: string, value: any) => {
    if (!draftQuiz) return;
    const updatedQuestions = [...draftQuiz.questions];
    updatedQuestions[questionIndex] = {
      ...updatedQuestions[questionIndex],
      [field]: value
    };
    setDraftQuiz({
      ...draftQuiz,
      questions: updatedQuestions
    });
  };

  // Cập nhật đáp án cụ thể của một câu hỏi trong đề nháp
  const handleUpdateDraftOption = (questionIndex: number, optionIndex: number, value: string) => {
    if (!draftQuiz) return;
    const updatedQuestions = [...draftQuiz.questions];
    const updatedOptions = [...updatedQuestions[questionIndex].options];
    updatedOptions[optionIndex] = value;
    updatedQuestions[questionIndex] = {
      ...updatedQuestions[questionIndex],
      options: updatedOptions
    };
    setDraftQuiz({
      ...draftQuiz,
      questions: updatedQuestions
    });
  };

  // Thêm một câu hỏi mới vào đề nháp
  const handleAddDraftQuestion = () => {
    if (!draftQuiz) return;
    const newQuestion = {
      id: `custom_q_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      text: "Nhập câu hỏi mới tại đây (ví dụ: Tính tích phân $I = \\int_0^1 x dx$)",
      options: [
        "Đáp án A",
        "Đáp án B",
        "Đáp án C",
        "Đáp án D"
      ],
      correctIndex: 0,
      explanation: "Lời giải chi tiết tại đây."
    };
    setDraftQuiz({
      ...draftQuiz,
      questions: [...draftQuiz.questions, newQuestion]
    });
  };

  // Xóa câu hỏi khỏi đề nháp
  const handleRemoveDraftQuestion = (index: number) => {
    if (!draftQuiz) return;
    if (draftQuiz.questions.length <= 1) {
      alert("Đề thi phải có ít nhất 1 câu hỏi.");
      return;
    }
    const updatedQuestions = draftQuiz.questions.filter((_: any, idx: number) => idx !== index);
    setDraftQuiz({
      ...draftQuiz,
      questions: updatedQuestions
    });
  };

  // Lưu câu hỏi cá nhân từ DraftQuestionCard
  const handleSaveDraftQuestion = (index: number, updatedQuestion: any) => {
    if (!draftQuiz) return;
    const updatedQuestions = [...draftQuiz.questions];
    updatedQuestions[index] = updatedQuestion;
    setDraftQuiz({
      ...draftQuiz,
      questions: updatedQuestions
    });
  };

  // Gửi đề thi đã chỉnh sửa và phê duyệt lên server để phát hành chính thức
  const handlePublishQuiz = async () => {
    if (!draftQuiz) return;
    if (!confirm(`Bạn có chắc chắn muốn phát hành đề thi "${draftQuiz.title}" chính thức? Việc này sẽ xóa hết toàn bộ tiến trình thi hiện tại của học sinh!`)) {
      return;
    }

    setIsPublishing(true);
    setPublishMessage("Đang gửi đề thi đã duyệt lên server và làm sạch phòng thi...");

    try {
      const res = await fetch("/api/quiz/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftQuiz),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gặp lỗi khi phát hành đề thi.");
      }

      setGeneratorSuccess(data.quiz);
      setDraftQuiz(null); // Phát hành thành công thì đóng trình duyệt nháp
      setPublishMessage("");
      setActiveTab("monitor"); // Chuyển về màn hình live monitor để giáo viên bắt đầu giám sát
      fetchDashboardData(); // Đồng bộ dữ liệu mới nhất
    } catch (err: any) {
      setPublishMessage(`Lỗi phát hành: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Reset all student sessions
  const handleResetSessions = async () => {
    if (!confirm("Hệ thống sẽ xóa sạch toàn bộ danh sách và điểm số của học sinh hiện tại để bắt đầu thi đợt mới. Bạn có chắc chắn?")) return;
    setIsResetting(true);
    try {
      const res = await fetch("/api/teacher/reset", { method: "POST" });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsResetting(false);
    }
  };

  // Export to Excel / CSV standard format for MoET
  const handleExportToExcel = () => {
    if (studentsList.length === 0) {
      alert("Không có dữ liệu học sinh để xuất bảng điểm.");
      return;
    }

    const quizTitleStr = activeQuiz?.title || "De_Thi_EduQuiz_Pro";
    const dateStr = new Date().toLocaleDateString("vi-VN");

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Include BOM for Vietnamese accent rendering in Excel
    csvContent += "SỞ GIÁO DỤC VÀ ĐÀO TẠO,TRƯỜNG THPT CHUYÊN ĐÀO TẠO SỐ HÓA\n";
    csvContent += "BẢNG ĐIỂM CHI TIẾT BÀI KIỂM TRA TRẮC NGHIỆM TƯƠNG TÁC (EDUQUIZ PRO)\n";
    csvContent += `Tên đề kiểm tra,${quizTitleStr}\n`;
    csvContent += `Giáo viên chủ trì,${teacherName}\n`;
    csvContent += `Ngày xuất bảng điểm,${dateStr}\n\n`;

    csvContent += "STT,Họ và tên học sinh,Lớp học,Số câu trả lời đúng,Điểm số (Thang 10),Thời gian trả lời trung bình (giây),Huy hiệu,Trạng thái\n";

    studentsList.forEach((st, idx) => {
      const scoreScale10 = ((st.score / (activeQuiz?.questionCount || 12)) * 10).toFixed(1);
      const badgesStr = st.badges.join(" - ") || "Chưa đạt";
      csvContent += `${idx + 1},"${st.studentName}","${st.className}",${st.score},${scoreScale10},${st.averageTime},"${badgesStr}","${st.status}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bảng_Điểm_EduQuiz_${quizTitleStr.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportDocx = async () => {
    if (!activeQuiz) {
      alert("Không có đề thi nào đang hoạt động để tải.");
      return;
    }
    setIsExportingDocx(true);
    try {
      const res = await fetch("/api/quiz/export-docx");
      if (!res.ok) {
        throw new Error("Không thể xuất đề thi sang Word.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const safeTitle = activeQuiz.title.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9\s-]/g, "").replace(/\s+/g, "_");
      link.download = `De_Thi_${safeTitle}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Lỗi khi tải đề thi Word: " + err.message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6" id="teacher_workspace">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-md">
            Hội đồng giáo viên
          </span>
          <h2 className="text-2xl font-black text-slate-800 mt-1">Hệ Thống Quản Trị & Giám Sát Real-Time</h2>
          <p className="text-sm text-slate-400 mt-0.5">Quản lý ngân hàng đề, số hóa tài liệu AI & theo dõi phòng thi trực tiếp</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn_teacher_reset"
            onClick={handleResetSessions}
            disabled={isResetting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors border border-slate-200 cursor-pointer"
          >
            <ListRestart size={16} /> Làm sạch phòng thi
          </button>
          <button
            id="btn_back_role"
            onClick={onBackToRole}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md transition-colors cursor-pointer"
          >
            Trang Chủ
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-200 mb-6 gap-2 flex-wrap">
        <button
          id="tab_monitor"
          onClick={() => setActiveTab("monitor")}
          className={`px-5 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 cursor-pointer ${activeTab === "monitor" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          <Users size={16} /> Live Monitor (Phòng Thi)
        </button>
        <button
          id="tab_ai_setup"
          onClick={() => setActiveTab("ai_setup")}
          className={`px-5 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 cursor-pointer ${activeTab === "ai_setup" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          <Sparkles size={16} /> Soạn đề AI & OCR Quét ảnh
        </button>
        <button
          id="tab_reports"
          onClick={() => setActiveTab("reports")}
          className={`px-5 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 cursor-pointer ${activeTab === "reports" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          <TrendingUp size={16} /> Báo cáo & Phổ điểm
        </button>
        <button
          id="tab_api_keys"
          onClick={() => setActiveTab("api_keys")}
          className={`px-5 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 cursor-pointer ${activeTab === "api_keys" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          <Key size={16} /> Cấu hình API Keys
        </button>
      </div>

      {/* ----------------- TAB: LIVE MONITOR ----------------- */}
      {activeTab === "monitor" && (
        <div className="space-y-6">
          {/* Active Quiz Banner */}
          <div className="p-5 bg-gradient-to-r from-slate-800 to-indigo-900 rounded-2xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-200 bg-indigo-500/30 px-2 py-0.5 rounded">
                Đề kiểm tra hiện hoạt
              </span>
              <h3 className="text-lg font-bold mt-1">{activeQuiz?.title || "Chưa có tiêu đề đề thi"}</h3>
              <p className="text-xs text-indigo-200 mt-0.5">Số câu hỏi: {activeQuiz?.questionCount || 0} câu | Thời gian/câu: 30s</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold bg-white/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full bg-emerald-400 ${isPolling ? "animate-ping" : ""}`} />
                {isPolling ? "Đang lắng nghe trực tuyến..." : "Tạm ngắt đồng bộ"}
              </span>
              <button
                id="btn_toggle_poll"
                onClick={() => setIsPolling(!isPolling)}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                title={isPolling ? "Dừng đồng bộ real-time" : "Bật đồng bộ real-time"}
              >
                <RefreshCw size={16} className={isPolling ? "animate-spin" : ""} />
              </button>
              <button
                onClick={handleExportDocx}
                disabled={isExportingDocx}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-lg shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Tải đề thi về dạng Word (.docx) chuẩn Bộ GD&ĐT"
              >
                {isExportingDocx ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
                Xuất Đề Thi (.docx)
              </button>
            </div>
          </div>

          {/* Core Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <Users size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-400 block font-semibold">TỔNG SỐ HỌC SINH</span>
                <strong className="text-2xl text-slate-800 font-extrabold">{stats?.totalStudents || 0}</strong>
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <CheckCircle size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-400 block font-semibold">ĐÃ HOÀN THÀNH</span>
                <strong className="text-2xl text-slate-800 font-extrabold">{stats?.completedCount || 0}</strong>
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
                <ShieldAlert size={24} className={stats?.violationCount && stats.violationCount > 0 ? "animate-bounce text-red-500" : ""} />
              </div>
              <div>
                <span className="text-xs text-slate-400 block font-semibold">VI PHẠM GIAN LẬN</span>
                <strong className="text-2xl text-red-600 font-extrabold">{stats?.violationCount || 0}</strong>
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                <Award size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-400 block font-semibold">ĐIỂM TRUNG BÌNH LỚP</span>
                <strong className="text-2xl text-slate-800 font-extrabold">
                  {stats?.averageClassScore !== undefined ? `${stats.averageClassScore}/${activeQuiz?.questionCount || 12}` : "0"}
                </strong>
              </div>
            </div>
          </div>

          {/* Monitoring Table Grid */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="font-extrabold text-slate-800">DANH SÁCH GIÁM SÁT TRỰC TIẾP HỌC SINH</h4>
              <button
                id="btn_export_excel"
                onClick={handleExportToExcel}
                className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow transition-colors cursor-pointer"
              >
                <FileSpreadsheet size={14} /> Xuất Bảng Điểm Bộ GD&ĐT (Excel)
              </button>
            </div>

            {studentsList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <HelpCircle size={40} className="mx-auto opacity-40 text-slate-400 animate-pulse" />
                <p className="font-semibold">Phòng thi hiện tại đang trống.</p>
                <p className="text-xs max-w-sm mx-auto">Vui lòng cung cấp link hoặc hướng dẫn học sinh đăng nhập Họ tên & Lớp của mình ở một tab hoặc thiết bị khác để bắt đầu.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-bold tracking-wider uppercase">
                      <th className="py-3 px-5">Học Sinh</th>
                      <th className="py-3 px-5">Lớp</th>
                      <th className="py-3 px-5">Tiến Trình Làm Bài</th>
                      <th className="py-3 px-5">Số Câu Đúng</th>
                      <th className="py-3 px-5">Tốc độ phản ứng</th>
                      <th className="py-3 px-5">Huy Hiệu</th>
                      <th className="py-3 px-5 text-right">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {studentsList.map((st) => {
                      const totalQs = activeQuiz?.questionCount || 12;
                      const progressPercent = Math.min(100, (st.progress / totalQs) * 100);

                      let statusBadge = "";
                      if (st.status === "đang làm") statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-100";
                      else if (st.status === "đã nộp") statusBadge = "bg-indigo-50 text-indigo-700 border-indigo-100";
                      else if (st.status === "vi phạm") statusBadge = "bg-red-50 text-red-700 border-red-100 animate-pulse";

                      return (
                        <tr key={st.id} className="hover:bg-slate-50/50 transition-colors text-slate-700 text-xs md:text-sm">
                          <td className="py-3.5 px-5 font-bold text-slate-800">{st.studentName}</td>
                          <td className="py-3.5 px-5 font-medium">{st.className}</td>
                          <td className="py-3.5 px-5 w-48">
                            <div className="flex items-center gap-2">
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${st.status === "vi phạm" ? "bg-red-500" : "bg-indigo-600"}`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-bold shrink-0 text-slate-500">
                                {st.progress}/{totalQs}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 font-bold text-indigo-600">{st.score} câu</td>
                          <td className="py-3.5 px-5 text-slate-500">{st.averageTime}s/câu</td>
                          <td className="py-3.5 px-5">
                            <div className="flex gap-1">
                              {st.badges.length === 0 && <span className="text-slate-300 text-[10px] font-medium">-</span>}
                              {st.badges.includes("đồng") && <span title="Badge Đồng">🥉</span>}
                              {st.badges.includes("bạc") && <span title="Badge Bạc">🥈</span>}
                              {st.badges.includes("vàng") && <span title="Badge Vàng">🥇</span>}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {st.violationsCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold">
                                  <AlertTriangle size={10} /> Tab: {st.violationsCount}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 border text-[10px] font-extrabold rounded-full uppercase ${statusBadge}`}>
                                {st.status}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------- TAB: AI SOẠN ĐỀ (AI & OCR) ----------------- */}
      {activeTab === "ai_setup" && (
        <div className="space-y-4 w-full">
          {/* Cảnh báo API Key máy chủ */}
          {(!apiKeyStatus || apiKeyStatus.status === "unconfigured" || apiKeyStatus.status === "exhausted" || apiKeyStatus.status === "expired" || apiKeyStatus.status === "invalid") && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
              <AlertTriangle className="text-red-600 shrink-0 mt-0.5 animate-pulse" size={20} />
              <div>
                <p className="font-extrabold text-sm text-red-900">⚠️ API Key máy chủ chưa được cấu hình hoặc gặp lỗi!</p>
                <p className="text-xs mt-1 text-red-700 leading-relaxed font-medium">
                  Hệ thống hiện không có API Key hoạt động trên máy chủ. Hãy cấu hình API Key trong tab <button type="button" onClick={() => setActiveTab("api_keys")} className="text-indigo-600 underline font-bold hover:text-indigo-800 cursor-pointer">Cấu hình API Key</button> để có thể bóc tách đề bằng AI. Nếu không, hệ thống sẽ sử dụng ngân hàng đề mẫu.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls Form Panel */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center gap-2 border-b pb-3 mb-2">
                <Sparkles size={20} className="text-indigo-600 animate-spin" />
                <h3 className="font-extrabold text-slate-800">CÔNG CỤ SỐ HÓA ĐỀ THI AI & OCR THÔNG MINH</h3>
              </div>

              <form onSubmit={handleAIGenerate} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="teacher_form_name" className="block text-xs font-bold text-slate-500 uppercase mb-1">TÊN GIÁO VIÊN SOẠN ĐỀ</label>
                    <input
                      id="teacher_form_name"
                      type="text"
                      required
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800"
                    />
                  </div>
                  <div>
                    <label htmlFor="time_form_limit" className="block text-xs font-bold text-slate-500 uppercase mb-1">GIỚI HẠN THỜI GIAN / CÂU</label>
                    <select
                      id="time_form_limit"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800"
                    >
                      <option value="15">15 giây</option>
                      <option value="30">30 giây</option>
                      <option value="45">45 giây</option>
                      <option value="60">60 giây</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="topic_form_prompt" className="block text-xs font-bold text-slate-500 uppercase mb-1">Chủ đề hoặc Yêu cầu đặc biệt cho AI</label>
                  <input
                    id="topic_form_prompt"
                    type="text"
                    placeholder="Ví dụ: 12 câu Toán tích phân ôn thi THPT Quốc Gia mức độ thông hiểu"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800"
                  />
                </div>

                {/* Advanced file uploading / OCR */}
                <div>
                  <span className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Tải file đề thi (.docx, .pdf, hình ảnh) | Quy ước gạch chân đáp án đúng
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* File / Image Drag and drop */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${isDragging ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 bg-slate-50 hover:bg-slate-100/50"}`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,.pdf"
                        className="hidden"
                      />
                      {imageFile ? (
                        <div className="space-y-2 w-full">
                          <FileText size={32} className="text-indigo-600 mx-auto" />
                          <p className="text-xs font-bold text-slate-700 truncate">{imageFile.name}</p>
                          <p className="text-[10px] text-slate-400">({(imageFile.size / 1024).toFixed(1)} KB)</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearUploadedImage();
                            }}
                            className="px-2 py-0.5 text-[9px] bg-red-100 text-red-600 rounded hover:bg-red-200 font-bold"
                          >
                            Xóa file
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Upload size={24} className="text-slate-400 mx-auto" />
                          <p className="text-xs font-bold text-slate-600">Chọn hoặc Kéo thả file đề thi vào đây</p>
                          <p className="text-[10px] text-slate-400">Hỗ trợ .docx, .pdf, ảnh chụp. Đáp án đúng được gạch chân (ví dụ: <u>A</u>)</p>
                        </div>
                      )}
                    </div>

                    {/* Document Raw Pasting Box */}
                    <div>
                      <textarea
                        placeholder="Hoặc dán nội dung văn bản đề thi thô tại đây..."
                        value={docText}
                        onChange={(e) => setDocText(e.target.value)}
                        className="w-full h-[140px] p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {generatorMessage && (
                  <div className={`p-3 text-xs rounded-lg border leading-relaxed ${generatorMessage.startsWith("Thất bại") ? "bg-red-50 border-red-100 text-red-600" : "bg-indigo-50 border-indigo-100 text-indigo-700 font-medium"}`}>
                    {isGenerating && <RefreshCw size={12} className="animate-spin inline-block mr-1.5 align-middle" />}
                    {generatorMessage}
                  </div>
                )}

                {/* Visual Progress Bar and Step Tracker */}
                {(isGenerating || stepStatuses.some(s => s.status !== "idle")) && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>Tiến trình số hóa bằng AI</span>
                      <span>
                        {stepStatuses.filter(s => s.status === "success").length}/3 hoàn thành
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full transition-all duration-500 ${
                          stepStatuses.some(s => s.status === "failed" && s.error !== "Đã dừng do lỗi")
                            ? "bg-red-500" 
                            : stepStatuses.every(s => s.status === "success") 
                            ? "bg-emerald-500" 
                            : "bg-indigo-600"
                        }`}
                        style={{
                          width: `${
                            stepStatuses[2].status === "success" ? 100 :
                            stepStatuses[2].status === "loading" ? 83 :
                            stepStatuses[1].status === "success" ? 66 :
                            stepStatuses[1].status === "loading" ? 50 :
                            stepStatuses[0].status === "success" ? 33 :
                            stepStatuses[0].status === "loading" ? 15 : 0
                          }%`
                        }}
                      />
                    </div>

                    {/* Step Cards List */}
                    <div className="space-y-2">
                      {stepStatuses.map((step, idx) => {
                        let statusText = "Đang chờ";
                        let statusStyle = "bg-slate-100 text-slate-400 border-slate-200";
                        let icon = null;

                        if (step.status === "loading") {
                          statusText = "Đang xử lý...";
                          statusStyle = "bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse";
                          icon = <RefreshCw size={10} className="animate-spin text-indigo-600" />;
                        } else if (step.status === "success") {
                          statusText = "Hoàn tất";
                          statusStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
                          icon = <Check size={10} className="text-emerald-600" />;
                        } else if (step.status === "failed") {
                          statusText = step.error === "Đã dừng do lỗi" ? "Đã dừng do lỗi" : "Thất bại";
                          statusStyle = "bg-red-50 text-red-700 border-red-200";
                          icon = <X size={10} className="text-red-600" />;
                        }

                        return (
                          <div 
                            key={idx} 
                            className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                              step.status === "loading" ? "bg-white border-indigo-100 shadow-sm" : 
                              step.status === "success" ? "bg-white border-emerald-100" :
                              step.status === "failed" ? "bg-white border-red-100" : "bg-slate-50 border-slate-100"
                            }`}
                          >
                            <span className={step.status === "failed" && step.error === "Đã dừng do lỗi" ? "text-slate-400 italic" : "text-slate-700"}>
                              {step.title}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {icon}
                              <span className={`px-2 py-0.5 border rounded-full text-[9px] uppercase font-black ${statusStyle}`}>
                                {statusText}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  id="btn_ai_generate"
                  type="submit"
                  disabled={isGenerating}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  {isGenerating ? "AI Đang xử lý bóc tách & Tạo đề..." : "Bắt Đầu Số Hóa & Phát Hành Đề Bằng AI"}
                </button>
              </form>
            </div>

            {/* AI Result Review Panel */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h4 className="font-extrabold text-slate-800 text-sm">TRẠNG THÁI MA TRẬN ĐỀ THI</h4>
                {generatorSuccess && (
                  <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2 py-0.5 rounded uppercase">
                    Thành công
                  </span>
                )}
              </div>

              {generatorSuccess ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <p className="text-xs text-emerald-800 font-bold">✓ ĐỀ THI ĐÃ ĐƯỢC PHÁT HÀNH TRÊN HỆ THỐNG!</p>
                    <p className="text-xs text-emerald-600 font-semibold mt-1">Đã cấu hình xáo trộn {"$P_{\\{random\\}}$"} cho từng học sinh.</p>
                  </div>

                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-400 uppercase block">Thông tin tổng quan:</span>
                    <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 text-slate-700">
                      <p>• <strong>Tiêu đề:</strong> {generatorSuccess.title}</p>
                      <p>• <strong>Giáo viên:</strong> {generatorSuccess.teacherName}</p>
                      <p>• <strong>Số câu:</strong> {generatorSuccess.questionCount} câu trắc nghiệm</p>
                      <p>• <strong>Thời gian:</strong> {generatorSuccess.durationSeconds} giây / câu</p>
                    </div>
                  </div>

                  <div className="pt-2 text-center">
                    <p className="text-xs text-slate-400 leading-relaxed">Phòng thi đã được sẵn sàng với đề mới. Quay lại tab <strong>Monitor</strong> để bắt đầu!</p>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <FileText size={40} className="mx-auto opacity-30" />
                  <p className="text-xs font-semibold">Chưa có đề thi mới được số hóa.</p>
                  <p className="text-[10px] max-w-xs mx-auto">Vui lòng điền thông tin và bấm "Phát hành" để AI tạo ngân hàng câu hỏi LaTeX chuẩn.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- BỘ DUYỆT & HIỆU CHỈNH ĐỀ THI NHÁP (DRAFT EDITOR) ----------------- */}
      {activeTab === "ai_setup" && draftQuiz && (
        <div id="draft_review_section" className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={22} className="text-indigo-600 animate-pulse" />
                <h3 className="text-xl font-black text-slate-800">Duyệt & Hiệu Chỉnh Đề Thi Nháp</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Hãy trực tiếp chỉnh sửa câu chữ, công thức LaTeX, thay đổi đáp án đúng trước khi phát hành đề chính thức cho học sinh.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (confirm("Bạn có chắc muốn hủy bản nháp hiện tại?")) {
                    setDraftQuiz(null);
                  }
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hủy đề nháp
              </button>
              <button
                type="button"
                onClick={handlePublishQuiz}
                disabled={isPublishing}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isPublishing ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Xác nhận & Phát Hành Đề
              </button>
            </div>
          </div>

          {/* Cảnh báo nếu sử dụng đề thi mẫu fallback do hết quota hoặc lỗi */}
          {generatorWarning && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5 animate-pulse" size={20} />
              <div>
                <p className="font-extrabold text-sm text-amber-900">⚠️ Đang sử dụng Đề thi mẫu chuẩn sư phạm (LaTeX)</p>
                <p className="text-xs mt-1 text-amber-700 leading-relaxed font-medium">{generatorWarning}</p>
              </div>
            </div>
          )}

          {/* Cấu hình chung của đề nháp */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tiêu đề đề thi</label>
              <input
                type="text"
                value={draftQuiz.title || ""}
                onChange={(e) => handleUpdateDraftMeta("title", e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-bold"
                placeholder="Ví dụ: Đề khảo sát chất lượng Toán 12"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Giáo viên soạn đề</label>
              <input
                type="text"
                value={draftQuiz.teacherName || ""}
                onChange={(e) => handleUpdateDraftMeta("teacherName", e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-bold"
                placeholder="Tên thầy/cô giáo"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Thời gian làm bài / Câu (giây)</label>
              <select
                value={draftQuiz.durationSeconds || "30"}
                onChange={(e) => handleUpdateDraftMeta("durationSeconds", parseInt(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-bold"
              >
                <option value="15">15 giây</option>
                <option value="30">30 giây</option>
                <option value="45">45 giây</option>
                <option value="60">60 giây</option>
              </select>
            </div>
          </div>

          {/* Danh sách các câu hỏi trong đề nháp */}
          <div className="space-y-6">
            {draftQuiz.questions && draftQuiz.questions.map((q: any, qIdx: number) => (
              <DraftQuestionCard
                key={q.id || qIdx}
                question={q}
                qIdx={qIdx}
                onSave={(updatedQ) => handleSaveDraftQuestion(qIdx, updatedQ)}
                onRemove={() => handleRemoveDraftQuestion(qIdx)}
              />
            ))}
          </div>

          {/* Thêm câu hỏi */}
          <div className="text-center py-2">
            <button
              type="button"
              onClick={handleAddDraftQuestion}
              className="px-5 py-2.5 bg-white hover:bg-slate-50 text-indigo-600 font-bold text-xs rounded-xl border border-dashed border-indigo-300 shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              + Thêm câu hỏi tự soạn
            </button>
          </div>

          {/* Dòng trạng thái phát hành và Nút hành động */}
          {publishMessage && (
            <div className={`p-3 text-xs rounded-lg border text-center ${publishMessage.startsWith("Lỗi") ? "bg-red-50 border-red-100 text-red-600" : "bg-emerald-50 border-emerald-100 text-emerald-700 font-medium"}`}>
              {publishMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => {
                if (confirm("Bạn có chắc muốn hủy bản nháp hiện tại?")) {
                  setDraftQuiz(null);
                }
              }}
              className="px-5 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
            >
              Hủy đề nháp
            </button>
            <button
              type="button"
              onClick={handlePublishQuiz}
              disabled={isPublishing}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isPublishing ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Xác nhận & Phát Hành Đề Thi Chính Thức
            </button>
          </div>
        </div>
      )}

      {/* ----------------- TAB: BÁO CÁO PHỔ ĐIỂM (BELL CURVE) ----------------- */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bell Curve Area Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div className="border-b pb-3 flex justify-between items-center">
                <div>
                  <h4 className="font-extrabold text-slate-800">PHÂN TÍCH PHỔ ĐIỂM HỌC SINH (BIỂU ĐỒ HÌNH CHUÔNG)</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Phân tích tần suất phân phối điểm thi của lớp học</p>
                </div>
              </div>

              <div className="h-72 w-full pt-4">
                {stats && stats.gradeDistribution.some(d => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.gradeDistribution}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="score" label={{ value: "Điểm Số", position: "insideBottomRight", offset: -10 }} />
                      <YAxis allowDecimals={false} label={{ value: "Số Học Sinh", angle: -90, position: "insideLeft" }} />
                      <Tooltip formatter={(value) => [`${value} học sinh`, "Số lượng"]} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#4f46e5"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorCount)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                    <TrendingUp size={36} className="opacity-30 animate-pulse" />
                    <p className="font-semibold">Chưa có đủ phổ điểm của lớp.</p>
                    <p className="text-[10px]">Học sinh hoàn thành bài thi sẽ được vẽ phân bổ phổ điểm hình chuông.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Toughest Questions Review panel */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div className="border-b pb-3">
                <h4 className="font-extrabold text-slate-800 text-sm">TOP 3 CÂU HỎI CÓ TỶ LỆ SAI CAO NHẤT</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Hỗ trợ phát hiện lỗ hổng kiến thức sư phạm</p>
              </div>

              <div className="space-y-4">
                {stats && stats.topWrongQuestions.length > 0 ? (
                  stats.topWrongQuestions.map((q, idx) => (
                    <div key={idx} className="p-3.5 bg-rose-50/50 border border-rose-100 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full uppercase">
                          TOP {idx + 1} SAI CAO
                        </span>
                        <span className="text-xs font-extrabold text-rose-600">
                          Tỷ lệ sai: {q.percentageWrong}%
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 font-medium line-clamp-2">
                        <LatexRenderer text={q.questionText} />
                      </div>
                      <div className="text-[10px] text-slate-400 bg-white p-2 rounded border border-rose-50">
                        <span className="font-bold text-slate-500 block uppercase tracking-wider">Đáp án đúng của Bộ đề:</span>
                        <LatexRenderer text={q.correctAnswer} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                    <Award size={36} className="mx-auto opacity-30 text-indigo-500" />
                    <p className="font-semibold">Lớp học chưa có dữ liệu sai.</p>
                    <p className="text-[10px] max-w-xs mx-auto">Khi học sinh trả lời sai, các câu khó nhất sẽ hiển thị ở đây để giáo viên giải nghĩa.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB: CẤU HÌNH API KEY ----------------- */}
      {activeTab === "api_keys" && (
        <div className="space-y-6">
          {/* Header Description */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Key className="text-indigo-600" size={24} />
                <h3 className="text-lg font-black text-slate-800">Quản Lý API Key Máy Chủ</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Cấu hình API Key Gemini của hệ thống dùng để bóc tách tài liệu và hình ảnh đề thi.
                Thầy cô có thể kích hoạt lại trạng thái hoạt động của key nếu key bị đánh dấu tạm dừng do lỗi hết quota hoặc sai cấu hình.
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleResetKeysStatus}
              disabled={isResettingKeys}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} className={isResettingKeys ? "animate-spin" : ""} />
              Kích hoạt lại API Key
            </button>
          </div>

          {/* Key Status Grid */}
          <div className="max-w-md">
            {(() => {
              const keyStatus = apiKeyStatus || { status: "unconfigured", keyMasked: "Chưa cấu hình" };
              
              let statusLabel = "Chưa cấu hình";
              let statusBg = "bg-slate-100 text-slate-500 border-slate-200";
              let statusDot = "bg-slate-400";
              
              if (keyStatus.status === "active") {
                statusLabel = "Đang hoạt động";
                statusBg = "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse";
                statusDot = "bg-emerald-500";
              } else if (keyStatus.status === "exhausted") {
                statusLabel = "Hết hạn ngạch (429)";
                statusBg = "bg-amber-50 text-amber-700 border-amber-200";
                statusDot = "bg-amber-500";
              } else if (keyStatus.status === "expired" || keyStatus.status === "invalid") {
                statusLabel = "Khóa lỗi / Hết hạn";
                statusBg = "bg-rose-50 text-rose-700 border-rose-200";
                statusDot = "bg-rose-500";
              }
              
              return (
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trạng thái API Key máy chủ</span>
                      <span className={`px-2 py-0.5 border text-[10px] font-extrabold rounded-full flex items-center gap-1.5 ${statusBg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-sm font-mono font-bold text-slate-700 truncate">{keyStatus.keyMasked}</p>
                  </div>
                  
                  <div className="text-[10px] text-slate-400 space-y-1 pt-2 border-t border-slate-50">
                    <p>
                      <strong>Sử dụng lần cuối:</strong>{" "}
                      {keyStatus.lastUsed ? new Date(keyStatus.lastUsed).toLocaleTimeString("vi-VN") : "Chưa sử dụng"}
                    </p>
                    {keyStatus.errorMessage && (
                      <div className="mt-1 p-2 bg-rose-50 text-rose-600 rounded border border-rose-100 overflow-y-auto max-h-[60px] break-words font-medium">
                        {keyStatus.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Configuration Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div className="border-b pb-3 flex items-center gap-2">
              <Sliders className="text-indigo-600" size={18} />
              <h4 className="font-extrabold text-slate-800">CẤU HÌNH CHI TIẾT KHÓA API</h4>
            </div>

            <form onSubmit={handleSaveKeys} className="space-y-4">
              <div className="max-w-md space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase">
                  Gemini API Key hệ thống
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <input
                    type={showKey ? "text" : "password"}
                    value={rawKey || ""}
                    onChange={(e) => setRawKey(e.target.value)}
                    placeholder="Dán API Key (AIzaSy...) tại đây"
                    className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {keysMessage && (
                <div className={`p-3 text-xs rounded-lg border text-center ${keysMessage.startsWith("Lỗi") ? "bg-red-50 border-red-100 text-red-600" : "bg-emerald-50 border-emerald-100 text-emerald-700 font-medium"}`}>
                  {keysMessage}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSavingKeys}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-sm rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingKeys ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Lưu cấu hình API Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Hợp phần hiệu chỉnh từng câu hỏi nháp riêng lẻ (nút xác nhận lưu đề từng câu hỏi)
interface DraftQuestionCardProps {
  question: any;
  qIdx: number;
  onSave: (updatedQuestion: any) => void;
  onRemove: () => void;
}

const DraftQuestionCard: React.FC<DraftQuestionCardProps> = ({
  question,
  qIdx,
  onSave,
  onRemove
}) => {
  const [text, setText] = useState(question.text || "");
  const [options, setOptions] = useState<string[]>(question.options || ["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState<number>(question.correctIndex ?? 0);
  const [explanation, setExplanation] = useState(question.explanation || "");
  const [isSaved, setIsSaved] = useState(true);

  // Đồng bộ khi dữ liệu câu hỏi từ ngoài thay đổi
  useEffect(() => {
    setText(question.text || "");
    setOptions(question.options || ["", "", "", ""]);
    setCorrectIndex(question.correctIndex ?? 0);
    setExplanation(question.explanation || "");
    setIsSaved(true);
  }, [question]);

  const handleTextChange = (val: string) => {
    setText(val);
    setIsSaved(false);
  };

  const handleOptionChange = (optIdx: number, val: string) => {
    const updatedOptions = [...options];
    updatedOptions[optIdx] = val;
    setOptions(updatedOptions);
    setIsSaved(false);
  };

  const handleCorrectIndexChange = (optIdx: number) => {
    setCorrectIndex(optIdx);
    setIsSaved(false);
  };

  const handleExplanationChange = (val: string) => {
    setExplanation(val);
    setIsSaved(false);
  };

  const handleLocalSave = () => {
    onSave({
      ...question,
      text,
      options,
      correctIndex,
      explanation
    });
    setIsSaved(true);
  };

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-300 p-6 space-y-4 relative group ${isSaved ? "border-slate-200 shadow-sm" : "border-amber-300 shadow-md ring-1 ring-amber-100"}`}>
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-black">
            {qIdx + 1}
          </span>
          <h4 className="font-extrabold text-slate-800 uppercase tracking-wider text-xs">Cấu trúc Câu hỏi {qIdx + 1}</h4>
          
          {/* Huy hiệu trạng thái lưu */}
          {isSaved ? (
            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold border border-emerald-100">
              <Check size={10} /> Đã lưu vào bộ đề nháp
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-bold border border-amber-100 animate-pulse">
              <Edit3 size={10} /> Chưa lưu thay đổi câu này
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          title="Xóa câu hỏi này"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Nội dung câu hỏi */}
      <div className="space-y-1">
        <label className="block text-xs font-bold text-slate-500 uppercase">Nội dung câu hỏi (Chấp nhận LaTeX dạng $...$)</label>
        <textarea
          rows={2}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
          placeholder="Nhập đề bài..."
        />
        {text && (
          <div className="mt-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
            <span className="text-[10px] font-bold text-indigo-500 uppercase block mb-1">Hiển thị toán học thực tế:</span>
            <LatexRenderer text={text} />
          </div>
        )}
      </div>

      {/* 4 Đáp án lựa chọn */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-500 uppercase">
          Các phương án lựa chọn & Đánh dấu Đáp án đúng
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map((opt: string, optIdx: number) => {
            const optLabel = ["A", "B", "C", "D"][optIdx];
            const isCorrect = correctIndex === optIdx;

            return (
              <div
                key={optIdx}
                className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${isCorrect ? "bg-emerald-50/50 border-emerald-200" : "bg-slate-50/50 border-slate-200"}`}
              >
                <button
                  type="button"
                  onClick={() => handleCorrectIndexChange(optIdx)}
                  className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center font-bold text-xs border transition-colors cursor-pointer ${isCorrect ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-400 hover:text-slate-700 hover:border-slate-400"}`}
                >
                  {optLabel}
                </button>
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    value={opt || ""}
                    onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder={`Nhập phương án ${optLabel}...`}
                  />
                  {opt && (
                    <div className="text-[10px] text-slate-400 pl-1">
                      <LatexRenderer text={opt} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lời giải chi tiết */}
      <div className="space-y-1">
        <label className="block text-xs font-bold text-slate-500 uppercase">Lời giải thích chi tiết (Hiển thị cho học sinh sau khi nộp)</label>
        <textarea
          rows={2}
          value={explanation}
          onChange={(e) => handleExplanationChange(e.target.value)}
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
          placeholder="Nhập lời giải..."
        />
        {explanation && (
          <div className="mt-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
            <span className="text-[10px] font-bold text-indigo-500 uppercase block mb-1">Hiển thị giải thích thực tế:</span>
            <LatexRenderer text={explanation} />
          </div>
        )}
      </div>

      {/* Nút xác nhận lưu câu hỏi */}
      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={handleLocalSave}
          disabled={isSaved}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${isSaved ? "bg-slate-100 text-slate-400 border border-slate-200" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"}`}
        >
          {isSaved ? <Check size={14} /> : <Save size={14} />}
          {isSaved ? "Đã lưu câu này" : "Xác nhận & Lưu câu hỏi này"}
        </button>
      </div>
    </div>
  );
}
