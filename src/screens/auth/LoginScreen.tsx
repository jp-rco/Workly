import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useTheme } from '../../context/ThemeContext';
import { SIZES } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { FadeInUp, PressScale } from '../../components/common/Animated';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa tu email y contraseña');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error de inicio de sesión', 'Credenciales inválidas o el usuario no existe.');
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.content}>
          <FadeInUp delay={80}>
            <Text style={styles.eyebrow}>BIENVENIDO</Text>
          </FadeInUp>
          <FadeInUp delay={160}>
            <Text style={styles.title}>
              Hola de{'\n'}
              <Text style={styles.titleAccent}>nuevo.</Text>
            </Text>
          </FadeInUp>
          <FadeInUp delay={240}>
            <Text style={styles.subtitle}>
              Inicia sesión para continuar donde lo dejaste.
            </Text>
          </FadeInUp>

          <View style={styles.form}>
            <FadeInUp delay={320}>
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

            <FadeInUp delay={400}>
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

            <FadeInUp delay={460}>
              <TouchableOpacity style={styles.forgotWrapper} activeOpacity={0.6}>
                <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            </FadeInUp>

            <FadeInUp delay={540}>
              <PressScale
                style={[styles.loginButton, loading && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
                    <Ionicons name="arrow-forward" size={18} color="#000" style={{ marginLeft: 6 }} />
                  </>
                )}
              </PressScale>
            </FadeInUp>
          </View>

          <FadeInUp delay={640}>
            <View style={styles.footer}>
              <Text style={styles.footerText}>¿No tienes cuenta? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register', { type: 'Searching' })}>
                <Text style={styles.footerLink}>Regístrate</Text>
              </TouchableOpacity>
            </View>
          </FadeInUp>
        </View>
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
    content: {
      flex: 1,
      paddingHorizontal: SIZES.lg,
      paddingTop: SIZES.lg,
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
    forgotWrapper: {
      alignSelf: 'flex-end',
      marginTop: -4,
      marginBottom: SIZES.md,
    },
    forgotText: {
      fontFamily: 'PlusJakartaSans_500Medium',
      fontSize: 13,
      color: colors.textLight,
    },
    loginButton: {
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
    loginButtonText: {
      color: '#000000',
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
