import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { Colors } from '../../constants/colors';
import { webScrollStyle, scrollContentStyle } from '../../constants/webStyles';

export default function ForgotPasswordScreen({ navigation }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (error) {
      let message = 'Failed to send reset email. Please try again.';
      if (error.code === 'auth/user-not-found') message = 'No account found with this email.';
      if (error.code === 'auth/invalid-email')  message = 'Please enter a valid email address.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        Platform.OS === 'web' && { minHeight: '100vh' },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={webScrollStyle}
        contentContainerStyle={[styles.scroll, scrollContentStyle]}
        keyboardShouldPersistTaps="handled"
      >

        <View style={styles.header}>
          <Text style={styles.appName}>AdaptiveTutor</Text>
          <Text style={styles.tagline}>Your personalised learning companion</Text>
        </View>

        <View style={styles.form}>

          {!sent ? (
            <>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>

              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={Colors.light.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleReset}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>Send Reset Link</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.title}>Email Sent!</Text>
              <Text style={styles.subtitle}>
                We've sent a password reset link to {email}. Check your inbox and follow the instructions.
              </Text>
            </>
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.backButton}
          >
            <Text style={styles.backText}>← Back to Sign In</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 6,
  },
  form: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: Colors.light.text,
    marginBottom: 16,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  backButton: {
    alignItems: 'center',
    marginTop: 8,
  },
  backText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});