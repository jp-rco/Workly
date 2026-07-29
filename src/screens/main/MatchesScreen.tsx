import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView, Platform, Alert,
} from 'react-native';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SIZES, SHADOWS, type } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, MainTabParamList } from '../../navigation/MainNavigator';
import { FadeInUp } from '../../components/common/Animated';
import { useModal } from '../../context/ModalContext';
import { useNotification } from '../../context/NotificationContext';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Matches'>,
  NativeStackNavigationProp<MainStackParamList>
>;

interface ApplicationItem {
  id: string; userId: string; name: string; email: string; photoURL: string;
  resumeURL: string; description: string; status: string; createdAt: string;
  interviewDate?: string; jobId?: string; jobTitle?: string; jobImageUrl?: string;
  jobAddress?: string; jobPay?: string; jobDuration?: string; statusViewed?: boolean;
}
interface JobWithCount { id: string; title: string; imageUrl?: string; applicantCount: number; }
interface LikedUser { id: string; userId: string; name: string; profession: string; photoURL: string; timestamp: string; }

const STATUS_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'interview', label: 'Entrevista' },
  { id: 'accepted', label: 'Aceptados' },
  { id: 'rejected', label: 'Rechazados' },
];

export default function MatchesScreen() {
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<NavProp>();
  const { unreadCount } = useNotification();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recruiterTab, setRecruiterTab] = useState<'applications' | 'interest'>('applications');
  const [statusFilter, setStatusFilter] = useState('all');

  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [myJobs, setMyJobs] = useState<JobWithCount[]>([]);
  const [interestProfiles, setInterestProfiles] = useState<LikedUser[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [applicantsForJob, setApplicantsForJob] = useState<ApplicationItem[]>([]);

  const isSearching = userProfile?.userType === 'Searching';

  const fetchApplicantsForSelectedJob = async (jobId: string) => {
    const q = query(collection(db, 'applications'), where('jobId', '==', jobId));
    const snap = await getDocs(q);
    const enriched = snap.docs.map((appDoc) => {
      const app = appDoc.data();
      return {
        id: appDoc.id,
        status: app.status || 'pending',
        createdAt: app.createdAt || '',
        interviewDate: app.interviewDate || '',
        userId: app.userId,
        name: app.name || 'Candidato',
        email: app.email,
        photoURL: app.photoURL,
        resumeURL: app.resumeURL,
        description: app.description,
        jobId: app.jobId || '',
        jobTitle: app.jobTitle || 'Trabajo',
        statusViewed: app.statusViewed !== false,
      } as ApplicationItem;
    });
    setApplicantsForJob(enriched.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
  };

  const fetchData = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      if (isSearching) {
        const q = query(collection(db, 'applications'), where('userId', '==', userProfile.uid));
        const snap = await getDocs(q);
        const enriched = await Promise.all(snap.docs.map(async (appDoc) => {
          const app = appDoc.data();
          let jobData: any = {};
          if (app.jobId) {
            const jobSnap = await getDoc(doc(db, 'jobs', app.jobId));
            if (jobSnap.exists()) jobData = jobSnap.data();
          }
          return {
            id: appDoc.id,
            status: app.status || 'pending',
            createdAt: app.createdAt || '',
            interviewDate: app.interviewDate || '',
            userId: app.userId, name: app.name, email: app.email,
            photoURL: app.photoURL, resumeURL: app.resumeURL, description: app.description,
            jobId: app.jobId,
            jobTitle: jobData.title || app.jobTitle,
            jobImageUrl: jobData.imageUrl,
            jobAddress: jobData.address,
            jobPay: jobData.pay,
            jobDuration: jobData.duration,
          } as ApplicationItem;
        }));
        setApplications(enriched.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
      } else {
        if (recruiterTab === 'applications') {
          const jobsSnap = await getDocs(query(collection(db, 'jobs'), where('ownerUid', '==', userProfile.uid)));
          const jobsList = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
          const jobsWithCounts = await Promise.all(jobsList.map(async (j) => {
            const qApp = query(collection(db, 'applications'), where('jobId', '==', j.id));
            const appSnap = await getDocs(qApp);
            return { id: j.id, title: j.title, imageUrl: j.imageUrl, applicantCount: appSnap.size };
          }));
          setMyJobs(jobsWithCounts);
          if (selectedJobId) await fetchApplicantsForSelectedJob(selectedJobId);
        } else {
          const likesSnap = await getDocs(query(collection(db, 'likes'), where('employerId', '==', userProfile.uid)));
          const likedList = await Promise.all(likesSnap.docs.map(async (lDoc) => {
            const like = lDoc.data();
            const uSnap = await getDoc(doc(db, 'users', like.userId));
            const userData = uSnap.exists() ? uSnap.data() : {};
            return {
              id: lDoc.id,
              userId: like.userId,
              name: userData.name || 'Candidato',
              profession: userData.profession || 'Profesional',
              photoURL: userData.photoURL || '',
              timestamp: like.timestamp || '',
            };
          }));
          setInterestProfiles(likedList.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || ''))));
        }
      }
    } catch (e) {
      console.error('fetchData error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile, isSearching, recruiterTab, selectedJobId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleJobSelect = async (jobId: string) => {
    setLoading(true);
    setSelectedJobId(jobId);
    await fetchApplicantsForSelectedJob(jobId);
    setLoading(false);
  };

  const statusColors: any = {
    rejected: colors.reject,
    accepted: colors.accept,
    interview: '#5DA8FF',
    pending: colors.primary,
  };
  const getStatusColor = (s: string) => statusColors[s] || colors.primary;
  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'rejected': return 'Rechazado';
      case 'accepted': return 'Contratado';
      case 'interview': return 'Entrevista';
      default: return 'Pendiente';
    }
  };

  const styles = makeStyles(colors, isDark);

  const renderApplicationCard = ({ item, index }: { item: ApplicationItem; index: number }) => (
    <FadeInUp delay={Math.min(index * 30, 200)}>
      <View style={styles.cardWrapper}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => {
            if (isSearching) {
              if (item.jobId) navigation.navigate('Detail', { id: item.jobId, type: 'Job', applicationId: item.id });
            } else {
              if (item.userId) navigation.navigate('Detail', { id: item.userId, type: 'Candidate', applicationId: item.id });
            }
          }}
          activeOpacity={0.85}
        >
          <Image
            source={{
              uri: isSearching
                ? (item.jobImageUrl || 'https://via.placeholder.com/100.png?text=Trabajo')
                : (item.photoURL || 'https://via.placeholder.com/100.png?text=Perfil'),
            }}
            style={styles.avatar}
          />
          <View style={styles.info}>
            <Text style={styles.mainTitle} numberOfLines={1}>
              {isSearching ? item.jobTitle : item.name}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {isSearching ? (item.jobPay ? `$${item.jobPay}` : 'Ver detalles') : (item.email || 'Postulante')}
            </Text>
            <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) + '22', borderColor: getStatusColor(item.status) + '55' }]}>
              <View style={[styles.badgeDot, { backgroundColor: getStatusColor(item.status) }]} />
              <Text style={[styles.badgeText, { color: getStatusColor(item.status) }]}>
                {getStatusLabel(item.status)}
                {item.status === 'interview' && item.interviewDate ? ` · ${new Date(item.interviewDate).toLocaleDateString()}` : ''}
              </Text>
            </View>
          </View>
          {item.statusViewed === false && <View style={styles.unreadDot} />}
          <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickChatBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Chat', {
            applicationId: item.id,
            otherUserId: (isSearching ? item.jobId : item.userId) || '',
            jobTitle: item.jobTitle || 'Chat',
          })}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </FadeInUp>
  );

  const { showConfirm, showAlert } = useModal();

  const handleDeleteInterest = (likeDocId: string, candidateName: string) => {
    showConfirm({
      title: 'Quitar de interés',
      message: `¿Deseas quitar a ${candidateName} de tu lista de personas de interés?`,
      confirmText: 'Quitar',
      confirmStyle: 'destructive',
      icon: 'trash-outline',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'likes', likeDocId));
          setInterestProfiles((prev) => prev.filter((p) => p.id !== likeDocId));
        } catch (e) {
          console.error('Error deleting interest:', e);
          showAlert({ title: 'Error', message: 'No se pudo quitar el perfil de interés.', type: 'error' });
        }
      },
    });
  };

  const renderLikedCard = ({ item, index }: { item: LikedUser; index: number }) => (
    <FadeInUp delay={Math.min(index * 30, 200)}>
      <View style={styles.cardWrapper}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Detail', { id: item.userId, type: 'Candidate', fromMatches: true })}
          activeOpacity={0.85}
        >
          <Image source={{ uri: item.photoURL || 'https://via.placeholder.com/100.png?text=Perfil' }} style={styles.avatar} />
          <View style={styles.info}>
            <Text style={styles.mainTitle}>{item.name}</Text>
            <Text style={styles.subtitle}>{item.profession}</Text>
            <Text style={styles.dateText}>Interesado el {new Date(item.timestamp).toLocaleDateString()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickChatBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Chat', { otherUserId: item.userId, jobTitle: item.name })}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.trashBtn}
          activeOpacity={0.85}
          onPress={() => handleDeleteInterest(item.id, item.name)}
        >
          <Ionicons name="trash-outline" size={18} color={colors.reject} />
        </TouchableOpacity>
      </View>
    </FadeInUp>
  );

  const filteredApps = applications.filter(a => {
    if (a.status === 'completed') return false;
    if (statusFilter === 'all') return true;
    return a.status === statusFilter;
  });

  if (loading && !refreshing) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        {!isSearching && selectedJobId ? (
          <TouchableOpacity onPress={() => setSelectedJobId(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : null}

        {!isSearching && !selectedJobId ? (
          <View style={styles.tabContainer}>
            {(['applications', 'interest'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, recruiterTab === t && styles.activeTab]}
                onPress={() => setRecruiterTab(t)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabText, recruiterTab === t && styles.activeTabText]}>
                  {t === 'applications' ? 'Postulaciones' : 'Interés'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.headerTitle}>
            {isSearching ? 'Mis procesos' : (selectedJobId ? 'Candidatos' : 'Matches')}
          </Text>
        )}

        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {isSearching && (
        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {STATUS_FILTERS.map(f => (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, statusFilter === f.id && styles.activeFilterChip]}
                onPress={() => setStatusFilter(f.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterChipText, statusFilter === f.id && styles.activeFilterChipText]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {isSearching ? (
        filteredApps.length === 0 ? (
          <EmptyState colors={colors} isDark={isDark} text="Sin postulaciones aún" subtext="Cuando apliques a una vacante, aparecerá aquí." />
        ) : (
          <FlatList
            data={filteredApps}
            renderItem={renderApplicationCard}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          />
        )
      ) : (
        recruiterTab === 'applications' ? (
          selectedJobId ? (
            applicantsForJob.length === 0 ? (
              <EmptyState colors={colors} isDark={isDark} text="Nadie ha aplicado todavía" subtext="" />
            ) : (
              <FlatList
                data={applicantsForJob}
                renderItem={renderApplicationCard}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
              />
            )
          ) : (
            myJobs.length === 0 ? (
              <EmptyState colors={colors} isDark={isDark} text="No tienes vacantes" subtext="Publica una desde Crear." />
            ) : (
              <FlatList
                data={myJobs}
                renderItem={({ item, index }) => (
                  <FadeInUp delay={Math.min(index * 30, 180)}>
                    <TouchableOpacity style={styles.card} onPress={() => handleJobSelect(item.id)} activeOpacity={0.85}>
                      <Image source={{ uri: item.imageUrl || 'https://via.placeholder.com/100.png?text=Vacante' }} style={styles.avatar} />
                      <View style={styles.info}>
                        <Text style={styles.mainTitle}>{item.title}</Text>
                        <View style={styles.countRow}>
                          <Ionicons name="people-outline" size={14} color={colors.primary} />
                          <Text style={styles.countText}>{item.applicantCount} candidatos</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                    </TouchableOpacity>
                  </FadeInUp>
                )}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
              />
            )
          )
        ) : (
          interestProfiles.length === 0 ? (
            <EmptyState colors={colors} isDark={isDark} text="Sin perfiles de interés" subtext="" />
          ) : (
            <FlatList
              data={interestProfiles}
              renderItem={renderLikedCard}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            />
          )
        )
      )}
    </View>
  );
}

function EmptyState({ colors, isDark, text, subtext }: { colors: any; isDark: boolean; text: string; subtext: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
      <View style={{
        width: 76, height: 76, borderRadius: 38,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: isDark ? 'rgba(232,197,108,0.08)' : 'rgba(10,10,10,0.04)',
        borderWidth: 1, borderColor: colors.border, marginBottom: 14,
      }}>
        <Ionicons name="documents-outline" size={32} color={colors.primary} />
      </View>
      <Text style={{ ...type.h2, color: colors.text, textAlign: 'center' }}>{text}</Text>
      {subtext ? <Text style={{ ...type.body, color: colors.textLight, textAlign: 'center', marginTop: 6 }}>{subtext}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SIZES.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SIZES.sm,
    backgroundColor: colors.headerBg,
  },
  backBtn: { marginRight: 12 },
  headerTitle: { ...type.h1, color: colors.text, flex: 1 },
  notifBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(232,197,108,0.12)' : 'rgba(10,10,10,0.06)',
    borderWidth: 1, borderColor: colors.border,
    position: 'relative', marginLeft: 8,
  },
  notifBadge: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: colors.reject, minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  notifBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },

  tabContainer: { flexDirection: 'row', flex: 1, gap: 8 },
  tab: {
    paddingVertical: 9, paddingHorizontal: 16,
    borderRadius: SIZES.radius_full,
    backgroundColor: 'transparent',
  },
  activeTab: { backgroundColor: colors.primary },
  tabText: { ...type.button, color: colors.textLight },
  activeTabText: { color: colors.onPrimary },

  filterWrapper: {
    backgroundColor: colors.headerBg,
    paddingBottom: SIZES.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterScroll: { paddingHorizontal: SIZES.lg, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: SIZES.radius_full,
    backgroundColor: colors.inputBackground,
    borderWidth: 1, borderColor: colors.border,
  },
  activeFilterChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...type.small, color: colors.textLight },
  activeFilterChipText: { color: colors.onPrimary },

  listContent: { padding: SIZES.md, gap: 10, paddingBottom: 130 },

  cardWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: SIZES.radius_lg,
    padding: SIZES.md, gap: SIZES.md,
    borderWidth: 1, borderColor: colors.border,
    ...(isDark ? {} : SHADOWS.light),
  },
  avatar: { width: 56, height: 56, borderRadius: SIZES.radius, backgroundColor: colors.inputBackground },
  info: { flex: 1, gap: 2 },
  mainTitle: { ...type.h3, color: colors.text },
  subtitle: { ...type.small, color: colors.textLight },
  dateText: { ...type.caption, color: colors.textLight, marginTop: 4 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  countText: { ...type.small, color: colors.primary },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: SIZES.radius_full, alignSelf: 'flex-start', marginTop: 6,
    borderWidth: 1,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { ...type.caption },

  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.reject, marginRight: 4 },

  quickChatBtn: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  trashBtn: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,77,77,0.12)' : 'rgba(255,77,77,0.08)',
    borderWidth: 1, borderColor: colors.reject + '33',
  },
});
