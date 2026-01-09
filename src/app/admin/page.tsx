"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, writeBatch, doc, query, getDocs } from "firebase/firestore";
import Papa from "papaparse";

const SECTION_MAP: Record<string, number> = {
    "小学生前半": 1,
    "小学生後半": 2,
    "中学1年生前半": 3,
    "中学1年生後半": 4,
    "中学2年生前半": 5,
    "中学2年生後半": 6,
    "中学3年生前半": 7,
    "中学3年生後半": 8,
};

export default function AdminPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [log, setLog] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);

    // Moved up to avoid hook order error
    const [stats, setStats] = useState<Record<string, number>>({});
    const [categories, setCategories] = useState<string[]>([]);

    // Get Admin UID from environment
    const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID;

    // Redirect or block if not admin
    if (!loading && (!user || (ADMIN_UID && user.uid !== ADMIN_UID))) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-800">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-red-600 mb-4">Access Denied</h1>
                    <p className="mb-4">You do not have permission to view this page.</p>
                    <a href="/" className="text-blue-600 hover:underline">Return Home</a>
                    <div className="mt-4 text-xs text-gray-400">
                        Current UID: {user?.uid || "Not logged in"}<br />
                        Allowed UID: {ADMIN_UID ? "Set via Env" : "Not Configured"}
                    </div>
                </div>
            </div>
        );
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setLog(["Reading file..."]);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                await importData(results.data);
                setLoading(false);
            },
            error: (error) => {
                console.error(error);
                setLog((prev) => [...prev, "Error parsing CSV: " + error.message]);
                setLoading(false);
            }
        });
    };

    const importData = async (data: any[]) => {
        setLog((prev) => [...prev, `Found ${data.length} rows. Starting import...`]);

        const BATCH_SIZE = 500;
        const chunks: any[][] = [];

        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            chunks.push(data.slice(i, i + BATCH_SIZE));
        }

        let totalProcessed = 0;

        for (let i = 0; i < chunks.length; i++) {
            const batch = writeBatch(db);
            const chunk = chunks[i];

            chunk.forEach((row: any) => {
                // Modified mapping based on user CSV structure
                // 学年・時期 maps to sectionId
                // カテゴリー is just the category (parts of speech etc)
                const rank = row["学年・時期"]?.trim();
                const category = row["カテゴリー"]?.trim();
                const word = row["英単語"]?.trim();
                const meaning = row["日本語訳"]?.trim();

                if (rank && word && meaning) {
                    const sectionId = SECTION_MAP[rank] || 99;
                    const docRef = doc(collection(db, "word_master"));
                    batch.set(docRef, {
                        category, // Keep original category (e.g. pronoun)
                        rank,     // Store the rank/grade text too for reference
                        word,
                        meaning,
                        sectionId
                    });
                }
            });

            try {
                await batch.commit();
                totalProcessed += chunk.length;
                setProgress((totalProcessed / data.length) * 100);
                setLog((prev) => [...prev, `Batch ${i + 1}/${chunks.length} committed.`]);
            } catch (e: any) {
                console.error(e);
                setLog((prev) => [...prev, `Error in batch ${i + 1}: ${e.message}`]);
                return;
            }
        }

        setLog((prev) => [...prev, "Import complete!"]);
    };

    const handleDeleteAll = async () => {
        if (!confirm("Are you sure you want to DELETE ALL words? This cannot be undone.")) return;

        setLoading(true);
        setLog(["Deleting all words..."]);

        try {
            const q = query(collection(db, "word_master"));
            const snapshot = await getDocs(q);
            const total = snapshot.size;

            if (total === 0) {
                setLog(prev => [...prev, "No words to delete."]);
                setLoading(false);
                return;
            }

            const BATCH_SIZE = 500;
            const chunks: any[][] = [];
            const docs = snapshot.docs;

            for (let i = 0; i < total; i += BATCH_SIZE) {
                chunks.push(docs.slice(i, i + BATCH_SIZE));
            }

            for (let i = 0; i < chunks.length; i++) {
                const batch = writeBatch(db);
                chunks[i].forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                setLog(prev => [...prev, `Deleted batch ${i + 1}/${chunks.length} (${chunks[i].length} docs)`]);
            }

            setLog(prev => [...prev, "All words deleted."]);
            checkStats(); // Update stats
        } catch (e: any) {
            console.error(e);
            setLog(prev => [...prev, "Error deleting: " + e.message]);
        } finally {
            setLoading(false);
        }
    };

    // if (!user) return <div className="p-8">Please login first.</div>;

    // Data verification logic

    // Hooks moved to top

    const checkStats = async () => {
        const q = query(collection(db, "word_master"));
        const snapshot = await getDocs(q);
        const counts: Record<string, number> = {};
        const cats = new Set<string>();

        snapshot.forEach(doc => {
            const data = doc.data();
            const sid = data.sectionId;
            counts[sid] = (counts[sid] || 0) + 1;
            if (data.category) cats.add(data.category);
        });
        setStats(counts);
        setCategories(Array.from(cats));
    };

    return (
        <div className="min-h-screen p-8 bg-gray-50 text-gray-800">
            <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow">
                <h1 className="text-2xl font-bold mb-6">Admin: Data Import</h1>
                <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                    <span className="font-bold">Your UID:</span> {user?.uid}
                </div>

                <div className="mb-6 space-y-2">
                    <label className="block font-medium">Upload CSV (カテゴリー, 英単語, 日本語訳)</label>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        disabled={loading}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-orange file:text-white hover:file:bg-orange-600"
                    />
                </div>

                {loading && (
                    <div className="mb-4">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                        </div>
                        <p className="text-sm text-right mt-1">{Math.round(progress)}%</p>
                    </div>
                )}

                <div className="bg-gray-900 text-green-400 p-4 rounded h-64 overflow-y-auto font-mono text-sm mb-6">
                    {log.map((line, i) => <div key={i}>{line}</div>)}
                </div>

                <div className="border-t pt-6">
                    <h2 className="font-bold mb-4">Database Stats</h2>
                    <div className="flex gap-4 mb-4">
                        <button onClick={checkStats} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">Check Word Counts</button>
                        <button onClick={handleDeleteAll} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Delete All Data</button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        {Object.entries(stats).map(([sid, count]) => (
                            <div key={sid} className="bg-gray-100 p-2 rounded flex justify-between">
                                <span>Section {sid}</span>
                                <span className="font-bold">{count} words</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6">
                        <h3 className="font-bold mb-2 text-sm text-gray-600">Detected Categories:</h3>
                        <div className="flex flex-wrap gap-2">
                            {categories.map(c => (
                                <span key={c} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{c}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
