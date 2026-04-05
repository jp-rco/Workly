import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Linking, LayoutAnimation } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SIZES, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList, MainTabParamList } from '../../navigation/MainNavigator';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useEffect } from 'react';

type ProfileScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Profile'>,
  NativeStackNavigationProp<MainStackParamList>
>;

type Props = { navigation: ProfileScreenNavigationProp };

export default function ProfileScreen({ navigation }: Props) {
  const { userProfile, logout, switchRole } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const [switching, setSwitching] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!userProfile) return;
      setLoadingHistory(true);
      try {
        const q = query(
          collection(db, 'applications'),
          where(userProfile.userType === 'Searching' ? 'userId' : 'recruiterId', '==', userProfile.uid)
          // Removed status filter here to avoid requiring a composite index.
        );
        const snap = await getDocs(q);
        
        // Filter history client-side for 'completed' status
        const completedSnap = snap.docs.filter(d => d.data().status === 'completed');

        const enriched = await Promise.all(completedSnap.map(async (d) => {
          const app = d.data();
          let jData = {};
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

  const handleSwitchRole = async () => {
    Alert.alert(
      'Cambiar Rol',
      `¿Estás seguro que quieres cambiar a modo ${isSearching ? 'Reclutador' : 'Candidato'}? Esto cambiará tu feed y opciones principales.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cambiar',
          onPress: async () => {
            setSwitching(true);
            try {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              await switchRole();
            } catch (error) {
              Alert.alert('Error', 'No se pudo cambiar el rol');
            } finally {
              setSwitching(false);
            }
          }
        }
      ]
    );
  };

  const s = makeStyles(colors, isDark);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* ─── HEADER ─── */}
      <View style={s.header}>
        <View style={s.topControls}>
          <TouchableOpacity style={s.themeBtn} onPress={toggleTheme} activeOpacity={0.7}>
            <Ionicons
              name={isDark ? 'sunny' : 'moon'}
              size={20}
              color={isDark ? '#FBBF24' : colors.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[s.roleSwitchBtn, { backgroundColor: isSearching ? colors.primary + '15' : colors.accept + '15' }]} 
            onPress={handleSwitchRole}
            disabled={switching}
          >
            {switching ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons 
                  name={isSearching ? "briefcase-outline" : "person-outline"} 
                  size={16} 
                  color={isSearching ? colors.primary : colors.accept} 
                />
                <Text style={[s.roleSwitchText, { color: isSearching ? colors.primary : colors.accept }]}>
                  {isSearching ? '¡Necesito contratar!' : '¡Busco trabajo!'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Image
          source={{ uri: userProfile.photoURL || 'https://via.placeholder.com/150.png?text=Foto' }}
          style={s.avatar}
        />
        <Text style={s.name}>{userProfile.name}</Text>
        <Text style={s.roleLabel}>
          {isSearching ? userProfile.profession || 'Profesional' : (userProfile.companyName || 'Reclutador / Empresa')}
        </Text>
        {isSearching && userProfile.city ? (
          <View style={s.locationRow}>
            <Ionicons name="location-outline" size={14} color={colors.textLight} />
            <Text style={s.locationLabel}>{userProfile.city}</Text>
          </View>
        ) : null}
      </View>

      {/* ─── ACTION BUTTONS ─── */}
      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('EditProfile')}>
          <Ionicons name="create-outline" size={20} color={colors.primary} />
          <Text style={s.actionBtnText}>Editar Perfil</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.actionBtn, { borderColor: colors.reject }]} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={colors.reject} />
          <Text style={[s.actionBtnText, { color: colors.reject }]}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>

      {/* ─── CONTENT SECTION ─── */}
      <View style={s.section}>
        {isSearching ? (
          <>
            <Text style={s.sectionTitle}>Sobre Mí</Text>
            <Text style={s.sectionText}>{userProfile.bio || 'Aún no has escrito tu biografía.'}</Text>

            {userProfile.jobDescription ? (
              <>
                <Text style={s.sectionTitle}>Trabajo Buscado</Text>
                <Text style={s.sectionText}>{userProfile.jobDescription}</Text>
              </>
            ) : null}

            <Text style={s.sectionTitle}>Habilidades</Text>
            <View style={s.listContainer}>
              {userProfile.skills && userProfile.skills.length > 0 ? (
                userProfile.skills.map((skill, i) => (
                  <View key={i} style={s.listItem}>
                    <Text style={s.bulletPoint}>•</Text>
                    <Text style={s.listItemText}>{skill}</Text>
                  </View>
                ))
              ) : (
                <Text style={s.sectionText}>No has agregado habilidades.</Text>
              )}
            </View>

            {userProfile.resumeURL && (
              <>
                <Text style={s.sectionTitle}>Documentos</Text>
                <TouchableOpacity style={s.cvButton} onPress={() => Linking.openURL(userProfile.resumeURL!)}>
                  <Ionicons name="document-text" size={20} color="#FFFFFF" />
                  <Text style={s.cvButtonText}>Ver Hoja de Vida (PDF)</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        ) : (
          <>
            <Text style={s.sectionTitle}>Acerca de la Empresa</Text>
            <Text style={s.sectionText}>{userProfile.companyDescription || 'Aún no has descrito a tu empresa.'}</Text>

            <Text style={s.sectionTitle}>Detalles Corporativos</Text>
            <View style={s.infoGrid}>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>Industria</Text>
                <Text style={s.infoValue}>{userProfile.industry || 'No especificada'}</Text>
              </View>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>Ubicación</Text>
                <Text style={s.infoValue}>{userProfile.location || 'No especificada'}</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* ─── HISTORY SECTION ─── */}
      <View style={[s.section, { marginTop: SIZES.lg }]}>
        <Text style={s.sectionTitle}>Historial de Trabajo</Text>
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
      </View>

    </ScrollView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: SIZES.lg, paddingBottom: SIZES.xxl },

  header: { alignItems: 'center', marginBottom: SIZES.xl },
  topControls: { 
    flexDirection: 'row', justifyContent: 'space-between', width: '100%', 
    alignItems: 'center', marginBottom: SIZES.sm 
  },
  
  themeBtn: {
    backgroundColor: colors.inputBackground,
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },

  roleSwitchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, 
    borderWidth: 1, 
  },
  roleSwitchText: { fontSize: 13, fontWeight: '700' },

  avatar: {
    width: 110, height: 110, borderRadius: 55,
    marginTop: SIZES.sm, marginBottom: SIZES.md,
    borderWidth: 3, borderColor: colors.primary + '20',
  },
  name: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  roleLabel: { fontSize: 16, color: colors.textLight, marginTop: 4, fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationLabel: { fontSize: 13, color: colors.textLight },

  actions: { flexDirection: 'row', gap: 10, marginBottom: SIZES.xl },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: SIZES.radius_lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    gap: 8,
  },
  actionBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },

  section: {
    backgroundColor: colors.card, padding: SIZES.lg,
    borderRadius: SIZES.radius_lg,
    borderWidth: isDark ? 1 : 0, borderColor: colors.border,
    ...(isDark ? {} : SHADOWS.light),
  },
  sectionTitle: {
    fontSize: 16, fontWeight: 'bold', color: colors.text,
    marginBottom: SIZES.sm, marginTop: SIZES.lg,
  },
  sectionText: { fontSize: 14, color: colors.textLight, lineHeight: 22 },

  listContainer: { marginTop: 4, gap: 8 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletPoint: { fontSize: 18, color: colors.primary, marginTop: -2 },
  listItemText: { fontSize: 14, color: colors.textLight, flex: 1 },

  cvButton: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.primary, padding: 14,
    borderRadius: SIZES.radius_lg, marginTop: SIZES.sm,
  },
  cvButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },

  infoGrid: { flexDirection: 'row', gap: 15, marginTop: 4 },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 12, color: colors.textLight, marginBottom: 2 },
  infoValue: { fontSize: 14, color: colors.text, fontWeight: '500' },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  historyBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: 15, fontWeight: 'bold', color: colors.text },
  historyDate: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  historyResult: { alignItems: 'flex-end' },
  historyValue: { fontSize: 15, fontWeight: 'bold', color: colors.primary },
  historyLabel: { fontSize: 10, color: colors.textLight },
});
