import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withTiming, 
  runOnJS
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { FONTS } from '../../constants/theme';

export interface ToastOptions {
  title: string;
  message?: string;
  type?: 'default' | 'success' | 'error' | 'message';
  icon?: keyof typeof Ionicons.glyphMap;
  duration?: number;
  onPress?: () => void;
}

interface CustomToastProps {
  visible: boolean;
  options: ToastOptions | null;
  onHide: () => void;
}

export const CustomToast: React.FC<CustomToastProps> = ({ visible, options, onHide }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  const translateY = useSharedValue(-150);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible && options) {
      // Show
      translateY.value = withSpring(insets.top + 10, {
        damping: 15,
        stiffness: 150,
        mass: 0.8
      });
      opacity.value = withTiming(1, { duration: 250 });

      // Auto hide
      const duration = options.duration || 4000;
      const hideTimeout = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(hideTimeout);
    } else {
      // Hide
      hideToast();
    }
  }, [visible, options]);

  const hideToast = () => {
    'worklet';
    translateY.value = withTiming(-150, { duration: 300 });
    opacity.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(onHide)();
      }
    });
  };

  if (!options) return null;

  const getIconAndColor = () => {
    if (options.icon) return { icon: options.icon, color: colors.primary };
    switch (options.type) {
      case 'success': return { icon: 'checkmark-circle', color: '#34C759' };
      case 'error': return { icon: 'alert-circle', color: '#FF3B30' };
      case 'message': return { icon: 'chatbubble-ellipses', color: colors.primary };
      default: return { icon: 'notifications', color: colors.primary };
    }
  };

  const { icon, color } = getIconAndColor();
  const bgColor = isDark ? colors.card : '#FFFFFF';
  const borderColor = isDark ? colors.border : '#E5E5E5';

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="box-none">
      <TouchableOpacity 
        style={[
          styles.toastCard, 
          { 
            backgroundColor: bgColor,
            borderColor: borderColor,
            shadowColor: '#000',
          }
        ]} 
        activeOpacity={0.8}
        onPress={() => {
          hideToast();
          options.onPress?.();
        }}
      >
        <View style={[styles.iconBadge, { backgroundColor: isDark ? `${color}20` : `${color}15` }]}>
          <Ionicons name={icon as any} size={22} color={color} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {options.title}
          </Text>
          {options.message ? (
            <Text style={[styles.message, { color: colors.textLight }]} numberOfLines={2}>
              {options.message}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: 16,
    elevation: 10,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    marginBottom: 2,
  },
  message: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
});
