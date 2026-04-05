import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert, Linking, Modal
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainNavigator';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { 
  collection, addDoc, query, where, onSnapshot, 
  serverTimestamp, setDoc, doc, increment, getDoc 
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { SIZES } from '../../constants/theme';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { pickAndUploadImage, uploadToFirebase } from '../../utils/uploadImage';
import MapPickerScreen from './MapPickerScreen';

type Props = NativeStackScreenProps<MainStackParamList, 'Chat'>;

interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageUri?: string;
  audioUri?: string;
  location?: { latitude: number; longitude: number };
  createdAt: any;
}

interface ApplicationData {
  id: string;
  status: string;
  jobTitle: string;
  jobId: string;
  jobImageUrl?: string;
  interviewDate?: string;
}

export default function ChatScreen({ route, navigation }: Props) {
  const { applicationId, otherUserId, jobTitle: routeJobTitle } = route.params;
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [appData, setAppData] = useState<ApplicationData | null>(null);
  
  // Audio state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!userProfile?.uid) return;
    navigation.setOptions({ title: routeJobTitle || (appData?.jobTitle) || 'Chat' });

    // Fetch Application Context if exists
    if (applicationId) {
      getDoc(doc(db, 'applications', applicationId)).then(async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          let jobImageUrl = '';
          if (data.jobId) {
            const jSnap = await getDoc(doc(db, 'jobs', data.jobId));
            if (jSnap.exists()) jobImageUrl = jSnap.data().imageUrl;
          }
          setAppData({
            id: snap.id,
            status: data.status,
            jobTitle: data.jobTitle,
            jobId: data.jobId,
            jobImageUrl,
            interviewDate: data.interviewDate,
          });
        }
      });
    }

    // Use applicationId if provided, otherwise a composite ID from both users
    const conversationId = applicationId || 
      (userProfile.uid < otherUserId ? `${userProfile.uid}_${otherUserId}` : `${otherUserId}_${userProfile.uid}`);

    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      msgs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeA - timeB;
      });

      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [applicationId, otherUserId]);

  const sendMessage = async (payload: Partial<Message>) => {
    if (!userProfile) return;
    const conversationId = applicationId || 
      (userProfile.uid < otherUserId ? `${userProfile.uid}_${otherUserId}` : `${otherUserId}_${userProfile.uid}`);
      
    try {
      // 1. Add the message
      await addDoc(collection(db, 'messages'), {
        conversationId,
        applicationId: applicationId || null,
        senderId: userProfile.uid,
        createdAt: serverTimestamp(),
        ...payload
      });

      // 2. Update the conversation summary (for the messages list)
      await setDoc(doc(db, 'conversations', conversationId), {
        id: conversationId,
        lastMessage: payload.text || (payload.imageUri ? '📷 Imagen' : payload.audioUri ? '🎤 Nota de voz' : '📍 Ubicación'),
        lastMessageAt: serverTimestamp(),
        participants: [userProfile.uid, otherUserId],
        applicationId: applicationId || null,
        jobTitle: routeJobTitle || (appData?.jobTitle) || 'Chat',
        jobImageUrl: appData?.jobImageUrl || null,
        // Update unread count for the recipient
        [`unreadCount_${otherUserId}`]: increment(1),
        [`unreadCount_${userProfile.uid}`]: 0,
      }, { merge: true });

    } catch (e) {
      console.error('Error sending message:', e);
    }
  };

  const handleSendText = () => {
    if (!inputText.trim()) return;
    sendMessage({ text: inputText.trim() });
    setInputText('');
  };

  const handleSendImage = async () => {
    const storagePath = `chat_media/${applicationId}/img_${Date.now()}.jpg`;
    const url = await pickAndUploadImage(storagePath);
    if (url) sendMessage({ imageUri: url });
  };

  const onLocationPicked = (loc: any) => {
    setShowMapPicker(false);
    sendMessage({ 
      location: { latitude: loc.latitude, longitude: loc.longitude },
      text: `📍 Ubicación: ${loc.address}`
    });
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording } = await Audio.Recording.createAsync(
            Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(recording);
        setIsRecording(true);
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (uri) {
        const storagePath = `chat_media/${applicationId}/audio_${Date.now()}.m4a`;
        const url = await uploadToFirebase(uri, storagePath);
        if (url) sendMessage({ audioUri: url });
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.senderId === userProfile?.uid;
    return (
      <View style={[styles.messageWrapper, isMine ? styles.myMessage : styles.theirMessage]}>
        <View style={[styles.bubble, isMine ? { backgroundColor: colors.primary } : { backgroundColor: colors.inputBackground }]}>
          {item.text && <Text style={[styles.messageText, isMine ? { color: '#FFFFFF' } : { color: colors.text }]}>{item.text}</Text>}
          {item.imageUri && <Image source={{ uri: item.imageUri }} style={styles.messageImage} />}
          {item.audioUri && (
            <TouchableOpacity 
              style={styles.audioBtn} 
              onPress={async () => {
                const { sound } = await Audio.Sound.createAsync({ uri: item.audioUri! });
                await sound.playAsync();
              }}
            >
              <Ionicons name="play-circle" size={32} color={isMine ? '#FFFFFF' : colors.primary} />
              <Text style={[styles.audioText, isMine ? { color: '#FFFFFF' } : { color: colors.text }]}>Nota de voz</Text>
            </TouchableOpacity>
          )}
          {item.location && (
            <TouchableOpacity 
              style={styles.locationBubble}
              onPress={() => {
                const url = `https://www.google.com/maps/search/?api=1&query=${item.location!.latitude},${item.location!.longitude}`;
                Linking.openURL(url);
              }}
            >
              <Ionicons name="location" size={24} color={isMine ? '#FFFFFF' : colors.primary} />
              <Text style={[styles.locationTextMsg, isMine ? { color: '#FFFFFF' } : { color: colors.text }]}>Ver ubicación</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.timeText}>{item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
    >
      {appData && (
        <TouchableOpacity 
          style={[styles.contextCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
          onPress={() => navigation.navigate('Detail', { id: appData.jobId, type: 'Job' })}
        >
          <Image source={{ uri: appData.jobImageUrl || 'https://via.placeholder.com/60.png?text=Trabajo' }} style={styles.contextImage} />
          <View style={styles.contextInfo}>
            <Text style={[styles.contextTitle, { color: colors.text }]} numberOfLines={1}>{appData.jobTitle}</Text>
            <View style={[styles.contextStatus, { backgroundColor: getStatusColor(appData.status, colors.primary) + '20' }]}>
              <Text style={[styles.contextStatusText, { color: getStatusColor(appData.status, colors.primary) }]}>
                {getStatusLabel(appData.status)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={[styles.inputArea, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleSendImage}>
          <Ionicons name="image" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowMapPicker(true)}>
          <Ionicons name="location" size={24} color={colors.primary} />
        </TouchableOpacity>
        
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground }]}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={colors.textLight}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />

        {inputText.trim() ? (
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }]} onPress={handleSendText}>
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.sendBtn, { backgroundColor: isRecording ? colors.reject : colors.primary }]} 
            onPressIn={startRecording}
            onPressOut={stopRecording}
          >
            <Ionicons name={isRecording ? "mic-off" : "mic"} size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showMapPicker} animationType="slide">
        <MapPickerScreen
          onLocationPicked={onLocationPicked}
          onCancel={() => setShowMapPicker(false)}
        />
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: SIZES.md, gap: 10 },
  messageWrapper: { marginBottom: 10, maxWidth: '80%' },
  myMessage: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirMessage: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { padding: 12, borderRadius: 20 },
  messageText: { fontSize: 16 },
  messageImage: { width: 220, height: 220, borderRadius: 15, marginTop: 5 },
  audioBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 120 },
  audioText: { fontSize: 14, fontWeight: '600' },
  locationBubble: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationTextMsg: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  timeText: { fontSize: 10, color: '#999', marginTop: 4 },
  inputArea: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1 },
  iconBtn: { padding: 8 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, marginHorizontal: 5, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  
  contextCard: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, gap: 12 },
  contextImage: { width: 40, height: 40, borderRadius: 8 },
  contextInfo: { flex: 1 },
  contextTitle: { fontSize: 14, fontWeight: 'bold', color: '#111' },
  contextStatus: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  contextStatusText: { fontSize: 10, fontWeight: 'bold' },
});

const getStatusColor = (status: string, primary: string) => {
  switch (status) {
    case 'rejected': return '#e74c3c';
    case 'accepted': return '#27ae60';
    case 'interview': return '#3498db';
    default: return primary;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'rejected': return 'RECHAZADO';
    case 'accepted': return 'CONTRATADO';
    case 'interview': return 'ENTREVISTA';
    default: return 'PENDIENTE';
  }
};
