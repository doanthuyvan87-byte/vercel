import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WordClue, CrosswordData, PlacedWord } from './types';
import { generateCrossword } from './lib/crossword-generator';
import CrosswordGrid from './components/CrosswordGrid';
import ClueList from './components/ClueList';
import { 
  Plus, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  Eye, 
  Download, 
  Printer, 
  Save, 
  FileJson, 
  Timer, 
  Trophy,
  Trash2,
  Lightbulb,
  Sparkles,
  Loader2,
  X,
  Check,
  Share2,
  Copy,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { GoogleGenAI, Type } from "@google/genai";
import LZString from 'lz-string';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const DEFAULT_INPUT = `BIT Đơn vị nhỏ nhất của dữ liệu
CHIASE Hành động truyền thông tin
NGUONTIN Nơi cung cấp thông tin
MANG Hệ thống kết nối các máy tính
DULIEU Các con số hoặc văn bản được xử lý
PHANMEM Các chương trình chạy trên máy tính`;

export default function App() {
  const [inputText, setInputText] = useState(DEFAULT_INPUT);
  const [topic, setTopic] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [crossword, setCrossword] = useState<CrosswordData | null>(null);
  const [userGrid, setUserGrid] = useState<string[][]>([]);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [time, setTime] = useState(0);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [hintCount, setHintCount] = useState(0);

  // Sharing state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // Modal state
  const [activeWord, setActiveWord] = useState<PlacedWord | null>(null);
  const [modalInput, setModalInput] = useState<string[]>([]);
  const modalInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (isGameStarted && !isComplete && !revealed) {
      interval = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGameStarted, isComplete, revealed]);

  const handleGenerate = useCallback((customInput?: string | any) => {
    const textToUse = (typeof customInput === 'string') ? customInput : inputText;
    const lines = textToUse.trim().split('\n');
    const wordClues: WordClue[] = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const word = parts[0];
      const clue = parts.slice(1).join(' ');
      return { word, clue };
    }).filter(wc => wc.word && wc.clue);

    if (wordClues.length < 3) {
      if (!customInput) alert("Vui lòng nhập ít nhất 3 từ!");
      return;
    }

    const result = generateCrossword(wordClues);
    if (result) {
      setCrossword(result);
      setUserGrid(Array.from({ length: result.height }, () => Array(result.width).fill('')));
      setIsGameStarted(true);
      setRevealed(false);
      setChecked(false);
      setTime(0);
      setScore(0);
      setHintCount(0);
      setIsComplete(false);

      if (result.unplacedWords.length > 0 && !customInput) {
        const skipped = result.unplacedWords.map(w => w.word).join(', ');
        alert(`Lưu ý: Một số từ không thể kết nối vào ô chữ: ${skipped}`);
      }
    } else {
      if (!customInput) alert("Không thể tạo ô chữ với các từ này. Hãy thử thêm nhiều từ hơn hoặc từ dài hơn!");
    }
  }, [inputText]);

  // Load from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data = params.get('data');
    if (data) {
      try {
        const decoded = LZString.decompressFromEncodedURIComponent(data);
        if (decoded) {
          setInputText(decoded);
          // Small delay to ensure state is updated if needed, though handleGenerate uses textToUse
          setTimeout(() => handleGenerate(decoded), 100);
        }
      } catch (e) {
        console.error("Failed to decode share data", e);
      }
    }
  }, [handleGenerate]);

  const handleShare = () => {
    const compressed = LZString.compressToEncodedURIComponent(inputText);
    const url = `${window.location.origin}${window.location.pathname}?data=${compressed}`;
    setShareUrl(url);
    setIsShareModalOpen(true);
    setCopied(false);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const handleAiGenerate = async () => {
    if (!process.env.GEMINI_API_KEY) {
      alert("Thiếu mã khóa API (GEMINI_API_KEY)! Nếu bạn đang dùng Vercel, hãy thêm mã này vào phần Environment Variables trong cài đặt dự án.");
      return;
    }

    if (!topic.trim()) {
      alert("Vui lòng nhập chủ đề!");
      return;
    }

    setIsAiLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Tạo một danh sách gồm 8-12 cặp từ và gợi ý cho trò chơi ô chữ về chủ đề: "${topic}". 
        Yêu cầu:
        1. Ngôn ngữ: Tiếng Việt.
        2. Từ (WORD): Viết hoa, không dấu (ví dụ: CONGNGHE), độ dài từ 3-10 ký tự.
        3. Gợi ý (CLUE): Ngắn gọn, súc tích, có dấu đầy đủ.
        4. Định dạng trả về: Mỗi dòng là "TỪ Gợi ý".
        Ví dụ:
        MAYTINH Thiết bị dùng để xử lý dữ liệu
        INTERNET Mạng toàn cầu kết nối mọi người`,
      });

      const text = response.text;
      if (text) {
        setInputText(text.trim());
        setTopic("");
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      alert("Có lỗi xảy ra khi tạo nội dung bằng AI. Vui lòng thử lại!");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleWordClick = (word: PlacedWord) => {
    setActiveWord(word);
    const currentAnswer: string[] = [];
    for (let i = 0; i < word.word.length; i++) {
      const x = word.direction === 'across' ? word.x + i : word.x;
      const y = word.direction === 'down' ? word.y + i : word.y;
      currentAnswer.push(userGrid[y][x]);
    }
    setModalInput(currentAnswer);
  };

  const handleModalInputChange = (index: number, value: string) => {
    const char = value.slice(-1).toUpperCase().normalize('NFC');
    const newInput = [...modalInput];
    newInput[index] = char;
    setModalInput(newInput);

    if (char !== '' && index < modalInput.length - 1) {
      modalInputRefs.current[index + 1]?.focus();
    }
  };

  const handleModalSubmit = () => {
    if (!activeWord || !crossword) return;

    const newGrid = [...userGrid];
    for (let i = 0; i < activeWord.word.length; i++) {
      const x = activeWord.direction === 'across' ? activeWord.x + i : activeWord.x;
      const y = activeWord.direction === 'down' ? activeWord.y + i : activeWord.y;
      newGrid[y][x] = modalInput[i];
    }
    setUserGrid(newGrid);
    setActiveWord(null);
    checkGameCompletion(newGrid);
  };

  const checkGameCompletion = (currentGrid: string[][]) => {
    if (!crossword) return;
    let allCorrect = true;
    crossword.grid.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell && currentGrid[y][x] !== cell.char) {
          allCorrect = false;
        }
      });
    });

    if (allCorrect && !revealed) {
      setIsComplete(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  const handleCheck = () => {
    if (!crossword) return;
    setChecked(true);
    
    let correct = 0;
    let total = 0;

    crossword.grid.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          total++;
          if (userGrid[y][x] === cell.char) {
            correct++;
          }
        }
      });
    });

    const newScore = Math.floor((correct / total) * 100);
    setScore(newScore);
  };

  const handleReveal = () => {
    setRevealed(true);
    setChecked(false);
  };

  const handleHint = () => {
    if (!crossword || revealed) return;
    
    if (hintCount >= 6) {
      alert("Bạn đã hết lượt gợi ý (tối đa 6 lần)!");
      return;
    }

    const emptyCells: {x: number, y: number}[] = [];
    crossword.grid.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell && userGrid[y][x] !== cell.char) {
          emptyCells.push({x, y});
        }
      });
    });

    if (emptyCells.length > 0) {
      const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      const newGrid = [...userGrid];
      newGrid[randomCell.y][randomCell.x] = crossword.grid[randomCell.y][randomCell.x]!.char;
      setUserGrid(newGrid);
      setHintCount(prev => prev + 1);
      setScore(prev => Math.max(0, prev - 5));
      checkGameCompletion(newGrid);
    }
  };

  const handlePrint = async () => {
    const element = document.getElementById('printable-area');
    if (!element) return;

    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('crossword-puzzle.pdf');
  };

  const handleSave = () => {
    if (!crossword) return;
    const data = JSON.stringify({ crossword, userGrid, time, score });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crossword-save.json';
    a.click();
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setCrossword(data.crossword);
        setUserGrid(data.userGrid);
        setTime(data.time);
        setScore(data.score);
        setIsGameStarted(true);
      } catch (err) {
        alert("File không hợp lệ!");
      }
    };
    reader.readAsText(file);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-sky-50 py-8 px-4 font-sans selection:bg-sky-200">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center p-4 bg-sky-400 rounded-3xl shadow-lg shadow-sky-200 mb-4"
          >
            <Sparkles className="text-white w-10 h-10" />
          </motion.div>
          <motion.h1 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-5xl font-black text-sky-900 mb-2 tracking-tight"
          >
            Ô Chữ <span className="text-sky-500">Vui Nhộn</span>
          </motion.h1>
          <p className="text-sky-600 text-lg font-bold">
            Cùng bé học vui mỗi ngày! 🌟
          </p>
        </header>

        {!isGameStarted ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-white rounded-[3rem] shadow-xl shadow-sky-100 p-10 border-4 border-sky-100 flex flex-col relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles size={120} className="text-sky-400" />
              </div>
              
              <div className="flex items-center mb-6">
                <div className="p-4 bg-amber-100 rounded-2xl mr-4 shadow-sm">
                  <Sparkles className="text-amber-500 w-8 h-8" />
                </div>
                <h2 className="text-3xl font-black text-slate-800">AI Thông Thái</h2>
              </div>
              
              <p className="text-slate-500 mb-8 font-medium text-lg leading-relaxed">
                Nhập chủ đề yêu thích, AI sẽ tặng bé một bộ ô chữ thật hay!
              </p>

              <div className="space-y-4 flex-1">
                <div className="relative">
                  <input
                    type="text"
                    className="w-full p-5 bg-slate-50 border-4 border-slate-100 rounded-[2rem] focus:border-sky-400 focus:bg-white outline-none transition-all text-slate-700 font-bold text-lg placeholder:text-slate-300"
                    placeholder="Ví dụ: Con vật, Trái cây..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                  />
                </div>
                <button
                  onClick={handleAiGenerate}
                  disabled={isAiLoading}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black py-5 px-6 rounded-[2rem] transition-all flex items-center justify-center gap-3 shadow-xl shadow-sky-200 disabled:opacity-70 neo-button text-xl"
                >
                  {isAiLoading ? <Loader2 className="animate-spin" /> : <Play size={24} />}
                  {isAiLoading ? "Đang nghĩ..." : "Bắt đầu ngay!"}
                </button>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02 }}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-white rounded-[3rem] shadow-xl shadow-sky-100 p-10 border-4 border-sky-100 group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <Plus size={120} className="text-emerald-400" />
              </div>

              <div className="flex items-center mb-6">
                <div className="p-4 bg-emerald-100 rounded-2xl mr-4 shadow-sm">
                  <Plus className="text-emerald-500 w-8 h-8" />
                </div>
                <h2 className="text-3xl font-black text-slate-800">Tự Sáng Tạo</h2>
              </div>

              <textarea
                className="w-full h-64 p-6 bg-slate-50 border-4 border-slate-100 rounded-[2rem] focus:border-emerald-400 focus:bg-white outline-none transition-all font-mono text-lg text-slate-700 leading-relaxed"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="TỪ_KHÓA Gợi ý của bé..."
              />
              
              <div className="flex gap-4 mt-8">
                <button
                  onClick={handleGenerate}
                  className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 px-6 rounded-[2rem] transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-100 neo-button text-xl"
                >
                  <Play size={24} /> Tạo Ô Chữ
                </button>
                <label className="flex-1 bg-white hover:bg-slate-50 text-slate-600 border-4 border-slate-100 font-black py-5 px-6 rounded-[2rem] transition-all flex items-center justify-center gap-2 cursor-pointer neo-button">
                  <FileJson size={24} />
                  <input type="file" className="hidden" onChange={handleLoad} accept=".json" />
                </label>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-6">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex flex-wrap items-center justify-between gap-6 bg-white p-6 rounded-[2.5rem] border-4 border-sky-100 shadow-xl shadow-sky-100/50"
            >
              <div className="flex items-center gap-8">
                <div className="flex items-center px-5 py-3 bg-sky-50 rounded-2xl border-2 border-sky-100">
                  <Timer className="mr-3 text-sky-500" size={24} /> 
                  <span className="text-sky-900 font-black text-2xl tabular-nums">{formatTime(time)}</span>
                </div>
                <div className="flex items-center px-5 py-3 bg-amber-50 rounded-2xl border-2 border-amber-100">
                  <Trophy className="mr-3 text-amber-500" size={24} /> 
                  <span className="text-amber-900 font-black text-2xl">{score}</span>
                </div>
                <div className="flex items-center px-5 py-3 bg-rose-50 rounded-2xl border-2 border-rose-100">
                  <Lightbulb className="mr-3 text-rose-500" size={24} /> 
                  <span className="text-rose-900 font-black text-2xl">{6 - hintCount}</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <button onClick={handleCheck} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-2xl text-lg font-black transition-all shadow-lg shadow-emerald-100 neo-button">
                  Kiểm tra
                </button>
                <button onClick={handleHint} disabled={hintCount >= 6} className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-2xl text-lg font-black transition-all shadow-lg shadow-amber-100 neo-button disabled:opacity-50">
                  Gợi ý
                </button>
                <button onClick={handleReveal} className="bg-sky-500 hover:bg-sky-600 text-white px-8 py-3 rounded-2xl text-lg font-black transition-all shadow-lg shadow-sky-100 neo-button">
                  Giải đáp
                </button>
                <button onClick={handleShare} className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3 rounded-2xl text-lg font-black transition-all shadow-lg shadow-indigo-100 neo-button">
                  Chia sẻ
                </button>
                <button onClick={() => setIsGameStarted(false)} className="bg-white hover:bg-slate-50 text-slate-500 border-4 border-slate-100 px-8 py-3 rounded-2xl text-lg font-black transition-all neo-button">
                  Thoát
                </button>
              </div>
            </motion.div>

            <div className="flex flex-col lg:flex-row gap-6 items-stretch h-[calc(100vh-280px)] min-h-[600px]">
              <div className="lg:flex-[2] bg-white p-8 rounded-[3rem] border-4 border-sky-100 shadow-2xl shadow-sky-100/40 flex items-center justify-center relative overflow-hidden group" id="printable-area">
                <div className="absolute inset-0 bg-[radial-gradient(#bae6fd_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>
                {crossword && (
                  <div className="relative z-10 scale-90 md:scale-100">
                    <CrosswordGrid 
                      data={crossword} 
                      userGrid={userGrid} 
                      revealed={revealed}
                      checked={checked}
                      onWordClick={handleWordClick}
                    />
                  </div>
                )}
              </div>

              <div className="lg:flex-1 bg-white p-8 rounded-[3rem] border-4 border-sky-100 shadow-xl shadow-sky-100/40 flex flex-col">
                <div className="flex items-center justify-between mb-6 pb-4 border-b-4 border-sky-50">
                  <h2 className="text-3xl font-black text-slate-800">Câu Hỏi</h2>
                  <div className="flex gap-2">
                    <button onClick={handlePrint} className="p-3 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-2xl transition-all" title="In PDF">
                      <Printer size={24} />
                    </button>
                    <button onClick={handleSave} className="p-3 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-2xl transition-all" title="Lưu JSON">
                      <Save size={24} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {crossword && <ClueList placedWords={crossword.placedWords} />}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        <AnimatePresence>
          {isShareModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 40, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 40, opacity: 0 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
              >
                <div className="bg-indigo-600 p-6 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                      <Share2 className="text-white w-6 h-6" />
                    </div>
                    <h3 className="font-black text-white text-xl">
                      Chia Sẻ Ô Chữ
                    </h3>
                  </div>
                  <button 
                    onClick={() => setIsShareModalOpen(false)} 
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                <div className="p-10">
                  <p className="text-slate-600 font-bold text-lg mb-6">
                    Gửi liên kết này cho bạn bè để họ cùng giải ô chữ của bé nhé!
                  </p>
                  
                  <div className="relative mb-8">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="w-full p-5 bg-slate-50 border-4 border-slate-100 rounded-2xl text-slate-400 font-medium text-sm pr-16 outline-none"
                    />
                    <button 
                      onClick={copyToClipboard}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl shadow-sm border border-slate-100 transition-all"
                    >
                      {copied ? <CheckCircle className="text-emerald-500" size={24} /> : <Copy size={24} />}
                    </button>
                  </div>

                  <div className="flex justify-center">
                    <button 
                      onClick={() => setIsShareModalOpen(false)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-12 rounded-[2rem] shadow-xl shadow-indigo-100 transition-all neo-button text-xl"
                    >
                      Xong Rồi!
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Word Entry Modal */}
        <AnimatePresence>
          {activeWord && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 40, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 40, opacity: 0 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100"
              >
                <div className="bg-sky-500 p-6 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                      <Lightbulb className="text-white w-6 h-6" />
                    </div>
                    <h3 className="font-black text-white text-xl">
                      Câu Hỏi Số {activeWord.number}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setActiveWord(null)} 
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                <div className="p-10">
                  <div className="mb-8 text-center">
                    <span className="text-sm font-black text-sky-500 uppercase tracking-[0.2em] mb-4 block">Gợi ý cho bé:</span>
                    <p className="text-3xl text-slate-800 font-black leading-tight">
                      {activeWord.clue}
                    </p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex flex-wrap gap-3 justify-center">
                      {modalInput.map((char, idx) => (
                        <motion.input
                          key={idx}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          ref={el => modalInputRefs.current[idx] = el}
                          type="text"
                          maxLength={1}
                          className="w-16 h-20 border-4 border-slate-100 rounded-[1.5rem] text-center text-3xl font-black uppercase focus:border-sky-400 focus:ring-8 focus:ring-sky-50 outline-none transition-all shadow-sm"
                          value={char}
                          onChange={(e) => handleModalInputChange(idx, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && char === '' && idx > 0) {
                              modalInputRefs.current[idx - 1]?.focus();
                            } else if (e.key === 'Enter') {
                              handleModalSubmit();
                            }
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-12 flex items-center justify-between gap-6">
                    <p className="text-slate-400 text-sm font-medium">
                      Nhấn <kbd className="px-2 py-1 bg-slate-100 rounded border border-slate-200 text-xs font-bold">Enter</kbd> để xác nhận nhanh
                    </p>
                    <button 
                      onClick={handleModalSubmit}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 px-12 rounded-[2rem] flex items-center gap-3 shadow-xl shadow-emerald-100 transition-all neo-button text-xl"
                    >
                      <Check size={28} /> Xong Rồi!
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isComplete && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-lg p-10 max-w-md w-full text-center shadow-2xl border border-[#dcdcdc]"
              >
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={48} />
                </div>
                <h2 className="text-3xl font-bold text-[#4a4a4a] mb-2">Tuyệt vời!</h2>
                <p className="text-[#8a8a8a] mb-8">Bạn đã hoàn thành ô chữ trong {formatTime(time)}.</p>
                <div className="bg-[#f8f5e6] rounded p-6 mb-8 border border-[#dcdcdc]">
                  <div className="text-xs text-[#8a8a8a] font-bold uppercase tracking-widest mb-1">Điểm số</div>
                  <div className="text-5xl font-bold text-[#4a4a4a]">{score}</div>
                </div>
                <button 
                  onClick={() => setIsComplete(false)}
                  className="w-full bg-[#4a90e2] hover:bg-[#357abd] text-white font-bold py-4 rounded transition-all"
                >
                  Tiếp tục
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-16 text-center text-[#8a8a8a] text-xs uppercase tracking-widest">
          <p>&copy; 2026 VietCross Puzzle • Trình tạo ô chữ thông minh</p>
        </footer>
      </div>
    </div>
  );
}
