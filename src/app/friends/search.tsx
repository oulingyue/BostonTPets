import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { UserRow } from '@/components/UserRow';
import { searchUsers, type UserSummary } from '@/lib/api';
import { fonts, hardShadow, spacing, usePalette, useStyles, type Palette } from '@/theme';

const DEBOUNCE_MS = 250;
/** Same minimum as the social function. */
const MIN_QUERY = 3;

type Results = { query: string; users: UserSummary[] } | { query: string; error: string };

export default function FindPeople() {
  const styles = useStyles(makeStyles);
  const c = usePalette();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const query = input.trim().replace(/\s+/g, ' ');
  const tooShort = query.length < MIN_QUERY;

  useEffect(() => {
    if (tooShort) return; // old results are ignored while the query is too short
    // Debounce, and ignore responses for queries the user has already typed past.
    let cancelled = false;
    const timer = setTimeout(() => {
      searchUsers(query)
        .then((users) => !cancelled && setResults({ query, users }))
        .catch((e) => !cancelled && setResults({ query, error: e instanceof Error ? e.message : String(e) }));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, tooShort]);

  const pending = !tooShort && results?.query !== query;
  const users = results && 'users' in results ? results.users : [];

  return (
    <FlatList
      data={tooShort || pending ? [] : users}
      keyExtractor={(u) => u.id}
      renderItem={({ item }) => <UserRow user={item} />}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={
        <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
          <Text style={styles.label} nativeID="search-label">
            Search by name
          </Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Name"
              placeholderTextColor={c.muted}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="search"
              accessibilityLabelledBy="search-label"
              accessibilityLabel="Search by name"
              clearButtonMode="while-editing"
            />
          </View>
          <Text style={styles.hint}>
            {tooShort
              ? `Type at least ${MIN_QUERY} characters.`
              : `Names that contain “${query}”.`}
          </Text>
        </View>
      }
      ListEmptyComponent={
        tooShort ? (
          <Text style={styles.empty}>
            Following someone lets you see their collection. They don’t need to approve it.
          </Text>
        ) : pending ? (
          <ActivityIndicator style={{ marginTop: spacing.lg }} />
        ) : results && 'error' in results ? (
          <Text style={[styles.empty, { color: c.danger }]}>{results.error}</Text>
        ) : (
          <Text style={styles.empty}>No one with a username starting with “{query}”.</Text>
        )
      }
    />
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { padding: spacing.md, gap: 10 },
    label: { fontFamily: fonts.heavy, fontSize: 13, color: c.muted },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 48,
      backgroundColor: c.input,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      ...hardShadow(c),
    },
    input: { flex: 1, fontFamily: fonts.bold, fontSize: 17, paddingVertical: 12, color: c.text },
    hint: { fontFamily: fonts.body, fontSize: 12, color: c.muted },
    empty: { fontFamily: fonts.bold, textAlign: 'center', color: c.muted, padding: spacing.lg },
  });
