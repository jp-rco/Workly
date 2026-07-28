import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

export async function pickImageFromSource(
  useCamera: boolean,
  storagePath: string,
  onProgress?: (progress: number) => void
): Promise<{ url: string | null; error?: string }> {
  try {
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        return { url: null, error: 'Se necesita acceso a la cámara para tomar fotos.' };
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return { url: null, error: 'Se necesita acceso a la galería para seleccionar fotos.' };
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

    if (result.canceled || !result.assets?.[0]?.uri) {
      return { url: null };
    }

    const uri = result.assets[0].uri;
    const url = await uploadToFirebase(uri, storagePath, onProgress);
    if (!url) {
      return { url: null, error: 'No se pudo subir la imagen a Firebase Storage.' };
    }
    return { url };
  } catch (err: any) {
    console.error('Image pick error:', err);
    return { url: null, error: 'Ocurrió un error insospechado al procesar la imagen.' };
  }
}

export async function pickAndUploadImage(
  storagePath: string,
  onProgress?: (progress: number) => void,
  useCamera?: boolean
): Promise<string | null> {
  const isCamera = useCamera ?? false;
  const res = await pickImageFromSource(isCamera, storagePath, onProgress);
  return res.url;
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
          resolve(null);
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
