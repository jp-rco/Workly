import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Image, Modal,
  KeyboardAvoidingView, LayoutAnimation, Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { SIZES, SHADOWS, type, FONTS } from '../../constants/theme';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../../navigation/MainNavigator';
import { Ionicons } from '@expo/vector-icons';
import { pickImageFromSource } from '../../utils/uploadImage';
import MapPickerScreen, { PickedLocation } from './MapPickerScreen';
import MapView, { Marker } from '../../components/common/AppMap';
import { FadeInUp, PressScale } from '../../components/common/Animated';
import { formatSalaryNumber } from '../../utils/formatters';
import { useModal } from '../../context/ModalContext';

type Props = { navigation: BottomTabNavigationProp<MainTabParamList, 'CreateJob'>; };

const FREQUENCY_OPTIONS = [
  'Por trabajo',
  'Por hora',
  'Por día',
  'Por mes',
  'Otro',
];

export default function CreateJobScreen({ navigation }: Props) {
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const { showImagePicker, showAlert } = useModal();

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  
  const [payAmount, setPayAmount] = useState('');
  const [payFrequency, setPayFrequency] = useState('Por trabajo');
  const [customFrequency, setCustomFrequency] = useState('');
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);

  const [requirementsText, setRequirementsText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [jobSubType, setJobSubType] = useState<'formal' | 'informal'>('formal');

  const styles = makeStyles(colors, isDark);

  const handlePickImage = () => {
    if (!userProfile) return;
    showImagePicker({
      title: 'Imagen de la oferta',
      message: '¿De dónde deseas obtener la foto para la vacante?',
      onCamera: () => processJobImageUpload(true),
      onGallery: () => processJobImageUpload(false),
    });
  };

  const processJobImageUpload = async (useCamera: boolean) => {
    if (!userProfile) return;
    setUploadingImage(true);
    try {
      const storagePath = `jobImages/${userProfile.uid}/job_${Date.now()}.jpg`;
      const { url, error } = await pickImageFromSource(useCamera, storagePath, (p) => setUploadProgress(p));
      if (error) {
        showAlert({ title: 'Atención', message: error, type: 'warning' });
        return;
      }
      if (url) setImageUrl(url);
    } catch (e) {
      console.error('Job image upload error:', e);
      showAlert({ title: 'Error', message: 'No se pudo subir la imagen de la oferta.', type: 'error' });
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
    }
  };

  const handlePostJob = async () => {
    const frequencyLabel = payFrequency === 'Otro' ? (customFrequency.trim() || 'Otro') : payFrequency;
    const finalPay = payAmount.trim() ? `${payAmount.trim()} / ${frequencyLabel}` : frequencyLabel;

    if (!title.trim() || !description.trim() || !duration.trim() || !finalPay.trim()) {
      showAlert({
        title: 'Faltan datos',
        message: 'Por favor completa: título, descripción, duración y salario.',
        type: 'warning',
      });
      return;
    }
    if (!location) {
      showAlert({
        title: 'Ubicación requerida',
        message: 'Selecciona la ubicación exacta de la vacante en el mapa.',
        type: 'warning',
      });
      return;
    }
    setLoading(true);
    try {
      const requirements = requirementsText.split(',').map((r) => r.trim()).filter(Boolean);
      await addDoc(collection(db, 'jobs'), {
        ownerUid: userProfile?.uid,
        companyName: userProfile?.name || userProfile?.companyName || '',
        title: title.trim(), description: description.trim(),
        duration: duration.trim(), pay: finalPay.trim(),
        requirements, imageUrl,
        latitude: location.latitude, longitude: location.longitude,
        address: location.address,
        jobSubType,
        createdAt: serverTimestamp(), status: 'active',
      });
      showAlert({
        title: '¡Publicada!',
        message: 'Tu oferta laboral ya es visible para candidatos en la plataforma.',
        type: 'success',
        buttonText: 'Ver mis publicaciones',
        onConfirm: () => { resetForm(); navigation.navigate('Home'); },
      });
    } catch (e) {
      console.error(e);
      showAlert({ title: 'Error', message: 'No se pudo publicar la oferta laboral.', type: 'error' });
    } finally { setLoading(false); }
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setDuration('');
    setPayAmount(''); setPayFrequency('Por trabajo'); setCustomFrequency('');
    setRequirementsText(''); setImageUrl(''); setLocation(null);
  };

  if (showMapPicker) {
    return (
      <Modal visible animationType="slide">
        <MapPickerScreen
          onLocationPicked={(loc) => { setLocation(loc); setShowMapPicker(false); }}
          onCancel={() => setShowMapPicker(false)}
          initialLatitude={location?.latitude}
          initialLongitude={location?.longitude}
        />
      </Modal>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <FadeInUp>
          <Text style={styles.eyebrow}>NUEVA VACANTE</Text>
          <Text style={styles.pageTitle}>Publicar oferta</Text>
          <Text style={styles.pageSubtitle}>Llega al talento adecuado en minutos.</Text>
        </FadeInUp>

        <FadeInUp delay={80} style={styles.card}>
          <Text style={styles.label}>Imagen del trabajo</Text>
          <TouchableOpacity style={styles.imagePickerArea} onPress={handlePickImage} disabled={uploadingImage} activeOpacity={0.85}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.jobImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <View style={styles.imageIconWrap}>
                  <Ionicons name="image-outline" size={26} color={colors.primary} />
                </View>
                <Text style={styles.imagePlaceholderText}>Toca para añadir foto</Text>
                <Text style={styles.imagePlaceholderHint}>JPG · PNG · hasta 5MB</Text>
              </View>
            )}
            {uploadingImage && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator color="#FFFFFF" size="large" />
                <Text style={styles.uploadText}>{Math.round(uploadProgress * 100)}%</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Tipo de trabajo</Text>
          <View style={styles.tabContainer}>
            {(['formal', 'informal'] as const).map((t) => {
              const active = jobSubType === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.tab, active && styles.activeTab]}
                  onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setJobSubType(t); }}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={t === 'formal' ? 'briefcase' : 'construct'}
                    size={16}
                    color={active ? colors.onPrimary : colors.textLight}
                  />
                  <Text style={[styles.tabText, active && styles.activeTabText]}>
                    {t === 'formal' ? 'Formal' : 'Informal'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Field
            label="Título del cargo"
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Vendedor de carritos"
            colors={colors}
            isDark={isDark}
          />
          <Field
            label="Descripción"
            value={description}
            onChangeText={setDescription}
            placeholder="Describe el trabajo, responsabilidades…"
            multiline numberOfLines={5}
            colors={colors} isDark={isDark}
          />
          <Field
            label="Duración / horario"
            value={duration}
            onChangeText={setDuration}
            placeholder="Ej: 8 horas diarias, Lun–Vie"
            colors={colors} isDark={isDark}
          />

          {/* SECCIÓN DE SALARIO Y PERIODO ALINEADOS HORIZONTALMENTE */}
          <Text style={styles.label}>Salario / paga y periodo</Text>
          <View style={styles.payRowContainer}>
            {/* Recuadro 1: Valor en Números */}
            <View style={styles.payAmountBox}>
              <Text style={styles.currencyPrefix}>$</Text>
              <TextInput
                style={styles.payAmountInput}
                placeholder="Ej: 50.000"
                placeholderTextColor={colors.textLight}
                value={payAmount}
                onChangeText={(t: string) => setPayAmount(formatSalaryNumber(t))}
                keyboardType="numeric"
              />
            </View>

            {/* Recuadro 2: Combo Box / Selector de Frecuencia */}
            <TouchableOpacity
              style={styles.payFrequencyBox}
              onPress={() => setShowFrequencyModal(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.payFrequencyText} numberOfLines={1}>
                {payFrequency === 'Otro' ? (customFrequency || 'Otro...') : payFrequency}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Campo de texto libre cuando selecciona 'Otro' */}
          {payFrequency === 'Otro' && (
            <FadeInUp style={{ marginTop: 8 }}>
              <TextInput
                style={styles.input}
                placeholder="Escribe el periodo o condición (ej: Por comisión)"
                placeholderTextColor={colors.textLight}
                value={customFrequency}
                onChangeText={setCustomFrequency}
              />
            </FadeInUp>
          )}

          <Text style={styles.label}>Requisitos (separados por coma)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Bachiller, puntual, proactivo"
            placeholderTextColor={colors.textLight}
            value={requirementsText}
            onChangeText={(t) => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setRequirementsText(t);
            }}
          />
          {requirementsText.trim() !== '' && (
            <View style={styles.requirementsSummary}>
              {requirementsText.split(',').filter(r => r.trim()).map((r, i) => (
                <View key={i} style={styles.requirementRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                  <Text style={styles.requirementItemText} numberOfLines={1}>{r.trim()}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.label}>Ubicación</Text>
          <TouchableOpacity style={styles.locationBtn} onPress={() => setShowMapPicker(true)} activeOpacity={0.85}>
            <View style={styles.locationIconWrap}>
              <Ionicons name="map-outline" size={18} color={colors.primary} />
            </View>
            {location ? (
              <Text style={styles.locationText} numberOfLines={2}>{location.address}</Text>
            ) : (
              <Text style={styles.locationPlaceholder}>Toca para seleccionar en el mapa</Text>
            )}
            <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
          </TouchableOpacity>
          {location && (
            <View style={styles.mapPreviewContainer}>
              <MapView
                style={styles.mapPreview}
                scrollEnabled={false}
                zoomEnabled={false}
                initialRegion={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
              >
                <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} />
              </MapView>
            </View>
          )}

          <PressScale style={styles.submitButton} onPress={handlePostJob} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="rocket-outline" size={18} color={colors.onPrimary} />
                <Text style={styles.submitButtonText}>Publicar trabajo</Text>
              </>
            )}
          </PressScale>
        </FadeInUp>
      </ScrollView>

      {/* MODAL / COMBO BOX DE OPCIONES DE PERIODO DE PAGO */}
      <Modal visible={showFrequencyModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFrequencyModal(false)}
        >
          <View style={styles.frequencyModalCard}>
            <Text style={styles.frequencyModalTitle}>Periodo de pago</Text>
            {FREQUENCY_OPTIONS.map((opt) => {
              const selected = payFrequency === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.frequencyOption, selected && styles.frequencyOptionSelected]}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setPayFrequency(opt);
                    setShowFrequencyModal(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.frequencyOptionText, selected && styles.frequencyOptionTextSelected]}>
                    {opt}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChangeText, placeholder, multiline, numberOfLines, keyboardType, colors, isDark,
}: any) {
  const styles = makeStyles(colors, isDark);
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={numberOfLines}
        keyboardType={keyboardType}
      />
    </>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: SIZES.lg, paddingBottom: 140 },

  eyebrow: { ...type.overline, color: colors.primary, marginBottom: 6 },
  pageTitle: { ...type.display, color: colors.text },
  pageSubtitle: { ...type.body, color: colors.textLight, marginTop: 4, marginBottom: SIZES.lg },

  card: {
    backgroundColor: colors.card, padding: SIZES.lg,
    borderRadius: SIZES.radius_xl,
    borderWidth: 1, borderColor: colors.border,
    ...(isDark ? {} : SHADOWS.light),
  },

  tabContainer: { flexDirection: 'row', gap: 10, marginBottom: SIZES.sm },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: SIZES.radius_full,
    backgroundColor: colors.inputBackground,
    borderWidth: 1, borderColor: colors.border,
  },
  activeTab: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...type.button, color: colors.textLight },
  activeTabText: { color: colors.onPrimary },

  label: { ...type.small, color: colors.text, marginBottom: 8, marginTop: SIZES.md },

  input: {
    backgroundColor: colors.inputBackground,
    paddingHorizontal: SIZES.md, paddingVertical: 14,
    borderRadius: SIZES.radius, ...type.body, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
  },
  textArea: { height: 120, textAlignVertical: 'top' },

  // ESTILOS DE SALARIO Y PERIODO ALINEADOS HORIZONTALMENTE
  payRowContainer: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  payAmountBox: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    paddingHorizontal: SIZES.md,
    height: 50,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyPrefix: {
    ...type.body,
    color: colors.primary,
    fontFamily: FONTS.bold,
    marginRight: 4,
  },
  payAmountInput: {
    flex: 1,
    color: colors.text,
    fontFamily: FONTS.medium,
    fontSize: 15,
    paddingVertical: 0,
  },
  payFrequencyBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBackground,
    paddingHorizontal: SIZES.md,
    height: 50,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payFrequencyText: {
    flex: 1,
    ...type.body,
    color: colors.text,
    fontFamily: FONTS.semibold,
    marginRight: 4,
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  frequencyModalCard: {
    backgroundColor: colors.card,
    width: '85%',
    borderRadius: SIZES.radius_xl,
    padding: SIZES.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  frequencyModalTitle: {
    ...type.h2,
    color: colors.text,
    marginBottom: 8,
  },
  frequencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: SIZES.radius,
  },
  frequencyOptionSelected: {
    backgroundColor: isDark ? 'rgba(232,197,108,0.10)' : 'rgba(10,10,10,0.06)',
  },
  frequencyOptionText: {
    ...type.body,
    color: colors.text,
  },
  frequencyOptionTextSelected: {
    color: colors.primary,
    fontFamily: FONTS.bold,
  },

  imagePickerArea: {
    height: 180, borderRadius: SIZES.radius_lg, overflow: 'hidden',
    backgroundColor: colors.inputBackground,
    marginBottom: SIZES.xs, position: 'relative',
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  jobImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imageIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: isDark ? 'rgba(232,197,108,0.10)' : 'rgba(10,10,10,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  imagePlaceholderText: { ...type.bodyMd, color: colors.text },
  imagePlaceholderHint: { ...type.caption, color: colors.textLight },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  uploadText: { color: '#FFF', ...type.h2 },

  requirementsSummary: {
    marginTop: SIZES.sm, gap: 6,
    backgroundColor: isDark ? 'rgba(232,197,108,0.06)' : 'rgba(10,10,10,0.03)',
    padding: SIZES.sm, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: colors.border,
  },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requirementItemText: { ...type.small, color: colors.textLight, fontStyle: 'italic' },

  locationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.inputBackground,
    padding: SIZES.md, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: colors.border,
  },
  locationIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(232,197,108,0.10)' : 'rgba(10,10,10,0.05)',
  },
  locationText: { flex: 1, ...type.bodyMd, color: colors.text },
  locationPlaceholder: { flex: 1, ...type.body, color: colors.textLight },

  mapPreviewContainer: {
    marginTop: SIZES.sm, borderRadius: SIZES.radius_lg,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
  },
  mapPreview: { height: 150, width: '100%' },

  submitButton: {
    flexDirection: 'row', gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16, borderRadius: SIZES.radius_full,
    alignItems: 'center', justifyContent: 'center',
    marginTop: SIZES.xl,
  },
  submitButtonText: { ...type.button, color: colors.onPrimary },
});
