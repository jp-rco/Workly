import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  LayoutAnimation,
  Platform,
  TextInput,
  ScrollView,
  FlatList,
  PanResponder,
  Animated,
} from 'react-native';
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

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const MAIN_CATEGORY_KEYS = [
  'cocina',
  'software',
  'ventas',
  'salud',
  'construccion',
  'administracion',
  'educacion',
  'logistica',
  'servicios',
  'diseno',
  'belleza',
];

const SYNONYM_GROUPS: Record<string, string[]> = {
  // Gastronomía y Cocina
  cocina: ['chef', 'mesero', 'mesera', 'cocinero', 'cocinera', 'cajero', 'cajera', 'gastronomia', 'restaurante', 'barista', 'auxiliar de cocina', 'panadero', 'repostero', 'plato', 'alimentos', 'comida'],
  restaurante: ['chef', 'mesero', 'mesera', 'cocinero', 'cocinera', 'cajero', 'barista', 'gastronomia', 'cocina', 'salonero'],
  chef: ['cocina', 'cocinero', 'gastronomia', 'restaurante', 'mesero', 'repostero', 'culinario'],
  mesero: ['mesera', 'cocina', 'restaurante', 'atencion', 'servicio', 'barista', 'cajero', 'salonero'],
  cajero: ['cajera', 'ventas', 'cocina', 'restaurante', 'atencion al cliente', 'tienda', 'caja', 'facturacion'],

  // Tecnología, Software e Ingeniería
  ingeniero: ['ingeniera', 'ingenieria', 'desarrollador', 'programador', 'software', 'sistemas', 'civil', 'mecanico', 'industrial', 'electronico', 'dev', 'tecnologia'],
  software: ['desarrollador', 'desarrolladora', 'programador', 'programadora', 'ingeniero', 'sistemas', 'frontend', 'backend', 'fullstack', 'web', 'mobile', 'react', 'python', 'javascript', 'java', 'node', 'app', 'ti', 'codigo'],
  desarrollador: ['programador', 'software', 'sistemas', 'frontend', 'backend', 'fullstack', 'web', 'mobile', 'dev', 'ingeniero', 'ti', 'react', 'python', 'javascript'],
  programador: ['desarrollador', 'software', 'sistemas', 'code', 'web', 'dev', 'ingeniero', 'programacion'],
  sistemas: ['software', 'desarrollador', 'programador', 'ingeniero', 'ti', 'redes', 'soporte', 'informatica'],
  tecnologia: ['software', 'desarrollador', 'ingeniero', 'sistemas', 'ti', 'digital'],

  // Ventas y Comercio
  ventas: ['vendedor', 'vendedora', 'comercial', 'asesor', 'asesora', 'cajero', 'cajera', 'atencion al cliente', 'ejecutivo de cuenta', 'promotor', 'tienda', 'comercio'],
  comercial: ['ventas', 'vendedor', 'asesor', 'ejecutivo', 'negocios', 'marketing', 'mercadeo'],
  vendedor: ['ventas', 'comercial', 'asesor', 'atencion al cliente', 'cajero', 'promotor'],

  // Salud y Medicina
  salud: ['enfermero', 'enfermera', 'medico', 'medica', 'doctor', 'doctora', 'terapeuta', 'auxiliar de enfermeria', 'odontologo', 'psicologo', 'clinica', 'hospital', 'farmacia'],
  enfermero: ['enfermera', 'salud', 'medico', 'clinica', 'auxiliar', 'hospital'],
  medico: ['doctor', 'salud', 'clinica', 'enfermero', 'medicina', 'hospital'],

  // Diseño y Creatividad
  diseño: ['diseno', 'diseñador', 'diseñadora', 'disenador', 'ux', 'ui', 'grafico', 'creativo', 'ilustrador', 'arte', 'motion', 'multimedia', 'edicion'],
  diseno: ['diseño', 'diseñador', 'ux', 'ui', 'grafico', 'creativo', 'ilustrador'],
  creativo: ['diseñador', 'diseño', 'arte', 'publicidad', 'contenido', 'marketing'],

  // Construcción y Obras
  construcción: ['construccion', 'albanil', 'albañil', 'maestro de obra', 'obras', 'pintor', 'electricista', 'plomero', 'soldador', 'edificacion', 'arquitecto'],
  construccion: ['construcción', 'albanil', 'albañil', 'maestro', 'obras', 'pintor', 'electricista', 'plomero'],
  obra: ['construccion', 'albanil', 'albañil', 'maestro', 'pintor', 'remodelacion'],

  // Administración y Finanzas
  administración: ['administracion', 'administrador', 'auxiliar administrativo', 'asistente', 'secretaria', 'recepcionista', 'contable', 'contador', 'gestion'],
  administracion: ['administración', 'administrador', 'auxiliar administrativo', 'asistente', 'secretaria', 'recepcionista', 'gestion'],
  contador: ['contadora', 'contabilidad', 'finanzas', 'auxiliar contable', 'auditor', 'impuestos'],

  // Educación y Docencia
  educación: ['educacion', 'profesor', 'profesora', 'docente', 'maestro', 'maestra', 'tutor', 'tutora', 'capacitador', 'instructor', 'pedagogia', 'colegio', 'escuela'],
  educacion: ['profesor', 'profesora', 'docente', 'maestro', 'maestra', 'tutor', 'instructor', 'colegio', 'escuela'],
  profesor: ['profesora', 'docente', 'educacion', 'maestro', 'tutor', 'instructor'],

  // Logística y Domicilios
  logística: ['logistica', 'conductor', 'chofer', 'domiciliario', 'repartidor', 'mensajero', 'bodega', 'despachador', 'envios', 'almacen', 'operario'],
  logistica: ['conductor', 'chofer', 'domiciliario', 'repartidor', 'mensajero', 'bodega', 'envios', 'almacen'],
  domiciliario: ['repartidor', 'mensajero', 'conductor', 'logistica', 'envios'],

  // Servicios Generales y Limpieza
  servicios: ['limpieza', 'aseadora', 'auxiliar de aseo', 'servicios generales', 'mantenimiento', 'aseo', 'seguridad', 'vigilante', 'guardia', 'portero'],
  limpieza: ['aseadora', 'auxiliar de aseo', 'servicios generales', 'mantenimiento', 'aseo', 'limpiador'],
  seguridad: ['vigilante', 'guardia', 'seguridad', 'escolta', 'portero'],

  // Belleza y Estética
  belleza: ['peluquero', 'peluquera', 'barbero', 'esteticista', 'maquillador', 'maquilladora', 'manicurista', 'spa', 'estetica', 'estilista'],
  peluquero: ['peluquera', 'barbero', 'estilista', 'belleza', 'corte'],
};

function getAllItemText(item: any): string {
  if (!item || typeof item !== 'object') return '';
  const textParts: string[] = [];

  const extract = (val: any) => {
    if (!val) return;
    if (typeof val === 'string') {
      textParts.push(val);
    } else if (typeof val === 'number') {
      textParts.push(String(val));
    } else if (Array.isArray(val)) {
      val.forEach(extract);
    } else if (typeof val === 'object') {
      Object.keys(val).forEach(k => {
        if (k !== 'uid' && k !== 'id' && k !== 'ownerUid' && k !== 'photoURL' && k !== 'imageUrl' && k !== 'resumeURL') {
          extract(val[k]);
        }
      });
    }
  };

  extract(item);
  return textParts.join(' ');
}

function belongsToAnyMainCategory(item: any): boolean {
  return MAIN_CATEGORY_KEYS.some(catKey => {
    const { matches } = evaluateCardRelevance(item, catKey, true);
    return matches;
  });
}

function evaluateCardRelevance(item: any, searchQuery: string, isInternalCheck: boolean = false): { matches: boolean; score: number } {
  if (!searchQuery || !searchQuery.trim()) return { matches: true, score: 0 };

  const normQuery = normalizeText(searchQuery.trim());

  if (!isInternalCheck && (normQuery === 'varios' || normQuery === 'otros')) {
    const belongs = belongsToAnyMainCategory(item);
    return {
      matches: !belongs,
      score: !belongs ? 50 : 0,
    };
  }

  const words = normQuery.split(/\s+/).filter(Boolean);

  const searchTermsSet = new Set<string>();
  words.forEach(word => {
    searchTermsSet.add(word);
    Object.keys(SYNONYM_GROUPS).forEach(key => {
      const normKey = normalizeText(key);
      if (normKey === word || word.includes(normKey) || normKey.includes(word)) {
        SYNONYM_GROUPS[key].forEach(syn => searchTermsSet.add(normalizeText(syn)));
      }
    });
  });

  const searchTerms = Array.from(searchTermsSet);

  const cargoAndTitle = normalizeText([
    item.title,
    item.profession,
    item.jobDescription,
  ].filter(Boolean).join(' '));

  const skillsAndRequirements = normalizeText([
    Array.isArray(item.skills) ? item.skills.join(' ') : item.skills,
    Array.isArray(item.requirements) ? item.requirements.join(' ') : item.requirements,
  ].filter(Boolean).join(' '));

  const sobreMiAndDesc = normalizeText([
    item.bio,
    item.description,
    item.companyDescription,
  ].filter(Boolean).join(' '));

  const categoryAndIndustry = normalizeText([
    item.industry,
    item.jobSubType,
    item.category,
  ].filter(Boolean).join(' '));

  const fullText = normalizeText(getAllItemText(item));

  let matchedCount = 0;
  let score = 0;

  searchTerms.forEach(term => {
    if (fullText.includes(term)) {
      matchedCount++;

      if (cargoAndTitle.includes(term)) score += 30;
      if (skillsAndRequirements.includes(term)) score += 25;
      if (categoryAndIndustry.includes(term)) score += 20;
      if (sobreMiAndDesc.includes(term)) score += 15;

      if (words.some(w => term.includes(w) || w.includes(term))) {
        score += 10;
      }
    }
  });

  return {
    matches: matchedCount > 0,
    score,
  };
}

const QUICK_CATEGORIES = [
  { key: 'cocina', label: 'Cocina', icon: 'restaurant-outline' },
  { key: 'software', label: 'Software & Tech', icon: 'code-slash-outline' },
  { key: 'ventas', label: 'Ventas & Comercio', icon: 'cart-outline' },
  { key: 'salud', label: 'Salud', icon: 'medkit-outline' },
  { key: 'construccion', label: 'Construcción', icon: 'construct-outline' },
  { key: 'administracion', label: 'Administración', icon: 'business-outline' },
  { key: 'educacion', label: 'Educación', icon: 'school-outline' },
  { key: 'logistica', label: 'Logística & Envíos', icon: 'car-outline' },
  { key: 'servicios', label: 'Servicios Gral.', icon: 'sparkles-outline' },
  { key: 'diseno', label: 'Diseño & Arte', icon: 'color-palette-outline' },
  { key: 'belleza', label: 'Belleza & Estética', icon: 'cut-outline' },
  { key: 'varios', label: 'Varios / Otros', icon: 'grid-outline' },
];

export default function HomeScreen({ navigation }: Props) {
  const { userProfile, user } = useAuth();
  const { colors, isDark } = useTheme();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ESTADOS DE MODO DE VISTA Y FILTRO FORMAL/INFORMAL
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [jobSubTypeFilter, setJobSubTypeFilter] = useState<'all' | 'formal' | 'informal'>('all');

  const isSearchingForJobs = userProfile?.userType === 'Searching';

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

      const myEmail = (userProfile.email || user?.email || '').toLowerCase().trim();
      const myBaseUid = (user?.uid || userProfile.uid).split('_')[0];

      if (isSearchingForJobs) {
        const jobsSnapshot = await getDocs(collection(db, 'jobs'));
        const jobsData = jobsSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((job: any) => {
            const isOwned = job.ownerUid === userProfile.uid ||
                            job.ownerUid === myBaseUid ||
                            String(job.ownerUid || '').startsWith(myBaseUid);
            return (
              (job.status === 'active' || job.status === 'activo') &&
              !excludedIds.includes(job.id) &&
              !isOwned
            );
          });
        setCards(jobsData);
      } else {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('userType', '==', 'Searching'));
        const usersSnapshot = await getDocs(q);
        const usersData = usersSnapshot.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter((u: any) => {
            const uEmail = (u.email || '').toLowerCase().trim();
            const uUid = String(u.uid || '');
            const uAuthUid = String(u.authUid || '');

            const isSelf = uUid === userProfile.uid ||
                           uUid === myBaseUid ||
                           uUid.startsWith(myBaseUid) ||
                           uAuthUid === myBaseUid ||
                           (myEmail && uEmail === myEmail);

            return !excludedIds.includes(u.uid) && !isSelf;
          });
        setCards(usersData);
      }
    } catch (e) {
      console.log('Error fetching cards', e);
    } finally {
      setLoading(false);
    }
  }, [userProfile, user, isSearchingForJobs]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const filteredCards = useMemo(() => {
    let list = cards;

    if (isSearchingForJobs && jobSubTypeFilter !== 'all') {
      list = list.filter((job: any) => {
        const subType = (job.jobSubType || '').toLowerCase();
        if (jobSubTypeFilter === 'formal') return subType === 'formal';
        if (jobSubTypeFilter === 'informal') return subType === 'informal' || subType !== 'formal';
        return true;
      });
    }

    if (!searchQuery || !searchQuery.trim()) return list;

    const scored = list
      .map(card => {
        const { matches, score } = evaluateCardRelevance(card, searchQuery);
        return { card, matches, score };
      })
      .filter(entry => entry.matches)
      .sort((a, b) => b.score - a.score);

    return scored.map(entry => entry.card);
  }, [cards, searchQuery, jobSubTypeFilter, isSearchingForJobs]);

  const handleSwipedRightForItem = async (item: any) => {
    if (!userProfile || !item) return;
    const itemId = isSearchingForJobs ? item.id : item.uid;
    // Remover de tarjetas locales inmediatamente
    setCards(prev => prev.filter(c => (isSearchingForJobs ? c.id !== itemId : c.uid !== itemId)));

    try {
      if (isSearchingForJobs) {
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

  const handleSwipedLeftForItem = async (item: any) => {
    if (!userProfile || !item) return;
    const targetId = isSearchingForJobs ? item.id : item.uid;
    // Remover de tarjetas locales inmediatamente
    setCards(prev => prev.filter(c => (isSearchingForJobs ? c.id !== targetId : c.uid !== targetId)));

    try {
      await addDoc(collection(db, 'swipes'), {
        userId: userProfile.uid, targetId, type: 'nope', timestamp: new Date().toISOString(),
      });
    } catch (e) { console.error('Error saving swipe left:', e); }
  };

  const handleSwipedRight = (cardIndex: number) => {
    const item = filteredCards[cardIndex];
    if (item) handleSwipedRightForItem(item);
  };

  const handleSwipedLeft = (cardIndex: number) => {
    const item = filteredCards[cardIndex];
    if (item) handleSwipedLeftForItem(item);
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

    if (isSearchingForJobs) {
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

  // COMPONENTE DESLIZABLE (SWIPEABLE) EN VISTA LISTA CON FEEDBACK INTERACTIVO
  const SwipeableListItem = ({ item, index }: { item: any; index: number }) => {
    const pan = useRef(new Animated.ValueXY()).current;

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 85) {
            // Swipe de izquierda a derecha -> INTERÉS / LIKE
            Animated.timing(pan, {
              toValue: { x: width * 1.2, y: 0 },
              duration: 200,
              useNativeDriver: false,
            }).start(() => handleSwipedRightForItem(item));
          } else if (gestureState.dx < -85) {
            // Swipe de derecha a izquierda -> RECHAZAR / NOPE
            Animated.timing(pan, {
              toValue: { x: -width * 1.2, y: 0 },
              duration: 200,
              useNativeDriver: false,
            }).start(() => handleSwipedLeftForItem(item));
          } else {
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
              friction: 6,
            }).start();
          }
        },
      })
    ).current;

    const rightOpacity = pan.x.interpolate({
      inputRange: [0, 70],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    const leftOpacity = pan.x.interpolate({
      inputRange: [-70, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    const handlePress = () => {
      if (isSearchingForJobs) {
        navigation.navigate('Detail', { id: item.id, type: 'Job' });
      } else {
        navigation.navigate('Detail', { id: item.uid || item.id, type: 'Candidate' });
      }
    };

    return (
      <FadeInUp delay={Math.min(index * 25, 150)} key={item.id || item.uid}>
        <View style={s.swipeableWrapper}>
          {/* Fondo Indicador Verde: ME INTERESA (IZQ -> DER) */}
          <Animated.View style={[s.swipeBackground, s.swipeRightBg, { opacity: rightOpacity }]}>
            <Ionicons name="checkmark-circle" size={26} color="#FFFFFF" />
            <Text style={s.swipeText}>ME INTERESA</Text>
          </Animated.View>

          {/* Fondo Indicador Rojo: DESCARTAR (DER -> IZQ) */}
          <Animated.View style={[s.swipeBackground, s.swipeLeftBg, { opacity: leftOpacity }]}>
            <Text style={s.swipeText}>DESCARTAR</Text>
            <Ionicons name="close-circle" size={26} color="#FFFFFF" />
          </Animated.View>

          {/* Tarjeta Interactiva Deslizable */}
          <Animated.View
            style={{ transform: [{ translateX: pan.x }] }}
            {...panResponder.panHandlers}
          >
            <TouchableOpacity
              style={s.listItem}
              onPress={handlePress}
              activeOpacity={0.88}
            >
              {isSearchingForJobs ? (
                <>
                  <Image
                    source={{ uri: item.imageUrl || 'https://via.placeholder.com/100.png?text=Trabajo' }}
                    style={s.listJobImage}
                  />
                  <View style={s.listInfo}>
                    <Text style={s.listTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={s.listSubtitle} numberOfLines={1}>{item.companyName || 'Empresa'}</Text>
                    
                    <View style={s.listMetaRow}>
                      {item.pay ? (
                        <View style={s.listPayBadge}>
                          <Text style={s.listPayText}>${item.pay}</Text>
                        </View>
                      ) : null}

                      <View style={[s.listTag, {
                        backgroundColor: item.jobSubType === 'formal'
                          ? (isDark ? 'rgba(232,197,108,0.12)' : 'rgba(10,10,10,0.06)')
                          : (isDark ? 'rgba(61,190,122,0.14)' : 'rgba(31,122,77,0.08)'),
                      }]}>
                        <Text style={[s.listTagText, {
                          color: item.jobSubType === 'formal' ? colors.primary : colors.accept,
                        }]}>
                          {item.jobSubType === 'formal' ? 'Formal' : 'Informal'}
                        </Text>
                      </View>

                      {item.address ? (
                        <View style={s.listTag}>
                          <Ionicons name="location-outline" size={11} color={colors.primary} />
                          <Text style={s.listTagText} numberOfLines={1}>{item.address}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Image
                    source={{ uri: item.photoURL || item.photoUrl || 'https://via.placeholder.com/100.png?text=Usuario' }}
                    style={s.listAvatar}
                  />
                  <View style={s.listInfo}>
                    <Text style={s.listTitle} numberOfLines={1}>
                      {item.name}{item.age ? `, ${item.age}` : ''}
                    </Text>
                    <Text style={s.listSubtitle} numberOfLines={1}>
                      {item.profession || 'Profesional'}
                    </Text>
                    
                    <View style={s.listMetaRow}>
                      {item.city ? (
                        <View style={s.listTag}>
                          <Ionicons name="location-outline" size={11} color={colors.primary} />
                          <Text style={s.listTagText} numberOfLines={1}>{item.city}</Text>
                        </View>
                      ) : null}
                      {item.experienceYears ? (
                        <View style={s.listTag}>
                          <Ionicons name="star-outline" size={11} color={colors.primary} />
                          <Text style={s.listTagText}>{item.experienceYears} años exp</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </FadeInUp>
    );
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
        <View style={s.headerTopRow}>
          <View style={s.logoWrap}>
            <Text style={s.headerTitle}>Workly</Text>
            <View style={s.roleTag}>
              <Ionicons
                name={isSearchingForJobs ? 'briefcase-outline' : 'people-outline'}
                size={12}
                color={colors.primary}
              />
              <Text style={s.roleTagText}>
                {isSearchingForJobs ? 'Empleos' : 'Talento'}
              </Text>
            </View>
          </View>

          {/* BOTÓN DE CAMBIO DE VISTA (CARTAS SWIPER vs LISTA ESTILO CHAT) */}
          <TouchableOpacity
            style={s.viewToggleBtn}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setViewMode(prev => prev === 'cards' ? 'list' : 'cards');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name={viewMode === 'cards' ? 'list-outline' : 'albums-outline'}
              size={18}
              color={colors.primary}
            />
            <Text style={s.viewToggleText}>
              {viewMode === 'cards' ? 'Vista Lista' : 'Vista Cartas'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* PESTAÑAS DE EMPLEO FORMAL E INFORMAL (Solo cuando busca trabajo) */}
        {isSearchingForJobs && (
          <View style={s.subTypeContainer}>
            <TouchableOpacity
              style={[s.subTypeTab, jobSubTypeFilter === 'all' && s.subTypeTabActive]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setJobSubTypeFilter('all');
              }}
              activeOpacity={0.8}
            >
              <Text style={[s.subTypeTabText, jobSubTypeFilter === 'all' && s.subTypeTabTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.subTypeTab, jobSubTypeFilter === 'formal' && s.subTypeTabActive]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setJobSubTypeFilter('formal');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="briefcase-outline"
                size={12}
                color={jobSubTypeFilter === 'formal' ? colors.onPrimary : colors.textLight}
              />
              <Text style={[s.subTypeTabText, jobSubTypeFilter === 'formal' && s.subTypeTabTextActive]}>
                Trabajo Formal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.subTypeTab, jobSubTypeFilter === 'informal' && s.subTypeTabActive]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setJobSubTypeFilter('informal');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="flash-outline"
                size={12}
                color={jobSubTypeFilter === 'informal' ? colors.onPrimary : colors.textLight}
              />
              <Text style={[s.subTypeTabText, jobSubTypeFilter === 'informal' && s.subTypeTabTextActive]}>
                Trabajo Informal
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Buscador inteligente comparador global */}
        <View style={s.searchBarContainer}>
          <Ionicons name="search" size={18} color={colors.primary} style={{ marginLeft: 12 }} />
          <TextInput
            style={s.searchInput}
            placeholder={
              isSearchingForJobs
                ? jobSubTypeFilter === 'formal'
                  ? "Buscar empleo formal (cargo, habilidades...)"
                  : jobSubTypeFilter === 'informal'
                  ? "Buscar trabajo informal (tarea, pago...)"
                  : "Buscar por cargo, habilidades, sobre mí..."
                : "Buscar por profesión, habilidades, área..."
            }
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={(t) => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSearchQuery(t);
            }}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={s.clearSearchBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* Chips de filtro rápido por categoría */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryScroll}>
          {QUICK_CATEGORIES.map((cat) => {
            const active = searchQuery.toLowerCase() === cat.key.toLowerCase();
            return (
              <TouchableOpacity
                key={cat.key}
                style={[s.categoryChip, active && s.categoryChipActive]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setSearchQuery(active ? '' : cat.key);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={12}
                  color={active ? colors.onPrimary : colors.textLight}
                  style={{ marginRight: 4 }}
                />
                <Text style={[s.categoryChipText, active && s.categoryChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* RENDERIZADO DE CONTENIDO SEGÚN MODO DE VISTA (CARTAS SWIPER vs LISTA DESLIZABLE ESTILO CHAT) */}
      {filteredCards.length > 0 ? (
        viewMode === 'cards' ? (
          <View style={s.swiperContainer}>
            <Swiper
              key={`swiper-${searchQuery.trim()}-${jobSubTypeFilter}-${filteredCards.length}-${isDark ? 'dark' : 'light'}`}
              cards={filteredCards}
              renderCard={renderCard}
              onSwipedRight={handleSwipedRight}
              onSwipedLeft={handleSwipedLeft}
              onSwipedAll={() => {
                if (searchQuery.trim() || jobSubTypeFilter !== 'all') {
                  setCards(prev => prev.filter(c => !filteredCards.includes(c)));
                } else {
                  setCards([]);
                }
              }}
              onTapCard={(cardIndex) => {
                const card = filteredCards[cardIndex];
                if (!card) return;
                if (isSearchingForJobs) {
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
          <FlatList
            data={filteredCards}
            keyExtractor={(item) => item.id || item.uid}
            renderItem={({ item, index }) => (
              <SwipeableListItem item={item} index={index} />
            )}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : searchQuery.trim() !== '' || jobSubTypeFilter !== 'all' ? (
        <FadeInUp style={s.emptyContainer}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="search-outline" size={44} color={colors.primary} />
          </View>
          <Text style={s.emptyTitle}>Sin coincidencias</Text>
          <Text style={s.emptySubtitle}>
            No encontramos resultados para {jobSubTypeFilter !== 'all' ? `en empleos ${jobSubTypeFilter}es` : ''} "{searchQuery}". Intenta con otros términos o cambia los filtros.
          </Text>

          <PressScale style={s.reloadButton} onPress={() => { setSearchQuery(''); setJobSubTypeFilter('all'); }}>
            <Ionicons name="close-circle-outline" size={18} color={colors.onPrimary} />
            <Text style={s.reloadText}>Limpiar filtros</Text>
          </PressScale>
        </FadeInUp>
      ) : (
        <FadeInUp style={s.emptyContainer}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="sparkles-outline" size={48} color={colors.primary} />
          </View>
          <Text style={s.emptyTitle}>Estás al día</Text>
          <Text style={s.emptySubtitle}>Has revisado todas las opciones disponibles por ahora.</Text>

          <PressScale style={s.reloadButton} onPress={fetchCards}>
            <Ionicons name="refresh" size={18} color={colors.onPrimary} />
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
    paddingHorizontal: SIZES.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: SIZES.sm,
    backgroundColor: colors.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZES.xs,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: { ...type.h1, color: colors.text, letterSpacing: -0.5 },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? 'rgba(232,197,108,0.10)' : 'rgba(10,10,10,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: SIZES.radius_full,
  },
  roleTagText: { ...type.caption, color: colors.primary, fontFamily: FONTS.semibold },
  
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: SIZES.radius_full,
    backgroundColor: isDark ? 'rgba(232,197,108,0.12)' : 'rgba(10,10,10,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewToggleText: { ...type.caption, color: colors.primary, fontFamily: FONTS.semibold },

  subTypeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  subTypeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: SIZES.radius_full,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subTypeTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subTypeTabText: { ...type.caption, color: colors.textLight },
  subTypeTabTextActive: { color: colors.onPrimary, fontFamily: FONTS.bold },

  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: SIZES.radius_full,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
    marginTop: 4,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: FONTS.medium,
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    paddingHorizontal: 10,
  },
  categoryScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: SIZES.radius_full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    ...type.caption,
    color: colors.textLight,
  },
  categoryChipTextActive: {
    color: colors.onPrimary,
    fontFamily: FONTS.bold,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  swiperContainer: { flex: 1 },

  // ESTILOS DE VISTA LISTA DESLIZABLE (SWIPEABLE)
  listContent: {
    padding: SIZES.md,
    gap: 10,
    paddingBottom: 140,
  },
  swipeableWrapper: {
    position: 'relative',
    borderRadius: SIZES.radius_lg,
    overflow: 'hidden',
    marginBottom: 10,
  },
  swipeBackground: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderRadius: SIZES.radius_lg,
  },
  swipeRightBg: {
    backgroundColor: colors.accept || '#3DBE7A',
    justifyContent: 'flex-start',
    gap: 8,
  },
  swipeLeftBg: {
    backgroundColor: colors.reject || '#E53935',
    justifyContent: 'flex-end',
    gap: 8,
  },
  swipeText: {
    ...type.caption,
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
    letterSpacing: 1.5,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: SIZES.radius_lg,
    padding: SIZES.md,
    gap: SIZES.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : SHADOWS.light),
  },
  listAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.inputBackground,
  },
  listJobImage: {
    width: 54,
    height: 54,
    borderRadius: SIZES.radius,
    backgroundColor: colors.inputBackground,
  },
  listInfo: {
    flex: 1,
    gap: 3,
  },
  listTitle: { ...type.h3, color: colors.text },
  listSubtitle: { ...type.small, color: colors.textLight, fontFamily: FONTS.medium },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  listTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: SIZES.radius_full,
    backgroundColor: isDark ? 'rgba(232,197,108,0.08)' : 'rgba(10,10,10,0.05)',
  },
  listTagText: { ...type.caption, color: colors.primary, fontFamily: FONTS.semibold },
  listPayBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: SIZES.radius_full,
  },
  listPayText: { ...type.caption, color: colors.onPrimary, fontFamily: FONTS.bold },

  card: {
    height: '94%',
    borderRadius: SIZES.radius_xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...(isDark ? {} : SHADOWS.medium),
    overflow: 'hidden',
  },
  imageBadgeContainer: { width: '100%', height: '38%', position: 'relative', backgroundColor: colors.inputBackground },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.05)',
  },
  salaryBadge: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: colors.primary,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: SIZES.radius_full,
  },
  salaryCurrency: { ...type.small, color: colors.onPrimary, marginRight: 2, opacity: 0.7 },
  salaryText: { ...type.h3, color: colors.onPrimary },

  cardContent: {
    padding: SIZES.md,
    flex: 1,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
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
    gap: 6, paddingVertical: 10,
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
  reloadText: { ...type.button, color: colors.onPrimary },
  clearDecisionsBtn: { marginTop: SIZES.lg, padding: SIZES.sm },
  clearDecisionsText: { ...type.small, color: colors.textLight, textDecorationLine: 'underline' },
});
