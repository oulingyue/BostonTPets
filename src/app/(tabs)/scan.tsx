import type { ScanResponse } from '@game/api';
import { getPet, parseScanPayload } from '@game/catalog';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PullReveal } from '@/components/reveal/PullReveal';
import { submitScan } from '@/lib/api';
import { IS_PREVIEW, PREVIEW_CODE } from '@/lib/preview';
import { colors, spacing } from '@/theme';

type ScanState =
  | { kind: 'scanning' }
  | { kind: 'submitting' }
  | { kind: 'result'; result: Extract<ScanResponse, { status: 'ok' }> }
  | { kind: 'message'; title: string; body: string };

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ kind: 'scanning' });
  // onBarcodeScanned fires many times per second; this ref stops duplicate submissions
  // before the state update lands.
  const locked = useRef(false);
  // Only one camera preview may be mounted at a time, so unmount it when the tab loses focus.
  const isFocused = useIsFocused();

  function reset() {
    locked.current = false;
    setState({ kind: 'scanning' });
  }

  async function onBarcodeScanned({ data }: BarcodeScanningResult) {
    if (locked.current) return;
    locked.current = true;

    if (!parseScanPayload(data)) {
      setState({ kind: 'message', title: 'Not a BostonTPets code', body: 'Look for the 🐥🦃🦭🦞 poster at the station.' });
      return;
    }

    setState({ kind: 'submitting' });
    try {
      const res = await submitScan(data);
      if (res.status === 'ok') setState({ kind: 'result', result: res });
      else if (res.status === 'cooldown') {
        setState({
          kind: 'message',
          title: 'Train already left 🚋',
          body: `You've scanned ${res.stationName} recently. Next departure in ${timeUntil(res.nextAvailableAt)}.`,
        });
      } else {
        setState({ kind: 'message', title: 'Code not recognized', body: 'This code is no longer in service.' });
      }
    } catch {
      setState({ kind: 'message', title: 'No signal', body: 'Couldn’t reach the server. Try again above ground.' });
    }
  }

  if (state.kind === 'result') {
    const r = state.result;
    const info = getPet(r.pet.petId);
    return (
      <SafeAreaView style={styles.fill}>
        <PullReveal
          pet={{
            id: r.pet.petId,
            name: info?.name ?? r.pet.petId,
            emoji: info?.emoji ?? '?',
            rarity: info?.rarity ?? 'common',
            isGold: r.pet.isGold,
          }}
          // A scan function deployed before stationLine existed won't send it: fall back to the pet's own line.
          line={r.stationLine ?? info?.line ?? 'red'}
          stationName={r.stationName}
          copies={r.copies}
          isNew={r.isNew}
          onDone={reset}
        />
      </SafeAreaView>
    );
  }

  // Preview mode has no camera: a "Simulate scan" button stands in for a QR code.
  if (!IS_PREVIEW && !permission) return <View style={styles.fill} />;

  if (!IS_PREVIEW && !permission?.granted) {
    return (
      <SafeAreaView style={[styles.fill, styles.center]}>
        <Text style={styles.title}>Camera needed</Text>
        <Text style={styles.body}>BostonTPets scans QR codes at T stations to find pets.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Allow camera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.fill, styles.cameraBackdrop]}>
      {isFocused && !IS_PREVIEW && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={state.kind === 'scanning' ? onBarcodeScanned : undefined}
        />
      )}
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.hint}>Point at a BostonTPets code</Text>
        <View style={styles.reticle} />
        {state.kind === 'submitting' && <ActivityIndicator size="large" color="white" />}
        {IS_PREVIEW && state.kind === 'scanning' && (
          <Pressable style={styles.button} onPress={() => onBarcodeScanned({ data: PREVIEW_CODE } as BarcodeScanningResult)}>
            <Text style={styles.buttonText}>Simulate scan (preview)</Text>
          </Pressable>
        )}
        {state.kind === 'message' && (
          <View style={styles.card}>
            <Text style={styles.title}>{state.title}</Text>
            <Text style={styles.body}>{state.body}</Text>
            <Pressable style={styles.button} onPress={reset}>
              <Text style={styles.buttonText}>Scan again</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function timeUntil(iso: string): string {
  const ms = Math.max(0, new Date(iso).getTime() - Date.now());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.ceil((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  cameraBackdrop: { backgroundColor: '#111' },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  hint: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    overflow: 'hidden',
  },
  reticle: { width: 240, height: 240, borderWidth: 4, borderColor: 'white', borderRadius: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
