import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useAuthStyles } from '@/components/authStyles';
import { LineStripe } from '@/components/ui/AppHeader';
import { signIn } from '@/lib/session';
import { usePalette } from '@/theme';

export default function SignIn() {
  const styles = useAuthStyles();
  const c = usePalette();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // The root layout's guard switches to the tabs when the session appears.
    } catch (e) {
      Alert.alert('Sign in failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.hero}>
        <View style={styles.sign}>
          <Text style={styles.title} accessibilityRole="header">
            BostonTPets
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <LineStripe />
          </View>
        </View>
        <Text style={styles.subtitle}>🐥 🦃 🦭 🦞</Text>
        <Text style={styles.tagline}>Ride the T. Scan codes. Collect them all.</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={c.muted}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={c.muted}
        secureTextEntry
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
      />
      <Pressable
        style={[styles.button, (busy || !email || !password) && styles.disabled]}
        disabled={busy || !email || !password}
        onPress={onSubmit}
      >
        <Text style={styles.buttonText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
      </Pressable>
      <Link href="/sign-up" style={styles.link}>
        New here? Create an account
      </Link>
    </KeyboardAvoidingView>
  );
}
