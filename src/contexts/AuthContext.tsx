"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

interface UserData {
    uid: string;
    displayName: string;
    totalStudyTime: number; // seconds
    totalChores: number; // correct count (using 'totalChores' as legacy name from plan, maybe rename to totalCorrect?)
    lastLoginAt: any;
}

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    loading: boolean;
    error: string | null;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userData: null,
    loading: true,
    error: null,
    login: async () => { },
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                try {
                    const userRef = doc(db, "users", currentUser.uid);
                    const userSnap = await getDoc(userRef);

                    if (!userSnap.exists()) {
                        const newUserData = {
                            uid: currentUser.uid,
                            displayName: currentUser.displayName || "User",
                            photoURL: currentUser.photoURL,
                            email: currentUser.email,
                            createdAt: serverTimestamp(),
                            lastLoginAt: serverTimestamp(),
                            totalStudyTime: 0,
                            totalChores: 0,
                        };
                        await setDoc(userRef, newUserData);
                        // @ts-ignore
                        setUserData(newUserData);
                    } else {
                        await setDoc(userRef, {
                            lastLoginAt: serverTimestamp(),
                        }, { merge: true });
                        // @ts-ignore
                        setUserData(userSnap.data());
                    }
                } catch (e: any) {
                    console.error("Firestore sync error:", e);
                    setError("Failed to load user data.");
                }
            } else {
                setUserData(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async () => {
        setError(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (e: any) {
            console.error("Login Error:", e);
            setError(e.message);
        }
    };

    const logout = async () => {
        await signOut(auth);
        setUserData(null);
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, login, logout, error }}>
            {children}
        </AuthContext.Provider>
    );
};
