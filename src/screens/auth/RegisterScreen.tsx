import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useTheme } from '../../context/ThemeContext';
import { SIZES, SHADOWS } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { UserType } from '../../context/AuthContext';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
  route: any;
};

export default function RegisterScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const [userType, setUserType] = useState<UserType>('Searching');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      const userData = {
        uid: userCredential.user.uid,
        email: email,
        name: name,
        userType: userType,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userData);

    } catch (error: any) {
      console.error(error);
      Alert.alert('Error al registrar', 'Revisa la información o intenta con otro correo.');
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>Únete a Workly hoy mismo</Text>

        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeCard, userType === 'Searching' && styles.typeCardActive]}
            onPress={() => setUserType('Searching')}
          >
            <Ionicons name="search" size={32} color={userType === 'Searching' ? colors.primary : colors.textLight} />
            <Text style={[styles.typeText, userType === 'Searching' && styles.typeTextActive]}>Busco Empleo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeCard, userType === 'Hiring' && styles.typeCardActive]}
            onPress={() => setUserType('Hiring')}
          >
            <Ionicons name="briefcase" size={32} color={userType === 'Hiring' ? colors.primary : colors.textLight} />
            <Text style={[styles.typeText, userType === 'Hiring' && styles.typeTextActive]}>Contrato</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Nombre completo / Empresa</Text>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={userType === 'Searching' ? "Juan Pérez" : "Tu Empresa Inc."}
            placeholderTextColor={colors.textLight}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="tu@email.com"
            placeholderTextColor={colors.textLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.inputPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color={colors.textLight} 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.registerButtonText}>Crear Cuenta</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Inicia Sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: SIZES.lg,
    paddingTop: 0,
  },
  backButton: {
    padding: SIZES.md,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: SIZES.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textLight,
    marginBottom: SIZES.lg,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SIZES.xl,
  },
  typeCard: {
    flex: 1,
    backgroundColor: colors.card,
    padding: SIZES.lg,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: 'transparent',
    ...(isDark ? {} : SHADOWS.light),
  },
  typeCardActive: {
    borderColor: colors.primary,
  },
  typeText: {
    marginTop: SIZES.sm,
    fontSize: 14,
    color: colors.textLight,
    fontWeight: '500',
  },
  typeTextActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  form: {
    marginTop: SIZES.xs,
  },
  label: {
    fontSize: 14,
    color: colors.text,
    marginBottom: SIZES.xs,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.inputBackground,
    color: colors.text,
    padding: SIZES.md,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.md,
    fontSize: 16,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.md,
    marginBottom: SIZES.md,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
  },
  inputPassword: {
    flex: 1,
    color: colors.text,
    paddingVertical: SIZES.md,
    fontSize: 16,
  },
  registerButton: {
    backgroundColor: colors.primary,
    padding: SIZES.md,
    borderRadius: SIZES.radius_lg,
    alignItems: 'center',
    marginTop: SIZES.lg,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SIZES.xl,
    paddingBottom: SIZES.xxl,
  },
  footerText: {
    color: colors.textLight,
  },
  footerLink: {
    color: colors.primary,
    fontWeight: 'bold',
  },
});
