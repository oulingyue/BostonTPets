import type { ScanResponse } from '@game/api';
import { getPet, parseScanPayload } from '@game/catalog';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PullReveal } from '@/components/reveal/PullReveal';
import { LineStripe } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { submitScan } from '@/lib/api';
import { IS_PREVIEW, PREVIEW_CODE } from '@/lib/preview';
import { cardStyle, fonts, spacing, useStyles, type Palette } from '@/theme';

type ScanState =
  | { kind: 'scanning' }
  | { kind: 'submitting' }
  | { kind: 'result'; result: Extract<ScanResponse, { status: 'ok' }> }
  | { kind: 'message'; title: string; body: string };

export default function ScanScreen() {
  const styles = useStyles(makeStyles);
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
          points={r.points}
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
        <View style={styles.card}>
          <Text style={styles.title}>Camera needed</Text>
          <Text style={styles.body}>BostonTPets scans QR codes at T stations to find pets.</Text>
          <Button title="Allow camera" onPress={requestPermission} style={styles.cardButton} />
        </View>
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
      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.sign}>
          <Text style={styles.signTitle} accessibilityRole="header">
            Scan
          </Text>
          <Text style={styles.signHint}>Point at a BostonTPets code</Text>
          <LineStripe />
        </View>

        <View style={styles.middle} pointerEvents="box-none">
          <Reticle />
          {state.kind === 'submitting' && <ActivityIndicator style={StyleSheet.absoluteFill} size="large" color="#F2C53D" />}
        </View>

        <View style={styles.bottom} pointerEvents="box-none">
          {IS_PREVIEW && state.kind === 'scanning' && (
            <Button
              title="Simulate scan (preview)"
              onPress={() => onBarcodeScanned({ data: PREVIEW_CODE } as BarcodeScanningResult)}
            />
          )}
          {state.kind === 'message' && (
            <View style={styles.card}>
              <Text style={styles.title}>{state.title}</Text>
              <Text style={styles.body}>{state.body}</Text>
              <Button title="Scan again" variant="strong" onPress={reset} style={styles.cardButton} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Four rounded yellow corner brackets around the viewfinder. */
function Reticle() {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.reticle} accessible={false}>
      <View style={[styles.corner, styles.topLeft]} />
      <View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} />
      <View style={[styles.corner, styles.bottomRight]} />
    </View>
  );
}

function timeUntil(iso: string): string {
  const ms = Math.max(0, new Date(iso).getTime() - Date.now());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.ceil((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const CORNER = 46;
const CORNER_WIDTH = 7;

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    fill: { flex: 1, backgroundColor: c.background },
    cameraBackdrop: { backgroundColor: '#1A1D24' },
    center: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    overlay: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    sign: {
      backgroundColor: c.sign,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: '#E8ECF5',
      overflow: 'hidden',
      alignItems: 'center',
    },
    signTitle: { fontFamily: fonts.pixelBold, fontSize: 20, letterSpacing: 1.5, color: c.signText, paddingTop: 12 },
    signHint: { fontFamily: fonts.bold, fontSize: 14, color: c.signMuted, marginTop: 2, marginBottom: 10 },
    middle: { alignItems: 'center', justifyContent: 'center' },
    reticle: { width: 250, height: 250 },
    corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: c.accent },
    topLeft: { left: 0, top: 0, borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderTopLeftRadius: 18 },
    topRight: { right: 0, top: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderTopRightRadius: 18 },
    bottomLeft: { left: 0, bottom: 0, borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderBottomLeftRadius: 18 },
    bottomRight: { right: 0, bottom: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderBottomRightRadius: 18 },
    // Room for the raised scan button that pokes up out of the tab bar.
    bottom: { minHeight: 120, justifyContent: 'flex-end', paddingBottom: 44, gap: spacing.md },
    card: { padding: spacing.lg, gap: spacing.sm, alignItems: 'center', alignSelf: 'stretch', ...cardStyle(c), borderRadius: 18 },
    title: { fontFamily: fonts.pixelBold, fontSize: 17, letterSpacing: 1, color: c.scheme === 'dark' ? c.accent : c.text, textAlign: 'center' },
    body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: c.muted, textAlign: 'center' },
    cardButton: { marginTop: spacing.sm, alignSelf: 'center', paddingHorizontal: 30 },
  });
