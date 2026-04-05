import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  ActivityIndicator, Dimensions, TouchableOpacity, Linking, Alert, Modal, TextInput, Platform
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainNavigator';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { SIZES, SHADOWS } from '../../constants/theme';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from '../../components/common/AppMap';
import DateTimePicker from '@react-native-community/datetimepicker';

type Props = NativeStackScreenProps<MainStackParamList, 'Detail'>;

const { width } = Dimensions.get('window');

export default function DetailScreen({ route, navigation }: Props) {
  const { id, type, applicationId } = route.params;
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  
  const [data, setData] = useState<any>(null);
  const [appData, setAppData] = useState<any>(null);
  const [jobData, setJobData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // States for Interview Date Picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  // State for Completion Modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionValue, setCompletionValue] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // Fetch base data (Job or User)
        const collectionName = type === 'Job' ? 'jobs' : 'users';
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setData({ id: docSnap.id, ...docSnap.data() });
        }

        // Fetch application specifically if we have applicationId
        if (applicationId) {
          const appSnap = await getDoc(doc(db, 'applications', applicationId));
          if (appSnap.exists()) {
            const aData = appSnap.data();
            
            // Clear notification for professional if they are viewing the update
            if (userProfile?.userType === 'Searching' && aData.statusViewed === false) {
              await updateDoc(doc(db, 'applications', applicationId), { statusViewed: true });
            }

            setAppData({ id: appSnap.id, ...aData });

            // Fetch Job sub-type
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
  }, [id, type, applicationId]);

  const styles = makeStyles(colors, isDark);

  const handleUpdateStatus = async (newStatus: string, extras: any = {}) => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const appRef = doc(db, 'applications', applicationId);
      const updates = { status: newStatus, statusViewed: false, ...extras };
      await updateDoc(appRef, updates);
      setAppData((prev: any) => ({ ...prev, ...updates }));
      
      // Prepare Email
      if (newStatus === 'rejected') {
        sendEmail(
          data.email, 
          `Actualización de tu postulación - Workly`, 
          `Hola ${data.name}, lamentamos informarte que tu perfil no ha sido seleccionado para la vacante en este momento. ¡Te deseamos éxito en tus futuras búsquedas!`
        );
      } else if (newStatus === 'accepted') {
        sendEmail(
          data.email, 
          `¡Felicidades! Has sido contratado/a - Workly`, 
          `Hola ${data.name}, nos complace informarte que has sido seleccionado para el puesto. ¡Bienvenido al equipo!`
        );
      }

      Alert.alert('Éxito', `Estado actualizado a ${newStatus}`);
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
        data.email,
        'Invitación a Entrevista - Workly',
        `Hola ${data.name}, nos gustaría invitarte a una entrevista para el puesto el día ${finalDate.toLocaleDateString()} a las ${finalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.\n\nPor favor confirma tu asistencia.`
      );
    }
  };

  const sendEmail = (to: string, subject: string, body: string) => {
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
    });
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
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {type === 'Job' ? (
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
                jobTitle: title 
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
              <TouchableOpacity style={[styles.actionBtn, styles.btnReject]} onPress={() => handleUpdateStatus('rejected')}>
                <Text style={styles.btnText}>Rechazar</Text>
              </TouchableOpacity>
              {isInformal ? (
                <TouchableOpacity style={[styles.actionBtn, styles.btnHire]} onPress={() => handleUpdateStatus('accepted')}>
                  <Text style={styles.btnText}>Contratar ya</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.actionBtn, styles.btnAccept]} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.btnText}>Entrevista</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {appData.status === 'interview' && (
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.btnReject]} onPress={() => handleUpdateStatus('rejected')}>
                <Text style={styles.btnText}>Rechazar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.btnHire]} onPress={() => handleUpdateStatus('accepted')}>
                <Text style={styles.btnText}>Contratar</Text>
              </TouchableOpacity>
            </View>
          )}

          {appData.status === 'accepted' && (
            <TouchableOpacity style={[styles.actionBtn, styles.btnComplete]} onPress={() => setShowCompleteModal(true)}>
              <Ionicons name="trophy-outline" size={20} color="#FFFFFF" />
              <Text style={styles.btnText}> Trabajo Realizado</Text>
            </TouchableOpacity>
          )}

          {appData.status === 'rejected' && (
            <View style={[styles.statusBanner, { backgroundColor: colors.reject }]}>
              <Ionicons name="close-circle" size={24} color="#FFFFFF" />
              <Text style={styles.bannerText}>Postulación Rechazada</Text>
            </View>
          )}
        </View>
      )}

      {/* Completion Modal */}
      <Modal visible={showCompleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Finalizar Trabajo</Text>
            <Text style={styles.modalSubtitle}>
              {isInformal ? 'Ingresa el MONTO TOTAL pagado al profesional:' : 'Ingresa los MESES de duración del contrato:'}
            </Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder={isInformal ? "$ Ejemplo: 100000" : "Ejemplo: 6"}
              placeholderTextColor={colors.textLight}
              value={completionValue}
              onChangeText={setCompletionValue}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCompleteModal(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={handleCompleteJob}>
                <Text style={styles.submitText}>Guardar y Finalizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={onDateChange}
          minimumDate={new Date()}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display="default"
          onChange={onTimeChange}
          minuteInterval={30}
        />
      )}
    </View>
  );
}

function JobDetail({ data, colors, isDark }: { data: any, colors: any, isDark: boolean }) {
  const styles = makeStyles(colors, isDark);
  return (
    <View>
      {data.imageUrl ? <Image source={{ uri: data.imageUrl }} style={styles.heroImage} /> : (
        <View style={[styles.heroImage, styles.heroPlaceholder]}><Ionicons name="briefcase" size={64} color={colors.textLight} /></View>
      )}
      <View style={styles.content}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={[styles.badgeSmall, { backgroundColor: data.jobSubType === 'formal' ? colors.primary + '20' : colors.accept + '20' }]}>
            <Text style={[styles.badgeTextSmall, { color: data.jobSubType === 'formal' ? colors.primary : colors.accept }]}>
              {data.jobSubType === 'formal' ? 'Trabajo Formal' : 'Trabajo Informal'}
            </Text>
          </View>
        </View>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.subtitle}>{data.companyName || 'Empresa'}</Text>
        <View style={styles.infoRow}>
          <View style={styles.infoChip}><Ionicons name="cash-outline" size={16} color={colors.primary} /><Text style={styles.infoChipText}>${data.pay}</Text></View>
          <View style={styles.infoChip}><Ionicons name="time-outline" size={16} color={colors.primary} /><Text style={styles.infoChipText}>{data.duration}</Text></View>
        </View>
        <Text style={styles.sectionTitle}>Descripción</Text>
        <Text style={styles.sectionText}>{data.description}</Text>
        {data.requirements && data.requirements.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Requisitos</Text>
            <View style={styles.listContainer}>
              {data.requirements.map((r: string, i: number) => (
                <View key={i} style={styles.listItem}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.listItemText}>{r}</Text>
                </View>
              ))}
            </View>
          </>
        )}
        {data.latitude && (
          <><Text style={styles.sectionTitle}>Ubicación</Text>
            {data.address && <View style={styles.addressRow}><Ionicons name="location-outline" size={16} color={colors.primary} /><Text style={styles.addressText}>{data.address}</Text></View>}
            <View style={styles.mapContainer}>
              <MapView style={styles.map} scrollEnabled={false} zoomEnabled={false} initialRegion={{ latitude: data.latitude, longitude: data.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }}>
                <Marker coordinate={{ latitude: data.latitude, longitude: data.longitude }} pinColor={colors.primary} />
              </MapView>
            </View></>
        )}
      </View>
    </View>
  );
}

function CandidateDetail({ data, appData, jobData, colors, isDark, isRecruiter, onChat }: any) {
  const styles = makeStyles(colors, isDark);
  return (
    <View>
      <View style={styles.candidateHeader}>
        <Image source={{ uri: data.photoURL || 'https://via.placeholder.com/200.png?text=Foto' }} style={styles.candidateAvatar} />
        <Text style={styles.title}>{data.name}</Text>
        <Text style={styles.subtitle}>{data.profession || 'Profesional'}</Text>
        
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {appData && (
              <View style={[styles.badge, { backgroundColor: (appData.status === 'rejected' ? colors.reject : (appData.status === 'accepted' ? colors.accept : (appData.status === 'interview' ? '#3498db' : colors.primary))) + '20' }]}>
                <Text style={{ color: appData.status === 'rejected' ? colors.reject : (appData.status === 'accepted' ? colors.accept : (appData.status === 'interview' ? '#3498db' : colors.primary)), fontWeight: 'bold' }}>
                  {appData.status.toUpperCase()}
                </Text>
              </View>
            )}
            {isRecruiter && (
              <TouchableOpacity style={styles.chatIconBtn} onPress={onChat}>
                <Ionicons name="chatbubble-ellipses" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

        {!appData && isRecruiter && (
          <TouchableOpacity style={[styles.chatIconBtn, { marginTop: 15, paddingHorizontal: 20, flexDirection: 'row', gap: 8, height: 44, borderRadius: 22 }]} onPress={onChat}>
            <Ionicons name="chatbubble-ellipses" size={22} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Iniciar Chat</Text>
          </TouchableOpacity>
        )}

        {appData?.interviewDate && <Text style={styles.interviewDateText}>Entrevista: {new Date(appData.interviewDate).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}</Text>}
      </View>

      <View style={styles.content}>
        {data.bio && <><Text style={styles.sectionTitle}>Sobre mí</Text><Text style={styles.sectionText}>{data.bio}</Text></>}
        {data.skills && data.skills.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Habilidades</Text>
            <View style={styles.listContainer}>
              {data.skills.map((s: string, i: number) => (
                <View key={i} style={styles.listItem}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.listItemText}>{s}</Text>
                </View>
              ))}
            </View>
          </>
        )}
        {data.resumeURL && (
          <TouchableOpacity style={styles.cvBox} onPress={() => Linking.openURL(data.resumeURL)} activeOpacity={0.7}>
            <Ionicons name="document-text" size={24} color="#FFFFFF" />
            <View><Text style={styles.cvText}>Ver CV (PDF)</Text><Text style={styles.cvSubtext}>Toca para abrir archivo</Text></View>
            <Ionicons name="open-outline" size={20} color="#FFFFFF" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        )}
        <View style={{ height: 100 }} />
      </View>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  noData: { fontSize: 16, color: colors.textLight },
  heroImage: { width, height: 240, resizeMode: 'cover', backgroundColor: colors.inputBackground },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: SIZES.lg },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.text, marginTop: SIZES.xs },
  subtitle: { fontSize: 16, color: colors.textLight, marginTop: 4 },
  infoRow: { flexDirection: 'row', gap: 10, marginTop: SIZES.md, flexWrap: 'wrap' },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  infoChipText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text, marginTop: SIZES.lg, marginBottom: SIZES.sm },
  sectionText: { fontSize: 15, color: colors.textLight, lineHeight: 22 },
  listContainer: { marginTop: 4, gap: 8 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { fontSize: 18, color: colors.primary, marginTop: -2 },
  listItemText: { fontSize: 15, color: colors.textLight, flex: 1, lineHeight: 22 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: colors.primary + '20', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  tagText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SIZES.sm },
  addressText: { fontSize: 14, color: colors.textLight, flex: 1 },
  mapContainer: { borderRadius: SIZES.radius_lg, overflow: 'hidden', borderWidth: isDark ? 1 : 0, borderColor: colors.border, marginTop: 8 },
  map: { width: '100%', height: 200 },
  candidateHeader: { alignItems: 'center', paddingTop: SIZES.xl, paddingBottom: SIZES.lg, backgroundColor: colors.card },
  candidateAvatar: { width: 120, height: 120, borderRadius: 60, ...(isDark ? {} : SHADOWS.medium) },
  cvBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primary, padding: SIZES.md, borderRadius: SIZES.radius_lg, marginTop: 20 },
  cvText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  cvSubtext: { color: '#FFFFFFCC', fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 },
  badgeSmall: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
  badgeTextSmall: { fontSize: 11, fontWeight: 'bold' },
  chatIconBtn: { backgroundColor: colors.primary + '10', padding: 8, borderRadius: 20, justifyContent: 'center' },
  actionFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SIZES.lg, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  btnRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, padding: 14, borderRadius: SIZES.radius, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnComplete: { backgroundColor: '#FFD700' }, 
  btnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  btnReject: { backgroundColor: colors.reject },
  btnAccept: { backgroundColor: '#3498db' },
  btnHire: { backgroundColor: colors.accept },
  statusBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.accept, padding: 14, borderRadius: SIZES.radius },
  bannerText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  interviewDateText: { marginTop: 12, fontSize: 13, color: colors.primary, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.card, width: '100%', borderRadius: SIZES.radius_lg, padding: SIZES.xl, gap: 15 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  modalSubtitle: { fontSize: 14, color: colors.textLight },
  modalInput: { backgroundColor: colors.inputBackground, padding: SIZES.md, borderRadius: SIZES.radius, color: colors.text, fontSize: 18, textAlign: 'center' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalCancel: { flex: 1, padding: 12, alignItems: 'center' },
  modalSubmit: { flex: 2, backgroundColor: colors.primary, padding: 12, borderRadius: SIZES.radius, alignItems: 'center' },
  cancelText: { color: colors.textLight, fontWeight: '600' },
  submitText: { color: '#FFFFFF', fontWeight: 'bold' },
});
