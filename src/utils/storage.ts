import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

/**
 * Uploads a file (blob) to Firebase Storage and returns the public URL
 * @param uri The local URI of the file
 * @param path The path in Firebase Storage (e.g., 'avatars/userId.jpg' or 'cvs/userId.pdf')
 */
export const uploadFileToStorage = async (uri: string, path: string): Promise<string> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error) {
    console.error('Error uploading file to storage:', error);
    throw error;
  }
};
