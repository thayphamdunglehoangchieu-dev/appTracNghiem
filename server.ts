import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import mammoth from "mammoth";
import * as docx from "docx";
import { Question, Quiz, StudentSession, DashboardStats } from "./src/types";

dotenv.config();

// API KEY STATUS INTERFACE & MANAGER FOR STATUS ALERTS
interface ApiKeyStatus {
  key: string;
  status: "active" | "exhausted" | "expired" | "invalid" | "unconfigured";
  errorMessage?: string;
  lastUsed?: string;
}

class ApiKeyManager {
  private key: string = "";
  private keyStatus: ApiKeyStatus = { key: "", status: "unconfigured" };
  private configPath = path.join(process.cwd(), "api_keys.json"); // keeps same filename for ease

  constructor() {
    this.loadKey();
  }

  public loadKey() {
    let loadedKey = "";
    // 1. Try to load from api_keys.json
    try {
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, "utf-8");
        const parsed = JSON.parse(fileContent);
        if (parsed.key) {
          loadedKey = String(parsed.key).trim();
          console.log("[ApiKeyManager] Đã tải key từ api_keys.json");
        } else if (Array.isArray(parsed.keys) && parsed.keys[0]) {
          // Compatibility with older 4-keys format
          loadedKey = String(parsed.keys[0]).trim();
          console.log("[ApiKeyManager] Đã tải key đầu tiên từ định dạng cũ trong api_keys.json");
        }
      }
    } catch (err) {
      console.error("[ApiKeyManager] Lỗi đọc file api_keys.json:", err);
    }

    // 2. If empty, try env variable
    if (!loadedKey) {
      loadedKey = (process.env.GEMINI_API_KEY || "").trim();
      if (loadedKey) {
        console.log("[ApiKeyManager] Đã tải key từ biến môi trường GEMINI_API_KEY");
      }
    }

    this.key = loadedKey;
    this.keyStatus = {
      key: loadedKey,
      status: loadedKey ? "active" : "unconfigured",
      errorMessage: undefined,
      lastUsed: undefined
    };
  }

  public saveKey(newKey: string) {
    this.key = newKey.trim();
    try {
      fs.writeFileSync(this.configPath, JSON.stringify({ key: this.key }, null, 2), "utf-8");
      console.log("[ApiKeyManager] Đã lưu key vào api_keys.json");
    } catch (err) {
      console.error("[ApiKeyManager] Lỗi ghi file api_keys.json:", err);
    }

    this.keyStatus = {
      key: this.key,
      status: this.key ? "active" : "unconfigured",
      errorMessage: undefined,
      lastUsed: undefined
    };
  }

  public getStatus() {
    return {
      status: this.keyStatus.status,
      errorMessage: this.keyStatus.errorMessage,
      lastUsed: this.keyStatus.lastUsed,
      keyMasked: this.key ? `${this.key.slice(0, 6)}...${this.key.slice(-4)}` : "Chưa cấu hình"
    };
  }

  public getRawKey() {
    return this.key;
  }

  public getClient(): GoogleGenAI | null {
    if (this.keyStatus.status === "active" && this.key) {
      this.keyStatus.lastUsed = new Date().toISOString();
      return new GoogleGenAI({
        apiKey: this.key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return null;
  }

  public markAsExhausted(errorMsg: string) {
    this.keyStatus.status = "exhausted";
    this.keyStatus.errorMessage = errorMsg;
    console.warn(`[ApiKeyManager] API Key hết hạn ngạch/token: ${errorMsg}`);
  }

  public markAsExpiredOrInvalid(errorMsg: string) {
    this.keyStatus.status = "expired";
    this.keyStatus.errorMessage = errorMsg;
    console.warn(`[ApiKeyManager] API Key hết hạn hoặc sai khóa: ${errorMsg}`);
  }

  public resetStatus() {
    if (this.key) {
      this.keyStatus.status = "active";
      this.keyStatus.errorMessage = undefined;
    } else {
      this.keyStatus.status = "unconfigured";
    }
  }
}

const apiKeyManager = new ApiKeyManager();


const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// IN-MEMORY DATABASE STATE
let activeQuiz: Quiz = {
  id: "default_quiz",
  title: "Đề khảo sát Khoa học tự nhiên (Toán - Lý - Hóa) Lớp 12",
  teacherName: "Hệ thống tự động",
  durationSeconds: 30, // 30 seconds per question
  createdAt: new Date().toISOString(),
  questions: [
    {
      id: "q1",
      text: "Tìm nguyên hàm của hàm số $f(x) = e^{2x}$.",
      options: [
        "$\\int e^{2x} dx = \\frac{1}{2} e^{2x} + C$",
        "$\\int e^{2x} dx = 2e^{2x} + C$",
        "$\\int e^{2x} dx = e^{2x} + C$",
        "$\\int e^{2x} dx = e^{2x+1} + C$"
      ],
      correctIndex: 0,
      explanation: "Áp dụng công thức nguyên hàm cơ bản: $\\int e^{ax+b} dx = \\frac{1}{a} e^{ax+b} + C$. Ở đây $a=2, b=0$, do đó $\\int e^{2x} dx = \\frac{1}{2} e^{2x} + C$."
    },
    {
      id: "q2",
      text: "Axit Sunfuric đặc, nóng phản ứng với kim loại Đồng ($Cu$) giải phóng khí nào sau đây?",
      options: [
        "Khí Hidro ($H_2$)",
        "Khí Sunfurơ ($SO_2$)",
        "Khí Cacbonic ($CO_2$)",
        "Khí Nitơ ($N_2$)"
      ],
      correctIndex: 1,
      explanation: "Phương trình hóa học của phản ứng là: $$Cu + 2H_2SO_4 \\text{ (đặc, nóng)} \\rightarrow CuSO_4 + SO_2\\uparrow + 2H_2O$$ Khí sinh ra là khí sunfurơ $SO_2$ có mùi hắc đặc trưng."
    },
    {
      id: "q3",
      text: "Chu kỳ dao động điều hòa của con lắc đơn có chiều dài dây treo $l$ tại nơi có gia tốc trọng trường $g$ được tính bởi công thức:",
      options: [
        "$T = 2\\pi \\sqrt{\\frac{g}{l}}$",
        "$T = \\frac{1}{2\\pi} \\sqrt{\\frac{l}{g}}$",
        "$T = 2\\pi \\sqrt{\\frac{l}{g}}$",
        "$T = 2\\pi \\sqrt{\\frac{m}{k}}$"
      ],
      correctIndex: 2,
      explanation: "Theo chương trình Vật lý 12, chu kỳ dao động của con lắc đơn phụ thuộc tỉ lệ thuận với căn bậc hai của chiều dài dây treo $l$ và tỉ lệ nghịch với căn bậc hai của gia tốc trọng trường $g$: $T = 2\\pi \\sqrt{\\frac{l}{g}}$."
    },
    {
      id: "q4",
      text: "Tính đạo hàm của hàm số $y = \\ln(x^2 + 1)$.",
      options: [
        "$y' = \\frac{1}{x^2+1}$",
        "$y' = \\frac{2x}{x^2+1}$",
        "$y' = \\frac{x}{x^2+1}$",
        "$y' = 2x(x^2+1)$"
      ],
      correctIndex: 1,
      explanation: "Áp dụng công thức tính đạo hàm của hàm số hợp $(\\ln u)' = \\frac{u'}{u}$. Với $u = x^2 + 1 \\Rightarrow u' = 2x$. Vậy $y' = \\frac{2x}{x^2+1}$."
    },
    {
      id: "q5",
      text: "Biểu thức nào sau đây mô tả định luật Ohm cho toàn mạch?",
      options: [
        "$I = \\frac{U}{R}$",
        "$I = \\frac{E}{R + r}$",
        "$I = E \\cdot (R + r)$",
        "$I = \\frac{E + U}{R}$"
      ],
      correctIndex: 1,
      explanation: "Định luật Ohm cho toàn mạch phát biểu: Cường độ dòng điện trong mạch kín tỉ lệ thuận với suất điện động $E$ của nguồn điện và tỉ lệ nghịch với điện trở toàn mạch $R+r$: $$I = \\frac{E}{R + r}$$"
    },
    {
      id: "q6",
      text: "Este etyl axetat được tạo thành từ phản ứng este hóa giữa axit axetic và ancol etylic có công thức cấu tạo thu gọn là:",
      options: [
        "$HCOOCH_3$",
        "$CH_3COOCH_3$",
        "$CH_3COOC_2H_5$",
        "$C_2H_5COOCH_3$"
      ],
      correctIndex: 2,
      explanation: "Phản ứng este hóa: $$CH_3COOH + C_2H_5OH \\rightleftharpoons CH_3COOC_2H_5 + H_2O$$ Sản phẩm este thu được là etyl axetat với công thức $CH_3COOC_2H_5$."
    },
    {
      id: "q7",
      text: "Nghiệm của phương trình logarit $\\log_3(x - 1) = 2$ là:",
      options: [
        "$x = 10$",
        "$x = 7$",
        "$x = 9$",
        "$x = 8$"
      ],
      correctIndex: 0,
      explanation: "Điều kiện xác định: $x - 1 > 0 \\Leftrightarrow x > 1$.\\\\ Ta có: $\\log_3(x-1) = 2 \\Leftrightarrow x-1 = 3^2 \\Leftrightarrow x-1 = 9 \\Leftrightarrow x = 10$ (thỏa mãn điều kiện)."
    },
    {
      id: "q8",
      text: "Thể tích khối chóp có diện tích mặt đáy bằng $B$ và chiều cao tương ứng bằng $h$ được tính theo công thức:",
      options: [
        "$V = B \\cdot h$",
        "$V = \\frac{1}{3} B \\cdot h$",
        "$V = \\frac{1}{2} B \\cdot h$",
        "$V = \\frac{4}{3} \\pi R^3$"
      ],
      correctIndex: 1,
      explanation: "Thể tích của bất kỳ khối chóp nào cũng bằng một phần ba tích của diện tích đáy và chiều cao: $V = \\frac{1}{3} B \\cdot h$."
    },
    {
      id: "q9",
      text: "Thuyết lượng tử ánh sáng của Albert Einstein giải thích thành công hiện tượng nào sau đây?",
      options: [
        "Hiện tượng giao thoa ánh sáng",
        "Hiện tượng nhiễu xạ ánh sáng",
        "Hiện tượng quang điện ngoài",
        "Hiện tượng tán sắc ánh sáng"
      ],
      correctIndex: 2,
      explanation: "Hiện tượng quang điện chứng tỏ ánh sáng có tính chất hạt (photon). Einstein đã sử dụng thuyết lượng tử ánh sáng đề xuất bởi Planck để giải thích định lượng hiện tượng quang điện ngoài, nhận giải Nobel Vật lý năm 1921."
    },
    {
      id: "q10",
      text: "Trong số các kim loại sau, kim loại nào có tính dẫn điện tốt nhất ở điều kiện tiêu chuẩn?",
      options: [
        "Vàng ($Au$)",
        "Bạc ($Ag$)",
        "Đồng ($Cu$)",
        "Sắt ($Fe$)"
      ],
      correctIndex: 1,
      explanation: "Khả năng dẫn điện giảm dần theo thứ tự: Bạc ($Ag$) > Đồng ($Cu$) > Vàng ($Au$) > Nhôm ($Al$) > Sắt ($Fe$). Do đó, Bạc ($Ag$) dẫn điện tốt nhất."
    },
    {
      id: "q11",
      text: "Tính đạo hàm của hàm số lượng giác $y = \\cos(2x)$.",
      options: [
        "$y' = -\\sin(2x)$",
        "$y' = -2\\sin(2x)$",
        "$y' = 2\\sin(2x)$",
        "$y' = -2\\cos(2x)$"
      ],
      correctIndex: 1,
      explanation: "Sử dụng công thức đạo hàm hàm lượng giác hợp: $(\\cos u)' = -u' \\cdot \\sin u$. Với $u = 2x \\Rightarrow u' = 2$, suy ra $y' = -2\\sin(2x)$."
    },
    {
      id: "q12",
      text: "Sắp xếp bước sóng của các bức xạ sau trong chân không theo thứ tự giảm dần (từ dài nhất đến ngắn nhất):",
      options: [
        "Hồng ngoại, Ánh sáng tím, Tử ngoại, Tia X",
        "Tia X, Tử ngoại, Ánh sáng tím, Hồng ngoại",
        "Hồng ngoại, Tử ngoại, Ánh sáng tím, Tia X",
        "Tia X, Ánh sáng tím, Tử ngoại, Hồng ngoại"
      ],
      correctIndex: 0,
      explanation: "Trật tự bước sóng trong thang sóng điện từ từ lớn đến bé là: Sóng vô tuyến $\\rightarrow$ Hồng ngoại $\\rightarrow$ Ánh sáng nhìn thấy (Đỏ đến Tím) $\\rightarrow$ Tử ngoại $\\rightarrow$ Tia X $\\rightarrow$ Tia Gamma. Do đó thứ tự giảm dần là Hồng ngoại > Ánh sáng tím > Tử ngoại > Tia X."
    }
  ]
};

// Map of sessionId -> StudentSession
const studentSessions = new Map<string, StudentSession>();

// Personalized questions map to grade randomized order correct options correctly
// sessionId -> Shuffled Question List (has updated options and correctIndex mapped to students' viewport)
const personalizedQuestionsMap = new Map<string, Question[]>();

// HELPER: Fischer-Yates Shuffling with original indices retention
function shuffleQuizQuestionsAndOptions(questions: Question[]): {
  shuffledQuestions: Question[];
} {
  // First, clone the questions array
  const shuffledQuestions = questions.map((q) => {
    // Pair each option with its original index
    const pairedOptions = q.options.map((opt, idx) => ({ opt, idx }));
    // Shuffle options
    for (let i = pairedOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairedOptions[i], pairedOptions[j]] = [pairedOptions[j], pairedOptions[i]];
    }

    // Find where the original correct answer went
    const newCorrectIndex = pairedOptions.findIndex(p => p.idx === q.correctIndex);

    return {
      ...q,
      options: pairedOptions.map(p => p.opt),
      correctIndex: newCorrectIndex,
    };
  });

  // Shuffle the questions order as well
  for (let i = shuffledQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
  }

  return { shuffledQuestions };
}

// REST ENDPOINTS

// Helper to handle retry logic with backoff and alternative models
async function generateContentWithRetry(ai: any, model: string, contents: any, config: any): Promise<any> {
  // Model priority from AI_INSTRUCTIONS.md:
  // Default is gemini-3-pro-preview. Fallbacks: 1. gemini-3-flash-preview, 2. gemini-3-pro-preview, 3. gemini-2.5-flash
  const priorityList = ["gemini-3-flash-preview", "gemini-3-pro-preview", "gemini-2.5-flash"];
  const modelsToTry = [model];
  for (const m of priorityList) {
    if (!modelsToTry.includes(m)) {
      modelsToTry.push(m);
    }
  }
  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    let retries = 2; // Try up to 3 times per model
    while (retries >= 0) {
      try {
        console.log(`[Gemini] Đang gọi model: ${currentModel} (Số lượt thử lại còn lại: ${retries})...`);
        const response = await ai.models.generateContent({
          model: currentModel,
          contents,
          config,
        });
        if (response && response.text) {
          console.log(`[Gemini] Thành công nhận kết quả từ model ${currentModel}`);
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err.message || String(err);
        console.error(`[Gemini] Lỗi khi gọi model ${currentModel}:`, errMsg);

        // Check if it is an invalid/expired key - abort early to rotate fast!
        const isInvalidKey = errMsg.includes("API_KEY_INVALID") ||
                             errMsg.includes("API key not valid") ||
                             errMsg.includes("API key expired") ||
                             (err.status && (err.status === 400 || err.status === 403) && (errMsg.includes("key") || errMsg.includes("Key")));

        if (isInvalidKey) {
          console.log(`[Gemini] Phát hiện API Key không hợp lệ hoặc hết hạn. Hủy thử lại model này để xoay key.`);
          throw err;
        }

        // Check for Quota Exceeded / Resource Exhausted / Rate limits (429 / RESOURCE_EXHAUSTED)
        const isQuotaExceeded = errMsg.includes("RESOURCE_EXHAUSTED") || 
                               errMsg.includes("Quota exceeded") || 
                               errMsg.includes("429") || 
                               (err.status && err.status === 429);

        if (isQuotaExceeded) {
          console.log(`[Gemini] Model ${currentModel} bị hết hạn ngạch (Quota Exceeded). Bỏ qua lượt thử lại của model này để chuyển sang model khác nhằm tiết kiệm thời gian.`);
          break; // Break the retries loop, immediately try the next model
        }

        retries--;
        if (retries >= 0) {
          console.log(`[Gemini] Đang đợi 2s để thử lại...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
  }
  throw lastError || new Error("Không thể tạo nội dung bằng Gemini API sau nhiều lần thử.");
}

// Wrapper for API Key status tracking
async function generateContentWithRotation(
  model: string,
  contents: any,
  config: any
): Promise<{ response: any; logs: string[] }> {
  const logs: string[] = [];
  
  const client = apiKeyManager.getClient();
  if (!client) {
    throw new Error("Không tìm thấy API Key nào đang hoạt động. Vui lòng cấu hình API Key trong phần cài đặt!");
  }
  
  console.log(`[Gemini] Sử dụng API Key hệ thống để gọi Gemini...`);
  
  try {
    const response = await generateContentWithRetry(client, model, contents, config);
    return { response, logs };
  } catch (err: any) {
    const errMsg = err.message || String(err);
    console.error(`[Gemini] Gặp lỗi với API Key hệ thống:`, errMsg);
    
    // Check if it is a rate limit / quota exhaustion
    const isQuotaExceeded = errMsg.includes("RESOURCE_EXHAUSTED") || 
                           errMsg.includes("Quota exceeded") || 
                           errMsg.includes("429") || 
                           (err.status && err.status === 429);
                           
    // Check if it is an invalid/expired key
    const isInvalidKey = errMsg.includes("API_KEY_INVALID") ||
                          errMsg.includes("API key not valid") ||
                          errMsg.includes("API key expired") ||
                          (err.status && (err.status === 400 || err.status === 403) && (errMsg.includes("key") || errMsg.includes("Key")));
    
    if (isQuotaExceeded) {
      apiKeyManager.markAsExhausted(errMsg);
    } else if (isInvalidKey) {
      apiKeyManager.markAsExpiredOrInvalid(errMsg);
    } else {
      apiKeyManager.markAsExhausted(errMsg);
    }
    throw err;
  }
}

// 1. Get current active quiz basic details
app.get("/api/quiz", (req, res) => {
  res.json({
    id: activeQuiz.id,
    title: activeQuiz.title,
    teacherName: activeQuiz.teacherName,
    durationSeconds: activeQuiz.durationSeconds,
    questionCount: activeQuiz.questions.length,
    createdAt: activeQuiz.createdAt,
  });
});

// Hàm tạo bộ câu hỏi đề thi mẫu chất lượng cao (fallback) khi Gemini gặp lỗi hoặc hết hạn ngạch
function generateFallbackQuizQuestions(): Question[] {
  return [
    {
      id: `fb_q_1_${Date.now()}`,
      text: "Cho hàm số $y = x^3 - 3x^2 + 2$. Điểm cực đại của đồ thị hàm số là:",
      options: [
        "A. $M(0; 2)$",
        "B. $N(2; -2)$",
        "C. $P(1; 0)$",
        "D. $Q(-1; -2)$"
      ],
      correctIndex: 0,
      explanation: "Ta có $y' = 3x^2 - 6x = 0 \\Leftrightarrow x = 0$ hoặc $x = 2$.\n- Với $x = 0 \\Rightarrow y = 2$ và $y''(0) = -6 < 0$ nên đồ thị đạt cực đại tại $M(0; 2)$.\n- Với $x = 2 \\Rightarrow y = -2$ và $y''(2) = 6 > 0$ nên đạt cực tiểu tại $N(2; -2)$."
    },
    {
      id: `fb_q_2_${Date.now()}`,
      text: "Tìm nguyên hàm của hàm số $f(x) = e^{2x} + \\cos(x)$:",
      options: [
        "A. $F(x) = \\frac{1}{2}e^{2x} + \\sin(x) + C$",
        "B. $F(x) = 2e^{2x} - \\sin(x) + C$",
        "C. $F(x) = \\frac{1}{2}e^{2x} - \\sin(x) + C$",
        "D. $F(x) = e^{2x} + \\sin(x) + C$"
      ],
      correctIndex: 0,
      explanation: "Áp dụng công thức nguyên hàm cơ bản:\n- Nguyên hàm của $e^{ax}$ là $\\frac{1}{a}e^{ax} + C$.\n- Nguyên hàm của $\\cos(x)$ là $\\sin(x) + C$.\nDo đó $F(x) = \\frac{1}{2}e^{2x} + \\sin(x) + C$."
    },
    {
      id: `fb_q_3_${Date.now()}`,
      text: "Trong không gian $Oxyz$, cho mặt phẳng $(P): 2x - y + 2z - 5 = 0$. Khoảng cách từ điểm $A(1; 2; 3)$ đến mặt phẳng $(P)$ bằng:",
      options: [
        "A. $1$",
        "B. $2$",
        "C. $\\frac{5}{3}$",
        "D. $\\frac{7}{3}$"
      ],
      correctIndex: 0,
      explanation: "Áp dụng công thức tính khoảng cách từ một điểm đến mặt phẳng:\n$d(A, (P)) = \\frac{|2(1) - 2 + 2(3) - 5|}{\\sqrt{2^2 + (-1)^2 + 2^2}} = \\frac{|2 - 2 + 6 - 5|}{\\sqrt{9}} = \\frac{1}{3}$."
    },
    {
      id: `fb_q_4_${Date.now()}`,
      text: "Tính thể tích $V$ của khối lăng trụ có diện tích đáy $B = 6\\text{ cm}^2$ và chiều cao $h = 4\\text{ cm}$:",
      options: [
        "A. $V = 24\\text{ cm}^3$",
        "B. $V = 8\\text{ cm}^3$",
        "C. $V = 12\\text{ cm}^3$",
        "D. $V = 18\\text{ cm}^3$"
      ],
      correctIndex: 0,
      explanation: "Thể tích khối lăng trụ được tính theo công thức: $V = B \\cdot h$.\nThay số: $V = 6 \\cdot 4 = 24\\text{ cm}^3$."
    },
    {
      id: `fb_q_5_${Date.now()}`,
      text: "Một mạch dao động điện từ $LC$ lí tưởng gồm cuộn cảm thuần có độ tự cảm $L = 2\\text{ mH}$ và tụ điện có điện dung $C = 8\\text{ nF}$. Chu kì dao động riêng của mạch là:",
      options: [
        "A. $8\\pi \\cdot 10^{-6}\\text{ s}$",
        "B. $4\\pi \\cdot 10^{-6}\\text{ s}$",
        "C. $2\\pi \\cdot 10^{-6}\\text{ s}$",
        "D. $16\\pi \\cdot 10^{-6}\\text{ s}$"
      ],
      correctIndex: 0,
      explanation: "Chu kỳ dao động riêng của mạch $LC$ được tính theo công thức:\n$T = 2\\pi \\sqrt{LC} = 2\\pi \\sqrt{2 \\cdot 10^{-3} \\cdot 8 \\cdot 10^{-9}} = 2\\pi \\sqrt{16 \\cdot 10^{-12}} = 2\\pi \\cdot 4 \\cdot 10^{-6} = 8\\pi \\cdot 10^{-6}\\text{ s}$."
    },
    {
      id: `fb_q_6_${Date.now()}`,
      text: "Trong thí nghiệm giao thoa ánh sáng bằng khe Y-âng, khoảng cách giữa hai khe là $a = 1\\text{ mm}$, khoảng cách từ hai khe đến màn là $D = 2\\text{ m}$. Ánh sáng đơn sắc có bước sóng $\\lambda = 0.6\\ \\mu\\text{m}$. Khoảng vân $i$ giao thoa trên màn bằng:",
      options: [
        "A. $1.2\\text{ mm}$",
        "B. $0.6\\text{ mm}$",
        "C. $0.3\\text{ mm}$",
        "D. $1.8\\text{ mm}$"
      ],
      correctIndex: 0,
      explanation: "Công thức khoảng vân: $i = \\frac{\\lambda D}{a}$.\nThay số: $i = \\frac{0.6 \\cdot 10^{-6} \\cdot 2}{1 \\cdot 10^{-3}} = 1.2 \\cdot 10^{-3}\\text{ m} = 1.2\\text{ mm}$."
    },
    {
      id: `fb_q_7_${Date.now()}`,
      text: "Đặt một điện áp xoay chiều $u = 220\\sqrt{2}\\cos(100\\pi t)\\text{ V}$ vào hai đầu đoạn mạch gồm điện trở thuần $R = 110\\ \\Omega$ và cuộn cảm thuần. Hệ số công suất của mạch đạt cực đại bằng:",
      options: [
        "A. $1$",
        "B. $0.5$",
        "C. $\\frac{\\sqrt{2}}{2}$",
        "D. $0.707$"
      ],
      correctIndex: 0,
      explanation: "Hệ số công suất cực đại $\\cos\\varphi = 1$ khi mạch xảy ra cộng hưởng điện hoặc khi đoạn mạch chỉ chứa điện trở thuần $R$."
    },
    {
      id: `fb_q_8_${Date.now()}`,
      text: "Hòa tan hoàn toàn $2.4\\text{ g}$ kim loại Magie ($Mg$, $M=24$) trong dung dịch $HCl$ dư thu được thể tích khí $H_2$ ở đktc là:",
      options: [
        "A. $2.24\\text{ lít}$",
        "B. $1.12\\text{ lít}$",
        "C. $4.48\\text{ lít}$",
        "D. $3.36\\text{ lít}$"
      ],
      correctIndex: 0,
      explanation: "Phương trình phản ứng: $Mg + 2HCl \\rightarrow MgCl_2 + H_2 \\uparrow$\nTa có $n_{Mg} = \\frac{2.4}{24} = 0.1\\text{ mol}$.\nTheo phương trình phản ứng: $n_{H_2} = n_{Mg} = 0.1\\text{ mol}$.\nThể tích khí $H_2$ ở đktc là: $V = 0.1 \\cdot 22.4 = 2.24\\text{ lít}$."
    },
    {
      id: `fb_q_9_${Date.now()}`,
      text: "Sản phẩm chính của phản ứng cộng giữa Propilen ($CH_3-CH=CH_2$) với axit clohiđric ($HCl$) theo quy tắc Mac-côp-nhị-cốp là:",
      options: [
        "A. 2-clopropan ($CH_3-CHCl-CH_3$)",
        "B. 1-clopropan ($CH_3-CH_2-CH_2Cl$)",
        "C. 1,2-đicloropropan",
        "D. 2,2-đicloropropan"
      ],
      correctIndex: 0,
      explanation: "Theo quy tắc Mac-côp-nhị-cốp, trong phản ứng cộng tác nhân không đối xứng $HX$ vào liên kết đôi của anken, nguyên tử $H$ cộng vào cacbon bậc thấp hơn (nhiều $H$ hơn), còn $X$ cộng vào cacbon bậc cao hơn (ít $H$ hơn). Do đó sản phẩm chính là 2-clopropan."
    },
    {
      id: `fb_q_10_${Date.now()}`,
      text: "Công thức hóa học của sắt(III) sunfat là:",
      options: [
        "A. $Fe_2(SO_4)_3$",
        "B. $FeSO_4$",
        "C. $Fe_3O_4$",
        "D. $Fe_2O_3$"
      ],
      correctIndex: 0,
      explanation: "Sắt(III) sunfat được tạo thành từ cation $Fe^{3+}$ và anion sunfat $SO_4^{2-}$. Do đó công thức là $Fe_2(SO_4)_3$."
    },
    {
      id: `fb_q_11_${Date.now()}`,
      text: "Trong dao động cơ điều hòa, đại lượng nào sau đây biến thiên cùng tần số nhưng trễ pha $\\frac{\\pi}{2}$ so với gia tốc $a$?",
      options: [
        "A. Vận tốc $v$",
        "B. Li độ $x$",
        "C. Lực kéo về $F$",
        "D. Động năng $W_d$"
      ],
      correctIndex: 0,
      explanation: "Gia tốc $a$ nhanh pha $\\frac{\\pi}{2}$ so với vận tốc $v$, đồng thời ngược pha với li độ $x$ (nhanh pha $\\pi$). Do đó, vận tốc $v$ trễ pha $\\frac{\\pi}{2}$ so với gia tốc $a$."
    },
    {
      id: `fb_q_12_${Date.now()}`,
      text: "Hòa tan hoàn toàn $5.6\\text{ g}$ sắt ($Fe$, $M=56$) trong dung dịch $HNO_3$ loãng dư thu được khí $NO$ (sản phẩm khử duy nhất). Số mol electron mà nguyên tử sắt đã nhường là:",
      options: [
        "A. $0.3\\text{ mol}$",
        "B. $0.2\\text{ mol}$",
        "C. $0.1\\text{ mol}$",
        "D. $0.4\\text{ mol}$"
      ],
      correctIndex: 0,
      explanation: "Số mol của $Fe$ là: $n_{Fe} = \\frac{5.6}{56} = 0.1\\text{ mol}$.\nSắt tác dụng với $HNO_3$ dư tạo muối sắt(III): $Fe \\rightarrow Fe^{3+} + 3e$.\nDo đó số mol electron nhường là: $n_e = 3 \\cdot n_{Fe} = 0.3\\text{ mol}$."
    }
  ];
}

// 2. Generate new quiz using Gemini AI (AI & OCR Scanner)
app.post("/api/quiz/generate", async (req, res) => {
  const { topic, teacherName, timeLimit, docText, base64Image, model, step, questions } = req.body;
  const clientApiKey = req.headers["x-api-key"] as string;
  const selectedModel = model || "gemini-3-pro-preview"; // Default is gemini-3-pro-preview

  try {
    let contentsPayload: any = [];
    let schemaConfig: any = {};
    let systemInstruction = "";

    const currentStep = step ? parseInt(step) : null;

    if (currentStep === null) {
      // Legacy full generation mode
      if (base64Image) {
        const mimeType = base64Image.split(";")[0].split(":")[1] || "";
        const base64Data = base64Image.split(",")[1] || base64Image;

        if (mimeType === "application/pdf") {
          contentsPayload = [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Data,
              },
            },
            {
              text: `Bạn là Giáo viên và Chuyên gia EdTech số hóa đề thi. Hãy bóc tách và phân tích đề thi từ tài liệu PDF này. 
Đặc biệt chú ý quy ước đáp án đúng: Trong đề thi PDF, đáp án đúng của mỗi câu hỏi luôn được đánh dấu bằng cách GẠCH CHÂN (underline) dưới ký tự đầu tiên của đáp án (A, B, C, hoặc D) (ví dụ: chữ A, B, C hoặc D có gạch dưới chân).
Hãy tìm ký hiệu gạch chân này để xác định chính xác correctIndex (từ 0 đến 3) tương ứng với A=0, B=1, C=2, D=3.
Hãy tái tạo, hiệu chỉnh và xuất ra chính xác đúng 12 câu hỏi trắc nghiệm có chất lượng sư phạm cao nhất.
Yêu cầu đề thi phải bao gồm các công thức toán học, lý học, hóa học định dạng LaTeX chuẩn chỉ giữa cặp dấu $...$ hoặc $$...$$.
Nếu tài liệu không đủ 12 câu hỏi, hãy tự động sáng tạo thêm các câu hỏi liên quan để đạt đúng 12 câu hỏi.`,
            },
          ];
        } else if (mimeType.includes("wordprocessingml") || mimeType.includes("docx") || mimeType.includes("msword")) {
          const docBuffer = Buffer.from(base64Data, "base64");
          const mammothResult = await mammoth.convertToHtml({ buffer: docBuffer });
          const docHtml = mammothResult.value;

          const docContext = `Dưới đây là tài liệu đề thi định dạng HTML được trích xuất từ file Word (.docx) của giáo viên (các chữ được gạch chân đại diện cho đáp án đúng được biểu diễn bằng thẻ <u> hoặc tương đương):\n"""\n${docHtml}\n"""`;
          promptContent = `Soạn thảo hoặc bóc tách đúng 12 câu hỏi trắc nghiệm (mỗi câu 4 đáp án) dựa trên tài liệu sau:
Chủ đề: ${topic || "Hỗn hợp Toán Lý Hóa phổ thông nâng cao"}
${docContext}

Yêu cầu cực kỳ quan trọng:
1. Bạn phải xuất ra ĐÚNG 12 câu hỏi. Mỗi câu hỏi gồm đúng 4 lựa chọn.
2. Đáp án đúng của mỗi câu hỏi luôn được đánh dấu bằng cách GẠCH CHÂN ký tự đầu tiên của đáp án (A, B, C, hoặc D). Trong mã HTML được trích xuất, ký tự gạch chân này sẽ nằm trong các thẻ như <u>A</u>, <u>B</u>, <u>C</u>, <u>D</u> hoặc tương đương. Hãy quét kỹ mã HTML để tìm thẻ gạch chân này và gán correctIndex chính xác (từ 0 đến 3) tương ứng với A=0, B=1, C=2, D=3.
3. TOÀN BỘ các biểu thức toán học, phương trình phản ứng hóa học hoặc ký hiệu vật lý phải được bao quanh bởi ký pháp LaTeX như $x^2 + 2x = 0$ hoặc $H_2SO_4$. Không viết thô chữ thường.
4. Cung cấp lời giải thích chi tiết, ngắn gọn, sư phạm cho từng câu để học sinh đối chiếu kiến thức khoa học.`;
          contentsPayload = promptContent;
        } else {
          contentsPayload = [
            {
              inlineData: {
                mimeType: mimeType || "image/png",
                data: base64Data,
              },
            },
            {
              text: `Bạn là Giáo viên và Chuyên gia EdTech số hóa đề thi. Hãy bóc tách và phân tích đề thi từ hình ảnh này (có thể là chữ viết tay hoặc văn bản in). 
Đặc biệt chú ý quy ước đáp án đúng: Trong ảnh đề thi, đáp án đúng của mỗi câu hỏi luôn được đánh dấu bằng cách GẠCH CHÂN (underline) dưới ký tự đầu tiên của đáp án (A, B, C, hoặc D) (ví dụ: chữ A, B, C hoặc D có gạch chân bên dưới).
Hãy tìm ký hiệu gạch chân này để xác định chính xác correctIndex (từ 0 đến 3) tương ứng với A=0, B=1, C=2, D=3.
Hãy tái tạo, hiệu chỉnh và xuất ra chính xác đúng 12 câu hỏi trắc nghiệm có chất lượng sư phạm cao nhất.
Yêu cầu đề thi phải bao gồm các công thức toán học, lý học, hóa học định dạng LaTeX chuẩn chỉ giữa cặp dấu $...$ hoặc $$...$$.
If the image doesn't contain enough questions, please generate matching science questions to make up exactly 12 questions.`,
            },
          ];
        }
      } else {
        const docContext = docText ? `\nDưới đây là tài liệu/đề thi giáo viên tải lên:\n"""\n${docText}\n"""` : "";
        promptContent = `Soạn thảo hoặc bóc tách đúng 12 câu hỏi trắc nghiệm (mỗi câu 4 đáp án) dựa trên chủ đề hoặc tài liệu sau:
Chủ đề: ${topic || "Hỗn hợp Toán Lý Hóa phổ thông nâng cao"}
${docContext}

Yêu cầu cực kỳ quan trọng:
1. Bạn phải xuất ra ĐÚNG 12 câu hỏi. Mỗi câu hỏi gồm đúng 4 lựa chọn.
2. Đáp án đúng của mỗi câu hỏi được giáo viên đánh dấu bằng cách gạch chân ký tự đầu tiên của đáp án (A, B, C, hoặc D) (ví dụ: <u>A</u> hoặc gạch dưới). Hãy bóc tách ký hiệu gạch chân này để xác định correctIndex chính xác (từ 0 đến 3) tương ứng với A=0, B=1, C=2, D=3. Nếu không tìm thấy gạch chân, hãy tự suy luận đáp án khoa học chính xác nhất.
3. TOÀN BỘ các biểu thức toán học, phương trình phản ứng hóa học hoặc ký hiệu vật lý phải được bao quanh bởi ký pháp LaTeX như $x^2 + 2x = 0$ hoặc $H_2SO_4$. Không viết thô chữ thường.
4. Cung cấp lời giải thích chi tiết, ngắn gọn, sư phạm cho từng câu để học sinh đối chiếu kiến thức khoa học.`;
        contentsPayload = promptContent;
      }

      systemInstruction = `Bạn là một Giáo viên Trung học Phổ thông ưu tú tại Việt Nam và là kiến trúc sư số hóa EdTech chuyên nghiệp.
Nhiệm vụ của bạn là trả về một mảng gồm đúng 12 câu hỏi trắc nghiệm khách quan chất lượng cao theo định dạng JSON chuẩn.
BẮT BUỘC:
1. Bạn phải định dạng các phương trình, công thức toán học, vật lý, hóa học bằng LaTeX giữa các cặp dấu $...$ cho công thức nội dòng hoặc $$...$$ cho các công thức hiển thị riêng.
2. ĐỐI VỚI ĐÁP ÁN ĐÚNG: Bạn phải quét kỹ tài liệu tải lên (mã HTML từ Word có các thẻ <u>, file PDF, hoặc hình ảnh có gạch chân). Giáo viên quy ước đáp án đúng bằng cách gạch chân ký tự đầu tiên của đáp án (A, B, C, hoặc D) (ví dụ: <u>A</u> hoặc ký tự được gạch dưới). Hãy bóc tách chính xác vị trí gạch chân này để gán 'correctIndex' (từ 0 đến 3 tương ứng với A=0, B=1, C=2, D=3). Nếu tài liệu không chứa định dạng gạch chân, hãy tự suy luận đáp án chính xác nhất về mặt khoa học.
3. Đảm bảo mảng trả về luôn khớp chính xác với định dạng JSON yêu cầu.`;

      schemaConfig = {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Mảng chứa đúng 12 câu hỏi trắc nghiệm học tập.",
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "Nội dung câu hỏi tiếng Việt, có chứa LaTeX." },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Danh sách 4 đáp án lựa chọn (phải chứa đúng 4 chuỗi).",
              },
              correctIndex: { type: Type.INTEGER, description: "Chỉ mục của câu trả lời chính xác từ 0 đến 3." },
              explanation: { type: Type.STRING, description: "Lời giải thích sư phạm chi tiết kèm LaTeX giải thích đáp án đúng." },
            },
            required: ["text", "options", "correctIndex", "explanation"],
          },
        },
      };
    } else if (currentStep === 1) {
      // Step 1: Extract raw questions
      if (base64Image) {
        const mimeType = base64Image.split(";")[0].split(":")[1] || "";
        const base64Data = base64Image.split(",")[1] || base64Image;

        if (mimeType === "application/pdf") {
          contentsPayload = [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Data,
              },
            },
            {
              text: `Bạn là Giáo viên và Chuyên gia EdTech số hóa đề thi. Hãy bóc tách và phân tích đề thi từ tài liệu PDF này. 
Đặc biệt chú ý quy ước đáp án đúng: Trong đề thi PDF, đáp án đúng của mỗi câu hỏi luôn được đánh dấu bằng cách GẠCH CHÂN (underline) dưới ký tự đầu tiên của đáp án (A, B, C, hoặc D) (ví dụ: chữ A, B, C hoặc D có gạch dưới chân).
Hãy tìm ký hiệu gạch chân này để xác định chính xác correctIndex (từ 0 đến 3) tương ứng với A=0, B=1, C=2, D=3.
Hãy trích xuất và xuất ra chính xác đúng 12 câu hỏi trắc nghiệm dưới dạng mảng JSON.
Nếu tài liệu không đủ 12 câu hỏi, hãy tự tạo thêm các câu hỏi trắc nghiệm liên quan để đạt đúng 12 câu hỏi.`,
            },
          ];
        } else if (mimeType.includes("wordprocessingml") || mimeType.includes("docx") || mimeType.includes("msword")) {
          const docBuffer = Buffer.from(base64Data, "base64");
          const mammothResult = await mammoth.convertToHtml({ buffer: docBuffer });
          const docHtml = mammothResult.value;

          const docContext = `Dưới đây là tài liệu đề thi định dạng HTML được trích xuất từ file Word (.docx) của giáo viên (các chữ được gạch chân đại diện cho đáp án đúng được biểu diễn bằng thẻ <u> hoặc tương đương):\n"""\n${docHtml}\n"""`;
          promptContent = `Trích xuất và bóc tách đúng 12 câu hỏi trắc nghiệm (mỗi câu 4 đáp án) dựa trên tài liệu sau:
Chủ đề: ${topic || "Hỗn hợp Toán Lý Hóa phổ thông nâng cao"}
${docContext}

Yêu cầu cực kỳ quan trọng:
1. Bạn phải xuất ra ĐÚNG 12 câu hỏi. Mỗi câu hỏi gồm đúng 4 lựa chọn.
2. Đáp án đúng của mỗi câu hỏi luôn được đánh dấu bằng cách GẠCH CHÂN ký tự đầu tiên của đáp án (A, B, C, hoặc D). Trong mã HTML được trích xuất, ký tự gạch chân này sẽ nằm trong các thẻ như <u>A</u>, <u>B</u>, <u>C</u>, <u>D</u> hoặc tương đương. Hãy quét kỹ mã HTML để tìm thẻ gạch chân này và gán correctIndex chính xác (từ 0 đến 3) tương ứng với A=0, B=1, C=2, D=3. Nếu không tìm thấy gạch chân, hãy đoán đáp án đúng.
3. Nếu tài liệu không đủ 12 câu hỏi, hãy tự tạo thêm các câu hỏi liên quan để đạt đúng 12 câu hỏi.`;
          contentsPayload = promptContent;
        } else {
          contentsPayload = [
            {
              inlineData: {
                mimeType: mimeType || "image/png",
                data: base64Data,
              },
            },
            {
              text: `Bạn là Giáo viên và Chuyên gia EdTech số hóa đề thi. Hãy bóc tách và phân tích đề thi từ hình ảnh này (có thể là chữ viết tay hoặc văn bản in). 
Đặc biệt chú ý quy ước đáp án đúng: Trong ảnh đề thi, đáp án đúng của mỗi câu hỏi luôn được đánh dấu bằng cách GẠCH CHÂN (underline) dưới ký tự đầu tiên của đáp án (A, B, C, hoặc D) (ví dụ: chữ A, B, C hoặc D có gạch chân bên dưới).
Hãy tìm ký hiệu gạch chân này để xác định chính xác correctIndex (từ 0 đến 3) tương ứng với A=0, B=1, C=2, D=3.
Hãy trích xuất và xuất ra chính xác đúng 12 câu hỏi trắc nghiệm.
Nếu hình ảnh không đủ 12 câu hỏi, hãy tự tạo thêm các câu hỏi trắc nghiệm khoa học liên quan để đạt đúng 12 câu hỏi.`,
            },
          ];
        }
      } else {
        const docContext = docText ? `\nDưới đây là tài liệu/đề thi giáo viên tải lên:\n"""\n${docText}\n"""` : "";
        promptContent = `Trích xuất hoặc tự tạo đúng 12 câu hỏi trắc nghiệm (mỗi câu 4 đáp án) dựa trên chủ đề hoặc tài liệu sau:
Chủ đề: ${topic || "Hỗn hợp Toán Lý Hóa phổ thông nâng cao"}
${docContext}

Yêu cầu cực kỳ quan trọng:
1. Bạn phải xuất ra ĐÚNG 12 câu hỏi. Mỗi câu hỏi gồm đúng 4 lựa chọn.
2. Đáp án đúng được giáo viên đánh dấu bằng cách gạch chân ký tự đầu tiên của đáp án (A, B, C, hoặc D). Hãy bóc tách ký hiệu gạch chân này để xác định correctIndex chính xác (từ 0 đến 3) tương ứng với A=0, B=1, C=2, D=3. Nếu không tìm thấy, hãy tự suy luận đáp án khoa học chính xác nhất.`;
        contentsPayload = promptContent;
      }

      systemInstruction = `Bạn là một Giáo viên Trung học Phổ thông ưu tú tại Việt Nam.
Nhiệm vụ của bạn là trích xuất và trả về một mảng gồm đúng 12 câu hỏi trắc nghiệm thô từ tài liệu của giáo viên theo định dạng JSON. Không cần lo lắng về định dạng LaTeX trong bước này.`;

      schemaConfig = {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Mảng chứa đúng 12 câu hỏi trắc nghiệm bóc tách từ tài liệu.",
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "Nội dung câu hỏi thô." },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Danh sách 4 đáp án lựa chọn.",
              },
              correctIndex: { type: Type.INTEGER, description: "Chỉ mục đáp án đúng (0-3)." },
            },
            required: ["text", "options", "correctIndex"],
          },
        },
      };
    } else if (currentStep === 2) {
      // Step 2: Format questions using LaTeX
      if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({ error: "Thiếu danh sách câu hỏi để thực hiện bước 2." });
      }

      const inputQuestionsStr = JSON.stringify(questions);
      contentsPayload = `Dưới đây là danh sách câu hỏi trắc nghiệm cần được chuẩn hóa định dạng công thức khoa học:\n"""\n${inputQuestionsStr}\n"""\n\nHãy giữ nguyên nội dung câu hỏi và các đáp án, nhưng hãy tìm tất cả các biểu thức toán học, phương trình phản ứng hóa học hoặc ký hiệu vật lý, các đại lượng khoa học và định dạng chúng sang LaTeX chuẩn đặt giữa cặp ký tự $...$ hoặc $$...$$. Ví dụ: $x^2 + 2x = 0$, $H_2SO_4$, $Fe^{3+}$, $10^{-6}\\text{ s}$. Không viết thô chữ thường hay ký hiệu thô.`;

      systemInstruction = `Bạn là một chuyên gia soạn thảo LaTeX học thuật. Nhiệm vụ của bạn là chuẩn hóa định dạng công thức toán lý hóa sang LaTeX cho mảng JSON các câu hỏi được cung cấp. Không thay đổi số thứ tự hay ý nghĩa của câu hỏi và đáp án, chỉ chuẩn hóa công thức sang LaTeX chuẩn.`;

      schemaConfig = {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Mảng chứa danh sách các câu hỏi đã được chuẩn hóa LaTeX.",
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "Nội dung câu hỏi có chứa LaTeX." },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Danh sách 4 đáp án có chứa LaTeX.",
              },
              correctIndex: { type: Type.INTEGER, description: "Chỉ mục đáp án đúng." },
            },
            required: ["text", "options", "correctIndex"],
          },
        },
      };
    } else if (currentStep === 3) {
      // Step 3: Add explanations
      if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({ error: "Thiếu danh sách câu hỏi để thực hiện bước 3." });
      }

      const inputQuestionsStr = JSON.stringify(questions);
      contentsPayload = `Dưới đây là danh sách câu hỏi trắc nghiệm đã được chuẩn hóa LaTeX:\n"""\n${inputQuestionsStr}\n"""\n\nHãy tạo lời giải thích chi tiết, ngắn gọn, dễ hiểu và chuẩn sư phạm bằng tiếng Việt (có định dạng LaTeX) cho từng câu hỏi để điền vào trường 'explanation'. Đồng thời kiểm tra lại correctIndex xem đã chính xác chưa.`;

      systemInstruction = `Bạn là một Giáo viên Trung học Phổ thông ưu tú tại Việt Nam. Nhiệm vụ của bạn là bổ sung lời giải thích sư phạm chi tiết bằng tiếng Việt (có chứa LaTeX) cho từng câu hỏi trong mảng JSON được cung cấp.`;

      schemaConfig = {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Mảng chứa các câu hỏi hoàn chỉnh bao gồm giải thích chi tiết.",
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "Nội dung câu hỏi." },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING, description: "Lời giải thích sư phạm chi tiết bằng tiếng Việt có LaTeX." },
            },
            required: ["text", "options", "correctIndex", "explanation"],
          },
        },
      };
    }

    let responseText = "";
    let logs: string[] = [];

    if (clientApiKey && clientApiKey.trim() !== "") {
      console.log(`[Gemini] Sử dụng Custom API Key từ client với model: ${selectedModel}`);
      const customAi = new GoogleGenAI({
        apiKey: clientApiKey.trim(),
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      const response = await generateContentWithRetry(customAi, selectedModel, contentsPayload, schemaConfig);
      responseText = response.text;
    } else {
      // Fallback mode if no key configured on server
      const activeKey = apiKeyManager.getRawKey();
      if (!activeKey) {
        if (currentStep === null || currentStep === 1) {
          const fallbackQuestions = generateFallbackQuizQuestions();
          const draftQuiz = {
            id: `draft_quiz_fallback_${Date.now()}`,
            title: topic ? `Đề thi mẫu: ${topic}` : "Đề mẫu Khoa học tự nhiên phổ thông",
            teacherName: teacherName || "Thầy cô giáo",
            durationSeconds: parseInt(timeLimit) || 30,
            questions: fallbackQuestions,
            createdAt: new Date().toISOString(),
          };
          return res.json({
            success: true,
            quiz: draftQuiz,
            isFallback: true,
            warning: "Vui lòng nhập API Key của bạn qua nút Settings trên Header hoặc cấu hình trong tab Cấu hình API Key để sử dụng AI. Hệ thống tạm thời hiển thị Đề thi mẫu!"
          });
        } else {
          return res.status(400).json({ error: "Không thể thực hiện các bước tiếp theo: Server không có API Key hoạt động." });
        }
      }

      const { response, logs: rotationLogs } = await generateContentWithRotation(selectedModel, contentsPayload, schemaConfig);
      responseText = response.text;
      logs = rotationLogs;
    }

    const parsedQuestions = JSON.parse(responseText || "[]") as any[];

    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      throw new Error("Không thể bóc tách đề thi dạng JSON hợp lệ.");
    }

    if (currentStep === 1 || currentStep === 2) {
      const sanitized = parsedQuestions.map((q) => {
        let opts = Array.isArray(q.options) ? q.options : [];
        while (opts.length < 4) {
          opts.push(`Đáp án bổ sung ${opts.length + 1}`);
        }
        opts = opts.slice(0, 4);

        return {
          text: q.text || "Câu hỏi không có nội dung",
          options: opts,
          correctIndex: typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < 4 ? q.correctIndex : 0,
        };
      });

      return res.json({
        success: true,
        questions: sanitized,
        rotationLogs: logs.length > 0 ? logs : undefined
      });
    }

    // Adapt structure to ensure they match Question interface
    const questions: Question[] = parsedQuestions.slice(0, 12).map((q, idx) => {
      // Fill options if not exactly 4
      let opts = Array.isArray(q.options) ? q.options : [];
      while (opts.length < 4) {
        opts.push(`Đáp án bổ sung ${opts.length + 1}`);
      }
      opts = opts.slice(0, 4);

      return {
        id: `gen_q_${idx}_${Date.now()}`,
        text: q.text || "Câu hỏi không có nội dung",
        options: opts,
        correctIndex: typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < 4 ? q.correctIndex : 0,
        explanation: q.explanation || "Chưa có giải thích chi tiết cho câu hỏi này.",
      };
    });

    // Prepare Draft Quiz, DO NOT overwrite activeQuiz immediately
    const draftQuiz = {
      id: `draft_quiz_${Date.now()}`,
      title: topic ? `Đề thi AI: ${topic}` : "Đề thi số hóa quét bằng AI/OCR",
      teacherName: teacherName || "Giáo viên AI",
      durationSeconds: parseInt(timeLimit) || 30,
      questions: questions,
      createdAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      quiz: draftQuiz,
      rotationLogs: logs.length > 0 ? logs : undefined
    });
  } catch (err: any) {
    console.error("Lỗi tạo đề thi bằng Gemini:", err);
    const errMsg = err.message || String(err);

    // Return the actual API error code in 500 status so the frontend can catch it and display it
    res.status(500).json({ error: errMsg });
  }
});

// 2.5. Publish the edited quiz to make it official
app.post("/api/quiz/publish", (req, res) => {
  const { title, teacherName, durationSeconds, questions } = req.body;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: "Danh sách câu hỏi không hợp lệ." });
  }

  // Save as official active quiz
  activeQuiz = {
    id: `ai_quiz_${Date.now()}`,
    title: title || "Đề thi số hóa chính thức",
    teacherName: teacherName || "Thầy cô giáo",
    durationSeconds: parseInt(durationSeconds) || 30,
    questions: questions.map((q: any, idx: number) => ({
      id: q.id || `gen_q_${idx}_${Date.now()}`,
      text: q.text || "Câu hỏi không có nội dung",
      options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      correctIndex: typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < 4 ? q.correctIndex : 0,
      explanation: q.explanation || "Chưa có giải thích chi tiết cho câu hỏi này.",
    })),
    createdAt: new Date().toISOString(),
  };

  // Clean up previous student sessions on new quiz publication
  studentSessions.clear();
  personalizedQuestionsMap.clear();

  res.json({
    success: true,
    quiz: {
      id: activeQuiz.id,
      title: activeQuiz.title,
      teacherName: activeQuiz.teacherName,
      durationSeconds: activeQuiz.durationSeconds,
      questionCount: activeQuiz.questions.length,
    },
  });
});

// 2.7. Export the active quiz as a formatted Word (.docx) document
app.get("/api/quiz/export-docx", async (req, res) => {
  try {
    if (!activeQuiz || !activeQuiz.questions || activeQuiz.questions.length === 0) {
      return res.status(400).json({ error: "Không có đề thi nào đang hoạt động." });
    }

    const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType } = docx;

    // Create a beautiful, standard Word document
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: "Times New Roman",
              size: 26, // 13pt
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch
                bottom: 1440,
                left: 1440,
                right: 1440,
              },
            },
          },
          children: [
            // Side-by-side header block using a borderless table
            new Table({
              columnWidths: [4680, 4680],
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      borders: {
                        top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                        bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                        left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                        right: { style: BorderStyle.NONE, size: 0, color: "auto" }
                      },
                      width: { size: 4680, type: WidthType.DXA },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({ text: "SỞ GIÁO DỤC VÀ ĐÀO TẠO", bold: true, size: 22 }),
                          ]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({ text: "TRƯỜNG THPT CHUYÊN SỐ HÓA", bold: true, size: 22 }),
                          ]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({ text: "-----------------------", size: 20 }),
                          ]
                        })
                      ]
                    }),
                    new TableCell({
                      borders: {
                        top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                        bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                        left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                        right: { style: BorderStyle.NONE, size: 0, color: "auto" }
                      },
                      width: { size: 4680, type: WidthType.DXA },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({ text: "ĐỀ THI TRẮC NGHIỆM CHÍNH THỨC", bold: true, size: 22 }),
                          ]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({ text: "Môn: Khoa học tự nhiên", bold: true, size: 22 }),
                          ]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({ text: "Thời gian làm bài: " + activeQuiz.durationSeconds + " giây / câu", italic: true, size: 20 }),
                          ]
                        })
                      ]
                    })
                  ]
                })
              ]
            }),
            new Paragraph({ text: "", spacing: { after: 200 } }),

            // Title
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: activeQuiz.title.toUpperCase(),
                  bold: true,
                  size: 32, // 16pt
                }),
              ],
              spacing: { after: 200 },
            }),

            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `Giáo viên soạn đề: ${activeQuiz.teacherName}`,
                  italic: true,
                  size: 24,
                }),
              ],
              spacing: { after: 400 },
            }),

            // List of questions
            ...activeQuiz.questions.flatMap((q, idx) => {
              const questionNum = idx + 1;
              const labels = ["A", "B", "C", "D"];

              return [
                new Paragraph({
                  children: [
                    new TextRun({ text: `Câu ${questionNum}: `, bold: true }),
                    new TextRun({ text: q.text }),
                  ],
                  spacing: { before: 120, after: 120 },
                }),
                // Display options
                ...q.options.map((opt, optIdx) => {
                  return new Paragraph({
                    indent: { left: 360 }, // Indent options
                    children: [
                      new TextRun({ text: `${labels[optIdx]}. `, bold: true }),
                      new TextRun({ text: opt }),
                    ],
                    spacing: { after: 80 },
                  });
                }),
                new Paragraph({ text: "" }), // Space between questions
              ];
            }),

            new Paragraph({ text: "", spacing: { before: 200 } }),
            new Paragraph({
              children: [
                new TextRun({ text: "------------------ HẾT ------------------", bold: true }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // Page Break for Answers & Explanations Key
            new Paragraph({
              children: [new TextRun({ text: "ĐÁP ÁN & LỜI GIẢI CHI TIẾT", bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              pageBreakBefore: true,
              spacing: { after: 200 },
            }),

            ...activeQuiz.questions.flatMap((q, idx) => {
              const questionNum = idx + 1;
              const labels = ["A", "B", "C", "D"];
              return [
                new Paragraph({
                  children: [
                    new TextRun({ text: `Câu ${questionNum}: `, bold: true }),
                    new TextRun({ text: `Đáp án đúng: `, bold: true }),
                    new TextRun({ text: labels[q.correctIndex], bold: true, color: "00aa00" }),
                  ],
                  spacing: { before: 120, after: 120 },
                }),
                new Paragraph({
                  indent: { left: 360 },
                  children: [
                    new TextRun({ text: "Lời giải chi tiết: ", italic: true, bold: true }),
                    new TextRun({ text: q.explanation }),
                  ],
                  spacing: { after: 200 },
                }),
              ];
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    
    // Clean title for filename
    const safeTitle = activeQuiz.title.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9\s-]/g, "").replace(/\s+/g, "_");
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="De_Thi_${encodeURIComponent(safeTitle)}.docx"`);
    res.send(buffer);
  } catch (err: any) {
    console.error("Lỗi khi xuất đề thi Word:", err);
    res.status(500).json({ error: "Không thể xuất đề thi sang định dạng Word: " + err.message });
  }
});

// 3. Student joins a quiz session
app.post("/api/session/join", (req, res) => {
  const { studentName, className } = req.body;

  if (!studentName || !className) {
    return res.status(400).json({ error: "Họ tên và Lớp là bắt buộc." });
  }

  const cleanName = studentName.trim();
  const cleanClass = className.trim();
  const sessionId = `${cleanName.toLowerCase().replace(/\s+/g, "_")}_${cleanClass.toLowerCase().replace(/\s+/g, "_")}_${Math.floor(Math.random() * 1000)}`;

  // Core Game feature: Random Shuffling ($P_{random}$)
  // Produce unique question ordering and option shuffling for this specific student
  const { shuffledQuestions } = shuffleQuizQuestionsAndOptions(activeQuiz.questions);

  const newSession: StudentSession = {
    id: sessionId,
    studentName: cleanName,
    className: cleanClass,
    quizId: activeQuiz.id,
    progress: 0,
    answers: [],
    score: 0,
    streak: 0,
    maxStreak: 0,
    badges: [],
    averageTime: 0,
    status: "đang làm",
    violationsCount: 0,
    lastActive: new Date().toISOString(),
  };

  studentSessions.set(sessionId, newSession);
  personalizedQuestionsMap.set(sessionId, shuffledQuestions);

  res.json({
    sessionId: sessionId,
    studentName: cleanName,
    className: cleanClass,
    quizTitle: activeQuiz.title,
    durationSeconds: activeQuiz.durationSeconds,
    totalQuestions: shuffledQuestions.length,
  });
});

// 4. Get student session status and personalized questions
app.get("/api/session/:id", (req, res) => {
  const sessionId = req.params.id;
  const session = studentSessions.get(sessionId);
  const personalizedQuestions = personalizedQuestionsMap.get(sessionId);

  if (!session || !personalizedQuestions) {
    return res.status(404).json({ error: "Phiên thi của học sinh không tồn tại." });
  }

  // Update last active
  session.lastActive = new Date().toISOString();

  // Send student metadata along with questions but HIDE correctIndex to prevent cheating
  const studentSafeQuestions = personalizedQuestions.map((q) => {
    const { correctIndex, explanation, ...safeQ } = q;
    return safeQ;
  });

  res.json({
    session: session,
    questions: studentSafeQuestions,
  });
});

// 5. Submit individual answer
app.post("/api/session/:id/submit", (req, res) => {
  const sessionId = req.params.id;
  const { questionIndex, selectedOption, timeTaken } = req.body; // selectedOption 0-3, timeTaken in seconds

  const session = studentSessions.get(sessionId);
  const personalizedQuestions = personalizedQuestionsMap.get(sessionId);

  if (!session || !personalizedQuestions) {
    return res.status(404).json({ error: "Phiên thi không tồn tại." });
  }

  if (session.status !== "đang làm") {
    return res.status(400).json({ error: "Bài thi đã được nộp hoặc bị khóa vi phạm." });
  }

  if (questionIndex !== session.progress) {
    return res.status(400).json({ error: "Câu hỏi không khớp tiến trình." });
  }

  const currentQuestion = personalizedQuestions[questionIndex];
  const isCorrect = selectedOption === currentQuestion.correctIndex;

  // Calculate new streak
  let newStreak = session.streak;
  if (isCorrect) {
    newStreak += 1;
  } else {
    newStreak = 0;
  }

  const maxStreak = Math.max(session.maxStreak, newStreak);

  // Gamification Badge Rules:
  // 3 consecutive correct: Bronze, 6: Silver, 10: Gold
  const badges: ("đồng" | "bạc" | "vàng")[] = [...session.badges];
  if (newStreak >= 3 && !badges.includes("đồng")) {
    badges.push("đồng");
  }
  if (newStreak >= 6 && !badges.includes("bạc")) {
    badges.push("bạc");
  }
  if (newStreak >= 10 && !badges.includes("vàng")) {
    badges.push("vàng");
  }

  // Update answers
  const updatedAnswers = [...session.answers];
  updatedAnswers[questionIndex] = {
    questionId: currentQuestion.id,
    selectedOption: selectedOption,
    isCorrect: isCorrect,
    timeTaken: parseFloat(timeTaken) || 0,
  };

  const newScore = updatedAnswers.filter(a => a.isCorrect).length;
  const newProgress = session.progress + 1;

  // Calculate average response time
  const totalTime = updatedAnswers.reduce((sum, a) => sum + a.timeTaken, 0);
  const averageTime = updatedAnswers.length > 0 ? totalTime / updatedAnswers.length : 0;

  // Check if completed
  const isCompleted = newProgress >= personalizedQuestions.length;
  const finalStatus = isCompleted ? "đã nộp" : "đang làm";

  const updatedSession: StudentSession = {
    ...session,
    progress: newProgress,
    answers: updatedAnswers,
    score: newScore,
    streak: newStreak,
    maxStreak: maxStreak,
    badges: badges,
    averageTime: parseFloat(averageTime.toFixed(2)),
    status: finalStatus,
    lastActive: new Date().toISOString(),
  };

  studentSessions.set(sessionId, updatedSession);

  // Return feedback for the specific question for interactive gamified experience
  res.json({
    success: true,
    isCorrect: isCorrect,
    correctOption: currentQuestion.correctIndex,
    explanation: currentQuestion.explanation,
    streak: newStreak,
    addedBadge: newStreak === 3 ? "đồng" : newStreak === 6 ? "bạc" : newStreak === 10 ? "vàng" : null,
    nextProgress: newProgress,
    status: finalStatus,
  });
});

// 6. Report anti-tab switching violation
app.post("/api/session/:id/violate", (req, res) => {
  const sessionId = req.params.id;
  const session = studentSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Phiên thi không tồn tại." });
  }

  if (session.status !== "đang làm") {
    return res.json({ success: true, status: session.status });
  }

  const newViolationsCount = session.violationsCount + 1;
  let finalStatus: "đang làm" | "đã nộp" | "vi phạm" = session.status;

  // If student violates 3 times, auto-submit and lock
  if (newViolationsCount >= 3) {
    finalStatus = "vi phạm";
  }

  const updatedSession: StudentSession = {
    ...session,
    violationsCount: newViolationsCount,
    status: finalStatus,
    lastActive: new Date().toISOString(),
  };

  studentSessions.set(sessionId, updatedSession);

  res.json({
    success: true,
    violationsCount: newViolationsCount,
    status: finalStatus,
  });
});

// 7. Force final submit
app.post("/api/session/:id/submit-final", (req, res) => {
  const sessionId = req.params.id;
  const session = studentSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Phiên thi không tồn tại." });
  }

  const updatedSession: StudentSession = {
    ...session,
    status: session.status === "vi phạm" ? "vi phạm" : "đã nộp",
    lastActive: new Date().toISOString(),
  };

  studentSessions.set(sessionId, updatedSession);

  res.json({
    success: true,
    status: updatedSession.status,
  });
});

// 8. Teacher Admin Stats - Calculates real-time analytics & bell curves
app.get("/api/teacher/stats", (req, res) => {
  const sessions = Array.from(studentSessions.values());
  const totalQuestionsCount = activeQuiz.questions.length;

  const totalStudents = sessions.length;
  const completedCount = sessions.filter(s => s.status === "đã nộp").length;
  const violationCount = sessions.filter(s => s.status === "vi phạm").length;

  // Class averages
  const completedOrViolated = sessions.filter(s => s.status !== "đang làm");
  const averageClassScore =
    completedOrViolated.length > 0
      ? completedOrViolated.reduce((sum, s) => sum + s.score, 0) / completedOrViolated.length
      : 0;

  const averageResponseTime =
    sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.averageTime, 0) / sessions.length
      : 0;

  // Grade distribution (for Bell Curve) - counts students achieving each score 0 to 12
  const distributionMap = new Map<number, number>();
  for (let i = 0; i <= totalQuestionsCount; i++) {
    distributionMap.set(i, 0);
  }
  completedOrViolated.forEach((s) => {
    distributionMap.set(s.score, (distributionMap.get(s.score) || 0) + 1);
  });

  const gradeDistribution = Array.from(distributionMap.entries()).map(([score, count]) => ({
    score: score,
    count: count,
  }));

  // Analyze top 3 toughest questions
  // Group attempts by original question id
  const questionFailureStats = new Map<
    string,
    { questionText: string; correctAns: string; wrongCount: number; totalAttempts: number }
  >();

  activeQuiz.questions.forEach((q) => {
    questionFailureStats.set(q.id, {
      questionText: q.text,
      correctAns: q.options[q.correctIndex],
      wrongCount: 0,
      totalAttempts: 0,
    });
  });

  // Aggregate student answers
  sessions.forEach((s) => {
    // We look up the original question and see if they answered correctly
    s.answers.forEach((ans) => {
      const stats = questionFailureStats.get(ans.questionId);
      if (stats) {
        stats.totalAttempts += 1;
        if (!ans.isCorrect) {
          stats.wrongCount += 1;
        }
      }
    });
  });

  const topWrongQuestions = Array.from(questionFailureStats.values())
    .filter(stat => stat.totalAttempts > 0)
    .map(stat => ({
      questionText: stat.questionText,
      correctAnswer: stat.correctAns,
      wrongCount: stat.wrongCount,
      totalAttempts: stat.totalAttempts,
      percentageWrong: parseFloat(((stat.wrongCount / stat.totalAttempts) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.percentageWrong - a.percentageWrong)
    .slice(0, 3);

  // Return full dashboard state
  const dashboardStats: DashboardStats = {
    totalStudents,
    completedCount,
    violationCount,
    averageClassScore: parseFloat(averageClassScore.toFixed(2)),
    averageResponseTime: parseFloat(averageResponseTime.toFixed(2)),
    gradeDistribution,
    topWrongQuestions,
  };

  res.json({
    activeQuiz: {
      title: activeQuiz.title,
      questionCount: totalQuestionsCount,
    },
    stats: dashboardStats,
    students: sessions.map(s => ({
      id: s.id,
      studentName: s.studentName,
      className: s.className,
      progress: s.progress,
      score: s.score,
      averageTime: s.averageTime,
      status: s.status,
      violationsCount: s.violationsCount,
      badges: s.badges,
    })),
  });
});

// 9. Teacher resets sessions
app.post("/api/teacher/reset", (req, res) => {
  studentSessions.clear();
  personalizedQuestionsMap.clear();
  res.json({ success: true, message: "Hệ thống giám sát đã được làm sạch." });
});

// 10. API Key Management endpoints
app.get("/api/keys", (req, res) => {
  res.json({
    success: true,
    key: apiKeyManager.getStatus(),
    rawKey: apiKeyManager.getRawKey()
  });
});

app.post("/api/keys/save", (req, res) => {
  const { key } = req.body;
  if (key === undefined) {
    return res.status(400).json({ success: false, error: "Dữ liệu API key không hợp lệ." });
  }
  apiKeyManager.saveKey(key);
  res.json({
    success: true,
    message: "Đã lưu và kích hoạt cấu hình API Key mới.",
    key: apiKeyManager.getStatus()
  });
});

app.post("/api/keys/reset", (req, res) => {
  apiKeyManager.resetStatus();
  res.json({
    success: true,
    message: "Đã thiết lập lại trạng thái hoạt động cho API Key.",
    key: apiKeyManager.getStatus()
  });
});

// VITE MIDDLEWARE SETUP FOR RICH FRONTEND DEVELOPMENT AND PRODUCTION SERVING

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Only start the server locally if not deploying as a Vercel Serverless Function
if (!process.env.VERCEL) {
  startServer();
}

export default app;
