import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput } from 'react-native';
import { signUp } from '@/lib/session';
import { authStyles as styles } from '@/components/authStyles';

export default function SignUp() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = displayName.trim().length > 0 && email.trim().length > 0 && password.length >= 6;

  async function onSubmit() {
    setBusy(true);
    try {
      const signedIn = await signUp(email.trim(), password, displayName.trim());
      if (!signedIn) {
        Alert.alert('Check your email', 'Confirm your address, then sign in.');
        router.back();
      }
    } catch (e) {
      Alert.alert('Sign up failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TextInput
        style={styles.input}
        placeholder="Display name"
        maxLength={30}
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (6+ characters)"
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={[styles.button, (busy || !valid) && styles.disabled]} disabled={busy || !valid} onPress={onSubmit}>
        <Text style={styles.buttonText}>{busy ? 'Creating…' : 'Create account'}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
