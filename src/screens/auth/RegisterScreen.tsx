import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useTheme } from '../../context/ThemeContext';
import { SIZES } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { UserType } from '../../context/AuthContext';
import { FadeInUp, PressScale } from '../../components/common/Animated';
import { useModal } from '../../context/ModalContext';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
  route: any;
};

export default function RegisterScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme();
  const { showAlert } = useModal();
  const initialType = route.params?.type || 'Searching';
  const [userType, setUserType] = useState<'Searching' | 'Hiring'>(initialType);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<'name' | 'email' | 'password' | null>(null);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      showAlert({ title: 'Campos incompletos', message: 'Por favor completa todos los campos para registrarte.', type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userData = {
        uid: userCredential.user.uid,
        email,
        name,
        userType,
        createdAt: new Date().toISOString(),
        onboardingPending: true,
      };
      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
    } catch (error: any) {
      console.error(error);
      showAlert({ title: 'Error al registrar', message: 'Revisa la información o intenta con otro correo electrónico.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(colors, isDark);

  const TypeCard = ({
    type,
    icon,
    title,
    description,
  }: {
    type: UserType;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
  }) => {
    const active = userType === type;
    return (
      <PressScale
        style={[styles.typeCard, active && styles.typeCardActive]}
        onPress={() => setUserType(type)}
      >
        <View style={[styles.typeIconWrap, active && styles.typeIconWrapActive]}>
          <Ionicons name={icon} size={22} color={active ? colors.onPrimary : colors.textLight} />
        </View>
        <Text style={[styles.typeText, active && styles.typeTextActive]}>{title}</Text>
        <Text style={styles.typeDesc}>{description}</Text>
        {active && <View style={styles.typeCheck}>
          <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
        </View>}
      </PressScale>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 20}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <FadeInUp delay={80}>
            <Text style={styles.eyebrow}>EMPECEMOS</Text>
          </FadeInUp>
          <FadeInUp delay={160}>
            <Text style={styles.title}>
              Crea tu{'\n'}
              <Text style={styles.titleAccent}>cuenta.</Text>
            </Text>
          </FadeInUp>
          <FadeInUp delay={240}>
            <Text style={styles.subtitle}>Únete a Workly y comienza tu próxima oportunidad.</Text>
          </FadeInUp>

          <FadeInUp delay={320}>
            <Text style={styles.sectionLabel}>¿Qué buscas?</Text>
          </FadeInUp>

          <FadeInUp delay={380}>
            <View style={styles.typeSelector}>
              <TypeCard
                type="Searching"
                icon="search"
                title="Busco empleo"
                description="Encuentra ofertas hechas para ti"
              />
              <TypeCard
                type="Hiring"
                icon="briefcase"
                title="Contratar"
                description="Encuentra el talento ideal"
              />
            </View>
          </FadeInUp>

          <View style={styles.form}>
            <FadeInUp delay={460}>
              <Text style={styles.label}>Nombre completo / Empresa</Text>
              <View
                style={[
                  styles.inputContainer,
                  focused === 'name' && styles.inputContainerFocused,
                ]}
              >
                <Ionicons name="person-outline" size={18} color={colors.textLight} />
                <TextInput
                  style={styles.inputField}
                  placeholder={userType === 'Searching' ? 'Juan Pérez' : 'Tu Empresa Inc.'}
                  placeholderTextColor={colors.textLight}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </FadeInUp>

            <FadeInUp delay={520}>
              <Text style={styles.label}>Email</Text>
              <View
                style={[
                  styles.inputContainer,
                  focused === 'email' && styles.inputContainerFocused,
                ]}
              >
                <Ionicons name="mail-outline" size={18} color={colors.textLight} />
                <TextInput
                  style={styles.inputField}
                  placeholder="tu@email.com"
                  placeholderTextColor={colors.textLight}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </FadeInUp>

            <FadeInUp delay={580}>
              <Text style={styles.label}>Contraseña</Text>
              <View
                style={[
                  styles.inputContainer,
                  focused === 'password' && styles.inputContainerFocused,
                ]}
              >
                <Ionicons name="lock-closed-outline" size={18} color={colors.textLight} />
                <TextInput
                  style={styles.inputField}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textLight}
                  />
                </TouchableOpacity>
              </View>
            </FadeInUp>

            <FadeInUp delay={660}>
              <PressScale
                style={[styles.registerButton, loading && { opacity: 0.7 }]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <>
                    <Text style={styles.registerButtonText}>Crear Cuenta</Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} style={{ marginLeft: 6 }} />
                  </>
                )}
              </PressScale>
            </FadeInUp>
          </View>

          <FadeInUp delay={760}>
            <View style={styles.footer}>
              <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.footerLink}>Inicia Sesión</Text>
              </TouchableOpacity>
            </View>
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
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: SIZES.lg,
      marginTop: SIZES.sm,
    },
    scrollContent: {
      paddingHorizontal: SIZES.lg,
      paddingTop: SIZES.lg,
      paddingBottom: 130,
    },
    eyebrow: {
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontSize: 12,
      letterSpacing: 2,
      color: colors.primary,
      marginBottom: SIZES.sm,
    },
    title: {
      fontFamily: 'PlusJakartaSans_800ExtraBold',
      fontSize: 40,
      color: colors.text,
      letterSpacing: -1.2,
      lineHeight: 44,
      marginBottom: SIZES.sm,
    },
    titleAccent: {
      color: colors.primary,
    },
    subtitle: {
      fontFamily: 'PlusJakartaSans_400Regular',
      fontSize: 15,
      color: colors.textLight,
      marginBottom: SIZES.xl,
      lineHeight: 22,
    },
    sectionLabel: {
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontSize: 13,
      color: colors.textLight,
      marginBottom: 12,
      letterSpacing: 0.3,
    },
    typeSelector: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: SIZES.xl,
    },
    typeCard: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : colors.card,
      padding: SIZES.md,
      borderRadius: SIZES.radius_lg,
      borderWidth: 1,
      borderColor: colors.border,
      position: 'relative',
      overflow: 'hidden',
    },
    typeCardActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(232,197,108,0.08)' : colors.card,
    },
    typeIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    typeIconWrapActive: {
      backgroundColor: colors.primary,
    },
    typeText: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 15,
      color: colors.text,
      marginBottom: 4,
    },
    typeTextActive: {
      color: colors.text,
    },
    typeDesc: {
      fontFamily: 'PlusJakartaSans_400Regular',
      fontSize: 12,
      color: colors.textLight,
      lineHeight: 16,
    },
    typeCheck: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    form: {
      marginTop: SIZES.xs,
    },
    label: {
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontSize: 13,
      color: colors.textLight,
      marginBottom: 8,
      letterSpacing: 0.3,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.inputBackground,
      borderRadius: SIZES.radius,
      paddingHorizontal: 14,
      marginBottom: SIZES.md,
      borderWidth: 1,
      borderColor: colors.border,
      height: 54,
    },
    inputContainerFocused: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(232,197,108,0.06)' : colors.inputBackground,
    },
    inputField: {
      flex: 1,
      color: colors.text,
      fontFamily: 'PlusJakartaSans_500Medium',
      fontSize: 15,
      paddingVertical: 0,
    },
    registerButton: {
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: SIZES.radius_lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      marginTop: SIZES.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 6,
    },
    registerButtonText: {
      color: colors.onPrimary,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 16,
      letterSpacing: 0.2,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: SIZES.xl,
    },
    footerText: {
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.textLight,
      fontSize: 14,
    },
    footerLink: {
      fontFamily: 'PlusJakartaSans_700Bold',
      color: colors.primary,
      fontSize: 14,
    },
  });
