import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuthStyles } from '@/components/authStyles';
import { isHandleAvailable } from '@/lib/api';
import { HANDLE_MAX, handleProblem, normalizeHandle } from '@/lib/handle';
import { signUp } from '@/lib/session';
import { fonts, usePalette, useStyles, type Palette } from '@/theme';

type HandleStatus =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' }
  // The check itself failed (e.g. offline). Sign-up is still allowed; the server enforces uniqueness.
  | { kind: 'unknown' };

const CHECK_DEBOUNCE_MS = 400;

export default function SignUp() {
  const styles = useAuthStyles();
  const local = useStyles(makeLocal);
  const c = usePalette();
  const [displayName, setDisplayName] = useState('');
  const [handleInput, setHandleInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  // Result of the last availability check, tagged with the handle it was for.
  const [check, setCheck] = useState<{ handle: string; kind: 'available' | 'taken' | 'unknown' } | null>(null);

  const handle = normalizeHandle(handleInput);
  const problem = handle ? handleProblem(handle) : null;

  useEffect(() => {
    if (!handle || problem) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      isHandleAvailable(handle)
        .then((ok) => !cancelled && setCheck({ handle, kind: ok ? 'available' : 'taken' }))
        .catch(() => !cancelled && setCheck({ handle, kind: 'unknown' }));
    }, CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [handle, problem]);

  const status: HandleStatus = !handle
    ? { kind: 'empty' }
    : problem
      ? { kind: 'invalid', message: problem }
      : check?.handle === handle
        ? { kind: check.kind }
        : { kind: 'checking' };

  const handleOk = status.kind === 'available' || status.kind === 'unknown';
  const valid = displayName.trim().length > 0 && handleOk && email.trim().length > 0 && password.length >= 6;

  async function onSubmit() {
    setBusy(true);
    try {
      const signedIn = await signUp(email.trim(), password, displayName.trim(), handle);
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

  const statusText = {
    empty: { text: 'Lowercase letters, numbers and _. This is how friends find you.', color: c.muted },
    invalid: { text: status.kind === 'invalid' ? status.message : '', color: c.danger },
    checking: { text: 'Checking…', color: c.muted },
    available: { text: `@${handle} is available`, color: c.scheme === 'dark' ? '#5BD18B' : '#00602C' },
    taken: { text: `@${handle} is taken`, color: c.danger },
    unknown: { text: "Couldn't check right now. We'll confirm when you sign up.", color: c.muted },
  }[status.kind];

  const borderColor =
    status.kind === 'available'
      ? c.scheme === 'dark' ? '#5BD18B' : '#00843D'
      : status.kind === 'taken' || status.kind === 'invalid'
        ? c.danger
        : c.border;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TextInput
        style={styles.input}
        placeholder="Display name"
        placeholderTextColor={c.muted}
        accessibilityLabel="Display name"
        maxLength={30}
        value={displayName}
        onChangeText={setDisplayName}
      />
      <View style={{ gap: 6 }}>
        <View style={[styles.input, local.handleBox, { borderColor }]}>
          <Text style={local.at}>@</Text>
          <TextInput
            style={local.handleInput}
            placeholder="username"
            placeholderTextColor={c.muted}
            accessibilityLabel="Username"
            accessibilityHint={statusText.text}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="username-new"
            maxLength={HANDLE_MAX + 1}
            value={handleInput}
            onChangeText={setHandleInput}
          />
        </View>
        <Text style={[local.status, { color: statusText.color }]} accessibilityLiveRegion="polite">
          {statusText.text}
        </Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={c.muted}
        accessibilityLabel="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (6+ characters)"
        placeholderTextColor={c.muted}
        accessibilityLabel="Password, 6 or more characters"
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

const makeLocal = (c: Palette) => StyleSheet.create({
  handleBox: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 0 },
  at: { fontFamily: fonts.heavy, fontSize: 16, color: c.muted },
  handleInput: { flex: 1, fontFamily: fonts.bold, fontSize: 16, paddingVertical: 16, color: c.text },
  status: { fontFamily: fonts.bold, fontSize: 12, paddingHorizontal: 4 },
});
