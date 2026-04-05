import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Image, Modal,
  KeyboardAvoidingView, LayoutAnimation,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { SIZES, SHADOWS } from '../../constants/theme';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../../navigation/MainNavigator';
import { Ionicons } from '@expo/vector-icons';
import { pickAndUploadImage } from '../../utils/uploadImage';
import MapPickerScreen, { PickedLocation } from './MapPickerScreen';
import { Platform } from 'react-native';
import MapView, { Marker } from '../../components/common/AppMap';

type Props = {
  navigation: BottomTabNavigationProp<MainTabParamList, 'CreateJob'>;
};

export default function CreateJobScreen({ navigation }: Props) {
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [pay, setPay] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [jobSubType, setJobSubType] = useState<'formal' | 'informal'>('formal');

  const styles = makeStyles(colors, isDark);

  const handlePickImage = async () => {
    if (!userProfile) return;
    setUploadingImage(true);
    try {
      const storagePath = `jobImages/${userProfile.uid}/job_${Date.now()}.jpg`;
      const url = await pickAndUploadImage(storagePath, (p) => setUploadProgress(p));
      if (url) setImageUrl(url);
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
    }
  };

  const handlePostJob = async () => {
    if (!title.trim() || !description.trim() || !duration.trim() || !pay.trim()) {
      Alert.alert('Error', 'Por favor completa los campos: título, descripción, duración y salario');
      return;
    }
    if (!location) {
      Alert.alert('Error', 'Por favor selecciona la ubicación en el mapa');
      return;
    }

    setLoading(true);
    try {
      const requirements = requirementsText
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      await addDoc(collection(db, 'jobs'), {
        ownerUid: userProfile?.uid,
        title: title.trim(),
        description: description.trim(),
        duration: duration.trim(),
        pay: pay.trim(),
        requirements,
        imageUrl,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        jobSubType: jobSubType,
        createdAt: serverTimestamp(),
        status: 'active',
      });

      Alert.alert('¡Éxito!', 'Oferta de trabajo publicada correctamente', [
        { text: 'OK', onPress: () => { resetForm(); navigation.navigate('Home'); } },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo publicar la oferta');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setDuration('');
    setPay(''); setRequirementsText(''); setImageUrl(''); setLocation(null);
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.pageTitle}>Publicar Vacante</Text>

        <Text style={styles.label}>Imagen del trabajo</Text>
        <TouchableOpacity style={styles.imagePickerArea} onPress={handlePickImage} disabled={uploadingImage}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.jobImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={40} color={colors.textLight} />
              <Text style={styles.imagePlaceholderText}>Toca para añadir foto</Text>
            </View>
          )}
          {uploadingImage && (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator color="#FFFFFF" size="large" />
              <Text style={styles.uploadText}>{Math.round(uploadProgress * 100)}%</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Tipo de Trabajo *</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, jobSubType === 'formal' && styles.activeTab]} 
            onPress={() => setJobSubType('formal')}
          >
            <Ionicons name="briefcase" size={18} color={jobSubType === 'formal' ? '#FFFFFF' : colors.textLight} />
            <Text style={[styles.tabText, jobSubType === 'formal' && styles.activeTabText]}>Formal</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, jobSubType === 'informal' && styles.activeTab]} 
            onPress={() => setJobSubType('informal')}
          >
            <Ionicons name="construct" size={18} color={jobSubType === 'informal' ? '#FFFFFF' : colors.textLight} />
            <Text style={[styles.tabText, jobSubType === 'informal' && styles.activeTabText]}>Informal</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Título del Cargo *</Text>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Ej: Vendedor de carritos"
          placeholderTextColor={colors.textLight}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Descripción *</Text>
        <TextInput
          style={[styles.input, styles.textArea, { color: colors.text }]}
          placeholder="Describe el trabajo, responsabilidades..."
          placeholderTextColor={colors.textLight}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
        />

        <Text style={styles.label}>Duración / Horario *</Text>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Ej: 8 horas diarias, Lun-Vie"
          placeholderTextColor={colors.textLight}
          value={duration}
          onChangeText={setDuration}
        />

        <Text style={styles.label}>Salario / Paga *</Text>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Ej: 5.000.000"
          placeholderTextColor={colors.textLight}
          value={pay}
          onChangeText={setPay}
          keyboardType="default"
        />

        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Ej: Bonito, elegante, inteligente..."
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

        <Text style={styles.label}>Ubicación *</Text>
        <TouchableOpacity style={styles.locationBtn} onPress={() => setShowMapPicker(true)}>
          <Ionicons name="map" size={20} color={colors.primary} />
          {location ? (
            <Text style={styles.locationText} numberOfLines={2}>{location.address}</Text>
          ) : (
            <Text style={styles.locationPlaceholder}>Toca para seleccionar en el mapa</Text>
          )}
          <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
        </TouchableOpacity>
        {location && (
          <View style={styles.mapPreviewContainer}>
            <MapPickerPreview
              latitude={location.latitude}
              longitude={location.longitude}
              styles={styles}
            />
          </View>
        )}

        <TouchableOpacity style={styles.submitButton} onPress={handlePostJob} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}> Publicar Trabajo</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>
);
}

function MapPickerPreview({ latitude, longitude, styles }: { latitude: number; longitude: number, styles: any }) {
  return (
    <MapView
      style={styles.mapPreview}
      scrollEnabled={false}
      zoomEnabled={false}
      initialRegion={{ latitude, longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
    >
      <Marker coordinate={{ latitude, longitude }} />
    </MapView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: SIZES.lg, paddingBottom: SIZES.xxl },
  card: {
    backgroundColor: colors.card, padding: SIZES.xl,
    borderRadius: SIZES.radius_lg, borderWidth: isDark ? 1 : 0, borderColor: colors.border,
    ...(isDark ? {} : SHADOWS.light),
  },
  pageTitle: {
    fontSize: 26, fontWeight: 'bold', color: colors.text, marginBottom: SIZES.lg,
  },
  tabContainer: {
    flexDirection: 'row', gap: 10, marginBottom: SIZES.md,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: SIZES.radius, backgroundColor: colors.inputBackground,
    borderWidth: 1, borderColor: colors.border,
  },
  activeTab: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  tabText: {
    fontSize: 14, fontWeight: '600', color: colors.textLight,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  label: {
    fontSize: 14, fontWeight: '600', color: colors.text,
    marginBottom: SIZES.xs, marginTop: SIZES.md,
  },
  input: {
    backgroundColor: colors.inputBackground, padding: SIZES.md,
    borderRadius: SIZES.radius, fontSize: 15, color: colors.text,
  },
  textArea: { height: 110, textAlignVertical: 'top' },
  imagePickerArea: {
    height: 180, borderRadius: SIZES.radius, overflow: 'hidden',
    backgroundColor: colors.inputBackground, marginBottom: SIZES.xs,
    position: 'relative',
  },
  jobImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  imagePlaceholderText: { color: colors.textLight, fontSize: 13 },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  uploadText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SIZES.xs },
  tag: {
    backgroundColor: colors.primary + '20', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20,
  },
  tagText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.inputBackground, padding: SIZES.md,
    borderRadius: SIZES.radius,
  },
  locationText: { flex: 1, fontSize: 14, color: colors.text },
  locationPlaceholder: { flex: 1, fontSize: 14, color: colors.textLight },
  mapPreviewContainer: { marginTop: SIZES.sm, borderRadius: SIZES.radius, overflow: 'hidden', borderWidth: isDark ? 1 : 0, borderColor: colors.border },
  mapPreview: { height: 140, width: '100%' },
  submitButton: {
    backgroundColor: colors.primary, padding: SIZES.md,
    borderRadius: SIZES.radius_lg, alignItems: 'center',
    marginTop: SIZES.xl, flexDirection: 'row', justifyContent: 'center',
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  requirementsSummary: {
    marginTop: SIZES.sm, gap: 4,
    backgroundColor: colors.primary + '05',
    padding: SIZES.sm, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: colors.primary + '15',
  },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  requirementItemText: { fontSize: 13, color: colors.textLight, fontStyle: 'italic' },
});
