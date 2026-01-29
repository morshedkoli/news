"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAdmin: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isAdmin: false,
    signOut: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setLoading(true);
            if (currentUser && currentUser.email) {
                // Check if user is admin
                try {
                    const adminDocRef = doc(db, "admins", currentUser.email);
                    const adminDoc = await getDoc(adminDocRef);

                    if (adminDoc.exists()) {
                        setUser(currentUser);
                        setIsAdmin(true);
                    } else {
                        console.warn("User is not an admin");
                        await firebaseSignOut(auth);
                        setUser(null);
                        setIsAdmin(false);
                        router.push("/login?error=unauthorized");
                    }
                } catch (error) {
                    console.error("Error checking admin status:", error);
                    setUser(null);
                    setIsAdmin(false);
                }
            } else {
                setUser(null);
                setIsAdmin(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [router]);

    const signOut = async () => {
        await firebaseSignOut(auth);
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
