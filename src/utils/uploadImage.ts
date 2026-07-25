import * as ImagePicker from 'expo-image-picker';
import { Alert, ActionSheetIOS, Platform } from 'react-native';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

export async function pickAndUploadImage(
  storagePath: string,
  onProgress?: (progress: number) => void
): Promise<string | null> {
  // Ask where to get the image
  return new Promise((resolve) => {
    const options = ['Tomar Foto', 'Elegir de Galería', 'Cancelar'];
    const cancelIndex = 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        async (buttonIndex) => {
          if (buttonIndex === cancelIndex) return resolve(null);
          const useCamera = buttonIndex === 0;
          const url = await _pickImage(useCamera, storagePath, onProgress);
          resolve(url);
        }
      );
    } else {
      // Android: use Alert with buttons
      Alert.alert('Seleccionar imagen', '¿De dónde quieres obtener la imagen?', [
        {
          text: 'Tomar Foto',
          onPress: async () => {
            const url = await _pickImage(true, storagePath, onProgress);
            resolve(url);
          },
        },
        {
          text: 'Galería',
          onPress: async () => {
            const url = await _pickImage(false, storagePath, onProgress);
            resolve(url);
          },
        },
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
      ]);
    }
  });
}

async function _pickImage(
  useCamera: boolean,
  storagePath: string,
  onProgress?: (progress: number) => void
): Promise<string | null> {
  try {
    // Request permissions
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara');
        return null;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se necesita acceso a la galería');
        return null;
      }
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });

    if (result.canceled || !result.assets?.[0]?.uri) return null;

    const uri = result.assets[0].uri;
    return await uploadToFirebase(uri, storagePath, onProgress);
  } catch (err) {
    console.error('Image pick error:', err);
    Alert.alert('Error', 'No se pudo obtener la imagen');
    return null;
  }
}

export async function uploadToFirebase(
  uri: string,
  storagePath: string,
  onProgress?: (progress: number) => void
): Promise<string | null> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, blob);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = snapshot.bytesTransferred / snapshot.totalBytes;
          onProgress?.(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          Alert.alert('Error', 'No se pudo subir la imagen');
          reject(null);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
  } catch (err) {
    console.error('Upload error:', err);
    return null;
  }
}
