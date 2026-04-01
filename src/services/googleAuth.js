import { Platform } from 'react-native';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';

// Creates or fetches user Firestore document after Google sign-in
export async function createUserDocIfNeeded(user) {
  const userRef  = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      name:                user.displayName || '',
      email:               user.email || '',
      faculty:             '',
      course_of_study:     '',
      year_of_study:       0,
      bio:                 '',
      profile_picture_url: user.photoURL || '',
      linkedin_url:        '',
      joined_date:         serverTimestamp(),
      theme_mode:          'light',
      login_streak:        0,
      longest_streak:      0,
      last_login_date:     serverTimestamp(),
      onboarding_complete: false,
    });
  }
}

// Web Google Sign-In using Firebase popup
export async function signInWithGoogleWeb() {
  const result = await signInWithPopup(auth, googleProvider);
  await createUserDocIfNeeded(result.user);
  return result.user;
}

// Native Google Sign-In using expo-auth-session credential
export async function signInWithGoogleNative(idToken) {
  const credential = GoogleAuthProvider.credential(idToken);
  const result     = await signInWithCredential(auth, credential);
  await createUserDocIfNeeded(result.user);
  return result.user;
}

// Unified function — auto-detects platform
export async function signInWithGoogle(promptAsync, response) {
  if (Platform.OS === 'web') {
    return await signInWithGoogleWeb();
  } else {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      return await signInWithGoogleNative(id_token);
    }
    throw new Error('Google sign-in was cancelled or failed.');
  }
}