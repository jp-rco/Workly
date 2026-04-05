import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, TouchableOpacity, Alert, Dimensions } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import { collection, getDocs, query, where, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { SIZES, SHADOWS } from '../../constants/theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, MainTabParamList } from '../../navigation/MainNavigator';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { CompositeNavigationProp } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { LayoutAnimation, Platform } from 'react-native';

const { width } = Dimensions.get('window');

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<MainStackParamList>
>;

type Props = {
  navigation: HomeScreenNavigationProp;
};

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
      // Filter out swiped/applied items
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

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleSwipedRight = async (cardIndex: number) => {
    if (!userProfile) return;
    const item = cards[cardIndex];
    if (!item) return;

    try {
      if (userProfile.userType === 'Searching') {
        await addDoc(collection(db, 'applications'), {
          userId: userProfile.uid,
          jobId: item.id,
          jobTitle: item.title || '',
          status: 'pending',
          description: userProfile.jobDescription || '',
          email: userProfile.email || '',
          name: userProfile.name || '',
          photoURL: userProfile.photoURL || '',
          resumeURL: userProfile.resumeURL || '',
          createdAt: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, 'likes'), {
          employerId: userProfile.uid,
          userId: item.uid,
          type: 'EmployerLikesUser',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('Error saving swipe right:', e);
    }
  };

  const handleSwipedLeft = async (cardIndex: number) => {
    if (!userProfile) return;
    const item = cards[cardIndex];
    if (!item) return;

    const targetId = userProfile.userType === 'Searching' ? item.id : item.uid;

    try {
      await addDoc(collection(db, 'swipes'), {
        userId: userProfile.uid,
        targetId: targetId,
        type: 'nope',
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Error saving swipe left:', e);
    }
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
      Alert.alert('Éxito', 'Tus decisiones pasadas han sido borradas.');
      fetchCards();
    } catch (e) {
      console.error('Error clearing decisions:', e);
      Alert.alert('Error', 'No se pudieron borrar las decisiones.');
    } finally {
      setResetting(false);
    }
  };

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
            <View style={s.salaryBadge}>
              <Text style={s.salaryText}>${card.pay || 'N/A'}</Text>
            </View>
          </View>

          <View style={s.cardContent}>
            <View style={s.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{card.title}</Text>
                <Text style={s.cardSubtitle} numberOfLines={1}>{card.companyName || 'Empresa'}</Text>
              </View>
              <View style={s.locationChip}>
                <Ionicons name="location-outline" size={14} color={colors.primary} />
                <Text style={s.locationText}>{card.address || 'Ubicación'}</Text>
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.detailGrid}>
              <View style={s.detailItem}>
                <Ionicons name="time-outline" size={18} color={colors.textLight} />
                <Text style={s.detailText}>{card.duration || 'Flexible'}</Text>
              </View>
              <View style={s.detailItem}>
                <Ionicons name="briefcase-outline" size={18} color={colors.textLight} />
                <Text style={s.detailText}>{card.modality || 'Presencial'}</Text>
              </View>
            </View>

            <Text style={s.summaryTitle}>Descripción rápida</Text>
            <Text style={s.cardDescription} numberOfLines={2}>{card.description}</Text>

            {requirements.length > 0 && (
              <View style={s.reqContainer}>
                <Text style={s.summaryTitle}>Requisitos:</Text>
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
            <Ionicons name="information-circle-outline" size={14} color={colors.textLight} />
            <Text style={s.footerHintText}>Toca para ver todo el detalle</Text>
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
          </View>

          <View style={s.cardContent}>
            <View style={s.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{card.name}{card.age ? `, ${card.age}` : ''}</Text>
                <Text style={s.cardSubtitle} numberOfLines={1}>{card.profession || 'Profesional'}</Text>
              </View>
              <View style={s.locationChip}>
                <Ionicons name="location-outline" size={14} color={colors.primary} />
                <Text style={s.locationText}>{card.city || 'Ubicación'}</Text>
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.detailGrid}>
              <View style={s.detailItem}>
                <Ionicons name="star-outline" size={18} color={colors.textLight} />
                <Text style={s.detailText}>{card.experienceYears ? `${card.experienceYears} años exp` : 'Talento'}</Text>
              </View>
              <View style={s.detailItem}>
                <Ionicons name="school-outline" size={18} color={colors.textLight} />
                <Text style={s.detailText}>{card.education || 'Certificado'}</Text>
              </View>
            </View>

            <Text style={s.summaryTitle}>Sobre el talento</Text>
            <Text style={s.cardDescription} numberOfLines={2}>{card.bio || 'Sin biografía disponible. Toca para ver más.'}</Text>

            {skills.length > 0 && (
              <View style={s.reqContainer}>
                <Text style={s.summaryTitle}>Aptitudes:</Text>
                <View style={s.skillsRow}>
                  {skills.slice(0, 3).map((skill: string, idx: number) => (
                    <View key={idx} style={[s.skillChip, { backgroundColor: colors.primary + '15' }]}><Text style={s.skillText}>{skill}</Text></View>
                  ))}
                  {skills.length > 3 && <Text style={s.moreText}>+{skills.length - 3}</Text>}
                </View>
              </View>
            )}
          </View>
          <View style={s.footerHint}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textLight} />
            <Text style={s.footerHintText}>Toca para ver perfil completo</Text>
          </View>
        </View>
      );
    }
  };

  const s = makeStyles(colors, isDark);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={s.container}>
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
            cardVerticalMargin={10}
            animateOverlayLabelsOpacity
            animateCardOpacity
            overlayLabels={{
              left: {
                title: 'NOPE',
                style: {
                  label: { backgroundColor: colors.reject, color: '#FFFFFF', fontSize: 24, borderRadius: 10 },
                  wrapper: { flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start', marginTop: 30, marginLeft: -30 }
                }
              },
              right: {
                title: 'LIKE',
                style: {
                  label: { backgroundColor: colors.accept, color: '#FFFFFF', fontSize: 24, borderRadius: 10 },
                  wrapper: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', marginTop: 30, marginLeft: 30 }
                }
              }
            }}
          />
        </View>
      ) : (
        <View style={s.emptyContainer}>
          <Ionicons name="planet-outline" size={80} color={colors.primary + '30'} />
          <Text style={s.emptyText}>Has visto todas las opciones de hoy.</Text>
          
          <TouchableOpacity 
            style={[s.clearDecisionsBtn, resetting && { opacity: 0.7 }]} 
            onPress={handleClearDecisions}
            disabled={resetting}
          >
            {resetting ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={s.clearDecisionsText}>Reiniciar descartes / Borrar antiguas decisiones</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.reloadButton} onPress={fetchCards}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={s.reloadText}>Refrescar feed</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  swiperContainer: { flex: 1 },
  card: {
    height: '92%',
    borderRadius: SIZES.radius_lg,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...(isDark ? {} : SHADOWS.medium),
    overflow: 'hidden',
  },
  imageBadgeContainer: { width: '100%', height: '48%', position: 'relative' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  salaryBadge: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: colors.accept, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, ...SHADOWS.light,
  },
  salaryText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },

  cardContent: { padding: SIZES.lg, flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  cardSubtitle: { fontSize: 15, color: colors.textLight, marginTop: 2 },
  
  locationChip: { 
    flexDirection: 'row', alignItems: 'center', gap: 4, 
    backgroundColor: colors.primary + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 
  },
  locationText: { color: colors.primary, fontSize: 11, fontWeight: '600' },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: SIZES.md },
  
  detailGrid: { flexDirection: 'row', gap: 15, marginBottom: SIZES.md, flexWrap: 'wrap' },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: '40%' },
  detailText: { fontSize: 13, color: colors.textLight, fontWeight: '600' },

  summaryTitle: { fontSize: 12, textTransform: 'uppercase', color: colors.textLight, fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 },
  cardDescription: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: SIZES.md },

  reqContainer: { marginTop: 4 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, alignItems: 'center' },
  skillChip: { backgroundColor: colors.inputBackground, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  skillText: { fontSize: 11, color: colors.text, fontWeight: '500' },
  moreText: { fontSize: 11, color: colors.textLight, fontWeight: '600' },

  footerHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: colors.inputBackground },
  footerHintText: { fontSize: 12, color: colors.textLight, fontStyle: 'italic' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.xl },
  emptyText: { fontSize: 18, color: colors.text, fontWeight: '600', marginTop: SIZES.xl, textAlign: 'center' },
  clearDecisionsBtn: { marginTop: SIZES.xl, padding: SIZES.md },
  clearDecisionsText: { color: colors.primary, fontWeight: '600', fontSize: 14, textDecorationLine: 'underline' },
  reloadButton: { 
    marginTop: SIZES.md, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SIZES.xl, paddingVertical: SIZES.md, 
    backgroundColor: colors.primary, borderRadius: SIZES.radius_lg 
  },
  reloadText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }
});
