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
import { SIZES, SHADOWS, type } from '../../constants/theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainNavigator';
import { Ionicons } from '@expo/vector-icons';
import { pickAndUploadImage } from '../../utils/uploadImage';
import * as DocumentPicker from 'expo-document-picker';
import { FadeInUp, PressScale } from '../../components/common/Animated';

type Props = { navigation: NativeStackNavigationProp<MainStackParamList, 'EditProfile'>; };

export default function EditProfileScreen({ navigation }: Props) {
  const { userProfile, refreshProfile } = useAuth();
  const { colors, isDark } = useTheme();

  const [loading, setLoading] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');

  const [uploadingCV, setUploadingCV] = useState(false);
  const [cvProgress, setCvProgress] = useState(0);
  const [resumeURL, setResumeURL] = useState(userProfile?.resumeURL || '');
  const [cvFileName, setCvFileName] = useState('');

  const [name, setName] = useState(userProfile?.name || '');
  const [bio, setBio] = useState(userProfile?.bio || userProfile?.companyDescription || '');
  const [city, setCity] = useState(userProfile?.city || userProfile?.location || '');
  const [role, setRole] = useState(userProfile?.profession || userProfile?.industry || '');
  const [jobDescription, setJobDescription] = useState(userProfile?.jobDescription || '');
  const [skillsText, setSkillsText] = useState(userProfile?.skills?.join(', ') || '');

  const isSearching = userProfile?.userType === 'Searching';
  const styles = makeStyles(colors, isDark);

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
        Alert.alert('Foto actualizada');
      }
    } finally {
      setUploadingPhoto(false);
      setPhotoProgress(0);
    }
  };

  const handlePickCV = async () => {
    if (!userProfile) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf', copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      setCvFileName(file.name);
      setUploadingCV(true);
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const storagePath = `cvs/${userProfile.uid}/${file.name}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: 'application/pdf' });
      uploadTask.on('state_changed',
        (snapshot) => setCvProgress(snapshot.bytesTransferred / snapshot.totalBytes),
        (error) => {
          console.error('CV upload error:', error);
          Alert.alert('Error', 'No se pudo subir el CV');
          setUploadingCV(false); setCvProgress(0);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setResumeURL(downloadURL);
          await updateDoc(doc(db, 'users', userProfile.uid), { resumeURL: downloadURL });
          await refreshProfile();
          setUploadingCV(false); setCvProgress(0);
          Alert.alert('CV subido', `Archivo: ${file.name}`);
        });
    } catch (err) {
      console.error('CV pick error:', err);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
      setUploadingCV(false);
    }
  };

  const handleViewCV = () => { if (resumeURL) Linking.openURL(resumeURL); };

  const handleSave = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'users', userProfile.uid);
      const skills = skillsText.split(',').map(s => s.trim()).filter(Boolean);
      const updateData = userProfile.userType === 'Searching'
        ? { name, bio, city, profession: role, jobDescription, skills }
        : { name, companyDescription: bio, location: city, industry: role };
      await updateDoc(docRef, updateData);
      await refreshProfile();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Alert.alert('Listo', 'Tu perfil fue actualizado.');
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 20}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <FadeInUp style={styles.photoSection}>
          <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto} style={styles.avatarContainer} activeOpacity={0.85}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={48} color={colors.textLight} />
              </View>
            )}
            <View style={styles.cameraOverlay}>
              {uploadingPhoto
                ? <ActivityIndicator color={isDark ? '#000' : '#fff'} size="small" />
                : <Ionicons name="camera" size={16} color={isDark ? '#000' : '#fff'} />}
            </View>
          </TouchableOpacity>
          {uploadingPhoto && (
            <Text style={styles.progressText}>Subiendo foto · {Math.round(photoProgress * 100)}%</Text>
          )}
          <Text style={styles.hint}>Toca para cambiar tu foto</Text>
        </FadeInUp>

        <FadeInUp delay={80}>
          <Field label={isSearching ? 'Nombre completo' : 'Nombre de la empresa'} value={name} onChangeText={setName} colors={colors} isDark={isDark} />
          <Field label={isSearching ? 'Profesión / cargo' : 'Sector / industria'} value={role} onChangeText={setRole} colors={colors} isDark={isDark} />
          <Field label={isSearching ? 'Ciudad' : 'Ubicación'} value={city} onChangeText={setCity} colors={colors} isDark={isDark} />

          {isSearching && (
            <Field
              label="Trabajo que buscas"
              value={jobDescription}
              onChangeText={setJobDescription}
              placeholder="Ej: Busco trabajo presencial en ventas…"
              colors={colors} isDark={isDark}
            />
          )}

          <Field
            label={`Acerca de ${isSearching ? 'mí' : 'la empresa'}`}
            value={bio} onChangeText={setBio}
            multiline numberOfLines={4}
            colors={colors} isDark={isDark}
          />

          {isSearching && (
            <>
              <Field
                label="Habilidades (separadas por coma)"
                value={skillsText}
                onChangeText={(t: string) => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setSkillsText(t);
                }}
                placeholder="Ej: Carpintería, Electricidad, Ventas"
                colors={colors} isDark={isDark}
              />

              <View style={styles.sectionDivider} />
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                <Text style={styles.sectionHeader}>Hoja de vida (PDF)</Text>
              </View>

              {resumeURL ? (
                <View style={styles.cvExisting}>
                  <View style={styles.cvIconBox}>
                    <Ionicons name="document-text" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.cvMeta}>
                    <Text style={styles.cvExistingText}>CV cargado</Text>
                    <Text style={styles.cvFileName} numberOfLines={1}>
                      {cvFileName || 'curriculum.pdf'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.cvViewBtn} onPress={handleViewCV} activeOpacity={0.8}>
                    <Ionicons name="open-outline" size={16} color={colors.primary} />
                    <Text style={styles.cvViewText}>Ver</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cvEmpty}>
                  <Ionicons name="cloud-upload-outline" size={32} color={colors.textLight} />
                  <Text style={styles.cvEmptyText}>Aún no has subido tu CV</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.cvUploadBtn, uploadingCV && styles.cvUploadBtnDisabled]}
                onPress={handlePickCV}
                disabled={uploadingCV}
                activeOpacity={0.85}
              >
                {uploadingCV ? (
                  <View style={styles.cvUploadingRow}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={styles.cvUploadingText}>Subiendo · {Math.round(cvProgress * 100)}%</Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                    <Text style={styles.cvUploadBtnText}>
                      {resumeURL ? 'Reemplazar CV' : 'Subir CV (PDF)'}
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

          <PressScale style={styles.saveButton} onPress={handleSave} disabled={loading}>
            {loading
              ? <ActivityIndicator color={isDark ? '#000' : '#fff'} />
              : <Text style={styles.saveButtonText}>Guardar cambios</Text>}
          </PressScale>
        </FadeInUp>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, numberOfLines, colors, isDark }: any) {
  const styles = makeStyles(colors, isDark);
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        multiline={multiline}
        numberOfLines={numberOfLines}
      />
    </>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: SIZES.lg, paddingBottom: SIZES.xxl },

  photoSection: { alignItems: 'center', marginBottom: SIZES.lg, paddingTop: SIZES.md },
  avatarContainer: { position: 'relative' },
  avatar: { width: 116, height: 116, borderRadius: 58, backgroundColor: colors.inputBackground, borderWidth: 2, borderColor: colors.border },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cameraOverlay: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: colors.primary, borderRadius: 18,
    width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.background,
  },
  progressText: { marginTop: SIZES.sm, ...type.caption, color: colors.primary },
  hint: { marginTop: 6, ...type.caption, color: colors.textLight },

  label: { ...type.small, color: colors.text, marginBottom: 8, marginTop: SIZES.md },
  input: {
    backgroundColor: colors.inputBackground,
    paddingHorizontal: SIZES.md, paddingVertical: 14,
    borderRadius: SIZES.radius, ...type.body, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
  },
  textArea: { height: 100, textAlignVertical: 'top' },

  sectionDivider: { height: 1, backgroundColor: colors.border, marginVertical: SIZES.lg },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SIZES.md },
  sectionHeader: { ...type.h3, color: colors.text },

  cvEmpty: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.inputBackground,
    borderRadius: SIZES.radius_lg, padding: SIZES.lg,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  cvEmptyText: { ...type.small, color: colors.textLight },

  cvExisting: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.md,
    backgroundColor: isDark ? 'rgba(232,197,108,0.08)' : 'rgba(10,10,10,0.04)',
    borderRadius: SIZES.radius_lg, padding: SIZES.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cvIconBox: {
    width: 44, height: 44, borderRadius: SIZES.radius,
    backgroundColor: isDark ? 'rgba(232,197,108,0.18)' : 'rgba(10,10,10,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  cvMeta: { flex: 1 },
  cvExistingText: { ...type.small, color: colors.primary },
  cvFileName: { ...type.caption, color: colors.textLight, marginTop: 2 },
  cvViewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: SIZES.radius_full, borderWidth: 1, borderColor: colors.border,
  },
  cvViewText: { ...type.caption, color: colors.primary },

  cvUploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: SIZES.radius_lg,
    paddingVertical: 14, marginTop: SIZES.md,
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed',
  },
  cvUploadBtnDisabled: { opacity: 0.5 },
  cvUploadBtnText: { ...type.button, color: colors.primary },
  cvUploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cvUploadingText: { ...type.button, color: colors.primary },

  progressBarTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: SIZES.sm, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },

  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16, borderRadius: SIZES.radius_full,
    alignItems: 'center', justifyContent: 'center',
    marginTop: SIZES.xl,
  },
  saveButtonText: { ...type.button, color: isDark ? '#000' : '#fff' },
});
