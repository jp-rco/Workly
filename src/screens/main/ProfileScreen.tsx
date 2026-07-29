import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Alert, Linking, LayoutAnimation, Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SIZES, SHADOWS, type } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, MainTabParamList } from '../../navigation/MainNavigator';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useEffect } from 'react';
import { FadeInUp, PressScale } from '../../components/common/Animated';
import { useModal } from '../../context/ModalContext';
import { useNotification } from '../../context/NotificationContext';

type ProfileScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Profile'>,
  NativeStackNavigationProp<MainStackParamList>
>;

type Props = { navigation: ProfileScreenNavigationProp };

export default function ProfileScreen({ navigation }: Props) {
  const { userProfile, logout, switchRole } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { showRoleSwitch, showAlert, showConfirm } = useModal();
  const { showToast, unreadCount } = useNotification();
  const [switching, setSwitching] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!userProfile) return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const q = query(
          collection(db, 'applications'),
          where(userProfile.userType === 'Searching' ? 'applicantId' : 'employerId', '==', userProfile.uid)
        );
        const snap = await getDocs(q);
        const enriched = await Promise.all(snap.docs.map(async d => {
          const app = d.data();
          let jData = null;
          if (app.jobId) {
            const jSnap = await getDoc(doc(db, 'jobs', app.jobId));
            if (jSnap.exists()) jData = jSnap.data();
          }
          return { id: d.id, ...app, job: jData };
        }));
        setHistory(enriched);
      } catch (e) {
        console.error('History fetch error:', e);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [userProfile]);

  if (!userProfile) return null;

  const isSearching = userProfile.userType === 'Searching';

  const handleSwitchRole = () => {
    const targetRoleName = isSearching ? 'Reclutador / Empresa' : 'Buscador de Empleo';
    showRoleSwitch({
      targetRoleName,
      onConfirm: async () => {
        setSwitching(true);
        try {
          const { isFirstTime, targetRole } = await switchRole();
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          if (isFirstTime) {
            showAlert({
              title: '¡Nuevo perfil creado!',
              message: `Se creó tu perfil de ${targetRole === 'Hiring' ? 'Contratante / Empresa' : 'Buscador de Empleo'}. Configura la información de este nuevo perfil.`,
              type: 'success',
              buttonText: 'Configurar perfil ahora',
              onConfirm: () => navigation.navigate('EditProfile'),
            });
          } else {
            showAlert({
              title: 'Perfil cambiado',
              message: `Ahora estás en tu perfil de ${targetRole === 'Hiring' ? 'Contratante / Empresa' : 'Candidato'}.`,
              type: 'success',
            });
          }
        } catch (e) {
          console.error(e);
          showAlert({
            title: 'Error',
            message: 'No se pudo cambiar el perfil. Intenta nuevamente.',
            type: 'error',
          });
        } finally {
          setSwitching(false);
        }
      },
    });
  };

  const handleLogout = () => {
    showConfirm({
      title: 'Cerrar sesión',
      message: '¿Estás seguro de que deseas salir de tu cuenta?',
      confirmText: 'Cerrar sesión',
      confirmStyle: 'destructive',
      icon: 'log-out-outline',
      onConfirm: logout,
    });
  };

  const s = makeStyles(colors, isDark);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* HEADER */}
      <FadeInUp>
        <View style={s.topControls}>
          <TouchableOpacity style={s.iconBtn} onPress={toggleTheme} activeOpacity={0.7}>
            <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.iconBtn, { position: 'relative' }]}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={18} color={colors.text} />
            {unreadCount > 0 && (
              <View style={s.notifBadgeCircle}>
                <Text style={s.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.roleSwitchBtn}
            onPress={handleSwitchRole}
            disabled={switching}
            activeOpacity={0.85}
          >
            {switching ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons
                  name={isSearching ? 'briefcase-outline' : 'person-outline'}
                  size={14}
                  color={colors.text}
                />
                <Text style={s.roleSwitchText}>
                  {isSearching ? 'Necesito contratar' : 'Busco trabajo'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={s.heroCard}>
          <View style={s.avatarRing}>
            <Image
              source={{ uri: userProfile.photoURL || 'https://via.placeholder.com/200.png?text=Foto' }}
              style={s.avatar}
            />
          </View>
          <Text style={s.name}>{userProfile.name}</Text>
          <Text style={s.roleLabel}>
            {isSearching ? userProfile.profession || 'Profesional' : (userProfile.companyName || 'Reclutador')}
          </Text>
          {isSearching && userProfile.city ? (
            <View style={s.locationRow}>
              <Ionicons name="location-outline" size={13} color={colors.textLight} />
              <Text style={s.locationLabel}>{userProfile.city}</Text>
            </View>
          ) : null}

          <View style={s.heroActions}>
            <PressScale style={s.primaryBtn} onPress={() => navigation.navigate('EditProfile')}>
              <Ionicons name="create-outline" size={16} color={colors.onPrimary} />
              <Text style={s.primaryBtnText}>Editar perfil</Text>
            </PressScale>
            <TouchableOpacity style={s.ghostBtn} onPress={handleLogout} activeOpacity={0.8}>
              <Ionicons name="log-out-outline" size={18} color={colors.reject} />
            </TouchableOpacity>
          </View>
        </View>
      </FadeInUp>

      {/* CONTENT */}
      <FadeInUp delay={80} style={s.section}>
        {isSearching ? (
          <>
            <Text style={s.sectionTitle}>Sobre mí</Text>
            <Text style={s.sectionText}>{userProfile.bio || 'Aún no has escrito tu biografía.'}</Text>

            {userProfile.jobDescription ? (
              <>
                <Text style={s.sectionTitle}>Trabajo buscado</Text>
                <Text style={s.sectionText}>{userProfile.jobDescription}</Text>
              </>
            ) : null}

            <Text style={s.sectionTitle}>Habilidades</Text>
            <View style={s.chipsWrap}>
              {userProfile.skills && userProfile.skills.length > 0 ? (
                userProfile.skills.map((skill, i) => (
                  <View key={i} style={s.chip}>
                    <Text style={s.chipText}>{skill}</Text>
                  </View>
                ))
              ) : (
                <Text style={s.sectionText}>No has agregado habilidades.</Text>
              )}
            </View>

            {userProfile.resumeURL && (
              <PressScale style={s.cvButton} onPress={() => Linking.openURL(userProfile.resumeURL!)}>
                <Ionicons name="document-text" size={18} color={colors.onPrimary} />
                <Text style={s.cvButtonText}>Ver hoja de vida (PDF)</Text>
                <Ionicons name="open-outline" size={16} color={colors.onPrimary} style={{ marginLeft: 'auto' }} />
              </PressScale>
            )}
          </>
        ) : (
          <>
            <Text style={s.sectionTitle}>Acerca de la empresa</Text>
            <Text style={s.sectionText}>{userProfile.companyDescription || 'Aún no has descrito a tu empresa.'}</Text>

            <Text style={s.sectionTitle}>Detalles</Text>
            <View style={s.infoGrid}>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>Industria</Text>
                <Text style={s.infoValue}>{userProfile.industry || '—'}</Text>
              </View>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>Ubicación</Text>
                <Text style={s.infoValue}>{userProfile.location || '—'}</Text>
              </View>
            </View>
          </>
        )}
      </FadeInUp>

      {/* HISTORY */}
      <FadeInUp delay={140} style={[s.section, { marginTop: SIZES.md }]}>
        <Text style={s.sectionTitle}>Historial de trabajo</Text>
        {loadingHistory ? (
          <ActivityIndicator color={colors.primary} style={{ margin: 20 }} />
        ) : history.length === 0 ? (
          <Text style={s.sectionText}>No tienes trabajos finalizados aún.</Text>
        ) : (
          history.map((item, idx) => (
            <View key={item.id} style={[s.historyItem, idx !== history.length - 1 && s.historyBorder]}>
              <View style={s.historyInfo}>
                <Text style={s.historyTitle}>{item.jobTitle || 'Trabajo'}</Text>
                <Text style={s.historyDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={s.historyResult}>
                {item.job?.jobSubType === 'formal' ? (
                  <Text style={s.historyValue}>{item.monthsWorked || '?'} meses</Text>
                ) : (
                  <Text style={s.historyValue}>${item.finalPay || '?'}</Text>
                )}
                <Text style={s.historyLabel}>{item.job?.jobSubType === 'formal' ? 'Duración' : 'Total pagado'}</Text>
              </View>
            </View>
          ))
        )}
      </FadeInUp>
    </ScrollView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: SIZES.lg, paddingBottom: 130 },

  topControls: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SIZES.md,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  notifBadgeCircle: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: colors.reject, minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  notifBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },
  roleSwitchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: SIZES.radius_full,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  roleSwitchText: { ...type.small, color: colors.text },

  heroCard: {
    alignItems: 'center',
    paddingVertical: SIZES.xl,
    paddingHorizontal: SIZES.lg,
    borderRadius: SIZES.radius_xl,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    ...(isDark ? {} : SHADOWS.light),
    marginBottom: SIZES.md,
  },
  avatarRing: {
    padding: 4, borderRadius: 70,
    borderWidth: 2, borderColor: colors.primary,
    marginBottom: SIZES.md,
  },
  avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.inputBackground },
  name: { ...type.h1, color: colors.text },
  roleLabel: { ...type.bodyMd, color: colors.textLight, marginTop: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationLabel: { ...type.small, color: colors.textLight },

  heroActions: { flexDirection: 'row', gap: 10, marginTop: SIZES.lg, alignSelf: 'stretch' },
  primaryBtn: {
    flex: 1, flexDirection: 'row', gap: 10,
    paddingVertical: 14, borderRadius: SIZES.radius_full, paddingLeft: 20, paddingRight: 20,
    backgroundColor: colors.primary, alignSelf: 'center', justifyContent: 'center',
  },
  primaryBtnText: { ...type.button, color: colors.onPrimary },
  ghostBtn: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },

  section: {
    backgroundColor: colors.card, padding: SIZES.lg,
    borderRadius: SIZES.radius_xl,
    borderWidth: 1, borderColor: colors.border,
    ...(isDark ? {} : SHADOWS.light),
  },
  sectionTitle: { ...type.overline, color: colors.textLight, marginTop: SIZES.md, marginBottom: SIZES.sm },
  sectionText: { ...type.body, color: colors.text, lineHeight: 22 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: SIZES.radius_full,
    backgroundColor: colors.inputBackground,
    borderWidth: 1, borderColor: colors.border,
  },
  chipText: { ...type.caption, color: colors.text },

  cvButton: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.primary, padding: 14,
    borderRadius: SIZES.radius_full, marginTop: SIZES.md,
  },
  cvButtonText: { ...type.button, color: colors.onPrimary },

  infoGrid: { flexDirection: 'row', gap: 16, marginTop: 4 },
  infoItem: { flex: 1 },
  infoLabel: { ...type.caption, color: colors.textLight, marginBottom: 4 },
  infoValue: { ...type.bodyMd, color: colors.text },

  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  historyBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  historyInfo: { flex: 1 },
  historyTitle: { ...type.h3, color: colors.text },
  historyDate: { ...type.caption, color: colors.textLight, marginTop: 2 },
  historyResult: { alignItems: 'flex-end' },
  historyValue: { ...type.h3, color: colors.primary },
  historyLabel: { ...type.caption, color: colors.textLight, marginTop: 2 },
});
