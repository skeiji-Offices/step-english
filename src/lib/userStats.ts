import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface DailyMission {
    id: string;
    description: string;
    target: number;
    progress: number;
    completed: boolean;
    reward: number;
}

export interface UserStats {
    exp: number;
    level: number;
    streakCount: number;
    lastStudyDate: string | null;
    studyCalendar: string[]; // YYYY-MM-DD format
    dailyMission: DailyMission | null;
    lastMissionDate: string | null;
}

export const INITIAL_USER_STATS: UserStats = {
    exp: 0,
    level: 1,
    streakCount: 0,
    lastStudyDate: null,
    studyCalendar: [],
    dailyMission: null,
    lastMissionDate: null,
};

const MISSIONS = [
    { id: "play_10", description: "10問学習しよう", target: 10, reward: 50 },
    { id: "play_20", description: "20問学習しよう", target: 20, reward: 100 },
    { id: "score_5", description: "5問正解しよう", target: 5, reward: 30 },
];

function getTodayString() {
    return new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
}

function calculateLevel(exp: number) {
    // simple math: level up every 100 exp. Level 1 starts at 0 exp.
    return Math.floor(exp / 100) + 1;
}

function generateDailyMission(): DailyMission {
    const randomMission = MISSIONS[Math.floor(Math.random() * MISSIONS.length)];
    return {
        ...randomMission,
        progress: 0,
        completed: false,
    };
}

/**
 * Validates and resets daily missions or streaks if a new day has started.
 * Call this when loading the app or before updating stats.
 */
export async function checkDailyResets(uid: string, currentStats: UserStats): Promise<UserStats> {
    const today = getTodayString();
    let updatedStats = { ...currentStats };
    let needsUpdate = false;

    // Check Missions
    if (updatedStats.lastMissionDate !== today) {
        updatedStats.dailyMission = generateDailyMission();
        updatedStats.lastMissionDate = today;
        needsUpdate = true;
    }

    // Check Streak
    if (updatedStats.lastStudyDate) {
        const lastDate = new Date(updatedStats.lastStudyDate.replace(/-/g, "/"));
        const todayDate = new Date(today.replace(/-/g, "/"));
        const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 1 && updatedStats.streakCount > 0) {
            // Streak broken
            updatedStats.streakCount = 0;
            needsUpdate = true;
        }
    }

    if (needsUpdate) {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, {
            ...updatedStats
        });
    }

    return updatedStats;
}

/**
 * Updates stats after a session finishes.
 */
export async function updateSessionStats(
    uid: string,
    currentStats: UserStats,
    sessionScore: number,
    totalQuestions: number
): Promise<{ newStats: UserStats; leveledUp: boolean; missionCompleted: boolean }> {
    const today = getTodayString();
    let updatedStats = { ...currentStats };
    let leveledUp = false;
    let missionCompleted = false;

    // 1. UPDATE STREAK & CALENDAR
    if (updatedStats.lastStudyDate !== today) {
        // First study of the day!
        if (updatedStats.lastStudyDate) {
            const lastDate = new Date(updatedStats.lastStudyDate.replace(/-/g, "/"));
            const todayDate = new Date(today.replace(/-/g, "/"));
            const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                updatedStats.streakCount += 1;
            } else if (diffDays > 1) {
                updatedStats.streakCount = 1; // reset and start new 
            }
        } else {
            updatedStats.streakCount = 1; // very first time
        }

        updatedStats.lastStudyDate = today;

        if (!updatedStats.studyCalendar.includes(today)) {
            updatedStats.studyCalendar = [...updatedStats.studyCalendar, today];
        }
    }

    // 2. UPDATE EXP & LEVEL
    const baseExp = sessionScore * 10;
    // Perfect bonus
    const perfectBonus = sessionScore === totalQuestions && totalQuestions > 0 ? 20 : 0;
    let earnedExp = baseExp + perfectBonus;

    // 3. UPDATE MISSION
    if (updatedStats.dailyMission && !updatedStats.dailyMission.completed && updatedStats.lastMissionDate === today) {
        if (updatedStats.dailyMission.id.startsWith("play")) {
            updatedStats.dailyMission.progress += totalQuestions;
        } else if (updatedStats.dailyMission.id.startsWith("score")) {
            updatedStats.dailyMission.progress += sessionScore;
        }

        if (updatedStats.dailyMission.progress >= updatedStats.dailyMission.target) {
            updatedStats.dailyMission.progress = updatedStats.dailyMission.target;
            updatedStats.dailyMission.completed = true;
            earnedExp += updatedStats.dailyMission.reward;
            missionCompleted = true;
        }
    }

    const oldLevel = updatedStats.level;
    updatedStats.exp += earnedExp;
    updatedStats.level = calculateLevel(updatedStats.exp);

    if (updatedStats.level > oldLevel) {
        leveledUp = true;
    }

    // 4. SAVE TO FIRESTORE
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
        exp: updatedStats.exp,
        level: updatedStats.level,
        streakCount: updatedStats.streakCount,
        lastStudyDate: updatedStats.lastStudyDate,
        studyCalendar: updatedStats.studyCalendar,
        dailyMission: updatedStats.dailyMission,
        lastMissionDate: updatedStats.lastMissionDate
    });

    return { newStats: updatedStats, leveledUp, missionCompleted };
}

export function getLevelTitle(level: number) {
    if (level >= 50) return "レジェンド";
    if (level >= 40) return "マスター";
    if (level >= 30) return "エキスパート";
    if (level >= 20) return "熟練者";
    if (level >= 10) return "探求者";
    if (level >= 5) return "冒険者";
    return "見習い";
}
