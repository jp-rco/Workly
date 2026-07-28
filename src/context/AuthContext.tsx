import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  createdAt?: number | string;
  onboardingPending?: boolean;
  isDualProfile?: boolean;
  pushToken?: string;
}

interface SwitchRoleResult {
  isFirstTime: boolean;
  targetRole: UserType;
}

interface AuthContextData {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchRole: () => Promise<SwitchRoleResult>;
  updatePushToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const activeId = await AsyncStorage.getItem(`@workly_active_profile_id_${uid}`);
      const targetDocId = activeId || uid;

      const docRef = doc(db, 'users', targetDocId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserProfile({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      } else {
        const defaultRef = doc(db, 'users', uid);
        const defaultSnap = await getDoc(defaultRef);
        if (defaultSnap.exists()) {
          setUserProfile({ uid: defaultSnap.id, ...defaultSnap.data() } as UserProfile);
        } else {
          setUserProfile(null);
        }
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

  const updatePushToken = useCallback(async (token: string) => {
    if (!user || !userProfile) return;
    if (userProfile.pushToken === token) return;
    
    try {
      const docRef = doc(db, 'users', userProfile.uid);
      await updateDoc(docRef, { pushToken: token });
      setUserProfile((prev) => prev ? { ...prev, pushToken: token } : null);
    } catch (error) {
      console.error('Error updating push token:', error);
    }
  }, [user, userProfile]);

  const switchRole = async (): Promise<SwitchRoleResult> => {
    if (!user || !userProfile) {
      return { isFirstTime: false, targetRole: 'Searching' };
    }

    const currentRole = userProfile.userType;
    const targetRole: UserType = currentRole === 'Searching' ? 'Hiring' : 'Searching';
    const email = userProfile.email || user.email;

    try {
      // Buscar si ya existe un perfil en Firestore con el mismo correo y el rol destino
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email), where('userType', '==', targetRole));
      const snap = await getDocs(q);

      let targetProfileDocId = '';
      let isFirstTime = false;

      if (!snap.empty) {
        // Ya existe un perfil previamente creado para este rol con el mismo correo
        const existingDoc = snap.docs[0];
        targetProfileDocId = existingDoc.id;
        const targetData = { uid: existingDoc.id, ...existingDoc.data() } as UserProfile;
        setUserProfile(targetData);
      } else {
        // NO existe -> Crear un perfil secundario independiente con el mismo correo y nombre
        isFirstTime = true;
        targetProfileDocId = `${user.uid}_${targetRole}`;
        const newProfileData: any = {
          uid: targetProfileDocId,
          authUid: user.uid,
          email: email,
          name: userProfile.name || 'Usuario',
          userType: targetRole,
          createdAt: new Date().toISOString(),
          isDualProfile: true,
          photoURL: userProfile.photoURL || '',
        };

        if (targetRole === 'Hiring') {
          // Si no tiene empresa definida, se establece su nombre
          newProfileData.companyName = userProfile.companyName || userProfile.name || 'Empresa';
          newProfileData.location = userProfile.city || '';
          newProfileData.companyDescription = userProfile.bio || '';
        } else {
          newProfileData.profession = '';
          newProfileData.city = userProfile.location || '';
          newProfileData.bio = userProfile.companyDescription || '';
        }

        await setDoc(doc(db, 'users', targetProfileDocId), newProfileData);
        setUserProfile({ uid: targetProfileDocId, ...newProfileData } as UserProfile);
      }

      // Guardar perfil activo en AsyncStorage para persisitir la navegación en dicho rol
      await AsyncStorage.setItem(`@workly_active_profile_id_${user.uid}`, targetProfileDocId);

      return { isFirstTime, targetRole };
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
      if (user?.uid) {
        await AsyncStorage.removeItem(`@workly_active_profile_id_${user.uid}`);
      }
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout, refreshProfile, switchRole, updatePushToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
