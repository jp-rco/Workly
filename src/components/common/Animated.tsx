// src/components/common/AnimatedView.tsx
// Wrappers ligeros usando Animated nativo de React Native (sin nuevas dependencias).
// FadeInUp anima opacidad + translación. Press provee escalado táctil.

import React, { useEffect, useRef } from 'react';
import {
  Animated, Pressable, ViewStyle, StyleProp, PressableProps,
} from 'react-native';

interface FadeInUpProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

export const FadeInUp: React.FC<FadeInUpProps> = ({
  children, delay = 0, duration = 420, offset = 14, style,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(offset)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration, delay, useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0, duration, delay, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY: translate }] }, style]}>
      {children}
    </Animated.View>
  );
};

interface PressScaleProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}

export const PressScale: React.FC<PressScaleProps> = ({
  children, style, scaleTo = 0.97, ...rest
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const onIn = () => Animated.spring(scale, {
    toValue: scaleTo, useNativeDriver: true, friction: 8, tension: 120,
  }).start();
  const onOut = () => Animated.spring(scale, {
    toValue: 1, useNativeDriver: true, friction: 6, tension: 80,
  }).start();

  return (
    <Pressable onPressIn={onIn} onPressOut={onOut} {...rest}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// Punto pulsante (para indicador "grabando")
export const Pulse: React.FC<{ color: string; size?: number }> = ({ color, size = 10 }) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.2] });
  return (
    <Animated.View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, opacity, transform: [{ scale }],
      }}
    />
  );
};
