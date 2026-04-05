import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Image, Linking,
  KeyboardAvoidingView, Platform, LayoutAnimation,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import { SIZES, SHADOWS } from '../../constants/theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainNavigator';
import { Ionicons } from '@expo/vector-icons';
import { pickAndUploadImage } from '../../utils/uploadImage';
import * as DocumentPicker from 'expo-document-picker';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'EditProfile'>;
};

export default function EditProfileScreen({ navigation }: Props) {
  const { userProfile, refreshProfile } = useAuth();
  const { colors, isDark } = useTheme();

  const [loading, setLoading] = useState(false);

  // Photo state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');

  // CV / Resume state
  const [uploadingCV, setUploadingCV] = useState(false);
  const [cvProgress, setCvProgress] = useState(0);
  const [resumeURL, setResumeURL] = useState(userProfile?.resumeURL || '');
  const [cvFileName, setCvFileName] = useState('');

  // Profile fields
  const [name, setName] = useState(userProfile?.name || '');
  const [bio, setBio] = useState(userProfile?.bio || userProfile?.companyDescription || '');
  const [city, setCity] = useState(userProfile?.city || userProfile?.location || '');
  const [role, setRole] = useState(userProfile?.profession || userProfile?.industry || '');
  const [jobDescription, setJobDescription] = useState(userProfile?.jobDescription || '');
  const [skillsText, setSkillsText] = useState(userProfile?.skills?.join(', ') || '');

  const isSearching = userProfile?.userType === 'Searching';

  const styles = makeStyles(colors, isDark);

  // ─────────────────────────────────────────────────────────
  // PHOTO UPLOAD
  // ─────────────────────────────────────────────────────────
  const handlePickPhoto = async () => {
    if (!userProfile) return;
    setUploadingPhoto(true);
    try {
      const storagePath = `avatars/${userProfile.uid}/profile_${Date.now()}.jpg`;
      const url = await pickAndUploadImage(storagePath, (p) => setPhotoProgress(p));
      if (url) {
        setPhotoURL(url);
        await updateDoc(doc(db, 'users', userProfile.uid), { photoURL: url });
        await refreshProfile();
        Alert.alert('✓ Foto actualizada');
      }
    } finally {
      setUploadingPhoto(false);
      setPhotoProgress(0);
    }
  };

  // ─────────────────────────────────────────────────────────
  // CV / PDF UPLOAD
  // ─────────────────────────────────────────────────────────
  const handlePickCV = async () => {
    if (!userProfile) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      setCvFileName(file.name);
      setUploadingCV(true);

      const response = await fetch(file.uri);
      const blob = await response.blob();

      const storagePath = `cvs/${userProfile.uid}/${file.name}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, blob, {
        contentType: 'application/pdf',
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          setCvProgress(snapshot.bytesTransferred / snapshot.totalBytes);
        },
        (error) => {
          console.error('CV upload error:', error);
          Alert.alert('Error', 'No se pudo subir el CV');
          setUploadingCV(false);
          setCvProgress(0);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setResumeURL(downloadURL);

          await updateDoc(doc(db, 'users', userProfile.uid), { resumeURL: downloadURL });
          await refreshProfile();

          setUploadingCV(false);
          setCvProgress(0);
          Alert.alert('✓ CV subido correctamente', `Archivo: ${file.name}`);
        }
      );
    } catch (err) {
      console.error('CV pick error:', err);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
      setUploadingCV(false);
    }
  };

  const handleViewCV = () => {
    if (resumeURL) Linking.openURL(resumeURL);
  };

  const handleSave = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'users', userProfile.uid);
      const skills = skillsText.split(',').map(s => s.trim()).filter(Boolean);

      const updateData =
        userProfile.userType === 'Searching'
          ? { name, bio, city, profession: role, jobDescription, skills }
          : { name, companyDescription: bio, location: city, industry: role };

      await updateDoc(docRef, updateData);
      await refreshProfile();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 20}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto} style={styles.avatarContainer}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={48} color={colors.textLight} />
              </View>
            )}
            <View style={styles.cameraOverlay}>
              {uploadingPhoto
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Ionicons name="camera" size={18} color={colors.white} />}
            </View>
          </TouchableOpacity>
          {uploadingPhoto && (
            <Text style={styles.progressText}>Subiendo foto… {Math.round(photoProgress * 100)}%</Text>
          )}
          <Text style={styles.hint}>Toca para cambiar foto de perfil</Text>
        </View>

        <Text style={styles.label}>{isSearching ? 'Nombre Completo' : 'Nombre de la Empresa'}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.textLight} />

        <Text style={styles.label}>{isSearching ? 'Profesión / Cargo' : 'Sector / Industria'}</Text>
        <TextInput style={styles.input} value={role} onChangeText={setRole} placeholderTextColor={colors.textLight} />

        <Text style={styles.label}>{isSearching ? 'Ciudad' : 'Ubicación'}</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholderTextColor={colors.textLight} />

        {isSearching && (
          <>
            <Text style={styles.label}>Descripción del trabajo buscado</Text>
            <TextInput
              style={styles.input}
              value={jobDescription}
              onChangeText={setJobDescription}
              placeholder="Ej: Busco trabajo presencial en ventas..."
              placeholderTextColor={colors.textLight}
            />
          </>
        )}

        <Text style={styles.label}>Acerca de {isSearching ? 'mí' : 'la empresa'}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          placeholderTextColor={colors.textLight}
        />

        {isSearching && (
          <>
            <Text style={styles.label}>Habilidades (separa por comas)</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={skillsText}
              onChangeText={(t) => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSkillsText(t);
              }}
              placeholder="Ej: Carpintería, Electricidad, Ventas"
              placeholderTextColor={colors.textLight}
            />

            <View style={styles.sectionDivider} />
            <Text style={styles.sectionHeader}>
              <Ionicons name="document-text" size={16} color={colors.primary} /> {' '}
              Hoja de Vida (CV)
            </Text>

            {resumeURL ? (
              <View style={styles.cvExisting}>
                <View style={styles.cvIconBox}>
                  <Ionicons name="document-text" size={28} color={colors.primary} />
                </View>
                <View style={styles.cvMeta}>
                  <Text style={styles.cvExistingText}>CV cargado</Text>
                  <Text style={styles.cvFileName} numberOfLines={1}>
                    {cvFileName || 'curriculum.pdf'}
                  </Text>
                </View>
                <TouchableOpacity style={styles.cvViewBtn} onPress={handleViewCV}>
                  <Ionicons name="eye-outline" size={18} color={colors.primary} />
                  <Text style={styles.cvViewText}>Ver</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cvEmpty}>
                <Ionicons name="document-outline" size={36} color={colors.border} />
                <Text style={styles.cvEmptyText}>Aún no has subido tu CV</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.cvUploadBtn, uploadingCV && styles.cvUploadBtnDisabled]}
              onPress={handlePickCV}
              disabled={uploadingCV}
            >
              {uploadingCV ? (
                <View style={styles.cvUploadingRow}>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={styles.cvUploadingText}>
                    Subiendo… {Math.round(cvProgress * 100)}%
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                  <Text style={styles.cvUploadBtnText}>
                    {resumeURL ? 'Reemplazar CV (PDF)' : 'Subir CV (PDF)'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {uploadingCV && (
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${Math.round(cvProgress * 100)}%` }]} />
              </View>
            )}
          </>
        )}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.saveButtonText}>Guardar Cambios</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: SIZES.lg, paddingBottom: SIZES.xxl },

  photoSection: { alignItems: 'center', marginBottom: SIZES.lg, paddingTop: SIZES.md },
  avatarContainer: { position: 'relative' },
  avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.inputBackground },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: colors.primary, borderRadius: 16,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.white, ...SHADOWS.light,
  },
  progressText: { marginTop: SIZES.xs, fontSize: 12, color: colors.primary, fontWeight: '600' },
  hint: { marginTop: SIZES.xs, fontSize: 12, color: colors.textLight },

  label: { fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: SIZES.xs, marginTop: SIZES.md },
  input: { backgroundColor: colors.inputBackground, padding: SIZES.md, borderRadius: SIZES.radius, fontSize: 15, color: colors.text, borderWidth: isDark ? 1 : 0, borderColor: colors.border },
  textArea: { height: 100, textAlignVertical: 'top' },

  sectionDivider: { height: 1, backgroundColor: colors.border, marginVertical: SIZES.lg },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: SIZES.md },

  cvEmpty: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.inputBackground,
    borderRadius: SIZES.radius, padding: SIZES.lg,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  cvEmptyText: { color: colors.textLight, fontSize: 14 },

  cvExisting: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.md,
    backgroundColor: colors.primary + '10',
    borderRadius: SIZES.radius, padding: SIZES.md,
    borderWidth: 1, borderColor: colors.primary + '40',
  },
  cvIconBox: {
    width: 48, height: 48, borderRadius: SIZES.radius,
    backgroundColor: colors.primary + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  cvMeta: { flex: 1 },
  cvExistingText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  cvFileName: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  cvViewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.card, paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: colors.primary,
  },
  cvViewText: { color: colors.primary, fontSize: 13, fontWeight: '600' },

  cvUploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: SIZES.radius_lg,
    padding: SIZES.md, marginTop: SIZES.md,
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed',
  },
  cvUploadBtnDisabled: { opacity: 0.6 },
  cvUploadBtnText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  cvUploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cvUploadingText: { color: colors.primary, fontWeight: '600', fontSize: 14 },

  progressBarTrack: {
    height: 4, backgroundColor: colors.border,
    borderRadius: 2, marginTop: SIZES.sm, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },

  saveButton: {
    backgroundColor: colors.primary, padding: SIZES.md,
    borderRadius: SIZES.radius_lg, alignItems: 'center', marginTop: SIZES.xl,
  },
  saveButtonText: { color: colors.white, fontSize: 16, fontWeight: 'bold' },
});
