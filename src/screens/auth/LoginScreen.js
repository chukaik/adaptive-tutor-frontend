import { signInWithGoogle } from '../../services/googleAuth';
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { auth, db } from '../../services/firebase';
import { useTheme } from '../../constants/ThemeContext';
import { Colors } from '../../constants/colors';

WebBrowser.maybeCompleteAuthSession();

//const EXPO_CLIENT_ID   = '111057448166-3vbaj594cvrj5qiofdb70pp1plt7vckk.apps.googleusercontent.com'; //needs review
const ANDROID_CLIENT_ID = '111057448166-i2mmglcr3o3kcpd5q7cpotjup5u6ruer.apps.googleusercontent.com';
const WEB_CLIENT_ID    = '111057448166-3vbaj594cvrj5qiofdb70pp1plt7vckk.apps.googleusercontent.com';

export default function LoginScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [errors,   setErrors]   = useState({});

  const [request, response, promptAsync] = Google.useAuthRequest({
    //expoClientId:   EXPO_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    webClientId:     WEB_CLIENT_ID,
  });

  // useEffect(() => {
  //   if (response?.type === 'success') {
  //     handleGoogleResponse(response);
  //   }
  // }, [response]);

  useEffect(() => {
  if (response?.type === 'success' && Platform.OS !== 'web') {
    handleGoogleSignIn(response);
  }
}, [response]);

  // const handleGoogleResponse = async (res) => {
  //   setGLoading(true);
  //   try {
  //     const { id_token }   = res.params;
  //     const credential     = GoogleAuthProvider.credential(id_token);
  //     const userCredential = await signInWithCredential(auth, credential);
  //     const user           = userCredential.user;

  //     const userRef  = doc(db, 'users', user.uid);
  //     const userSnap = await getDoc(userRef);
  //     if (!userSnap.exists()) {
  //       await setDoc(userRef, {
  //         name:                user.displayName || '',
  //         email:               user.email || '',
  //         faculty:             '',
  //         course_of_study:     '',
  //         year_of_study:       0,
  //         bio:                 '',
  //         profile_picture_url: user.photoURL || '',
  //         linkedin_url:        '',
  //         joined_date:         serverTimestamp(),
  //         theme_mode:          'light',
  //         login_streak:        0,
  //         longest_streak:      0,
  //         last_login_date:     serverTimestamp(),
  //         onboarding_complete: false,
  //       });
  //     }
  //   } catch (error) {
  //     setErrors({ general: 'Google sign-in failed. Please try again.' });
  //   } finally {
  //     setGLoading(false);
  //   }
  // };

  const handleGoogleSignIn = async (res) => {
    setGLoading(true);
    try {
      if (Platform.OS === 'web') {
        await signInWithGoogle(null, null);
        // Force auth state refresh on web
        const currentUser = auth.currentUser;
        if (currentUser) {
          // Manually trigger a token refresh to wake the listener
          await currentUser.getIdToken(true);
        }
      } else {
        await signInWithGoogle(null, res);
      }
    } catch (error) {
      setErrors({ general: 'Google sign-in failed. Please try again.' });
    } finally {
      setGLoading(false);
    }
  };

  const handleLogin = async () => {
    const newErrors = {};
    if (!email.trim())    newErrors.email    = 'Email address is required.';
    if (!password.trim()) newErrors.password = 'Password is required.';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setErrors({ email: 'No account found with this email address.' });
      } else if (error.code === 'auth/wrong-password') {
        setErrors({ password: 'Incorrect password. Please try again.' });
      } else if (error.code === 'auth/invalid-email') {
        setErrors({ email: 'Please enter a valid email address.' });
      } else if (error.code === 'auth/too-many-requests') {
        setErrors({ general: 'Too many failed attempts. Please try again later.' });
      } else {
        setErrors({ general: 'Login failed. Please check your details and try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(theme, isDark);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🎓</Text>
          </View>
          <Text style={styles.appName}>AdaptiveTutor</Text>
          <Text style={styles.tagline}>Your personalised learning companion</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your learning journey</Text>

          {/* General error */}
          {errors.general ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {errors.general}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="Enter your email"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={(v) => { setEmail(v); setErrors(e => ({ ...e, email: null })); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, errors.password && styles.inputError]}
            placeholder="Enter your password"
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={(v) => { setPassword(v); setErrors(e => ({ ...e, password: null })); }}
            secureTextEntry
          />
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotContainer}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Sign In</Text>
            }
          </TouchableOpacity>

          {/* OR Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Button */}
          <TouchableOpacity
            style={[styles.googleButton, gLoading && styles.buttonDisabled]}
            // onPress={() => promptAsync()}
            onPress={
              () => {
                if (Platform.OS === 'web') {
                  handleGoogleSignIn(null);
                } else {
                  promptAsync();
                }
              }
            }            
            disabled={!request || gLoading}
          >
            {gLoading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <View style={styles.googleButtonInner}>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme, isDark) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    //scroll:    { flexGrow: 1, justifyContent: 'center', padding: 24 },
    scroll:    { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40 },
    header:    { alignItems: 'center', marginBottom: 32 },
    logoContainer: {
      width: 72, height: 72, borderRadius: 20,
      backgroundColor: Colors.primary,
      justifyContent: 'center', alignItems: 'center',
      marginBottom: 12, shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    logoIcon:  { fontSize: 36 },
    appName:   { fontSize: 28, fontWeight: 'bold', color: Colors.primary, letterSpacing: 0.5 },
    tagline:   { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
    card: {
      backgroundColor: theme.card, borderRadius: 20, padding: 24,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.08, shadowRadius: 12, elevation: 4,
      borderWidth: isDark ? 1 : 0, borderColor: theme.border,
    },
    title:    { fontSize: 22, fontWeight: 'bold', color: theme.text, marginBottom: 4 },
    subtitle: { fontSize: 13, color: theme.textSecondary, marginBottom: 16 },
    label:    { fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 6 },
    input: {
      backgroundColor: theme.background, borderWidth: 1,
      borderColor: theme.border, borderRadius: 10,
      padding: 14, fontSize: 15, color: theme.text, marginBottom: 4,
    },
    inputError: {
      borderColor: Colors.danger,
      borderWidth: 1.5,
    },
    errorText: {
      color: Colors.danger,
      fontSize: 12,
      marginBottom: 12,
      marginTop: 2,
    },
    errorBanner: {
      backgroundColor: '#FEE2E2',
      borderRadius: 8,
      padding: 10,
      marginBottom: 16,
      borderLeftWidth: 3,
      borderLeftColor: Colors.danger,
    },
    errorBannerText: {
      color: '#B91C1C',
      fontSize: 13,
    },
    forgotContainer: {
      alignSelf: 'flex-end',
      marginBottom: 20,
      marginTop: 4,
    },
    forgotText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
    button: {
      backgroundColor: Colors.primary, borderRadius: 12,
      padding: 16, alignItems: 'center', marginBottom: 16,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.3 },
    dividerRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    dividerLine: { flex: 1, height: 1, backgroundColor: theme.border },
    dividerText: { color: theme.textSecondary, fontSize: 12, fontWeight: '600', marginHorizontal: 12 },
    googleButton: {
      backgroundColor: theme.background, borderRadius: 12,
      padding: 14, alignItems: 'center', marginBottom: 24,
      borderWidth: 1.5, borderColor: theme.border,
    },
    googleButtonInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    googleIcon:        { fontSize: 18, fontWeight: 'bold', color: '#4285F4' },
    googleButtonText:  { color: theme.text, fontSize: 15, fontWeight: '600' },
    signupRow:  { flexDirection: 'row', justifyContent: 'center' },
    signupText: { color: theme.textSecondary, fontSize: 14 },
    signupLink: { color: Colors.primary, fontSize: 14, fontWeight: 'bold' },
  });
}