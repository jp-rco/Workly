import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Text,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SHADOWS, type } from '../../constants/theme';

const { width } = Dimensions.get('window');
const TAB_BAR_WIDTH = width * 0.90;

const TabItem = ({
  route,
  isFocused,
  onPress,
  onLongPress,
  colors,
  badge,
}: {
  route: any;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  colors: any;
  badge?: number | string;
}) => {
  const scale = useRef(new Animated.Value(isFocused ? 1.2 : 1)).current;
  const translateY = useRef(new Animated.Value(isFocused ? -10 : 0)).current;
  const opacity = useRef(new Animated.Value(isFocused ? 1 : 0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: isFocused ? 1.3 : 1,
        useNativeDriver: true,
        friction: 5,
        tension: 100,
      }),
      Animated.spring(translateY, {
        toValue: isFocused ? -12 : 0,
        useNativeDriver: true,
        friction: 5,
        tension: 100,
      }),
      Animated.timing(opacity, {
        toValue: isFocused ? 1 : 0.6,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isFocused]);

  let iconName: keyof typeof Ionicons.glyphMap = 'home';
  if (route.name === 'Home') iconName = isFocused ? 'home' : 'home-outline';
  else if (route.name === 'Messages') iconName = isFocused ? 'chatbubbles' : 'chatbubbles-outline';
  else if (route.name === 'Matches') iconName = isFocused ? 'file-tray-full' : 'file-tray-full-outline';
  else if (route.name === 'Profile') iconName = isFocused ? 'person' : 'person-outline';
  else if (route.name === 'CreateJob') iconName = isFocused ? 'add-circle' : 'add-circle-outline';

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [{ scale }, { translateY }],
            opacity,
          },
        ]}
      >
        <Ionicons
          name={iconName}
          size={26}
          color={isFocused ? colors.primary : colors.textLight}
        />
        {badge !== undefined && badge !== 0 && (
          <View style={[styles.badge, { backgroundColor: colors.reject }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        {isFocused && (
          <View
            style={[
              styles.activeIndicator,
              { backgroundColor: colors.primary, shadowColor: colors.primary, elevation: 5 },
            ]}
          />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

export const CustomTabBar = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 15,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const badge = options.tabBarBadge;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
              colors={colors}
              badge={badge as any}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    width: TAB_BAR_WIDTH,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    position: 'absolute',
    bottom: -12,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0C0C0C', // Matching card color in dark
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
