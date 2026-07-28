import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  StatusBar,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import { SIZES, SHADOWS, type, FONTS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { pickImageFromSource } from '../../utils/uploadImage';
import * as DocumentPicker from 'expo-document-picker';
import { FadeInUp, PressScale } from '../../components/common/Animated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useModal } from '../../context/ModalContext';

export default function CompleteProfileScreen() {
  const { userProfile, refreshProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const { showImagePicker, showAlert } = useModal();

  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');

  const [uploadingCV, setUploadingCV] = useState(false);
  const [cvProgress, setCvProgress] = useState(0);
  const [resumeURL, setResumeURL] = useState(userProfile?.resumeURL || '');
  const [cvFileName, setCvFileName] = useState('');

  const [name, setName] = useState(userProfile?.name || '');
  const [profession, setProfession] = useState(userProfile?.profession || userProfile?.industry || '');
  const [city, setCity] = useState(userProfile?.city || userProfile?.location || '');
  const [age, setAge] = useState(userProfile?.age ? String(userProfile.age) : '');
  const [jobDescription, setJobDescription] = useState(userProfile?.jobDescription || '');
  const [bio, setBio] = useState(userProfile?.bio || userProfile?.companyDescription || '');
  const [skillsText, setSkillsText] = useState(userProfile?.skills?.join(', ') || '');

  const isSearching = userProfile?.userType === 'Searching';
  const styles = makeStyles(colors, isDark);

  const handlePickPhoto = () => {
    if (!userProfile) return;
    showImagePicker({
      title: 'Foto de perfil',
      message: '¿De dónde deseas obtener la foto para tu perfil?',
      onCamera: () => processPhotoUpload(true),
      onGallery: () => processPhotoUpload(false),
    });
  };

  const processPhotoUpload = async (useCamera: boolean) => {
    if (!userProfile) return;
    setUploadingPhoto(true);
    try {
      const storagePath = `avatars/${userProfile.uid}/profile_${Date.now()}.jpg`;
      const { url, error } = await pickImageFromSource(useCamera, storagePath, (p) => setPhotoProgress(p));
      if (error) {
        showAlert({ title: 'Atención', message: error, type: 'warning' });
        return;
      }
      if (url) {
        setPhotoURL(url);
        showAlert({ title: 'Foto seleccionada', message: 'Tu foto de perfil se ha preparado correctamente.', type: 'success' });
      }
    } catch (err) {
      showAlert({ title: 'Error', message: 'No se pudo cargar la imagen de perfil.', type: 'error' });
    } finally {
      setUploadingPhoto(false);
      setPhotoProgress(0);
    }
  };

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
      const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: 'application/pdf' });
      uploadTask.on(
        'state_changed',
        (snapshot) => setCvProgress(snapshot.bytesTransferred / snapshot.totalBytes),
        (error) => {
          console.error('CV upload error:', error);
          showAlert({ title: 'Error', message: 'No se pudo subir la hoja de vida.', type: 'error' });
          setUploadingCV(false);
          setCvProgress(0);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setResumeURL(downloadURL);
          setUploadingCV(false);
          setCvProgress(0);
          showAlert({ title: 'CV cargado', message: `Archivo preparado: ${file.name}`, type: 'success' });
        }
      );
    } catch (err) {
      console.error('CV pick error:', err);
      showAlert({ title: 'Error', message: 'No se pudo seleccionar el archivo de CV.', type: 'error' });
      setUploadingCV(false);
    }
  };

  const handleSkip = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'users', userProfile.uid);
      await updateDoc(docRef, { onboardingPending: false });
      await refreshProfile();
    } catch (e) {
      console.error('Error skipping profile setup:', e);
      showAlert({ title: 'Error', message: 'No se pudo omitir en este momento.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'users', userProfile.uid);
      const skills = skillsText.split(',').map((s) => s.trim()).filter(Boolean);
      const parsedAge = age ? parseInt(age, 10) : undefined;

      const updateData = isSearching
        ? {
            name,
            photoURL: photoURL || null,
            resumeURL: resumeURL || null,
            profession,
            city,
            age: parsedAge || null,
            jobDescription,
            bio,
            skills,
            onboardingPending: false,
          }
        : {
            companyName: name,
            name: name,
            photoURL: photoURL || null,
            industry: profession,
            location: city,
            companyDescription: bio,
            onboardingPending: false,
          };

      await updateDoc(docRef, updateData);
      await refreshProfile();
    } catch (e) {
      console.error('Error completing profile:', e);
      showAlert({ title: 'Error', message: 'No se pudo guardar la información del perfil.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 20}
      >
        <View style={styles.topHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>PASO FINAL</Text>
            <Text style={styles.headerTitle}>Completa tu perfil</Text>
          </View>
          <TouchableOpacity
            style={styles.skipTopBtn}
            onPress={handleSkip}
            disabled={loading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.skipTopText}>Omitir</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <FadeInUp delay={60}>
            <Text style={styles.subtitle}>
              Suministra tus datos para destacar en las búsquedas o puedes omitir este paso y crear tu cuenta solo con tu información principal.
            </Text>
          </FadeInUp>

          {/* SECCIÓN DE FOTO DE PERFIL */}
          <FadeInUp delay={120} style={styles.photoSection}>
            <TouchableOpacity
              onPress={handlePickPhoto}
              disabled={uploadingPhoto}
              style={styles.avatarContainer}
              activeOpacity={0.85}
            >
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={44} color={colors.textLight} />
                </View>
              )}
              <View style={styles.cameraOverlay}>
                {uploadingPhoto ? (
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <Ionicons name="camera" size={16} color={colors.onPrimary} />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.photoHint}>Toca para añadir o cambiar tu foto de perfil</Text>
          </FadeInUp>

          {/* CAMPOS DE FORMULARIO DE PERFIL COMPLETO */}
          <FadeInUp delay={180}>
            <Text style={styles.label}>Nombre completo / Empresa</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={18} color={colors.textLight} />
              <TextInput
                style={styles.inputField}
                placeholder="Nombre completo"
                placeholderTextColor={colors.textLight}
                value={name}
                onChangeText={setName}
              />
            </View>
          </FadeInUp>

          <FadeInUp delay={240}>
            <Text style={styles.label}>{isSearching ? 'Profesión / cargo' : 'Industria / Área'}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="briefcase-outline" size={18} color={colors.textLight} />
              <TextInput
                style={styles.inputField}
                placeholder={isSearching ? 'Ej: Informática, Tecnología, Chef, Ventas...' : 'Ej: Gastronomía, Software...'}
                placeholderTextColor={colors.textLight}
                value={profession}
                onChangeText={setProfession}
              />
            </View>
          </FadeInUp>

          <FadeInUp delay={300}>
            <Text style={styles.label}>Ciudad / Ubicación</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="location-outline" size={18} color={colors.textLight} />
              <TextInput
                style={styles.inputField}
                placeholder="Ej: Bogotá, Medellín..."
                placeholderTextColor={colors.textLight}
                value={city}
                onChangeText={setCity}
              />
            </View>
          </FadeInUp>

          {isSearching && (
            <FadeInUp delay={340}>
              <Text style={styles.label}>Edad</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="calendar-outline" size={18} color={colors.textLight} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Ej: 25"
                  placeholderTextColor={colors.textLight}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                />
              </View>
            </FadeInUp>
          )}

          {isSearching && (
            <FadeInUp delay={380}>
              <Text style={styles.label}>Trabajo que buscas</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="search-outline" size={18} color={colors.textLight} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Ej: Busco trabajo presencial en ventas o servicio..."
                  placeholderTextColor={colors.textLight}
                  value={jobDescription}
                  onChangeText={setJobDescription}
                />
              </View>
            </FadeInUp>
          )}

          <FadeInUp delay={420}>
            <Text style={styles.label}>{isSearching ? 'Acerca de mí' : 'Descripción de la empresa'}</Text>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <TextInput
                style={[styles.inputField, styles.textArea]}
                placeholder={isSearching ? 'Cuenta un poco sobre tu experiencia y aspiraciones...' : 'Describe a tu empresa...'}
                placeholderTextColor={colors.textLight}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
              />
            </View>
          </FadeInUp>

          {isSearching && (
            <FadeInUp delay={460}>
              <Text style={styles.label}>Habilidades (separadas por coma)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="sparkles-outline" size={18} color={colors.textLight} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Ej: Carpintería, Electricidad, Ventas, React..."
                  placeholderTextColor={colors.textLight}
                  value={skillsText}
                  onChangeText={setSkillsText}
                />
              </View>
            </FadeInUp>
          )}

          {isSearching && (
            <FadeInUp delay={500} style={styles.cvSection}>
              <Text style={styles.label}>Hoja de vida (PDF)</Text>

              {resumeURL ? (
                <View style={styles.cvCard}>
                  <Ionicons name="document-text" size={24} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cvTitle} numberOfLines={1}>{cvFileName || 'Hoja de vida subida'}</Text>
                    <Text style={styles.cvSubtitle}>PDF listo en tu perfil</Text>
                  </View>
                  <TouchableOpacity onPress={() => Linking.openURL(resumeURL)}>
                    <Ionicons name="eye-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cvEmptyCard}>
                  <Ionicons name="cloud-upload-outline" size={28} color={colors.textLight} />
                  <Text style={styles.cvEmptyText}>Aún no has subido tu CV</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.uploadCvBtn}
                onPress={handlePickCV}
                disabled={uploadingCV}
                activeOpacity={0.8}
              >
                {uploadingCV ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={18} color={colors.primary} />
                    <Text style={styles.uploadCvText}>
                      {resumeURL ? 'Cambiar CV (PDF)' : 'Subir CV (PDF)'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </FadeInUp>
          )}

          {/* BOTONES DE ACCIÓN: GUARDAR vs OMITIR */}
          <FadeInUp delay={560} style={styles.actionButtons}>
            <PressScale
              style={[styles.saveButton, loading && { opacity: 0.7 }]}
              onPress={handleSaveAndContinue}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>Guardar y continuar</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
                </>
              )}
            </PressScale>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.skipButtonText}>
                Omitir por ahora (Crear solo con información principal)
              </Text>
            </TouchableOpacity>
          </FadeInUp>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SIZES.lg,
      paddingTop: SIZES.md,
      paddingBottom: SIZES.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    eyebrow: {
      ...type.overline,
      color: colors.primary,
      letterSpacing: 1.5,
    },
    headerTitle: {
      ...type.h1,
      color: colors.text,
    },
    skipTopBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: SIZES.radius_full,
      backgroundColor: isDark ? 'rgba(232,197,108,0.12)' : 'rgba(10,10,10,0.06)',
      borderWidth: 1,
      borderColor: colors.border,
    },
    skipTopText: {
      ...type.caption,
      color: colors.primary,
      fontFamily: FONTS.bold,
    },
    scrollContent: {
      padding: SIZES.lg,
      gap: 14,
      paddingBottom: 40,
    },
    subtitle: {
      ...type.body,
      color: colors.textLight,
      marginBottom: 6,
      lineHeight: 20,
    },
    photoSection: {
      alignItems: 'center',
      marginVertical: SIZES.sm,
    },
    avatarContainer: {
      position: 'relative',
      width: 96,
      height: 96,
      borderRadius: 48,
    },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
    },
    avatarPlaceholder: {
      backgroundColor: colors.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cameraOverlay: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    photoHint: {
      ...type.caption,
      color: colors.textLight,
      marginTop: 8,
    },
    label: {
      ...type.caption,
      color: colors.textLight,
      fontFamily: FONTS.semibold,
      marginBottom: 6,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: SIZES.radius_lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      height: 50,
      gap: 10,
    },
    inputField: {
      flex: 1,
      color: colors.text,
      fontFamily: FONTS.medium,
      fontSize: 15,
      paddingVertical: 0,
    },
    textAreaContainer: {
      height: 'auto',
      minHeight: 90,
      alignItems: 'flex-start',
      paddingVertical: 12,
    },
    textArea: {
      textAlignVertical: 'top',
    },
    cvSection: {
      marginTop: 6,
      gap: 8,
    },
    cvCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.card,
      padding: SIZES.md,
      borderRadius: SIZES.radius_lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cvTitle: {
      ...type.body,
      color: colors.text,
      fontFamily: FONTS.bold,
    },
    cvSubtitle: {
      ...type.caption,
      color: colors.textLight,
    },
    cvEmptyCard: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: SIZES.lg,
      backgroundColor: colors.inputBackground,
      borderRadius: SIZES.radius_lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      gap: 6,
    },
    cvEmptyText: {
      ...type.caption,
      color: colors.textLight,
    },
    uploadCvBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: SIZES.radius_full,
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderStyle: 'dashed',
    },
    uploadCvText: {
      ...type.button,
      color: colors.primary,
    },
    actionButtons: {
      marginTop: SIZES.lg,
      gap: 12,
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      height: 54,
      backgroundColor: colors.primary,
      borderRadius: SIZES.radius_full,
      ...(isDark ? {} : SHADOWS.medium),
    },
    saveButtonText: {
      ...type.button,
      color: colors.onPrimary,
      fontFamily: FONTS.bold,
    },
    skipButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
    },
    skipButtonText: {
      ...type.small,
      color: colors.textLight,
      textAlign: 'center',
      textDecorationLine: 'underline',
    },
  });
