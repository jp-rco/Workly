import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  ActivityIndicator, Dimensions, TouchableOpacity, Linking, Alert, Modal, TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainNavigator';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { SIZES, SHADOWS, type } from '../../constants/theme';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from '../../components/common/AppMap';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FadeInUp, PressScale } from '../../components/common/Animated';

type Props = NativeStackScreenProps<MainStackParamList, 'Detail'>;
const { width } = Dimensions.get('window');

export default function DetailScreen({ route, navigation }: Props) {
  const { id, type: kind, applicationId } = route.params;
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();

  const [data, setData] = useState<any>(null);
  const [appData, setAppData] = useState<any>(null);
  const [jobData, setJobData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionValue, setCompletionValue] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const collectionName = kind === 'Job' ? 'jobs' : 'users';
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setData({ id: docSnap.id, ...docSnap.data() });

        if (applicationId) {
          const appSnap = await getDoc(doc(db, 'applications', applicationId));
          if (appSnap.exists()) {
            const aData = appSnap.data();
            if (userProfile?.userType === 'Searching' && aData.statusViewed === false) {
              await updateDoc(doc(db, 'applications', applicationId), { statusViewed: true });
            }
            setAppData({ id: appSnap.id, ...aData });
            if (aData.jobId) {
              const jSnap = await getDoc(doc(db, 'jobs', aData.jobId));
              if (jSnap.exists()) setJobData(jSnap.data());
            }
          }
        }
      } catch (e) {
        console.error('Error fetching detail:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id, kind, applicationId]);

  const styles = makeStyles(colors, isDark);

  const handleUpdateStatus = async (newStatus: string, extras: any = {}) => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const appRef = doc(db, 'applications', applicationId);
      const updates = { status: newStatus, statusViewed: false, ...extras };
      await updateDoc(appRef, updates);
      setAppData((prev: any) => ({ ...prev, ...updates }));

      if (newStatus === 'rejected') {
        sendEmail(data.email, 'Actualización de tu postulación · Workly',
          `Hola ${data.name}, lamentamos informarte que tu perfil no ha sido seleccionado para la vacante en este momento. ¡Éxitos en tu búsqueda!`);
      } else if (newStatus === 'accepted') {
        sendEmail(data.email, '¡Felicidades! Has sido contratado/a · Workly',
          `Hola ${data.name}, nos complace informarte que has sido seleccionado para el puesto. ¡Bienvenido al equipo!`);
      }
      Alert.alert('Listo', `Estado actualizado a "${newStatus}"`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo actualizar el estado');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!completionValue) {
      Alert.alert('Error', 'Por favor ingresa el valor solicitado');
      return;
    }
    const field = jobData?.jobSubType === 'formal' ? 'monthsWorked' : 'finalPay';
    await handleUpdateStatus('completed', { [field]: completionValue });
    setShowCompleteModal(false);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setTempDate(selectedDate);
      setShowTimePicker(true);
    }
  };

  const onTimeChange = async (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const finalDate = new Date(tempDate);
      finalDate.setHours(selectedTime.getHours());
      const minutes = selectedTime.getMinutes();
      finalDate.setMinutes(minutes < 30 ? 30 : 0);
      if (minutes >= 30) finalDate.setHours(finalDate.getHours() + 1);

      await handleUpdateStatus('interview', { interviewDate: finalDate.toISOString() });
      sendEmail(
        data.email, 'Invitación a Entrevista · Workly',
        `Hola ${data.name}, nos gustaría invitarte a una entrevista para el puesto el día ${finalDate.toLocaleDateString()} a las ${finalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.\n\nPor favor confirma tu asistencia.`
      );
    }
  };

  const sendEmail = (to: string, subject: string, body: string) => {
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.canOpenURL(url).then(supported => { if (supported) Linking.openURL(url); });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!data) return <View style={styles.centered}><Text style={styles.noData}>No encontrado</Text></View>;

  const isInformal = jobData?.jobSubType === 'informal';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 140 }}>
        {kind === 'Job' ? (
          <JobDetail data={data} colors={colors} isDark={isDark} />
        ) : (
          <CandidateDetail
            data={data}
            appData={appData}
            jobData={jobData}
            colors={colors}
            isDark={isDark}
            isRecruiter={userProfile?.userType === 'Hiring'}
            onChat={() => {
              const targetUserId = appData?.userId || data.uid || data.id;
              const title = appData?.jobTitle || data.name || 'Chat';
              navigation.navigate('Chat', {
                applicationId: applicationId || undefined,
                otherUserId: targetUserId,
                jobTitle: title,
              });
            }}
          />
        )}
      </ScrollView>

      {/* Recruiter Actions Overlay */}
      {userProfile?.userType === 'Hiring' && appData && appData.status !== 'completed' && (
        <View style={styles.actionFooter}>
          {appData.status === 'pending' && (
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.btnReject]} onPress={() => handleUpdateStatus('rejected')} activeOpacity={0.85}>
                <Text style={styles.btnTextLight}>Rechazar</Text>
              </TouchableOpacity>
              {isInformal ? (
                <PressScale style={[styles.actionBtn, styles.btnHire]} onPress={() => handleUpdateStatus('accepted')}>
                  <Text style={styles.btnText}>Contratar ya</Text>
                </PressScale>
              ) : (
                <PressScale style={[styles.actionBtn, styles.btnAccept]} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.btnText}>Programar entrevista</Text>
                </PressScale>
              )}
            </View>
          )}

          {appData.status === 'interview' && (
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.btnReject]} onPress={() => handleUpdateStatus('rejected')} activeOpacity={0.85}>
                <Text style={styles.btnTextLight}>Rechazar</Text>
              </TouchableOpacity>
              <PressScale style={[styles.actionBtn, styles.btnHire]} onPress={() => handleUpdateStatus('accepted')}>
                <Text style={styles.btnText}>Contratar</Text>
              </PressScale>
            </View>
          )}

          {appData.status === 'accepted' && (
            <PressScale style={[styles.actionBtn, styles.btnComplete]} onPress={() => setShowCompleteModal(true)}>
              <Ionicons name="trophy-outline" size={18} color={isDark ? '#000' : '#fff'} />
              <Text style={styles.btnText}>Trabajo realizado</Text>
            </PressScale>
          )}

          {appData.status === 'rejected' && (
            <View style={styles.statusBanner}>
              <Ionicons name="close-circle" size={20} color="#fff" />
              <Text style={styles.bannerText}>Postulación rechazada</Text>
            </View>
          )}
        </View>
      )}

      {/* Completion Modal */}
      <Modal visible={showCompleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Finalizar trabajo</Text>
            <Text style={styles.modalSubtitle}>
              {isInformal ? 'Monto total pagado al profesional' : 'Meses de duración del contrato'}
            </Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder={isInformal ? '$ 100.000' : '6'}
              placeholderTextColor={colors.textLight}
              value={completionValue}
              onChangeText={setCompletionValue}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCompleteModal(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <PressScale style={styles.modalSubmit} onPress={handleCompleteJob}>
                <Text style={styles.submitText}>Guardar</Text>
              </PressScale>
            </View>
          </View>
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker value={tempDate} mode="date" display="default" onChange={onDateChange} minimumDate={new Date()} />
      )}
      {showTimePicker && (
        <DateTimePicker value={tempDate} mode="time" display="default" onChange={onTimeChange} minuteInterval={30} />
      )}
    </View>
  );
}

function JobDetail({ data, colors, isDark }: { data: any; colors: any; isDark: boolean }) {
  const styles = makeStyles(colors, isDark);
  return (
    <View>
      <View style={styles.heroWrap}>
        {data.imageUrl ? (
          <Image source={{ uri: data.imageUrl }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Ionicons name="briefcase-outline" size={56} color={colors.textLight} />
          </View>
        )}
        <View style={styles.heroScrim} />
      </View>

      <FadeInUp style={styles.content}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <View style={[styles.badgeSmall, {
            backgroundColor: data.jobSubType === 'formal'
              ? (isDark ? 'rgba(232,197,108,0.14)' : 'rgba(10,10,10,0.06)')
              : (isDark ? 'rgba(61,190,122,0.16)' : 'rgba(31,122,77,0.10)'),
          }]}>
            <Text style={[styles.badgeTextSmall, {
              color: data.jobSubType === 'formal' ? colors.primary : colors.accept,
            }]}>
              {data.jobSubType === 'formal' ? 'Trabajo formal' : 'Trabajo informal'}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.subtitle}>{data.companyName || 'Empresa'}</Text>

        <View style={styles.infoRow}>
          {data.pay ? (
            <View style={styles.infoChip}>
              <Ionicons name="cash-outline" size={14} color={colors.primary} />
              <Text style={styles.infoChipText}>${data.pay}</Text>
            </View>
          ) : null}
          {data.duration ? (
            <View style={styles.infoChip}>
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text style={styles.infoChipText}>{data.duration}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Descripción</Text>
        <Text style={styles.sectionText}>{data.description}</Text>

        {data.requirements && data.requirements.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Requisitos</Text>
            <View style={styles.chipsWrap}>
              {data.requirements.map((r: string, i: number) => (
                <View key={i} style={styles.softChip}>
                  <Text style={styles.softChipText}>{r}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {data.latitude && (
          <>
            <Text style={styles.sectionTitle}>Ubicación</Text>
            {data.address && (
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={14} color={colors.primary} />
                <Text style={styles.addressText}>{data.address}</Text>
              </View>
            )}
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                scrollEnabled={false}
                zoomEnabled={false}
                initialRegion={{ latitude: data.latitude, longitude: data.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
              >
                <Marker coordinate={{ latitude: data.latitude, longitude: data.longitude }} pinColor={colors.primary} />
              </MapView>
            </View>
          </>
        )}
      </FadeInUp>
    </View>
  );
}

function CandidateDetail({ data, appData, colors, isDark, isRecruiter, onChat }: any) {
  const styles = makeStyles(colors, isDark);
  return (
    <View>
      <FadeInUp style={styles.candidateHeader}>
        <View style={styles.avatarRing}>
          <Image
            source={{ uri: data.photoURL || 'https://via.placeholder.com/200.png?text=Foto' }}
            style={styles.candidateAvatar}
          />
        </View>
        <Text style={styles.title}>{data.name}</Text>
        <Text style={styles.subtitle}>{data.profession || 'Profesional'}</Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          {appData && (
            <View style={[styles.badge, {
              backgroundColor:
                (appData.status === 'rejected' ? colors.reject :
                  (appData.status === 'accepted' ? colors.accept :
                    (appData.status === 'interview' ? '#5DA8FF' : colors.primary))) + '22',
            }]}>
              <Text style={{
                ...type.caption,
                color: appData.status === 'rejected' ? colors.reject :
                  (appData.status === 'accepted' ? colors.accept :
                    (appData.status === 'interview' ? '#5DA8FF' : colors.primary)),
              }}>
                {appData.status.toUpperCase()}
              </Text>
            </View>
          )}

          {isRecruiter && (
            <TouchableOpacity style={styles.chatIconBtn} onPress={onChat} activeOpacity={0.85}>
              <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {!appData && isRecruiter && (
          <PressScale style={styles.chatPillBtn} onPress={onChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={isDark ? '#000' : '#fff'} />
            <Text style={styles.chatPillText}>Iniciar chat</Text>
          </PressScale>
        )}

        {appData?.interviewDate && (
          <Text style={styles.interviewDateText}>
            Entrevista · {new Date(appData.interviewDate).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}
          </Text>
        )}
      </FadeInUp>

      <FadeInUp delay={80} style={styles.content}>
        {data.bio ? (
          <>
            <Text style={styles.sectionTitle}>Sobre mí</Text>
            <Text style={styles.sectionText}>{data.bio}</Text>
          </>
        ) : null}

        {data.skills && data.skills.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Habilidades</Text>
            <View style={styles.chipsWrap}>
              {data.skills.map((s: string, i: number) => (
                <View key={i} style={styles.softChip}>
                  <Text style={styles.softChipText}>{s}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {data.resumeURL && (
          <PressScale style={styles.cvBox} onPress={() => Linking.openURL(data.resumeURL)}>
            <View style={styles.cvIconWrap}>
              <Ionicons name="document-text" size={20} color={isDark ? '#000' : '#fff'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cvText}>Ver hoja de vida</Text>
              <Text style={styles.cvSubtext}>Toca para abrir el PDF</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={isDark ? '#000' : '#fff'} />
          </PressScale>
        )}
      </FadeInUp>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  noData: { ...type.body, color: colors.textLight },

  heroWrap: { position: 'relative' },
  heroImage: { width, height: 260, resizeMode: 'cover', backgroundColor: colors.inputBackground },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.08)',
  },

  content: { padding: SIZES.lg },
  title: { ...type.display, color: colors.text, marginTop: 4 },
  subtitle: { ...type.bodyMd, color: colors.textLight, marginTop: 4 },

  infoRow: { flexDirection: 'row', gap: 8, marginTop: SIZES.md, flexWrap: 'wrap' },
  infoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: isDark ? 'rgba(232,197,108,0.10)' : 'rgba(10,10,10,0.05)',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: SIZES.radius_full,
  },
  infoChipText: { ...type.small, color: colors.primary },

  sectionTitle: { ...type.overline, color: colors.textLight, marginTop: SIZES.lg, marginBottom: SIZES.sm },
  sectionText: { ...type.body, color: colors.text, lineHeight: 23 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  softChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: SIZES.radius_full,
    backgroundColor: colors.inputBackground,
    borderWidth: 1, borderColor: colors.border,
  },
  softChipText: { ...type.caption, color: colors.text },

  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SIZES.sm },
  addressText: { ...type.small, color: colors.textLight, flex: 1 },
  mapContainer: { borderRadius: SIZES.radius_lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginTop: 8 },
  map: { width: '100%', height: 200 },

  candidateHeader: {
    alignItems: 'center',
    paddingTop: SIZES.xl, paddingBottom: SIZES.lg,
    backgroundColor: colors.card,
  },
  avatarRing: {
    padding: 4, borderRadius: 70,
    borderWidth: 2, borderColor: colors.primary,
    marginBottom: SIZES.md,
  },
  candidateAvatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.inputBackground },

  cvBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.primary, padding: SIZES.md,
    borderRadius: SIZES.radius_lg, marginTop: SIZES.lg,
  },
  cvIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  cvText: { ...type.button, color: isDark ? '#000' : '#fff' },
  cvSubtext: { ...type.caption, color: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.75)', marginTop: 2 },

  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: SIZES.radius_full },
  badgeSmall: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: SIZES.radius_full, alignSelf: 'flex-start' },
  badgeTextSmall: { ...type.caption },

  chatIconBtn: {
    backgroundColor: isDark ? 'rgba(232,197,108,0.10)' : 'rgba(10,10,10,0.05)',
    padding: 10, borderRadius: 22,
  },
  chatPillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: SIZES.md,
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: colors.primary, borderRadius: SIZES.radius_full,
  },
  chatPillText: { ...type.button, color: isDark ? '#000' : '#fff' },

  actionFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: SIZES.lg, paddingBottom: SIZES.xl,
    backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.border,
    ...(isDark ? {} : SHADOWS.medium),
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', gap: 8,
    paddingVertical: 14, borderRadius: SIZES.radius_full,
    alignItems: 'center', justifyContent: 'center',
  },
  btnReject: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: colors.reject,
  },
  btnAccept: { backgroundColor: '#5DA8FF' },
  btnHire: { backgroundColor: colors.accept },
  btnComplete: { backgroundColor: colors.primary },
  btnText: { ...type.button, color: isDark ? '#000' : '#fff' },
  btnTextLight: { ...type.button, color: colors.reject },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: colors.reject, padding: 14,
    borderRadius: SIZES.radius_full,
  },
  bannerText: { ...type.button, color: '#fff' },

  interviewDateText: { marginTop: 14, ...type.small, color: colors.primary },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: colors.card, width: '100%',
    borderRadius: SIZES.radius_xl, padding: SIZES.xl, gap: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  modalTitle: { ...type.h1, color: colors.text },
  modalSubtitle: { ...type.body, color: colors.textLight },
  modalInput: {
    backgroundColor: colors.inputBackground,
    padding: SIZES.md, borderRadius: SIZES.radius,
    color: colors.text, ...type.h2, textAlign: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancel: { flex: 1, padding: 14, alignItems: 'center', justifyContent: 'center' },
  modalSubmit: {
    flex: 2, backgroundColor: colors.primary,
    padding: 14, borderRadius: SIZES.radius_full,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { ...type.button, color: colors.textLight },
  submitText: { ...type.button, color: isDark ? '#000' : '#fff' },
});
