import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { CustomToast, ToastOptions } from '../components/common/CustomToast';
import { useAuth } from './AuthContext';

export interface NotificationContextData {
  expoPushToken: string | null;
  unreadCount: number;
  showToast: (options: ToastOptions) => void;
}

const NotificationContext = createContext<NotificationContextData>({} as NotificationContextData);

// Configurar cómo se comportan las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, updatePushToken } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastOptions, setToastOptions] = useState<ToastOptions | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Escuchar notificaciones no leídas en Firestore para el usuario activo
  useEffect(() => {
    if (!userProfile?.uid) {
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userProfile.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setUnreadCount(snapshot.size);
      },
      (error) => {
        console.error('Error escuchando notificaciones no leídas:', error);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.uid]);

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        updatePushToken(token);
      }
    });
  }, [updatePushToken]);

  useEffect(() => {
    // Escuchar notificaciones recibidas mientras la app está abierta
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      if (title || body) {
        showToast({
          title: title || 'Nueva Notificación',
          message: body || undefined,
          type: 'default',
        });
      }
    });

    // Escuchar interacciones (cuando el usuario toca la notificación nativa)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification tapped:', response.notification.request.content.data);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const showToast = (options: ToastOptions) => {
    setToastOptions(options);
    setToastVisible(true);
  };

  const hideToast = () => {
    setToastVisible(false);
  };

  return (
    <NotificationContext.Provider value={{ expoPushToken, unreadCount, showToast }}>
      {children}
      <CustomToast 
        visible={toastVisible} 
        options={toastOptions} 
        onHide={hideToast} 
      />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);

// Función auxiliar para registrar el dispositivo en Expo
async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E8C56C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
    } catch (e) {
      console.error(e);
      token = null;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
