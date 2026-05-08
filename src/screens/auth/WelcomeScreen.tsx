import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useTheme } from '../../context/ThemeContext';
import { SIZES } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FadeInUp, PressScale } from '../../components/common/Animated';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
};

const { width } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors, isDark);

  // Halo dorado que respira detrás del logo
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [glow]);

  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.12] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Decoración: halo dorado */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      />
      <View pointerEvents="none" style={styles.gridDot1} />
      <View pointerEvents="none" style={styles.gridDot2} />
      <View pointerEvents="none" style={styles.gridDot3} />

      <View style={styles.content}>
        <View style={styles.logoContainer}>

          <FadeInUp delay={220}>
            <Text style={styles.logoText}>Workly</Text>
          </FadeInUp>

          <FadeInUp delay={320}>
            <View style={styles.divider} />
          </FadeInUp>

          <FadeInUp delay={400}>
            <Text style={styles.subtitle}>
              Encuentra el trabajo ideal{'\n'}a un{' '}
              <Text style={styles.subtitleAccent}>swipe</Text> de distancia.
            </Text>
          </FadeInUp>
        </View>

        <View style={styles.buttonContainer}>
          <FadeInUp delay={520}>
            <PressScale
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Register', { type: 'Searching' })}
            >
              <Text style={styles.primaryButtonText}>Crear cuenta nueva</Text>
            </PressScale>
          </FadeInUp>

          <FadeInUp delay={620}>
            <PressScale
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.secondaryButtonText}>Iniciar Sesión</Text>
            </PressScale>
          </FadeInUp>

          <FadeInUp delay={720}>
            <Text style={styles.legal}>
              Al continuar aceptas nuestros{' '}
              <Text style={styles.legalLink}>Términos</Text> y{' '}
              <Text style={styles.legalLink}>Privacidad</Text>.
            </Text>
          </FadeInUp>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    glow: {
      position: 'absolute',
      top: -width * 0.25,
      alignSelf: 'center',
      width: width * 1.4,
      height: width * 1.4,
      borderRadius: width,
      backgroundColor: colors.primary,
    },
    gridDot1: {
      position: 'absolute',
      top: 120,
      left: 30,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
      opacity: 0.5,
    },
    gridDot2: {
      position: 'absolute',
      top: 220,
      right: 50,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      opacity: 0.35,
    },
    gridDot3: {
      position: 'absolute',
      top: 80,
      right: 120,
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.primary,
      opacity: 0.6,
    },
    content: {
      flex: 1,
      paddingHorizontal: SIZES.lg,
      paddingVertical: SIZES.xl,
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logoContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      marginBottom: SIZES.lg,
    },
    badgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      marginRight: 8,
    },
    badgeText: {
      fontFamily: 'PlusJakartaSans_500Medium',
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.textLight,
    },
    logoText: {
      fontFamily: 'PlusJakartaSans_800ExtraBold',
      fontSize: 72,
      color: colors.text,
      letterSpacing: -3,
      lineHeight: 76,
    },
    divider: {
      width: 48,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.primary,
      marginTop: SIZES.md,
      marginBottom: SIZES.lg,
      alignSelf: 'center',
    },
    subtitle: {
      fontFamily: 'PlusJakartaSans_400Regular',
      fontSize: 17,
      color: colors.textLight,
      textAlign: 'center',
      lineHeight: 26,
      paddingHorizontal: SIZES.md,
    },
    subtitleAccent: {
      fontFamily: 'PlusJakartaSans_700Bold',
      color: colors.primary,
    },
    buttonContainer: {
      width: '100%',
      paddingBottom: SIZES.md,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: SIZES.radius_lg,
      alignItems: 'center',
      marginBottom: SIZES.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 18,
      elevation: 6,
    },
    primaryButtonText: {
      color: '#000000',
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 16,
      letterSpacing: 0.2,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      paddingVertical: 18,
      borderRadius: SIZES.radius_lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      color: colors.text,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontSize: 16,
    },
    legal: {
      marginTop: SIZES.lg,
      textAlign: 'center',
      fontFamily: 'PlusJakartaSans_400Regular',
      fontSize: 12,
      color: colors.textLight,
      lineHeight: 18,
    },
    legalLink: {
      fontFamily: 'PlusJakartaSans_600SemiBold',
      color: colors.text,
    },
  });
