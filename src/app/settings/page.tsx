"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, CheckCircle, Keyboard, MousePointerClick } from "lucide-react";

export default function SettingsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [selectedRange, setSelectedRange] = useState<number>(4); // Default: Middle 1
    const [selectedMode, setSelectedMode] = useState<"choice" | "spelling_easy" | "spelling_hard">("choice");
    const [questionCount, setQuestionCount] = useState<10 | 30>(10); // Default to 10

    useEffect(() => {
        if (!loading && !user) router.push("/login");
    }, [user, loading, router]);

    if (loading || !user) return <div className="min-h-screen center bg-gray-900 text-gray-400">Loading...</div>;

    const handleStart = () => {
        router.push(`/session?range=${selectedRange}&mode=${selectedMode}&count=${questionCount}`);
    };

    const RANGES = [
        { id: 2, label: "小学生 (〜小6)", desc: "基本の単語" },
        { id: 4, label: "中学1年生 (〜中1)", desc: "日常会話の基礎" },
        { id: 6, label: "中学2年生 (〜中2)", desc: "表現を広げる" },
        { id: 8, label: "中学3年生 (〜中3)", desc: "受験レベルまで" },
        { id: -1, label: "【復習】苦手な単語", desc: "間違えた単語だけを重点的に" },
    ];

    return (
        <div className="min-h-screen p-4 bg-gray-900 pb-24">
            <header className="flex items-center mb-6">
                <button onClick={() => router.back()} className="mr-4 bg-gray-800 text-gray-200 p-2 rounded-full shadow border border-gray-700 hover:bg-gray-700 transition">
                    ←
                </button>
                <h1 className="font-bold text-xl text-gray-100">学習設定</h1>
            </header>

            <div className="max-w-md mx-auto space-y-8">

                {/* Range Selection */}
                <section>
                    <h2 className="text-lg font-bold text-brand-orange mb-3 flex items-center gap-2">
                        <BookOpen size={20} />
                        どこまで学習しますか？
                    </h2>
                    <div className="grid grid-cols-1 gap-3">
                        {RANGES.map((range) => (
                            <button
                                key={range.id}
                                onClick={() => setSelectedRange(range.id)}
                                className={`text-left p-4 rounded-xl border-2 transition-all ${selectedRange === range.id
                                    ? (range.id === -1 ? "bg-red-900/30 border-red-500 shadow-lg scale-[1.02]" : "bg-gray-800 border-brand-orange shadow-lg scale-[1.02]")
                                    : "bg-gray-800/40 border-transparent hover:bg-gray-800"
                                    }`}
                            >
                                <div className={`font-bold text-lg ${selectedRange === range.id ? (range.id === -1 ? "text-red-400" : "text-brand-orange") : "text-gray-300"}`}>{range.label}</div>
                                <div className="text-sm text-gray-500">{range.desc}</div>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Question Count Selection */}
                <section>
                    <h2 className="text-lg font-bold text-green-400 mb-3 flex items-center gap-2">
                        <BookOpen size={20} />
                        問題の数は？
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setQuestionCount(10)}
                            className={`p-3 rounded-xl border-2 font-bold transition-all ${questionCount === 10
                                ? "bg-green-900/30 border-green-400 text-green-400 shadow-lg"
                                : "bg-gray-800/40 border-transparent text-gray-500 hover:bg-gray-800"
                                }`}
                        >
                            10問 (サクッと)
                        </button>
                        <button
                            onClick={() => setQuestionCount(30)}
                            className={`p-3 rounded-xl border-2 font-bold transition-all ${questionCount === 30
                                ? "bg-green-900/30 border-green-400 text-green-400 shadow-lg"
                                : "bg-gray-800/40 border-transparent text-gray-500 hover:bg-gray-800"
                                }`}
                        >
                            30問 (しっかり)
                        </button>
                    </div>
                </section>

                {/* Mode Selection */}
                <section>
                    <h2 className="text-lg font-bold text-brand-blue mb-3 flex items-center gap-2">
                        <CheckCircle size={20} />
                        モードを選んでください
                    </h2>
                    <div className="space-y-3">
                        <button
                            onClick={() => setSelectedMode("choice")}
                            className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${selectedMode === "choice"
                                ? "bg-gray-800 border-brand-blue shadow-lg bg-blue-900/20"
                                : "bg-gray-800/40 border-transparent text-gray-500 hover:bg-gray-800"
                                }`}
                        >
                            <MousePointerClick size={32} className={selectedMode === "choice" ? "text-brand-blue" : "text-gray-600"} />
                            <div className="text-left">
                                <div className={`font-bold ${selectedMode === "choice" ? "text-brand-blue" : "text-gray-400"}`}>意味を選ぶ</div>
                                <div className="text-xs text-gray-500">4択クイズ</div>
                            </div>
                        </button>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setSelectedMode("spelling_easy")}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${selectedMode === "spelling_easy"
                                    ? "bg-gray-800 border-brand-blue shadow-lg bg-blue-900/20"
                                    : "bg-gray-800/40 border-transparent text-gray-500 hover:bg-gray-800"
                                    }`}
                            >
                                <Keyboard size={28} className={selectedMode === "spelling_easy" ? "text-brand-blue" : "text-gray-600"} />
                                <span className={`font-bold ${selectedMode === "spelling_easy" ? "text-brand-blue" : "text-gray-400"}`}>スペル (Easy)</span>
                                <span className="text-[10px] text-gray-500">ヒントあり</span>
                            </button>

                            <button
                                onClick={() => setSelectedMode("spelling_hard")}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${selectedMode === "spelling_hard"
                                    ? "bg-gray-800 border-brand-blue shadow-lg bg-blue-900/20"
                                    : "bg-gray-800/40 border-transparent text-gray-500 hover:bg-gray-800"
                                    }`}
                            >
                                <Keyboard size={28} className={selectedMode === "spelling_hard" ? "text-brand-blue" : "text-gray-600"} />
                                <span className={`font-bold ${selectedMode === "spelling_hard" ? "text-brand-blue" : "text-gray-400"}`}>スペル (Hard)</span>
                                <span className="text-[10px] text-gray-500">ヒントなし</span>
                            </button>
                        </div>
                    </div>
                </section>

                {/* Start Button (Static) */}
                <div className="pt-4 pb-8">
                    <button
                        onClick={handleStart}
                        className="btn-primary w-full text-xl shadow-orange-900/50"
                    >
                        スタート！
                    </button>
                </div>
            </div>
        </div>
    );
}
