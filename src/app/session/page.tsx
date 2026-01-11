"use client";

import { useAuth } from "@/contexts/AuthContext";
import { fetchQuestions, fetchWeakQuestions, Question } from "@/lib/game";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle, CheckCircle, Award, Volume2 } from "lucide-react";
import { doc, updateDoc, increment, addDoc, collection, serverTimestamp, setDoc, deleteDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Phase = "practice" | "test" | "review" | "result";

function shuffle<T>(array: T[]): T[] {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

function SessionContent() {
    const searchParams = useSearchParams();
    const range = parseInt(searchParams.get("range") || "4");
    const mode = searchParams.get("mode") || "choice";
    const count = parseInt(searchParams.get("count") || "10");

    const { user } = useAuth();
    const router = useRouter();

    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [phase, setPhase] = useState<Phase>("practice");
    const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);

    // Spelling Mode State
    const [spellingInput, setSpellingInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Stats
    const [practiceMisses, setPracticeMisses] = useState<Set<string>>(new Set());
    const [testScore, setTestScore] = useState(0);
    const [testMisses, setTestMisses] = useState<Question[]>([]);
    const [reviewQueue, setReviewQueue] = useState<Question[]>([]);
    const [startTime, setStartTime] = useState<number>(Date.now());

    // TTS Helper
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Chrome requires this to load voices accurately
    useEffect(() => {
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            console.log("Voices loaded:", voices.length);
        };
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
        return () => {
            if (typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.onvoiceschanged = null;
            }
        };
    }, []);

    const speakWord = (text: string) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

        console.log("Speaking:", text);

        // Cancel previous
        window.speechSynthesis.cancel();

        // Create new utterance
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 1.0;
        utterance.volume = 1.0;

        // Try to pick a Google voice if available (best for Chrome)
        const voices = window.speechSynthesis.getVoices();
        const googleVoice = voices.find(v => v.name.includes("Google US English")) || voices.find(v => v.lang.startsWith("en"));
        if (googleVoice) utterance.voice = googleVoice;

        // Prevent GC
        utteranceRef.current = utterance;

        utterance.onend = () => { utteranceRef.current = null; };
        utterance.onerror = (e) => console.error("TTS Error:", e);

        window.speechSynthesis.speak(utterance);
    };

    useEffect(() => {
        async function init() {
            let qs: Question[] = [];
            if (range === -1 && user) {
                // Pass mode to filter correct weak word type
                qs = await fetchWeakQuestions(user.uid, count, mode);
            } else {
                qs = await fetchQuestions(range, count);
            }
            setQuestions(qs);
            setLoading(false);
            setStartTime(Date.now());
        }
        if (user || range !== -1) init();
    }, [range, user, count]);

    // Focus input when question changes in spelling mode
    useEffect(() => {
        if (mode.startsWith("spelling") && !feedback) {
            setSpellingInput("");
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [currentIndex, phase, feedback, mode]);

    const currentQuestion = phase === "review" ? reviewQueue[currentIndex] : questions[currentIndex];

    // Auto-speak on question change
    useEffect(() => {
        if (currentQuestion && phase !== "result" && !feedback) {
            const shouldSpeak =
                (mode === "choice") || // Question is Word, so speak it
                (phase === "practice"); // Answer is shown, so speak it

            if (shouldSpeak) {
                setTimeout(() => speakWord(currentQuestion.word), 300);
            }
        }
    }, [currentIndex, phase, currentQuestion, mode, feedback]);

    // Speak when feedback is correct (Mastery)
    useEffect(() => {
        if (feedback === "correct" && mode !== "choice") {
            // For spelling test, speak after correct answer
            speakWord(currentQuestion?.word || "");
        }
    }, [feedback, mode, currentQuestion]);

    // Helper to start test phase with shuffling
    const startTestPhase = () => {
        // Shuffle questions AND choices for the test phase
        const shuffledQuestions = shuffle(questions).map(q => ({
            ...q,
            choices: shuffle(q.choices)
        }));
        setQuestions(shuffledQuestions);
        setPhase("test");
        setCurrentIndex(0);
    };

    const handleSpellingSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!spellingInput.trim()) return;
        handleAnswer(spellingInput.trim());
    };

    const handleAnswer = async (answer: string) => {
        if (feedback || !currentQuestion) return;

        let isCorrect = false;
        if (mode === "choice") {
            isCorrect = answer === currentQuestion.meaning || answer === currentQuestion.word;
        } else {
            isCorrect = answer.trim().toLowerCase() === currentQuestion.word.toLowerCase();
        }

        // Logic depends on Phase
        if (phase === "practice") {
            if (isCorrect) {
                setFeedback("correct");
            } else {
                setPracticeMisses(prev => new Set(prev).add(currentQuestion.id));
                setFeedback("incorrect");
            }

            setTimeout(() => {
                setFeedback(null);
                if (currentIndex < questions.length - 1) {
                    setCurrentIndex(prev => prev + 1);
                } else {
                    startTestPhase();
                }
            }, 1500);

        } else if (phase === "test") {
            if (isCorrect) {
                setTestScore(s => s + 1);
                setFeedback("correct");
            } else {
                setTestMisses(prev => [...prev, currentQuestion]);
                setFeedback("incorrect");
            }

            setTimeout(async () => {
                setFeedback(null);
                if (currentIndex < questions.length - 1) {
                    setCurrentIndex(prev => prev + 1);
                } else {
                    // End of Test
                    const finalMisses = isCorrect ? testMisses : [...testMisses, currentQuestion];
                    const finalScore = isCorrect ? testScore + 1 : testScore;

                    if (finalMisses.length > 0) {
                        setPhase("review");
                        setReviewQueue(finalMisses);
                        setCurrentIndex(0);
                    } else {
                        await finishSession(finalScore);
                    }
                }
            }, 1000);

        } else if (phase === "review") {
            if (isCorrect) {
                setFeedback("correct");
                setTimeout(() => {
                    setFeedback(null);
                    if (currentIndex < reviewQueue.length - 1) {
                        setCurrentIndex(prev => prev + 1);
                    } else {
                        finishSession(testScore);
                    }
                }, 1000);
            } else {
                setFeedback("incorrect");
                setTimeout(() => {
                    setFeedback(null);
                    if (currentIndex < reviewQueue.length - 1) {
                        setCurrentIndex(prev => prev + 1);
                    } else {
                        finishSession(testScore);
                    }
                }, 1500);
            }
        }
    };

    const finishSession = async (finalScore: number) => {
        if (!user) return;

        setPhase("result");
        const duration = Math.floor((Date.now() - startTime) / 1000);

        try {
            await addDoc(collection(db, `users/${user.uid}/learning_logs`), {
                sessionId: crypto.randomUUID(),
                timestamp: serverTimestamp(),
                range: range.toString(),
                mode: mode,
                score: finalScore,
                totalWords: questions.length,
                duration: duration
            });

            // Update stats
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                totalStudyTime: increment(duration),
                totalChores: increment(finalScore)
            });

            // --- WEAK WORDS LOGIC ---
            const currentMistakeType = mode === "choice" ? "meaning" : "spelling";
            const missIds = new Set(testMisses.map(q => q.id));

            // Process Misses -> Add/Update
            for (const q of testMisses) {
                const ref = doc(db, `users/${user.uid}/weak_words`, q.id);
                // Use setDoc with merge to create or update, adding the specific mistake type
                await setDoc(ref, {
                    ...q,
                    lastMissed: new Date(),
                    sectionId: q.sectionId || 99,
                    weakTypes: arrayUnion(currentMistakeType)
                }, { merge: true });
            }

            // Process Corrects -> Delete or Remove Type
            const correctQuestions = questions.filter(q => !missIds.has(q.id));
            for (const q of correctQuestions) {
                const ref = doc(db, `users/${user.uid}/weak_words`, q.id);

                // We need to check existence because we only want to remove if it was there
                try {
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        // Remove this specific mistake type
                        await updateDoc(ref, {
                            weakTypes: arrayRemove(currentMistakeType)
                        });

                        // If no more weak types, delete the doc entirely
                        const updatedSnap = await getDoc(ref);
                        const data = updatedSnap.data();
                        if (data && (!data.weakTypes || data.weakTypes.length === 0)) {
                            await deleteDoc(ref);
                        }
                    }
                } catch (e) {
                    console.error("Error updating weak word:", q.id, e);
                }
            }

        } catch (e) {
            console.error("Failed to save result", e);
        }
    };

    if (loading) return <div className="min-h-screen center p-8 text-center font-bold text-gray-400">問題を作成中...</div>;
    if (questions.length === 0) return <div className="min-h-screen center p-8 text-gray-400">条件に合う単語が見つかりませんでした。</div>;

    // --- RESULT VIEW ---
    if (phase === "result") {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-white">
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-gray-800 text-gray-100 rounded-3xl p-8 w-full max-w-md text-center shadow-2xl space-y-6 border border-gray-700"
                >
                    <div className="flex justify-center">
                        <Award size={80} className="text-brand-orange" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-gray-400">今回のスコア</h2>
                        <div className="text-6xl font-black text-brand-orange">
                            {testScore} <span className="text-2xl text-gray-500">/ {questions.length}</span>
                        </div>
                    </div>

                    <div className="py-4 border-t border-b border-gray-700 grid grid-cols-2 gap-4 text-center">
                        <div>
                            <div className="text-gray-500 text-xs">練習でのミス</div>
                            <div className="font-bold text-xl">{practiceMisses.size}問</div>
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs">学習時間</div>
                            <div className="font-bold text-xl">{Math.floor((Date.now() - startTime) / 1000)}秒</div>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push("/")}
                        className="btn-primary w-full text-lg shadow-orange-900/50"
                    >
                        トップへ戻る
                    </button>
                </motion.div>
            </div>
        );
    }

    // --- PRACTICE / TEST / REVIEW VIEW ---
    if (!currentQuestion) return <div>Loading...</div>;

    return (
        <div className={`min-h-screen flex flex-col ${phase === "test" ? "bg-blue-950" : phase === "review" ? "bg-red-950" : "bg-gray-900"}`}>
            {/* Header Phase Indicator */}
            <div className="bg-gray-800 p-4 shadow-sm flex justify-between items-center px-6 border-b border-gray-700">
                <span className={`font-bold px-3 py-1 rounded-full text-sm ${phase === "practice" ? "bg-brand-orange text-white" : "bg-gray-700 text-gray-500"}`}>
                    練習
                </span>
                <span className="text-gray-600">→</span>
                <span className={`font-bold px-3 py-1 rounded-full text-sm ${phase === "test" ? "bg-brand-blue text-white" : "bg-gray-700 text-gray-500"}`}>
                    テスト
                </span>
                {phase === "review" && (
                    <>
                        <span className="text-gray-600">→</span>
                        <span className="font-bold px-3 py-1 rounded-full text-sm bg-red-600 text-white">
                            復習
                        </span>
                    </>
                )}
                <span className="text-gray-600">→</span>
                <span className="font-bold px-3 py-1 rounded-full text-sm bg-gray-700 text-gray-500">
                    結果
                </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-gray-800">
                <div
                    className={`h-full transition-all duration-300 ${phase === "test" ? "bg-brand-blue" : phase === "review" ? "bg-red-600" : "bg-brand-orange"}`}
                    style={{ width: `${((currentIndex) / (phase === "review" ? reviewQueue.length : questions.length)) * 100}%` }}
                />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full relative">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${phase}-${currentQuestion.id}`}
                        initial={{ x: 50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -50, opacity: 0 }}
                        className="w-full space-y-8"
                    >
                        {/* Question Card */}
                        <div className={`bg-gray-800 rounded-3xl p-8 shadow-xl text-center border-4 min-h-[min(30vh,300px)] flex flex-col items-center justify-center relative ${phase === "test" ? "border-brand-blue" : phase === "review" ? "border-red-500" : "border-brand-yellow"}`}>

                            {/* Speaker Button */}
                            {(mode === "choice" || phase === "practice" || feedback) && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); speakWord(currentQuestion.word); }}
                                    className="absolute top-4 right-4 p-3 bg-gray-700 rounded-full hover:bg-gray-600 active:scale-95 transition-all text-brand-blue shadow-lg border border-gray-600"
                                    title="発音を聞く"
                                >
                                    <Volume2 size={24} />
                                </button>
                            )}
                            {phase === "review" && <span className="text-red-500 font-bold mb-2">Review Time!</span>}
                            <span className="text-sm text-gray-400 font-bold mb-2">
                                Question {currentIndex + 1} / {phase === "review" ? reviewQueue.length : questions.length}
                            </span>

                            {/* Display Logic */}
                            <h2 className="text-4xl font-black text-gray-100 tracking-wide mb-4">
                                {mode === "choice" ? currentQuestion.word : currentQuestion.meaning}
                            </h2>

                            {/* Easy Mode Hint */}
                            {mode === "spelling_easy" && (
                                <div className={`font-mono text-brand-orange font-bold mb-2 ${phase === "practice" ? "text-5xl" : "text-3xl tracking-[0.2em]"}`}>
                                    {phase === "practice" ? (
                                        // Practice: Show FULL WORD (Copying Mode)
                                        currentQuestion.word
                                    ) : (
                                        // Test: Show First, Last, and Middle (if long)
                                        currentQuestion.word.split('').map((char, index) => {
                                            const len = currentQuestion.word.length;
                                            let show = false;
                                            if (index === 0) show = true; // First
                                            if (index === len - 1) show = true; // Last
                                            if (len > 5 && index === Math.floor(len / 2)) show = true; // Middle for long words
                                            if (!/[a-zA-Z]/.test(char)) show = true; // Symbols

                                            return show ? char : '_';
                                        }).join(' ')
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Input Area (Choice or Spelling) */}
                        {mode === "choice" ? (
                            <div className="grid grid-cols-1 gap-3">
                                {currentQuestion.choices.map((choice, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleAnswer(choice)}
                                        className="w-full bg-gray-700 p-4 rounded-xl shadow-md font-bold text-lg text-gray-200 hover:bg-gray-600 active:scale-95 transition-all text-left border-b-4 border-gray-600 active:border-b-0 active:translate-y-1"
                                    >
                                        {choice}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <form onSubmit={handleSpellingSubmit} className="w-full">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={spellingInput}
                                    onChange={(e) => setSpellingInput(e.target.value)}
                                    className="w-full bg-gray-800 border-2 border-gray-600 text-white text-3xl font-bold p-6 rounded-2xl text-center focus:border-brand-blue focus:outline-none mb-4"
                                    placeholder={mode === "spelling_easy" ? "Fill in the blanks" : "Type answer..."}
                                    autoComplete="off"
                                />
                                <button
                                    type="submit"
                                    className="btn-primary w-full text-xl shadow-orange-900/50"
                                >
                                    回答する
                                </button>
                            </form>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Praise / Feedback Overlay */}
                <AnimatePresence>
                    {feedback && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
                        >
                            {feedback === "correct" ? (
                                <div className="text-center">
                                    <motion.div
                                        animate={{ rotate: [0, -10, 10, 0] }}
                                        className="text-8xl text-red-500 drop-shadow-2xl"
                                    >
                                        <CheckCircle size={120} fill="white" className="text-brand-orange" />
                                    </motion.div>
                                    <div className="text-6xl font-black text-brand-orange mt-4 drop-shadow-md text-pop-outline">
                                        {phase === "practice" ? "Nice!" : "Good!"}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-800/95 p-8 rounded-3xl shadow-2xl text-center border-4 border-brand-blue text-gray-100">
                                    <XCircle size={80} className="text-gray-400 mx-auto mb-4" />
                                    <div className="text-xl font-bold mb-2">正解は...</div>
                                    <div className="text-3xl font-black text-brand-blue mb-2">
                                        {mode === "choice" ? currentQuestion.meaning : currentQuestion.word}
                                    </div>
                                    <div className="text-sm text-gray-400">
                                        {mode === "choice" ? currentQuestion.word : currentQuestion.meaning}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default function SessionPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SessionContent />
        </Suspense>
    );
}
