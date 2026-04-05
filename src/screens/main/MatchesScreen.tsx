import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView
} from 'react-native';
import {
  collection, query, where, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SIZES, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, MainTabParamList } from '../../navigation/MainNavigator';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Matches'>,
  NativeStackNavigationProp<MainStackParamList>
>;

interface ApplicationItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  photoURL: string;
  resumeURL: string;
  description: string;
  status: string;
  createdAt: string;
  interviewDate?: string;
  jobId?: string;
  jobTitle?: string;
  jobImageUrl?: string;
  jobAddress?: string;
  jobPay?: string;
  jobDuration?: string;
  statusViewed?: boolean;
}

interface JobWithCount {
  id: string;
  title: string;
  imageUrl?: string;
  applicantCount: number;
}

interface LikedUser {
  id: string;
  userId: string;
  name: string;
  profession: string;
  photoURL: string;
  timestamp: string;
}

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
            userId: app.userId,
            name: app.name,
            email: app.email,
            photoURL: app.photoURL,
            resumeURL: app.resumeURL,
            description: app.description,
            jobId: app.jobId,
            jobTitle: jobData.title || app.jobTitle,
            jobImageUrl: jobData.imageUrl,
            jobAddress: jobData.address,
            jobPay: jobData.pay,
            jobDuration: jobData.duration,
          } as ApplicationItem;
        }));
        setApplications(enriched.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } else {
        if (recruiterTab === 'applications') {
          const jobsSnap = await getDocs(query(collection(db, 'jobs'), where('ownerUid', '==', userProfile.uid)));
          const jobsList = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
          const jobsWithCounts: JobWithCount[] = await Promise.all(jobsList.map(async (j) => {
            const qApp = query(collection(db, 'applications'), where('jobId', '==', j.id));
            const appSnap = await getDocs(qApp);
            return {
              id: j.id,
              title: j.title,
              imageUrl: j.imageUrl,
              applicantCount: appSnap.size,
            };
          }));
          setMyJobs(jobsWithCounts);
          if (selectedJobId) await fetchApplicantsForSelectedJob(selectedJobId);
        } else {
          const likesSnap = await getDocs(query(collection(db, 'likes'), where('employerId', '==', userProfile.uid)));
          const likedList: LikedUser[] = await Promise.all(likesSnap.docs.map(async (lDoc) => {
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
          setInterestProfiles(likedList.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
        }
      }
    } catch (e) {
      console.error('fetchData error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile, isSearching, recruiterTab, selectedJobId]);

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
        statusViewed: app.statusViewed !== false, // Default to true if missing
      } as ApplicationItem;
    });
    setApplicantsForJob(enriched.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  };

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
    interview: '#3498db',
    pending: colors.primary,
  };

  const getStatusColor = (status: string) => statusColors[status] || colors.primary;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'rejected': return 'Rechazado';
      case 'accepted': return 'Contratado';
      case 'interview': return 'Entrevista';
      default: return 'Pendiente';
    }
  };

  const renderApplicationCard = ({ item }: { item: ApplicationItem }) => (
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
        activeOpacity={0.8}
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
            {isSearching ? (item.jobPay || 'Ver detalles') : (item.email || 'Postulante')}
          </Text>
          <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.badgeText, { color: getStatusColor(item.status) }]}>
              {getStatusLabel(item.status)}
              {item.status === 'interview' && item.interviewDate ? ` - ${new Date(item.interviewDate).toLocaleDateString()}` : ''}
            </Text>
          </View>
        </View>
        {item.statusViewed === false && (
          <View style={[styles.unreadDot, { backgroundColor: colors.reject }]} />
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
      </TouchableOpacity>
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.quickChatBtn}
          onPress={() => navigation.navigate('Chat', { 
            applicationId: item.id, 
            otherUserId: (isSearching ? item.jobId : item.userId) || '', 
            jobTitle: item.jobTitle || 'Chat' 
          })}
        >
          <Ionicons name="chatbubbles" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLikedCard = ({ item }: { item: LikedUser }) => (
    <View style={styles.cardWrapper}>
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => navigation.navigate('Detail', { id: item.userId, type: 'Candidate' })}
      >
        <Image source={{ uri: item.photoURL || 'https://via.placeholder.com/100.png?text=Perfil' }} style={styles.avatar} />
        <View style={styles.info}>
          <Text style={styles.mainTitle}>{item.name}</Text>
          <Text style={styles.subtitle}>{item.profession}</Text>
          <Text style={styles.dateText}>Interesado el {new Date(item.timestamp).toLocaleDateString()}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
      </TouchableOpacity>
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.quickChatBtn}
          onPress={() => navigation.navigate('Chat', { 
            otherUserId: item.userId, 
            jobTitle: item.name 
          })}
        >
          <Ionicons name="chatbubbles" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const filteredApps = applications.filter(a => {
    if (a.status === 'completed') return false;
    if (statusFilter === 'all') return true;
    return a.status === statusFilter;
  });

  const styles = makeStyles(colors, isDark);

  if (loading && !refreshing) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        {!isSearching && selectedJobId ? (
          <TouchableOpacity onPress={() => setSelectedJobId(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        
        {!isSearching && !selectedJobId ? (
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, recruiterTab === 'applications' && styles.activeTab]}
              onPress={() => setRecruiterTab('applications')}
            >
              <Text style={[styles.tabText, recruiterTab === 'applications' && styles.activeTabText]}>Postulaciones</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, recruiterTab === 'interest' && styles.activeTab]}
              onPress={() => setRecruiterTab('interest')}
            >
              <Text style={[styles.tabText, recruiterTab === 'interest' && styles.activeTabText]}>Interés</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.headerTitle}>
            {isSearching ? 'Mis Procesos' : (selectedJobId ? 'Candidatos' : 'Matches')}
          </Text>
        )}
      </View>

      {isSearching && (
        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {STATUS_FILTERS.map(f => (
              <TouchableOpacity 
                key={f.id} 
                style={[styles.filterChip, statusFilter === f.id && styles.activeFilterChip]}
                onPress={() => setStatusFilter(f.id)}
              >
                <Text style={[styles.filterChipText, statusFilter === f.id && styles.activeFilterChipText]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {isSearching ? (
        filteredApps.length === 0 ? (
          <EmptyState colors={colors} text="No hay postulaciones" subtext="" />
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
              <EmptyState colors={colors} text="Nadie ha aplicado aún" subtext="" />
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
              <EmptyState colors={colors} text="No tienes vacantes" subtext="" />
            ) : (
              <FlatList
                data={myJobs}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.card} onPress={() => handleJobSelect(item.id)}>
                    <Image source={{ uri: item.imageUrl || 'https://via.placeholder.com/100.png?text=Vacante' }} style={styles.avatar} />
                    <View style={styles.info}>
                      <Text style={styles.mainTitle}>{item.title}</Text>
                      <View style={styles.countRow}>
                        <Ionicons name="people-outline" size={16} color={colors.primary} />
                        <Text style={styles.countText}>{item.applicantCount} candidatos</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                  </TouchableOpacity>
                )}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
              />
            )
          )
        ) : (
          interestProfiles.length === 0 ? (
            <EmptyState colors={colors} text="No hay perfiles de interés" subtext="" />
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

function EmptyState({ colors, text, subtext }: { colors: any; text: string; subtext: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
      <Ionicons name="documents-outline" size={60} color={colors.border} />
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 10, textAlign: 'center' }}>{text}</Text>
      {subtext ? <Text style={{ fontSize: 14, color: colors.textLight, textAlign: 'center', marginTop: 5 }}>{subtext}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SIZES.lg, paddingVertical: SIZES.sm,
    backgroundColor: colors.headerBg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabContainer: { flexDirection: 'row', flex: 1, gap: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  activeTab: { backgroundColor: colors.primary + '15' },
  tabText: { fontSize: 16, fontWeight: '600', color: colors.textLight },
  activeTabText: { color: colors.primary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  backBtn: { marginRight: 12 },
  filterWrapper: { backgroundColor: colors.headerBg, paddingBottom: 8 },
  filterScroll: { paddingHorizontal: SIZES.lg, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border },
  activeFilterChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, color: colors.textLight, fontWeight: '600' },
  activeFilterChipText: { color: '#FFFFFF' },
  listContent: { padding: SIZES.md, gap: SIZES.sm },
  card: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: SIZES.radius_lg, padding: SIZES.md, gap: SIZES.md,
    ...SHADOWS.light, borderWidth: isDark ? 1 : 0, borderColor: colors.border,
  },
  avatar: { width: 56, height: 56, borderRadius: SIZES.radius, backgroundColor: colors.inputBackground },
  info: { flex: 1, gap: 2 },
  mainTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textLight },
  dateText: { fontSize: 11, color: colors.textLight, marginTop: 4 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  countText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, alignSelf: 'flex-start', marginTop: 4 },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  cardWrapper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickActions: { paddingRight: 5 },
  quickChatBtn: {
    backgroundColor: colors.primary + '10',
    padding: 10,
    borderRadius: 20,
    marginLeft: 10,
  },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e74c3c', marginRight: 8 },
});
