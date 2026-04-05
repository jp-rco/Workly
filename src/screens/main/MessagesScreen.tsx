import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SIZES, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainNavigator';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

interface Conversation {
  id: string;
  lastMessage: string;
  lastMessageAt: any;
  participants: string[];
  applicationId?: string;
  jobTitle: string;
  otherUser?: {
    id: string;
    name: string;
    photoURL: string;
    profession?: string;
  };
  unreadCount: number;
  statusViewed?: boolean;
}

export default function MessagesScreen() {
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<NavProp>();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'applied' | 'direct'>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!userProfile) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userProfile.uid)
      // Removed orderBy to avoid index requirement
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convos = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data();
        const otherUserId = data.participants.find((p: string) => p !== userProfile.uid);
        
        // Fetch other user details
        const userSnap = await getDoc(doc(db, 'users', otherUserId));
        const userData = userSnap.exists() ? userSnap.data() : { name: 'Usuario', photoURL: '' };

        return {
          id: d.id,
          ...data,
          otherUser: {
            id: otherUserId,
            name: userData.name,
            photoURL: userData.photoURL || data.jobImageUrl, // Prioritize user photo, fallback to job photo
            profession: userData.profession,
          },
          unreadCount: data[`unreadCount_${userProfile.uid}`] || 0,
        } as Conversation;
      }));

      // Client-side sort by lastMessageAt desc
      convos.sort((a, b) => {
        const timeA = a.lastMessageAt?.seconds || 0;
        const timeB = b.lastMessageAt?.seconds || 0;
        return timeB - timeA;
      });

      setConversations(convos);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [userProfile]);

  const filteredConversations = conversations.filter(c => {
    if (activeTab === 'all') return true;
    if (activeTab === 'applied') return !!c.applicationId;
    return !c.applicationId;
  });

  const handlePressChat = async (convo: Conversation) => {
    // Reset unread count
    try {
      await updateDoc(doc(db, 'conversations', convo.id), {
        [`unreadCount_${userProfile?.uid}`]: 0
      });
    } catch {}

    navigation.navigate('Chat', {
      applicationId: convo.applicationId,
      otherUserId: convo.otherUser!.id,
      jobTitle: convo.jobTitle
    });
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity style={styles.row} onPress={() => handlePressChat(item)} activeOpacity={0.7}>
      <TouchableOpacity 
        onPress={() => navigation.navigate('Detail', { id: item.otherUser!.id, type: 'Candidate' })}
      >
        <Image 
          source={{ uri: item.otherUser?.photoURL || 'https://via.placeholder.com/80.png?text=User' }} 
          style={styles.avatar} 
        />
      </TouchableOpacity>
      
      <View style={styles.convoInfo}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>{item.otherUser?.name}</Text>
          <Text style={styles.time}>
            {item.lastMessageAt?.toDate ? item.lastMessageAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </Text>
        </View>
        
        <View style={styles.rowBottom}>
          <View style={styles.msgPreviewContainer}>
            {item.applicationId && (
              <Text style={styles.jobTag} numberOfLines={1}>[{item.jobTitle}]</Text>
            )}
            <Text style={[styles.lastMsg, item.unreadCount > 0 && styles.unreadMsg]} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          </View>
          {item.unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.unreadCountText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const styles = makeStyles(colors);

  const totalUnread = conversations.reduce((acc, curr) => acc + curr.unreadCount, 0);
  const appliedUnread = conversations.filter(c => !!c.applicationId).reduce((acc, curr) => acc + curr.unreadCount, 0);
  const directUnread = conversations.filter(c => !c.applicationId).reduce((acc, curr) => acc + curr.unreadCount, 0);
  const isSearching = userProfile?.userType === 'Searching';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            Todos{totalUnread > 0 ? ` (${totalUnread})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'applied' && styles.activeTab]}
          onPress={() => setActiveTab('applied')}
        >
          <Text style={[styles.tabText, activeTab === 'applied' && styles.activeTabText]}>
            {isSearching ? 'Aplicados' : 'Candidatos'}
            {appliedUnread > 0 ? ` (${appliedUnread})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'direct' && styles.activeTab]}
          onPress={() => setActiveTab('direct')}
        >
          <Text style={[styles.tabText, activeTab === 'direct' && styles.activeTabText]}>
            {isSearching ? 'Propuestas' : 'Directo'}
            {directUnread > 0 ? ` (${directUnread})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && conversations.length === 0 ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbox-ellipses-outline" size={64} color={colors.textLight} />
          <Text style={styles.emptyText}>No hay conversaciones aquí</Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 10 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 15, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textLight },
  activeTabText: { color: colors.primary },
  
  row: { flexDirection: 'row', padding: 15, alignItems: 'center', gap: 15 },
  avatar: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#eee' },
  convoInfo: { flex: 1, justifyContent: 'center' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  time: { fontSize: 12, color: colors.textLight },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  msgPreviewContainer: { flex: 1 },
  jobTag: { fontSize: 11, color: colors.primary, fontWeight: 'bold', marginBottom: 2 },
  lastMsg: { fontSize: 14, color: colors.textLight },
  unreadMsg: { color: colors.text, fontWeight: '600' },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadCountText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { marginTop: 15, color: colors.textLight, fontSize: 16 },
});
