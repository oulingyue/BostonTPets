import { reloadAppAsync } from 'expo';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Button } from '@/components/ui/Button';
import { allFontsMap, familiesFor, fontChoice, FONT_OPTIONS, saveFontChoice } from '@/lib/fontChoice';
import { cardStyle, fonts, spacing, usePalette, useStyles, type Palette } from '@/theme';

// Font picker: try each downloaded font as the app's pixel font (titles, headings and numbers), optionally
// for all text. Open /dev/fonts, or tap "Font picker" at the bottom of Profile. Available in every build,
// like the reveal playground. Picking saves the choice and reloads the app (see src/lib/fontChoice.ts).

type Scope = 'headings' | 'all';

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'headings', label: 'Headings only' },
  { value: 'all', label: 'All text' },
];

export default function FontPicker() {
  const styles = useStyles(makeStyles);
  const c = usePalette();
  const [previewsLoaded] = useFonts(allFontsMap);
  const [applying, setApplying] = useState<string | null>(null);

  const apply = async (font: string, everywhere: boolean) => {
    if (applying || (font === fontChoice.font && everywhere === fontChoice.everywhere)) return;
    setApplying(font);
    try {
      await saveFontChoice({ font, everywhere });
    } catch (e) {
      setApplying(null);
      Alert.alert('Could not save the font', e instanceof Error ? e.message : String(e));
      return;
    }
    // A reload restarts the app, so the timer only fires if the reload didn't happen.
    const askForRestart = () => {
      setApplying(null);
      Alert.alert('Font saved', 'Close and reopen the app to see it.');
    };
    reloadAppAsync('Font changed').then(() => setTimeout(askForRestart, 4000), askForRestart);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Fonts' }} />
      <Text style={styles.intro}>
        Pick the pixel font for titles, headings and numbers. The app reloads to show it everywhere.
      </Text>
      <SegmentedControl
        options={SCOPES}
        value={fontChoice.everywhere ? 'all' : 'headings'}
        onChange={(scope) => apply(fontChoice.font, scope === 'all')}
      />
      {FONT_OPTIONS.map((option) => {
        const inUse = option.id === fontChoice.font;
        const family = familiesFor(option);
        const regular = previewsLoaded ? { fontFamily: family.regular } : null;
        const bold = previewsLoaded ? { fontFamily: family.bold } : null;
        return (
          <Pressable
            key={option.id}
            onPress={() => apply(option.id, fontChoice.everywhere)}
            style={({ pressed }) => [styles.card, inUse && styles.cardInUse, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: inUse, busy: applying === option.id }}
          >
            <View style={styles.cardTop}>
              <Text style={[styles.name, bold]} numberOfLines={1}>
                {option.label}
              </Text>
              {applying === option.id ? (
                <ActivityIndicator color={c.text} />
              ) : (
                inUse && <Text style={styles.inUse}>IN USE</Text>
              )}
            </View>
            <Text style={[styles.heading, bold]}>LEVEL UP! 12 / 35</Text>
            <Text style={[styles.sample, regular]}>Rare pet found at Park Street</Text>
            {option.note && <Text style={styles.note}>{option.note}</Text>}
          </Pressable>
        );
      })}
      {/* Opened by link (or after a reload on web), there's no screen behind this one. */}
      {!router.canGoBack() && <Button title="Back to the app" variant="outline" onPress={() => router.replace('/')} />}
    </ScrollView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    intro: { fontFamily: fonts.body, fontSize: 14, color: c.muted },
    card: { ...cardStyle(c), padding: spacing.md, gap: 6 },
    cardInUse: { backgroundColor: c.mine },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    name: { flex: 1, fontSize: 18, color: c.text },
    inUse: {
      fontFamily: fonts.pixelBold,
      fontSize: 11,
      letterSpacing: 1,
      color: c.onAccent,
      backgroundColor: c.accent,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      overflow: 'hidden',
    },
    heading: { fontSize: 20, letterSpacing: 1, color: c.text },
    sample: { fontSize: 15, color: c.text },
    note: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
  });
