import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import HomeScreen from '../screens/main/HomeScreen';
import MatchesScreen from '../screens/main/MatchesScreen';
import MessagesScreen from '../screens/main/MessagesScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import CreateJobScreen from '../screens/main/CreateJobScreen';
import DetailScreen from '../screens/main/DetailScreen';
import ChatScreen from '../screens/main/ChatScreen';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

export type MainTabParamList = {
  Home: undefined;
  Messages: undefined;
  Matches: undefined;
  CreateJob: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  EditProfile: undefined;
  Detail: { id: string; type: 'Job' | 'Candidate'; applicationId?: string };
  Chat: { applicationId?: string; otherUserId: string; jobTitle: string };
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

function TabNavigator() {
  const { userProfile } = useAuth();
  const { colors } = useTheme();
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadStatusCount, setUnreadStatusCount] = useState(0);

  useEffect(() => {
    if (!userProfile?.uid) return;
    
    // Unread Messages Listener
    const qMsg = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userProfile.uid)
    );
    const unsubMsg = onSnapshot(qMsg, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach(doc => {
        count += (doc.data()[`unreadCount_${userProfile.uid}`] || 0);
      });
      setTotalUnread(count);
    });

    // Unread Application Status Listener
    const qApp = query(
      collection(db, 'applications'),
      where('userId', '==', userProfile.uid),
      where('statusViewed', '==', false)
    );
    const unsubApp = onSnapshot(qApp, (snapshot) => {
      setUnreadStatusCount(snapshot.size);
    });

    return () => { if(unsubMsg) unsubMsg(); if(unsubApp) unsubApp(); };
  }, [userProfile?.uid]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.headerBg,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '600',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Matches') {
            iconName = focused ? 'file-tray-full' : 'file-tray-full-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'CreateJob') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          paddingBottom: 5,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Explorar' }} />
      <Tab.Screen 
        name="Messages" 
        component={MessagesScreen} 
        options={{ 
          title: totalUnread > 0 ? `Mensajes (${totalUnread})` : 'Mensajes',
          tabBarBadge: totalUnread > 0 ? totalUnread : undefined
        }} 
      />
      <Tab.Screen 
        name="Matches" 
        component={MatchesScreen} 
        options={{ 
          title: unreadStatusCount > 0 ? `Postulaciones (${unreadStatusCount})` : 'Postulaciones',
          tabBarBadge: unreadStatusCount > 0 ? unreadStatusCount : undefined 
        }} 
      />

      {userProfile?.userType === 'Hiring' && (
        <Tab.Screen name="CreateJob" component={CreateJobScreen} options={{ title: 'Publicar' }} />
      )}

      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown: true,
          title: 'Editar Perfil',
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.headerBg },
          headerTitleStyle: { color: colors.text },
        }}
      />
      <Stack.Screen
        name="Detail"
        component={DetailScreen}
        options={{
          headerShown: true,
          title: 'Detalles',
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.headerBg },
          headerTitleStyle: { color: colors.text },
        }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: true,
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.headerBg },
          headerTitleStyle: { color: colors.text },
        }}
      />
    </Stack.Navigator>
  );
}
