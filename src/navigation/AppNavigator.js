import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import AuthNavigator from './AuthNavigator';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/colors';
import { useTheme } from '../constants/ThemeContext';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

export default function AppNavigator() {
  const { theme } = useTheme();
  const [user,              setUser]              = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [onboardingDone,    setOnboardingDone]    = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setOnboardingDone(userDoc.data().onboarding_complete === true);
          } else {
            // Doc doesn't exist yet — wait briefly and retry once
            // This handles the race condition on Google sign-up
            setTimeout(async () => {
              try {
                const retryDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                if (retryDoc.exists()) {
                  setOnboardingDone(retryDoc.data().onboarding_complete === true);
                }
              } catch (e) {
                setOnboardingDone(false);
              }
            }, 1500);
          }
        } catch (e) {
          setOnboardingDone(false);
        }
      } else {
        setUser(null);
        setOnboardingDone(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{
        flex: 1, justifyContent: 'center',
        alignItems: 'center', backgroundColor: theme.background
      }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user
        ? <AuthNavigator />
        : !onboardingDone
          ? <OnboardingScreen onComplete={() => setOnboardingDone(true)} userId={user.uid} />
          : <AuthNavigator /> // Placeholder — we replace with MainNavigator next phase
      }
    </NavigationContainer>
  );
}