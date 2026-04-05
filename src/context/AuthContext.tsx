import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

export type UserType = 'Searching' | 'Hiring';

export interface UserProfile {
  uid: string;
  email: string | null;
  userType: UserType;
  name: string;
  photoURL?: string;  // matches Firestore field
  resumeURL?: string; // matches Firestore field
  jobDescription?: string;
  jobId?: string;
  status?: string;    // e.g. "pending"
  // Searching
  age?: number;
  city?: string;
  profession?: string;
  bio?: string;
  skills?: string[];
  experienceYears?: number;
  education?: string;
  availability?: string;
  salaryExpectation?: string;
  cvUrl?: string;
  // Hiring
  companyName?: string;
  industry?: string;
  role?: string;
  companyDescription?: string;
  location?: string;
  website?: string;
  companySize?: string;
  createdAt?: number;
}

interface AuthContextData {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user?.uid) {
      await fetchProfile(user.uid);
    }
  };

  const switchRole = async () => {
    if (!user || !userProfile) return;
    const newRole: UserType = userProfile.userType === 'Searching' ? 'Hiring' : 'Searching';
    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, { userType: newRole });
      await fetchProfile(user.uid);
    } catch (error) {
      console.error('Error switching role:', error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout, refreshProfile, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
