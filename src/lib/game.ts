import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";

export interface Word {
    id: string;
    word: string;
    meaning: string;
    category: string;
    sectionId: number;
}

export interface Question extends Word {
    choices: string[]; // For choice mode: 3 distractors + 1 correct
}

/**
 * Shuffle array in place
 */
function shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Fetch random words within the range
 * Default count is 10 (user requested shorter sessions), can be overriden
 */
export async function fetchQuestions(maxSectionId: number, count: number = 10): Promise<Question[]> {
    const wordsRef = collection(db, "word_master");

    // Firestore doesn't support random fetch natively and efficiently for large datasets without specific indices.
    // For this scale (1800 words), we can try to fetch a chunk or use a random Field ID if we had one.
    // Since we don't have a random field, and we want to support "Range", we'll do a simple approach:
    // Fetch ALL words in the range (client-side filtering might be heavy if too huge, but 1800 is manageable in memory? maybe 500kb).
    // Actually, filtering by range first.

    const q = query(wordsRef, where("sectionId", "<=", maxSectionId));
    const snapshot = await getDocs(q);

    const allWords: Word[] = [];
    snapshot.forEach((doc) => {
        allWords.push({ id: doc.id, ...doc.data() } as Word);
    });

    if (allWords.length === 0) return [];

    // Shuffle and pick `count`
    const selectedWords = shuffle(allWords).slice(0, count);

    // Prepare questions (add choices)
    const questions: Question[] = selectedWords.map((word) => {
        // Pick 3 distractors from allWords excluding current
        const distractors = allWords
            .filter((w) => w.id !== word.id)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);

        // Mix choices
        const choices = shuffle([word.meaning, ...distractors.map(d => d.meaning)]);

        return {
            ...word,
            choices
        };
    });

    return questions;
}

export async function fetchWeakQuestions(uid: string, count: number = 10): Promise<Question[]> {
    const weakRef = collection(db, `users/${uid}/weak_words`);
    const snapshot = await getDocs(weakRef);

    const weakWords: Word[] = [];
    snapshot.forEach((doc) => {
        weakWords.push({ id: doc.id, ...doc.data() } as Word);
    });

    if (weakWords.length === 0) return [];

    // Limit to count, shuffle first
    const selectedWeakWords = shuffle(weakWords).slice(0, count);

    // We also need distractors. We should fetch a pool of words from word_master to use as distractors.
    // Fetching some random words (or all if cached/small enough)
    // For efficiency, let's just fetch a batch of words to use as distractors.
    // Ideally we fetch words from the same level/section, but random is okay for now.
    // Let's fetch 100 random words from word_master for distractors.
    let distractorPool: Word[] = [];
    try {
        const wordsRef = collection(db, "word_master");
        const q = query(wordsRef, limit(200)); // Just get some
        const wSnap = await getDocs(q);
        wSnap.forEach(doc => distractorPool.push({ id: doc.id, ...doc.data() } as Word));
    } catch (e) {
        console.error("Failed to fetch distractor pool", e);
        // Fallback: use weakWords as distractors if we have enough
        distractorPool = [...weakWords];
    }

    // Prepare questions
    const questions: Question[] = selectedWeakWords.map((word) => {
        // Pick 3 distractors
        const distractors = distractorPool
            .filter((w) => w.id !== word.id)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);

        // If not enough distractors (rare edge case), recycle meanings?
        while (distractors.length < 3) {
            distractors.push({ ...word, meaning: "Wrong Answer" }); // Fallback
        }

        const choices = shuffle([word.meaning, ...distractors.map(d => d.meaning)]);

        return {
            ...word,
            choices
        };
    });

    return questions;
}
