"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Star, Target, CalendarDays, AlertTriangle, ChevronRight } from "lucide-react";
import { getLevelTitle, UserStats } from "@/lib/userStats";
import { collection, query, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Home() {
  const { user, userData, loading, logout } = useAuth();
  const router = useRouter();
  const [weakWordCount, setWeakWordCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, `users/${user.uid}/weak_words`));
      getCountFromServer(q).then(snapshot => {
        setWeakWordCount(snapshot.data().count);
      }).catch(e => console.error("Error fetching weak word count:", e));
    }
  }, [user]);

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-brand-light">Loading...</div>;

  const totalMinutes = userData ? Math.floor(userData.totalStudyTime / 60) : 0;

  // Cast or destructure default stats safely
  const stats = userData as unknown as UserStats;
  const exp = stats?.exp || 0;
  const level = stats?.level || 1;
  const streakCount = stats?.streakCount || 0;
  const levelTitle = getLevelTitle(level);
  const nextLevelExp = level * 100;
  const progressPercent = ((exp % 100) / 100) * 100;
  const dailyMission = stats?.dailyMission;
  const isMissionCompleted = dailyMission?.completed;

  // Render safe 7-day calendar view
  const studyCalendar = stats?.studyCalendar || [];
  const renderCalendar = () => {
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
      const isStudied = studyCalendar.includes(dateStr);
      const isToday = i === 0;
      days.push(
        <div key={dateStr} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isStudied ? "bg-brand-orange text-white shadow-md" : "bg-gray-700 text-gray-500"} ${isToday && !isStudied ? "ring-2 ring-brand-blue" : ""}`}>
          {d.getDate()}
        </div>
      );
    }
    return days;
  };

  const handleStart = () => {
    router.push("/settings");
  };

  const handleRescue = () => {
    // jump into review session 
    router.push("/session?range=-1");
  };

  return (
    <main className="min-h-screen p-4 bg-gray-900 font-[family-name:var(--font-geist-sans)] pb-12">
      <header className="flex justify-between items-center bg-gray-800 rounded-full px-6 py-3 shadow-md mb-6 border border-gray-700">
        <h1 className="font-bold text-white text-xl">Step English</h1>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-bold text-gray-200 leading-none">{user.displayName}</div>
            <div className="text-xs text-brand-orange font-bold mt-1">Lv.{level} {levelTitle}</div>
          </div>
          <img src={user.photoURL || ""} alt="User" className="w-10 h-10 rounded-full border-2 border-brand-yellow" />
        </div>
      </header>

      <div className="max-w-md mx-auto space-y-5">

        {/* Streak & Rescue Section */}
        <div className="flex gap-3">
          <div className="flex-1 bg-gray-800 rounded-2xl border border-gray-700 p-4 flex items-center gap-3">
            <div className="bg-red-500/20 p-2 rounded-full">
              <Flame className={`w-8 h-8 ${streakCount > 0 ? "text-red-500 animate-pulse" : "text-gray-500"}`} />
            </div>
            <div>
              <div className="text-xs text-gray-400 font-bold">連続学習記録</div>
              <div className="text-2xl font-black text-gray-100">{streakCount}<span className="text-sm font-normal text-gray-400 ml-1">日</span></div>
            </div>
          </div>

          <button
            onClick={weakWordCount > 0 ? handleRescue : undefined}
            className={`flex-1 rounded-2xl border p-4 flex flex-col justify-center items-center gap-1 transition-all
             ${weakWordCount > 0 ? "bg-red-900/30 border-red-500/50 hover:bg-red-900/50 cursor-pointer" : "bg-gray-800 border-gray-700 opacity-50 cursor-not-allowed"}`}
          >
            <AlertTriangle className={`w-6 h-6 ${weakWordCount > 0 ? "text-red-400" : "text-gray-600"}`} />
            <div className="text-xs font-bold text-gray-300">弱点救出</div>
            <div className={`text-xl font-black ${weakWordCount > 0 ? "text-red-400" : "text-gray-600"}`}>{weakWordCount}<span className="text-xs ml-1 font-normal">件</span></div>
          </button>
        </div>

        {/* Start Button */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gray-800 rounded-3xl shadow-xl border border-gray-700 p-6 text-center space-y-5 relative overflow-hidden"
        >
          {/* Subtle background flair */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/10 rounded-full blur-3xl" />

          <div className="relative z-10 space-y-2">
            <h2 className="text-2xl font-black text-gray-100">学習を始めよう！</h2>
            <p className="text-gray-400 text-sm font-bold">1日5分、コツコツ続けよう。</p>
          </div>
          <button onClick={handleStart} className="btn-primary w-full text-xl py-4 shadow-orange-900/50 flex justify-center items-center gap-2 relative z-10 group">
            <Star className="text-brand-yellow group-hover:rotate-180 transition-transform duration-500" fill="currentColor" />
            スタート
          </button>
        </motion.div>

        {/* Level & EXP Progress */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
          <div className="flex justify-between items-end mb-2">
            <div className="font-bold text-gray-200">EXP・レベル</div>
            <div className="text-xs text-brand-blue font-bold">あと {nextLevelExp - Math.floor(exp)} EXP でUP!</div>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden mb-2 relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-brand-blue to-cyan-400"
            />
          </div>
          <div className="text-right text-xs text-gray-500 font-mono">{Math.floor(exp)} / {nextLevelExp}</div>
        </div>

        {/* Daily Mission */}
        {dailyMission && (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 relative overflow-hidden">
            {isMissionCompleted && (
              <div className="absolute top-0 right-0 bg-brand-orange text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">CLEAR!</div>
            )}
            <div className="flex items-center gap-2 mb-3">
              <Target className={`w-5 h-5 ${isMissionCompleted ? "text-brand-orange" : "text-brand-blue"}`} />
              <h3 className="font-bold text-gray-200">今日のミッション</h3>
            </div>
            <div className="text-sm font-medium text-gray-300 mb-3">{dailyMission.description}</div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${isMissionCompleted ? "bg-brand-orange" : "bg-brand-blue"}`}
                  style={{ width: `${Math.min(100, (dailyMission.progress / dailyMission.target) * 100)}%` }}
                />
              </div>
              <div className="text-xs font-mono font-bold text-gray-400 w-12 text-right">
                {Math.min(dailyMission.progress, dailyMission.target)}/{dailyMission.target}
              </div>
            </div>
            {!isMissionCompleted && (
              <div className="mt-3 text-[10px] text-gray-400">クリアすると <span className="text-brand-yellow font-bold">+{dailyMission.reward} EXP</span></div>
            )}
          </div>
        )}

        {/* Study History Stats & Calendar */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-gray-300">これまでの記録</h3>
          </div>

          <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded-xl mb-4 border border-gray-700">
            {renderCalendar()}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700 rounded-xl p-3 flex flex-col items-center">
              <div className="text-xs text-gray-400 font-medium mb-1">総学習時間</div>
              <div className="font-black text-xl text-brand-blue">{totalMinutes}<span className="text-sm font-normal ml-1">分</span></div>
            </div>
            <div className="bg-gray-700 rounded-xl p-3 flex flex-col items-center">
              <div className="text-xs text-gray-400 font-medium mb-1">総正解数</div>
              <div className="font-black text-xl text-brand-orange">{userData?.totalChores || 0}<span className="text-sm font-normal ml-1">回</span></div>
            </div>
          </div>
        </div>

        <button onClick={() => logout()} className="text-gray-400 text-sm underline w-full text-center">
          ログアウト
        </button>
      </div>
    </main>
  );
}
