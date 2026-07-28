// src/components/common/CustomModal.tsx
import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SIZES, FONTS } from '../../constants/theme';
import { PressScale } from './Animated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type ModalType = 'alert' | 'confirm' | 'role_switch' | 'image_picker';
export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

export interface ModalButtonConfig {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'cancel';
  icon?: string;
}

export interface CustomModalProps {
  visible: boolean;
  type?: ModalType;
  variant?: AlertVariant;
  title: string;
  message?: string;
  icon?: string;
  targetRoleName?: string;
  buttons?: ModalButtonConfig[];
  onDismiss: () => void;
  onSelectCamera?: () => void;
  onSelectGallery?: () => void;
}

export default function CustomModal({
  visible,
  type = 'alert',
  variant = 'info',
  title,
  message,
  icon,
  targetRoleName,
  buttons = [],
  onDismiss,
  onSelectCamera,
  onSelectGallery,
}: CustomModalProps) {
  const { colors, isDark } = useTheme();

  const backdropAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(contentAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(contentAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const styles = makeStyles(colors, isDark);

  const getVariantIcon = () => {
    if (icon) return icon;
    switch (variant) {
      case 'success':
        return 'checkmark-circle-outline';
      case 'error':
        return 'alert-circle-outline';
      case 'warning':
        return 'warning-outline';
      case 'info':
      default:
        return 'information-circle-outline';
    }
  };

  const getVariantColor = () => {
    switch (variant) {
      case 'success':
        return colors.accept;
      case 'error':
        return colors.reject;
      case 'warning':
        return colors.warning;
      case 'info':
      default:
        return colors.primary;
    }
  };

  const isBottomSheet = type === 'image_picker';

  const translateY = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isBottomSheet ? 300 : 40, 0],
  });

  const scale = isBottomSheet
    ? 1
    : contentAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.92, 1],
      });

  return (
    <Modal transparent visible={visible} onRequestClose={onDismiss} animationType="none">
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onDismiss}>
          <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            isBottomSheet ? styles.bottomSheetContainer : styles.cardContainer,
            {
              transform: isBottomSheet ? [{ translateY }] : [{ translateY }, { scale }],
            },
          ]}
        >
          {isBottomSheet ? (
            /* IMAGE PICKER BOTTOM SHEET */
            <View style={styles.sheetContent}>
              <View style={styles.handleBar} />

              <View style={styles.sheetHeader}>
                <View style={styles.sheetIconCircle}>
                  <Ionicons name="camera" size={24} color={colors.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>{title || 'Seleccionar foto'}</Text>

                  {message ? (
                    <Text style={styles.sheetSubtitle}>{message}</Text>
                  ) : (
                    <Text style={styles.sheetSubtitle}>
                      ¿De dónde deseas obtener la imagen?
                    </Text>
                  )}
                </View>

                <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
                  <Ionicons name="close" size={20} color={colors.textLight} />
                </TouchableOpacity>
              </View>

              <View style={styles.optionsList}>
                <TouchableOpacity
                  style={styles.optionCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    const cb = onSelectCamera;
                    onDismiss();
                    if (cb) setTimeout(cb, 100);
                  }}
                >
                  <View style={[styles.optionIconBadge, { backgroundColor: isDark ? 'rgba(232, 197, 108, 0.12)' : 'rgba(10, 10, 10, 0.06)' }]}>
                    <Ionicons name="camera-outline" size={22} color={colors.primary} />
                  </View>

                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Tomar Foto</Text>
                    <Text style={styles.optionDescription}>
                      Usa la cámara de tu dispositivo
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    const cb = onSelectGallery;
                    onDismiss();
                    if (cb) setTimeout(cb, 100);
                  }}
                >
                  <View style={[styles.optionIconBadge, { backgroundColor: isDark ? 'rgba(232, 197, 108, 0.12)' : 'rgba(10, 10, 10, 0.06)' }]}>
                    <Ionicons name="images-outline" size={22} color={colors.primary} />
                  </View>

                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Elegir de Galería</Text>
                    <Text style={styles.optionDescription}>
                      Selecciona una foto de tus archivos
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelSheetBtn} onPress={onDismiss} activeOpacity={0.7}>
                <Text style={styles.cancelSheetText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ) : type === 'role_switch' ? (
            /* ROLE SWITCH MODAL */
            <View style={styles.cardContent}>
              <View style={[styles.headerIconBadge, { backgroundColor: isDark ? 'rgba(232, 197, 108, 0.15)' : 'rgba(10, 10, 10, 0.08)' }]}>
                <Ionicons name="swap-horizontal" size={28} color={colors.primary} />
              </View>

              <Text style={styles.cardTitle}>Cambiar de perfil</Text>
              <Text style={styles.cardMessage}>
                ¿Deseas cambiar tu perfil activo a{' '}
                <Text style={{ fontFamily: FONTS.bold, color: colors.primary }}>
                  {targetRoleName || 'otro rol'}
                </Text>
                ?
              </Text>

              <View style={styles.rolePreviewContainer}>
                <View style={styles.rolePreviewBadge}>
                  <Ionicons name="sparkles" size={18} color={colors.primary} />
                  <Text style={styles.rolePreviewText}>{targetRoleName}</Text>
                </View>
              </View>

              <View style={styles.buttonRow}>
                {buttons.length > 0 ? (
                  buttons.map((btn, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.btn,
                        btn.style === 'cancel' || btn.style === 'outline' || btn.style === 'secondary'
                          ? styles.btnSecondary
                          : styles.btnPrimary,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        const cb = btn.onPress;
                        onDismiss();
                        if (cb) setTimeout(cb, 100);
                      }}
                    >
                      <Text
                        style={[
                          styles.btnText,
                          btn.style === 'cancel' || btn.style === 'outline' || btn.style === 'secondary'
                            ? styles.btnTextSecondary
                            : styles.btnTextPrimary,
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <>
                    <TouchableOpacity style={styles.btnSecondary} onPress={onDismiss} activeOpacity={0.7}>
                      <Text style={styles.btnTextSecondary}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnPrimary}
                      activeOpacity={0.7}
                      onPress={() => onDismiss()}
                    >
                      <Text style={styles.btnTextPrimary}>Cambiar</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ) : (
            /* GENERIC ALERT / CONFIRMATION MODAL */
            <View style={styles.cardContent}>
              <View
                style={[
                  styles.headerIconBadge,
                  {
                    backgroundColor: isDark
                      ? `${getVariantColor()}22`
                      : `${getVariantColor()}12`,
                  },
                ]}
              >
                <Ionicons name={getVariantIcon() as any} size={30} color={getVariantColor()} />
              </View>

              <Text style={styles.cardTitle}>{title}</Text>

              {message ? <Text style={styles.cardMessage}>{message}</Text> : null}

              <View style={styles.buttonRow}>
                {buttons.length > 0 ? (
                  buttons.map((btn, idx) => {
                    const isDestructive = btn.style === 'destructive';
                    const isCancel = btn.style === 'cancel' || btn.style === 'secondary' || btn.style === 'outline';

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.btn,
                          buttons.length === 1 && { width: '100%' },
                          isDestructive
                            ? styles.btnDestructive
                            : isCancel
                            ? styles.btnSecondary
                            : styles.btnPrimary,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          const cb = btn.onPress;
                          onDismiss();
                          if (cb) setTimeout(cb, 100);
                        }}
                      >
                        {btn.icon ? (
                          <Ionicons
                            name={btn.icon as any}
                            size={18}
                            color={isCancel ? colors.text : isDestructive ? '#FFF' : colors.onPrimary}
                            style={{ marginRight: 6 }}
                          />
                        ) : null}
                        <Text
                          style={[
                            styles.btnText,
                            isDestructive
                              ? styles.btnTextDestructive
                              : isCancel
                              ? styles.btnTextSecondary
                              : styles.btnTextPrimary,
                          ]}
                        >
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary, { width: '100%' }]}
                    activeOpacity={0.7}
                    onPress={onDismiss}
                  >
                    <Text style={styles.btnTextPrimary}>Entendido</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.70)',
    },
    cardContainer: {
      width: SCREEN_WIDTH - SIZES.lg * 2,
      maxWidth: 420,
      backgroundColor: colors.card,
      borderRadius: SIZES.radius_lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      elevation: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
    },
    cardContent: {
      padding: SIZES.lg,
      alignItems: 'center',
    },
    headerIconBadge: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SIZES.md,
    },
    cardTitle: {
      fontFamily: FONTS.bold,
      fontSize: 19,
      color: colors.text,
      textAlign: 'center',
      marginBottom: SIZES.xs,
    },
    cardMessage: {
      fontFamily: FONTS.regular,
      fontSize: 14,
      color: colors.textLight,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: SIZES.lg,
    },
    rolePreviewContainer: {
      width: '100%',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.inputBackground,
      borderRadius: SIZES.radius,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      marginBottom: SIZES.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rolePreviewBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rolePreviewText: {
      fontFamily: FONTS.semibold,
      fontSize: 15,
      color: colors.text,
    },
    buttonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      marginTop: 4,
    },
    btn: {
      flex: 1,
      height: 48,
      borderRadius: SIZES.radius,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    btnPrimary: {
      backgroundColor: colors.primary,
    },
    btnSecondary: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    btnDestructive: {
      backgroundColor: colors.reject,
    },
    btnText: {
      fontFamily: FONTS.semibold,
      fontSize: 15,
    },
    btnTextPrimary: {
      color: colors.onPrimary,
    },
    btnTextSecondary: {
      color: colors.text,
    },
    btnTextDestructive: {
      color: '#FFFFFF',
    },

    /* BOTTOM SHEET STYLES */
    bottomSheetContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.card,
      borderTopLeftRadius: SIZES.radius_xl,
      borderTopRightRadius: SIZES.radius_xl,
      borderTopWidth: 1,
      borderColor: colors.border,
      elevation: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      paddingBottom: Platform.OS === 'ios' ? 34 : SIZES.lg,
    },
    sheetContent: {
      paddingHorizontal: SIZES.lg,
      paddingTop: SIZES.sm,
    },
    handleBar: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: SIZES.md,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: SIZES.lg,
    },
    sheetIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(232, 197, 108, 0.12)' : 'rgba(10, 10, 10, 0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetTitle: {
      fontFamily: FONTS.bold,
      fontSize: 18,
      color: colors.text,
    },
    sheetSubtitle: {
      fontFamily: FONTS.regular,
      fontSize: 13,
      color: colors.textLight,
      marginTop: 2,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionsList: {
      gap: 10,
      marginBottom: SIZES.lg,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.inputBackground,
      borderRadius: SIZES.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    optionIconBadge: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionTextContainer: {
      flex: 1,
    },
    optionTitle: {
      fontFamily: FONTS.semibold,
      fontSize: 15,
      color: colors.text,
    },
    optionDescription: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textLight,
      marginTop: 2,
    },
    cancelSheetBtn: {
      height: 48,
      borderRadius: SIZES.radius,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelSheetText: {
      fontFamily: FONTS.semibold,
      fontSize: 15,
      color: colors.text,
    },
  });
