export interface Question {
  id: string;
  text: string;          // LaTeX supported string
  options: string[];     // Array of 4 options with LaTeX support
  correctIndex: number;  // 0 to 3
  explanation: string;   // Explaining why with LaTeX support
}

export interface Quiz {
  id: string;
  title: string;
  teacherName: string;
  durationSeconds: number; // Duration per question
  questions: Question[];
  createdAt: string;
}

export interface StudentSession {
  id: string;            // Session ID (often "name_class")
  studentName: string;
  className: string;
  quizId: string;
  progress: number;      // Number of questions completed (0 to total)
  answers: {
    questionId: string;
    selectedOption: number;
    isCorrect: boolean;
    timeTaken: number; // in seconds
  }[];
  score: number;         // number of correct answers
  streak: number;        // current correct answers streak
  maxStreak: number;     // max streak achieved
  badges: ('đồng' | 'bạc' | 'vàng')[];
  averageTime: number;   // Average response time T_avg in seconds
  status: 'đang làm' | 'đã nộp' | 'vi phạm';
  violationsCount: number; // Max 3 before force nộp bài
  lastActive: string;
}

export interface DashboardStats {
  totalStudents: number;
  completedCount: number;
  violationCount: number;
  averageClassScore: number;
  averageResponseTime: number;
  gradeDistribution: { score: number; count: number }[]; // For bell curve chart
  topWrongQuestions: {
    questionText: string;
    correctAnswer: string;
    wrongCount: number;
    totalAttempts: number;
    percentageWrong: number;
  }[];
}
