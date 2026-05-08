import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Image, Linking, Modal, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainNavigator';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import {
  collection, addDoc, query, where, onSnapshot,
  serverTimestamp, setDoc, doc, increment, getDoc,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { SIZES, type } from '../../constants/theme';
import {
  useAudioRecorder, useAudioPlayer, useAudioPlayerStatus,
  RecordingPresets, requestRecordingPermissionsAsync,
} from 'expo-audio';
import { pickAndUploadImage, uploadToFirebase } from '../../utils/uploadImage';
import MapPickerScreen from './MapPickerScreen';
import { PressScale, Pulse } from '../../components/common/Animated';

type Props = NativeStackScreenProps<MainStackParamList, 'Chat'>;

interface Message {
  id: string; senderId: string; text?: string; imageUri?: string;
  audioUri?: string; location?: { latitude: number; longitude: number };
  createdAt: any;
}
interface ApplicationData {
  id: string; status: string; jobTitle: string; jobId: string;
  jobImageUrl?: string; interviewDate?: string;
}

export default function ChatScreen({ route, navigation }: Props) {
  const { applicationId, otherUserId, jobTitle: routeJobTitle } = route.params;
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [appData, setAppData] = useState<ApplicationData | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const styles = makeStyles(colors, isDark);

  useEffect(() => {
    if (!userProfile?.uid) return;
    navigation.setOptions({ title: routeJobTitle || appData?.jobTitle || 'Chat' });

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
            id: snap.id, status: data.status, jobTitle: data.jobTitle,
            jobId: data.jobId, jobImageUrl, interviewDate: data.interviewDate,
          });
        }
      });
    }

    const conversationId = applicationId ||
      (userProfile.uid < otherUserId ? `${userProfile.uid}_${otherUserId}` : `${otherUserId}_${userProfile.uid}`);

    const q = query(collection(db, 'messages'), where('conversationId', '==', conversationId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Message[];
      msgs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [applicationId, otherUserId]);

  const sendMessage = async (payload: Partial<Message>) => {
    if (!userProfile) return;
    const conversationId = applicationId ||
      (userProfile.uid < otherUserId ? `${userProfile.uid}_${otherUserId}` : `${otherUserId}_${userProfile.uid}`);

    try {
      await addDoc(collection(db, 'messages'), {
        conversationId, applicationId: applicationId || null,
        senderId: userProfile.uid, createdAt: serverTimestamp(), ...payload,
      });
      await setDoc(doc(db, 'conversations', conversationId), {
        id: conversationId,
        lastMessage: payload.text || (payload.imageUri ? '📷 Imagen' : payload.audioUri ? '🎤 Nota de voz' : '📍 Ubicación'),
        lastMessageAt: serverTimestamp(),
        participants: [userProfile.uid, otherUserId],
        applicationId: applicationId || null,
        jobTitle: routeJobTitle || appData?.jobTitle || 'Chat',
        jobImageUrl: appData?.jobImageUrl || null,
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
    const mediaId = applicationId || 'direct_chats';
    const storagePath = `chat_media/${mediaId}/img_${Date.now()}.jpg`;
    const url = await pickAndUploadImage(storagePath);
    if (url) sendMessage({ imageUri: url });
  };

  const onLocationPicked = (loc: any) => {
    setShowMapPicker(false);
    sendMessage({
      location: { latitude: loc.latitude, longitude: loc.longitude },
      text: `📍 Ubicación: ${loc.address}`,
    });
  };

  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status === 'granted') {
        setIsRecording(true);
        recorder.record();
      }
    } catch (err) {
      console.error('Failed to start recording', err);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (!recorder.isRecording) return;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        const mediaId = applicationId || 'direct_chats';
        const storagePath = `chat_media/${mediaId}/audio_${Date.now()}.m4a`;
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
        <View style={[
          styles.bubble,
          isMine ? styles.myBubble : styles.theirBubble,
        ]}>
          {item.text && (
            <Text style={[styles.messageText, isMine ? styles.myText : styles.theirText]}>{item.text}</Text>
          )}
          {item.imageUri && <Image source={{ uri: item.imageUri }} style={styles.messageImage} />}
          {item.audioUri && (
            <VoiceMessagePlayer uri={item.audioUri} isMine={isMine} colors={colors} isDark={isDark} />
          )}
          {item.location && (
            <TouchableOpacity
              style={styles.locationBubble}
              onPress={() => {
                const url = `https://www.google.com/maps/search/?api=1&query=${item.location!.latitude},${item.location!.longitude}`;
                Linking.openURL(url);
              }}
            >
              <Ionicons name="location" size={20} color={isMine ? (isDark ? '#000' : '#fff') : colors.primary} />
              <Text style={[styles.locationTextMsg, isMine ? styles.myText : styles.theirText]}>Ver ubicación</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.timeText}>
          {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{routeJobTitle || appData?.jobTitle || 'Chat'}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>Con {appData?.jobTitle || 'Usuario'}</Text>
        </View>
      </View>

      {appData && (
        <TouchableOpacity
          style={styles.contextCard}
          onPress={() => navigation.navigate('Detail', { id: appData.jobId, type: 'Job' })}
          activeOpacity={0.85}
        >
          <Image
            source={{ uri: appData.jobImageUrl || 'https://via.placeholder.com/60.png?text=Trabajo' }}
            style={styles.contextImage}
          />
          <View style={styles.contextInfo}>
            <Text style={styles.contextTitle} numberOfLines={1}>{appData.jobTitle}</Text>
            <View style={[styles.contextStatus, { backgroundColor: getStatusColor(appData.status, colors.primary) + '20' }]}>
              <Text style={[styles.contextStatusText, { color: getStatusColor(appData.status, colors.primary) }]}>
                {getStatusLabel(appData.status)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        inverted
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={Keyboard.dismiss}
      />

      <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleSendImage}>
          <Ionicons name="image-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowMapPicker(true)}>
          <Ionicons name="location-outline" size={22} color={colors.text} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje…"
          placeholderTextColor={colors.textLight}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />

        {inputText.trim() ? (
          <PressScale style={styles.sendBtn} onPress={handleSendText}>
            <Ionicons name="arrow-up" size={20} color={isDark ? '#000' : '#fff'} />
          </PressScale>
        ) : (
          <TouchableOpacity
            style={[styles.micBtn, isRecording && styles.micBtnRecording]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
            activeOpacity={0.85}
          >
            {isRecording ? (
              <Pulse color="#fff" size={12} />
            ) : (
              <Ionicons name="mic" size={20} color={isDark ? '#000' : '#fff'} />
            )}
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showMapPicker} animationType="slide">
        <MapPickerScreen onLocationPicked={onLocationPicked} onCancel={() => setShowMapPicker(false)} />
      </Modal>
    </KeyboardAvoidingView>
  );
}

function VoiceMessagePlayer({ uri, isMine, colors, isDark }: { uri: string; isMine: boolean; colors: any; isDark: boolean }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const handlePlay = () => {
    if (status.didJustFinish) player.seekTo(0);
    player.play();
  };

  const fg = isMine ? (isDark ? '#000' : '#fff') : colors.primary;
  const tx = isMine ? (isDark ? '#000' : '#fff') : colors.text;

  return (
    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 140 }} onPress={handlePlay}>
      <Ionicons name={status.playing ? 'pause-circle' : 'play-circle'} size={32} color={fg} />
      <Text style={{ ...type.small, color: tx }}>
        {status.playing ? 'Reproduciendo…' : 'Nota de voz'}
      </Text>
    </TouchableOpacity>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: SIZES.sm,
    backgroundColor: colors.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { marginRight: 16 },
  headerInfo: { flex: 1 },
  headerTitle: { ...type.h3, color: colors.text },
  headerSubtitle: { ...type.caption, color: colors.textLight },
  listContent: { padding: SIZES.md, gap: 8 },

  messageWrapper: { marginBottom: 6, maxWidth: '82%' },
  myMessage: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirMessage: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: SIZES.radius_lg, minWidth: 44 },
  myBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirBubble: { backgroundColor: colors.card, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.border },

  messageText: { ...type.body },
  myText: { color: isDark ? '#000' : '#fff' },
  theirText: { color: colors.text },

  messageImage: { width: 220, height: 220, borderRadius: SIZES.radius, marginTop: 4 },

  locationBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationTextMsg: { ...type.bodyMd, textDecorationLine: 'underline' },

  timeText: { ...type.caption, color: colors.textLight, marginTop: 4 },

  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: SIZES.md, paddingTop: 8, gap: 6,
    backgroundColor: colors.headerBg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1, ...type.body, color: colors.text,
    backgroundColor: colors.inputBackground,
    borderRadius: SIZES.radius_lg,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    maxHeight: 110,
    borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  micBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  micBtnRecording: { backgroundColor: colors.reject },

  contextCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: SIZES.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  contextImage: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.inputBackground },
  contextInfo: { flex: 1 },
  contextTitle: { ...type.h3, color: colors.text },
  contextStatus: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: SIZES.radius_full, marginTop: 4,
  },
  contextStatusText: { ...type.caption },
});

const getStatusColor = (status: string, primary: string) => {
  switch (status) {
    case 'rejected': return '#FF6B6B';
    case 'accepted': return '#3DBE7A';
    case 'interview': return '#5DA8FF';
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
