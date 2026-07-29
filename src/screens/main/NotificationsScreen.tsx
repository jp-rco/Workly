import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SIZES, SHADOWS, type } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainNavigator';
import { FadeInUp } from '../../components/common/Animated';
import { useModal } from '../../context/ModalContext';
import { NotificationItem } from '../../utils/notificationService';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const CATEGORIES = [
  { id: 'all', label: 'Todas' },
  { id: 'application', label: 'Postulaciones' },
  { id: 'status_change', label: 'Estados' },
  { id: 'message', label: 'Mensajes' },
  { id: 'like', label: 'Interés' },
];

function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Hace un momento';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Hace ${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Hace ${diffInHours}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Ayer';
  if (diffInDays < 7) return `Hace ${diffInDays}d`;
  return date.toLocaleDateString();
}

export default function NotificationsScreen() {
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { showConfirm, showAlert } = useModal();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    if (!userProfile?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userProfile.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as NotificationItem[];

        // Ordenar por fecha descendente
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setNotifications(list);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error('Error escuchando notificaciones:', error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.uid]);

  const onRefresh = () => {
    setRefreshing(true);
  };

  const handleMarkAsRead = async (item: NotificationItem) => {
    if (!item.id || item.read) return;
    try {
      await updateDoc(doc(db, 'notifications', item.id), { read: true });
    } catch (e) {
      console.error('Error al marcar como leída:', e);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadItems = notifications.filter((n) => !n.read);
    if (unreadItems.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadItems.forEach((n) => {
        if (n.id) {
          batch.update(doc(db, 'notifications', n.id), { read: true });
        }
      });
      await batch.commit();
    } catch (e) {
      console.error('Error al marcar todas como leídas:', e);
      showAlert({ title: 'Error', message: 'No se pudieron actualizar las notificaciones.', type: 'error' });
    }
  };

  const handleDeleteNotification = (item: NotificationItem) => {
    if (!item.id) return;
    showConfirm({
      title: 'Eliminar notificación',
      message: '¿Deseas borrar esta notificación de tu historial?',
      confirmText: 'Eliminar',
      confirmStyle: 'destructive',
      icon: 'trash-outline',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'notifications', item.id!));
        } catch (e) {
          console.error('Error al borrar notificación:', e);
        }
      },
    });
  };

  const handleClearAllHistory = () => {
    if (notifications.length === 0) return;
    showConfirm({
      title: 'Vaciar historial',
      message: '¿Deseas eliminar todas las notificaciones de tu registro?',
      confirmText: 'Vaciar todo',
      confirmStyle: 'destructive',
      icon: 'trash-bin-outline',
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);
          notifications.forEach((n) => {
            if (n.id) {
              batch.delete(doc(db, 'notifications', n.id));
            }
          });
          await batch.commit();
        } catch (e) {
          console.error('Error al vaciar notificaciones:', e);
          showAlert({ title: 'Error', message: 'No se pudo vaciar el historial.', type: 'error' });
        }
      },
    });
  };

  const handlePressNotification = async (item: NotificationItem) => {
    await handleMarkAsRead(item);

    const { type, data } = item;
    if (!data) return;

    if (type === 'message') {
      if (data.otherUserId) {
        navigation.navigate('Chat', {
          applicationId: data.applicationId,
          otherUserId: data.otherUserId,
          jobTitle: data.jobTitle || item.title || 'Chat',
        });
      }
    } else if (type === 'application') {
      if (data.jobId) {
        navigation.navigate('Detail', {
          id: data.jobId,
          type: userProfile?.userType === 'Searching' ? 'Job' : 'Candidate',
          applicationId: data.applicationId,
        });
      } else {
        navigation.navigate('Tabs');
      }
    } else if (type === 'status_change') {
      if (data.jobId) {
        navigation.navigate('Detail', {
          id: data.jobId,
          type: 'Job',
          applicationId: data.applicationId,
        });
      } else {
        navigation.navigate('Tabs');
      }
    } else if (type === 'like') {
      if (data.employerId) {
        navigation.navigate('Detail', {
          id: data.employerId,
          type: 'Candidate',
          fromMatches: true,
        });
      } else {
        navigation.navigate('Tabs');
      }
    }
  };

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'application':
        return { icon: 'briefcase-outline', color: '#5DA8FF' };
      case 'status_change':
        return { icon: 'sync-outline', color: colors.primary };
      case 'message':
        return { icon: 'chatbubbles-outline', color: colors.accept };
      case 'like':
        return { icon: 'heart-outline', color: '#FF6B81' };
      default:
        return { icon: 'notifications-outline', color: colors.primary };
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (selectedCategory === 'all') return true;
    return n.type === selectedCategory;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const styles = makeStyles(colors, isDark);

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Notificaciones</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount} nuevas</Text>
            </View>
          )}
        </View>

        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllAsRead}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-done-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity
              onPress={handleClearAllHistory}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color={colors.reject} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Chips */}
      <View style={styles.categoryContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.categoryScroll}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item.id;
            return (
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(item.id)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="notifications-off-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Sin notificaciones</Text>
          <Text style={styles.emptySubtitle}>
            {selectedCategory === 'all'
              ? 'Aún no tienes notificaciones en tu registro.'
              : 'No hay notificaciones en esta categoría.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id!}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item, index }) => {
            const { icon, color } = getCategoryIcon(item.type);
            return (
              <FadeInUp delay={Math.min(index * 25, 200)}>
                <View style={[styles.cardWrapper, !item.read && styles.unreadCard]}>
                  <TouchableOpacity
                    style={styles.cardMain}
                    onPress={() => handlePressNotification(item)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.iconContainer}>
                      {item.senderPhoto ? (
                        <Image source={{ uri: item.senderPhoto }} style={styles.senderAvatar} />
                      ) : (
                        <View style={[styles.typeIconBg, { backgroundColor: color + '1A' }]}>
                          <Ionicons name={icon as any} size={22} color={color} />
                        </View>
                      )}
                      {!item.read && <View style={styles.dotUnread} />}
                    </View>

                    <View style={styles.infoContainer}>
                      <View style={styles.titleRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.timeText}>
                          {formatRelativeTime(item.createdAt)}
                        </Text>
                      </View>
                      <Text style={styles.cardBody} numberOfLines={2}>
                        {item.body}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteNotification(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={colors.textLight} />
                  </TouchableOpacity>
                </View>
              </FadeInUp>
            );
          }}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SIZES.lg,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: SIZES.md,
      backgroundColor: colors.headerBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      padding: 4,
    },
    headerTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      ...type.h2,
      color: colors.text,
    },
    unreadBadge: {
      backgroundColor: colors.primary + '22',
      borderWidth: 1,
      borderColor: colors.primary + '55',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: SIZES.radius_full,
    },
    unreadBadgeText: {
      ...type.caption,
      color: colors.primary,
      fontWeight: 'bold',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerIconBtn: {
      padding: 6,
    },
    categoryContainer: {
      backgroundColor: colors.headerBg,
      paddingVertical: SIZES.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    categoryScroll: {
      paddingHorizontal: SIZES.lg,
      gap: 8,
    },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: SIZES.radius_full,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryText: {
      ...type.small,
      color: colors.textLight,
    },
    categoryTextActive: {
      color: colors.onPrimary,
      fontWeight: 'bold',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(232,197,108,0.08)' : 'rgba(10,10,10,0.04)',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    emptyTitle: {
      ...type.h2,
      color: colors.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      ...type.body,
      color: colors.textLight,
      textAlign: 'center',
      marginTop: 8,
    },
    listContent: {
      padding: SIZES.md,
      gap: 10,
      paddingBottom: 100,
    },
    cardWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: SIZES.radius_lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...(isDark ? {} : SHADOWS.light),
    },
    unreadCard: {
      borderColor: colors.primary + '66',
      backgroundColor: isDark ? colors.card : '#FFFFFF',
    },
    cardMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: SIZES.md,
      gap: SIZES.md,
    },
    iconContainer: {
      position: 'relative',
    },
    typeIconBg: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },
    senderAvatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.inputBackground,
    },
    dotUnread: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.card,
    },
    infoContainer: {
      flex: 1,
      gap: 3,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      ...type.h3,
      color: colors.text,
      flex: 1,
    },
    timeText: {
      ...type.caption,
      color: colors.textLight,
      marginLeft: 8,
    },
    cardBody: {
      ...type.body,
      fontSize: 13,
      color: colors.textLight,
      lineHeight: 18,
    },
    deleteBtn: {
      paddingHorizontal: 12,
      paddingVertical: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
