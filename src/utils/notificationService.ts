import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface NotificationItem {
  id?: string;
  userId: string;
  senderId?: string;
  senderName?: string;
  senderPhoto?: string;
  title: string;
  body: string;
  type: 'application' | 'status_change' | 'message' | 'like' | 'system';
  data?: {
    jobId?: string;
    applicationId?: string;
    conversationId?: string;
    otherUserId?: string;
    status?: string;
    employerId?: string;
    jobTitle?: string;
  };
  read: boolean;
  createdAt: string;
}

interface SendNotificationOptions {
  recipientId: string;
  senderId?: string;
  senderName?: string;
  senderPhoto?: string;
  title: string;
  body: string;
  type: 'application' | 'status_change' | 'message' | 'like' | 'system';
  data?: {
    jobId?: string;
    applicationId?: string;
    conversationId?: string;
    otherUserId?: string;
    status?: string;
    employerId?: string;
    jobTitle?: string;
  };
}

/**
 * Envia una notificación push mediante la API de Expo Push Notifications.
 */
export async function sendExpoPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data: any = {}
) {
  if (!expoPushToken || typeof expoPushToken !== 'string' || !expoPushToken.startsWith('ExponentPushToken[')) {
    console.log('Push token no válido o en emulador:', expoPushToken);
    return;
  }

  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
    priority: 'high',
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const resData = await response.json();
    if (resData.errors) {
      console.error('Expo Push API Error:', resData.errors);
    }
  } catch (error) {
    console.error('Error al enviar Push Notification vía Expo:', error);
  }
}

/**
 * Registra una notificación en el historial de Firestore y le envía una notificación push al usuario destinatario si posee token.
 */
export async function sendNotificationToUser(options: SendNotificationOptions) {
  const { recipientId, senderId, senderName, senderPhoto, title, body, type, data } = options;

  if (!recipientId) return;

  try {
    // 1. Guardar la notificación en la colección 'notifications' de Firestore
    const notificationPayload: NotificationItem = {
      userId: recipientId,
      senderId: senderId || '',
      senderName: senderName || '',
      senderPhoto: senderPhoto || '',
      title,
      body,
      type,
      data: data || {},
      read: false,
      createdAt: new Date().toISOString(),
    };

    await addDoc(collection(db, 'notifications'), notificationPayload);

    // 2. Obtener el token Push del usuario destinatario
    const userDocRef = doc(db, 'users', recipientId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      const pushToken = userData?.pushToken;

      if (pushToken) {
        await sendExpoPushNotification(pushToken, title, body, { ...data, type });
      }
    }
  } catch (error) {
    console.error('Error enviando notificación al usuario:', error);
  }
}
