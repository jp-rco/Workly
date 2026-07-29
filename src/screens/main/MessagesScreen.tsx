import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SIZES, SHADOWS, type } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainNavigator';
import { FadeInUp } from '../../components/common/Animated';
import { useNotification } from '../../context/NotificationContext';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

interface Conversation {
  id: string;
  lastMessage: string;
  lastMessageAt: any;
  participants: string[];
  applicationId?: string;
  jobTitle: string;
  otherUser?: { id: string; name: string; photoURL: string; profession?: string; };
  unreadCount: number;
  statusViewed?: boolean;
}

export default function MessagesScreen() {
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<NavProp>();
  const { unreadCount } = useNotification();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'applied' | 'direct'>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!userProfile) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userProfile.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convos = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data();
        const otherUserId = data.participants.find((p: string) => p !== userProfile.uid);

        const userSnap = await getDoc(doc(db, 'users', otherUserId));
        const userData = userSnap.exists() ? userSnap.data() : { name: 'Usuario', photoURL: '' };

        return {
          id: d.id,
          ...data,
          otherUser: {
            id: otherUserId,
            name: userData.name,
            photoURL: userData.photoURL || data.jobImageUrl,
            profession: userData.profession,
          },
          unreadCount: data[`unreadCount_${userProfile.uid}`] || 0,
        } as Conversation;
      }));

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
    try {
      await updateDoc(doc(db, 'conversations', convo.id), {
        [`unreadCount_${userProfile?.uid}`]: 0,
      });
    } catch { }
    navigation.navigate('Chat', {
      applicationId: convo.applicationId,
      otherUserId: convo.otherUser!.id,
      jobTitle: convo.jobTitle,
    });
  };

  const styles = makeStyles(colors, isDark);

  const renderConversation = ({ item, index }: { item: Conversation; index: number }) => (
    <FadeInUp delay={Math.min(index * 35, 250)}>
      <TouchableOpacity style={styles.row} onPress={() => handlePressChat(item)} activeOpacity={0.75}>
        <TouchableOpacity onPress={() => navigation.navigate('Detail', { id: item.otherUser!.id, type: 'Candidate' })}>
          <View style={styles.avatarRing}>
            <Image
              source={{ uri: item.otherUser?.photoURL || 'https://via.placeholder.com/80.png?text=User' }}
              style={styles.avatar}
            />
          </View>
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
                <Text style={styles.jobTag} numberOfLines={1}>· {item.jobTitle}</Text>
              )}
              <Text style={[styles.lastMsg, item.unreadCount > 0 && styles.unreadMsg]} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            </View>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCountText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </FadeInUp>
  );

  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  const appliedUnread = conversations.filter(c => !!c.applicationId).reduce((acc, c) => acc + c.unreadCount, 0);
  const directUnread = conversations.filter(c => !c.applicationId).reduce((acc, c) => acc + c.unreadCount, 0);
  const isSearching = userProfile?.userType === 'Searching';

  const Tab = ({ id, label, count }: { id: typeof activeTab; label: string; count: number }) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === id && styles.activeTab]}
      onPress={() => setActiveTab(id)}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabText, activeTab === id && styles.activeTabText]}>
        {label}{count > 0 ? ` · ${count}` : ''}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mensajes</Text>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <Tab id="all" label="Todos" count={totalUnread} />
        <Tab id="applied" label={isSearching ? 'Aplicados' : 'Candidatos'} count={appliedUnread} />
        <Tab id="direct" label={isSearching ? 'Propuestas' : 'Directo'} count={directUnread} />
      </View>

      {loading && conversations.length === 0 ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="chatbubbles-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyText}>Sin conversaciones</Text>
          <Text style={styles.emptySubtext}>Tus chats aparecerán aquí.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={item => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 130 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingHorizontal: SIZES.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SIZES.sm,
    backgroundColor: colors.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { ...type.display, color: colors.text },
  notifBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(232,197,108,0.12)' : 'rgba(10,10,10,0.06)',
    borderWidth: 1, borderColor: colors.border,
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: colors.reject, minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  notifBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.md, paddingBottom: SIZES.sm,
    gap: 6,
    backgroundColor: colors.headerBg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: SIZES.radius_full,
    backgroundColor: 'transparent',
  },
  activeTab: { backgroundColor: colors.primary },
  tabText: { ...type.small, color: colors.textLight },
  activeTabText: { color: colors.onPrimary },

  row: { flexDirection: 'row', paddingHorizontal: SIZES.lg, paddingVertical: 14, alignItems: 'center', gap: 14 },
  avatarRing: {
    padding: 2, borderRadius: 32,
    borderWidth: 1.5, borderColor: colors.border,
  },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.inputBackground },

  convoInfo: { flex: 1, justifyContent: 'center' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...type.h3, color: colors.text },
  time: { ...type.caption, color: colors.textLight },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, gap: 8 },
  msgPreviewContainer: { flex: 1 },
  jobTag: { ...type.caption, color: colors.primary, marginBottom: 2 },
  lastMsg: { ...type.body, color: colors.textLight },
  unreadMsg: { color: colors.text, fontFamily: type.bodyMd.fontFamily },
  unreadBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7,
    backgroundColor: colors.primary,
  },
  unreadCountText: { ...type.caption, color: colors.onPrimary },

  separator: { height: 1, marginLeft: SIZES.lg + 60, backgroundColor: colors.border, opacity: 0.5 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(232,197,108,0.08)' : 'rgba(10,10,10,0.04)',
    borderWidth: 1, borderColor: colors.border,
    marginBottom: SIZES.md,
  },
  emptyText: { ...type.h2, color: colors.text },
  emptySubtext: { ...type.body, color: colors.textLight, marginTop: 4 },
});
