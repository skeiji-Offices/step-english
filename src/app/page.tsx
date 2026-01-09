"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";

export default function Home() {
  const { user, userData, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-brand-light">Loading...</div>;

  const totalMinutes = userData ? Math.floor(userData.totalStudyTime / 60) : 0;

  const handleStart = () => {
    router.push("/settings");
  };

  return (
    <main className="min-h-screen p-4 bg-gray-900 font-[family-name:var(--font-geist-sans)]">
      <header className="flex justify-between items-center bg-gray-800 rounded-full px-6 py-3 shadow-md mb-8 border border-gray-700">
        <h1 className="font-bold text-white text-xl">Step English (英単語学習)</h1>
        <div className="flex items-center gap-4">
          <span className="font-bold text-gray-200">{user.displayName}</span>
          <img src={user.photoURL || ""} alt="User" className="w-10 h-10 rounded-full border-2 border-brand-yellow" />
        </div>
      </header>

      <div className="max-w-md mx-auto space-y-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 p-6 text-center space-y-4"
        >
          <h2 className="text-2xl font-bold text-gray-100">学習を始めよう！</h2>
          <p className="text-gray-400">今日も楽しく英語を身につけましょう。</p>
          <button onClick={handleStart} className="btn-primary w-full text-xl shadow-orange-900/50">
            スタート
          </button>
        </motion.div>

        <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 p-6 text-center">
          <h3 className="font-bold text-gray-300 mb-2">これまでの記録</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 rounded-xl p-3">
              <div className="text-xs text-gray-400">学習時間</div>
              <div className="font-black text-xl text-brand-blue">{totalMinutes}分</div>
            </div>
            <div className="bg-gray-700 rounded-xl p-3">
              <div className="text-xs text-gray-400">正解数</div>
              <div className="font-black text-xl text-brand-orange">{userData?.totalChores || 0}回</div>
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
