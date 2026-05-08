import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, TouchableOpacity, Alert, Dimensions, LayoutAnimation, Platform } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { collection, getDocs, query, where, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { SIZES, SHADOWS, FONTS, type } from '../../constants/theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, MainTabParamList } from '../../navigation/MainNavigator';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { CompositeNavigationProp } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { FadeInUp, PressScale } from '../../components/common/Animated';

const { width } = Dimensions.get('window');

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<MainStackParamList>
>;

type Props = { navigation: HomeScreenNavigationProp };

export default function HomeScreen({ navigation }: Props) {
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const fetchCards = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const swipesQuery = query(collection(db, 'swipes'), where('userId', '==', userProfile.uid));
      const swipesSnap = await getDocs(swipesQuery);
      const swipedIds = swipesSnap.docs.map(d => d.data().targetId);

      const applicationsQuery = query(collection(db, 'applications'), where('userId', '==', userProfile.uid));
      const appsSnap = await getDocs(applicationsQuery);
      const appliedJobIds = appsSnap.docs.map(d => d.data().jobId);

      const likesQuery = query(collection(db, 'likes'), where('employerId', '==', userProfile.uid));
      const likesSnap = await getDocs(likesQuery);
      const likedUserIds = likesSnap.docs.map(d => d.data().userId);

      const excludedIds = [...swipedIds, ...appliedJobIds, ...likedUserIds];

      if (userProfile.userType === 'Searching') {
        const jobsSnapshot = await getDocs(collection(db, 'jobs'));
        const jobsData = jobsSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((job: any) =>
            (job.status === 'active' || job.status === 'activo') &&
            !excludedIds.includes(job.id) &&
            job.ownerUid !== userProfile.uid
          );
        setCards(jobsData);
      } else {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('userType', '==', 'Searching'));
        const usersSnapshot = await getDocs(q);
        const usersData = usersSnapshot.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter((u: any) => !excludedIds.includes(u.uid) && u.uid !== userProfile.uid);
        setCards(usersData);
      }
    } catch (e) {
      console.log('Error fetching cards', e);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const handleSwipedRight = async (cardIndex: number) => {
    if (!userProfile) return;
    const item = cards[cardIndex];
    if (!item) return;
    try {
      if (userProfile.userType === 'Searching') {
        await addDoc(collection(db, 'applications'), {
          userId: userProfile.uid, jobId: item.id, jobTitle: item.title || '',
          status: 'pending', description: userProfile.jobDescription || '',
          email: userProfile.email || '', name: userProfile.name || '',
          photoURL: userProfile.photoURL || '', resumeURL: userProfile.resumeURL || '',
          createdAt: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, 'likes'), {
          employerId: userProfile.uid, userId: item.uid,
          type: 'EmployerLikesUser', timestamp: new Date().toISOString(),
        });
      }
    } catch (e) { console.error('Error saving swipe right:', e); }
  };

  const handleSwipedLeft = async (cardIndex: number) => {
    if (!userProfile) return;
    const item = cards[cardIndex];
    if (!item) return;
    const targetId = userProfile.userType === 'Searching' ? item.id : item.uid;
    try {
      await addDoc(collection(db, 'swipes'), {
        userId: userProfile.uid, targetId, type: 'nope', timestamp: new Date().toISOString(),
      });
    } catch (e) { console.error('Error saving swipe left:', e); }
  };

  const handleClearDecisions = async () => {
    if (!userProfile) return;
    setResetting(true);
    try {
      const q = query(collection(db, 'swipes'), where('userId', '==', userProfile.uid));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      Alert.alert('Listo', 'Tus descartes anteriores fueron borrados.');
      fetchCards();
    } catch (e) {
      console.error('Error clearing decisions:', e);
      Alert.alert('Error', 'No se pudieron borrar las decisiones.');
    } finally { setResetting(false); }
  };

  const s = makeStyles(colors, isDark);

  const renderCard = (card: any) => {
    if (!card) return null;

    if (userProfile?.userType === 'Searching') {
      const requirements = Array.isArray(card.requirements) ? card.requirements : [];
      return (
        <View style={s.card}>
          <View style={s.imageBadgeContainer}>
            <Image
              source={{ uri: card.imageUrl || 'https://via.placeholder.com/400x300.png?text=Trabajo' }}
              style={s.cardImage}
            />
            <View style={s.imageScrim} />
            <View style={s.salaryBadge}>
              <Text style={s.salaryCurrency}>$</Text>
              <Text style={s.salaryText}>{card.pay || 'N/A'}</Text>
            </View>
          </View>

          <View style={s.cardContent}>
            <View style={s.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{card.title}</Text>
                <Text style={s.cardSubtitle} numberOfLines={1}>{card.companyName || 'Empresa'}</Text>
              </View>
              <View style={s.locationChip}>
                <Ionicons name="location-outline" size={12} color={colors.primary} />
                <Text style={s.locationText} numberOfLines={1}>{card.address || 'Ubicación'}</Text>
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.detailGrid}>
              <View style={s.detailItem}>
                <View style={s.detailIcon}><Ionicons name="time-outline" size={14} color={colors.primary} /></View>
                <Text style={s.detailText}>{card.duration || 'Flexible'}</Text>
              </View>
              <View style={s.detailItem}>
                <View style={s.detailIcon}><Ionicons name="briefcase-outline" size={14} color={colors.primary} /></View>
                <Text style={s.detailText}>{card.modality || 'Presencial'}</Text>
              </View>
            </View>

            <Text style={s.summaryTitle}>Descripción</Text>
            <Text style={s.cardDescription} numberOfLines={2}>{card.description}</Text>

            {requirements.length > 0 && (
              <View style={s.reqContainer}>
                <Text style={s.summaryTitle}>Requisitos</Text>
                <View style={s.skillsRow}>
                  {requirements.slice(0, 3).map((r: string, i: number) => (
                    <View key={i} style={s.skillChip}><Text style={s.skillText}>{r}</Text></View>
                  ))}
                  {requirements.length > 3 && <Text style={s.moreText}>+{requirements.length - 3}</Text>}
                </View>
              </View>
            )}
          </View>

          <View style={s.footerHint}>
            <Ionicons name="hand-left-outline" size={13} color={colors.textLight} />
            <Text style={s.footerHintText}>Toca para ver el detalle completo</Text>
          </View>
        </View>
      );
    } else {
      const skills = Array.isArray(card.skills) ? card.skills : [];
      return (
        <View style={s.card}>
          <View style={s.imageBadgeContainer}>
            <Image
              source={{ uri: card.photoURL || card.photoUrl || 'https://via.placeholder.com/400x400.png?text=Usuario' }}
              style={s.cardImage}
            />
            <View style={s.imageScrim} />
          </View>

          <View style={s.cardContent}>
            <View style={s.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{card.name}{card.age ? `, ${card.age}` : ''}</Text>
                <Text style={s.cardSubtitle} numberOfLines={1}>{card.profession || 'Profesional'}</Text>
              </View>
              <View style={s.locationChip}>
                <Ionicons name="location-outline" size={12} color={colors.primary} />
                <Text style={s.locationText} numberOfLines={1}>{card.city || 'Ubicación'}</Text>
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.detailGrid}>
              <View style={s.detailItem}>
                <View style={s.detailIcon}><Ionicons name="star-outline" size={14} color={colors.primary} /></View>
                <Text style={s.detailText}>{card.experienceYears ? `${card.experienceYears} años exp` : 'Talento'}</Text>
              </View>
              <View style={s.detailItem}>
                <View style={s.detailIcon}><Ionicons name="school-outline" size={14} color={colors.primary} /></View>
                <Text style={s.detailText}>{card.education || 'Certificado'}</Text>
              </View>
            </View>

            <Text style={s.summaryTitle}>Sobre el talento</Text>
            <Text style={s.cardDescription} numberOfLines={2}>{card.bio || 'Sin biografía disponible. Toca para ver más.'}</Text>

            {skills.length > 0 && (
              <View style={s.reqContainer}>
                <Text style={s.summaryTitle}>Aptitudes</Text>
                <View style={s.skillsRow}>
                  {skills.slice(0, 3).map((skill: string, idx: number) => (
                    <View key={idx} style={s.skillChip}><Text style={s.skillText}>{skill}</Text></View>
                  ))}
                  {skills.length > 3 && <Text style={s.moreText}>+{skills.length - 3}</Text>}
                </View>
              </View>
            )}
          </View>

          <View style={s.footerHint}>
            <Ionicons name="hand-left-outline" size={13} color={colors.textLight} />
            <Text style={s.footerHintText}>Toca para ver el perfil completo</Text>
          </View>
        </View>
      );
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Workly</Text>
        <TouchableOpacity style={s.headerIcon}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {cards.length > 0 ? (
        <View style={s.swiperContainer}>
          <Swiper
            cards={cards}
            renderCard={renderCard}
            onSwipedRight={handleSwipedRight}
            onSwipedLeft={handleSwipedLeft}
            onSwipedAll={() => setCards([])}
            onTapCard={(cardIndex) => {
              const card = cards[cardIndex];
              if (!card) return;
              if (userProfile?.userType === 'Searching') {
                navigation.navigate('Detail', { id: card.id, type: 'Job' });
              } else {
                navigation.navigate('Detail', { id: card.uid, type: 'Candidate' });
              }
            }}
            cardIndex={0}
            backgroundColor="transparent"
            stackSize={3}
            cardVerticalMargin={14}
            animateOverlayLabelsOpacity
            animateCardOpacity
            overlayLabels={{
              left: {
                title: 'NOPE',
                style: {
                  label: { backgroundColor: colors.reject, color: colors.white, fontSize: 22, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, fontFamily: FONTS.extrabold, letterSpacing: 2 },
                  wrapper: { flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start', marginTop: 30, marginLeft: -30 }
                }
              },
              right: {
                title: 'LIKE',
                style: {
                  label: { backgroundColor: colors.accept, color: colors.white, fontSize: 22, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, fontFamily: FONTS.extrabold, letterSpacing: 2 },
                  wrapper: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', marginTop: 30, marginLeft: 30 }
                }
              }
            }}
          />
        </View>
      ) : (
        <FadeInUp style={s.emptyContainer}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="sparkles-outline" size={48} color={colors.primary} />
          </View>
          <Text style={s.emptyTitle}>Estás al día</Text>
          <Text style={s.emptySubtitle}>Has revisado todas las opciones disponibles por ahora.</Text>

          <PressScale style={s.reloadButton} onPress={fetchCards}>
            <Ionicons name="refresh" size={18} color={isDark ? '#000' : '#fff'} />
            <Text style={s.reloadText}>Refrescar feed</Text>
          </PressScale>

          <TouchableOpacity
            style={[s.clearDecisionsBtn, resetting && { opacity: 0.6 }]}
            onPress={handleClearDecisions}
            disabled={resetting}
          >
            {resetting ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={s.clearDecisionsText}>Reiniciar mis descartes anteriores</Text>
            )}
          </TouchableOpacity>
        </FadeInUp>
      )}
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SIZES.sm,
    backgroundColor: colors.headerBg,
  },
  headerTitle: { ...type.h1, color: colors.text, letterSpacing: -0.5 },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  swiperContainer: { flex: 1 },

  card: {
    height: '93%',
    borderRadius: SIZES.radius_xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...(isDark ? {} : SHADOWS.medium),
    overflow: 'hidden',
  },
  imageBadgeContainer: { width: '100%', height: '46%', position: 'relative', backgroundColor: colors.inputBackground },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.05)',
  },
  salaryBadge: {
    position: 'absolute', bottom: 14, right: 14,
    flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: colors.primary,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: SIZES.radius_full,
  },
  salaryCurrency: { ...type.small, color: isDark ? '#000' : '#fff', marginRight: 2, opacity: 0.7 },
  salaryText: { ...type.h3, color: isDark ? '#000' : '#fff' },

  cardContent: { padding: SIZES.lg, flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { ...type.h1, color: colors.text },
  cardSubtitle: { ...type.body, color: colors.textLight, marginTop: 2 },

  locationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: isDark ? 'rgba(232,197,108,0.10)' : 'rgba(10,10,10,0.06)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: SIZES.radius_full,
    maxWidth: 140,
  },
  locationText: { ...type.caption, color: colors.primary },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: SIZES.md },

  detailGrid: { flexDirection: 'row', gap: 16, marginBottom: SIZES.md, flexWrap: 'wrap' },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: '40%' },
  detailIcon: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(232,197,108,0.10)' : 'rgba(10,10,10,0.05)',
  },
  detailText: { ...type.small, color: colors.text },

  summaryTitle: { ...type.overline, color: colors.textLight, marginBottom: 6 },
  cardDescription: { ...type.body, color: colors.text, marginBottom: SIZES.md },

  reqContainer: { marginTop: 4 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  skillChip: {
    backgroundColor: colors.inputBackground,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: SIZES.radius_full,
    borderWidth: 1, borderColor: colors.border,
  },
  skillText: { ...type.caption, color: colors.text },
  moreText: { ...type.caption, color: colors.textLight },

  footerHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  footerHintText: { ...type.caption, color: colors.textLight },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.xl },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(232,197,108,0.08)' : 'rgba(10,10,10,0.04)',
    borderWidth: 1, borderColor: colors.border,
    marginBottom: SIZES.lg,
  },
  emptyTitle: { ...type.h1, color: colors.text, textAlign: 'center' },
  emptySubtitle: { ...type.body, color: colors.textLight, textAlign: 'center', marginTop: 8, maxWidth: 280 },
  reloadButton: {
    marginTop: SIZES.xl, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SIZES.xl, paddingVertical: 14,
    backgroundColor: colors.primary, borderRadius: SIZES.radius_full,
  },
  reloadText: { ...type.button, color: isDark ? '#000' : '#fff' },
  clearDecisionsBtn: { marginTop: SIZES.lg, padding: SIZES.sm },
  clearDecisionsText: { ...type.small, color: colors.textLight, textDecorationLine: 'underline' },
});
