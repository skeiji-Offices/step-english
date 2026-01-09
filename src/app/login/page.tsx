"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";

export default function LoginPage() {
    const { user, login, loading, error } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) {
            router.push("/");
        }
    }, [user, loading, router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-gray-900">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-blue/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-brand-orange/20 rounded-full blur-[100px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="card-pop relative z-10 max-w-md w-full text-center space-y-10 py-12 px-8 border-brand-orange/30 shadow-2xl shadow-black/50"
            >
                <div>
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="mb-6 inline-block"
                    >
                        <span className="text-6xl">🚀</span>
                    </motion.div>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-brand-yellow tracking-wider mb-3 drop-shadow-sm">
                        Step English
                    </h1>
                    <p className="text-gray-400 font-medium text-lg">
                        楽しく学べる英単語アプリ
                    </p>
                </div>

                <div className="space-y-6">
                    <button
                        onClick={login}
                        disabled={loading}
                        className="w-full bg-white hover:bg-gray-100 text-gray-800 font-bold py-4 px-6 rounded-full shadow-lg transition-transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 border border-gray-200"
                    >
                        {loading ? (
                            <span className="text-gray-500">Loading...</span>
                        ) : (
                            <>
                                <svg className="w-6 h-6" viewBox="0 0 24 24">
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        fill="#4285F4"
                                    />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        fill="#FBBC05"
                                    />
                                    <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                    />
                                </svg>
                                <span>Googleで始める</span>
                            </>
                        )}
                    </button>

                    <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                        利用規約ポリシーに同意して開始します。<br />
                        毎日の学習記録をつけましょう！
                    </p>
                </div>

                {/* Error Display */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="text-red-400 text-sm bg-red-900/30 border border-red-500/50 p-3 rounded"
                    >
                        {error}
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}
