import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { UserRow } from '@/components/UserRow';
import { searchUsers, type UserSummary } from '@/lib/api';
import { HANDLE_MIN, normalizeHandle } from '@/lib/handle';
import { colors, spacing } from '@/theme';

const DEBOUNCE_MS = 250;

type Results = { query: string; users: UserSummary[] } | { query: string; error: string };

export default function FindPeople() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const query = normalizeHandle(input);
  const tooShort = query.length < HANDLE_MIN;

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
            Search by username
          </Text>
          <View style={styles.inputWrap}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="username"
              placeholderTextColor="#8A8780"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="search"
              accessibilityLabelledBy="search-label"
              accessibilityLabel="Search by username"
              clearButtonMode="while-editing"
            />
          </View>
          <Text style={styles.hint}>
            {tooShort
              ? `Type at least ${HANDLE_MIN} characters.`
              : `Usernames that start with “${query}”.`}
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
          <Text style={[styles.empty, { color: colors.danger }]}>{results.error}</Text>
        ) : (
          <Text style={styles.empty}>No one with a username starting with “{query}”.</Text>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm },
  label: { fontSize: 13, fontWeight: '600', color: '#4F4F4F' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  at: { fontSize: 17, fontWeight: '700', color: colors.muted },
  input: { flex: 1, fontSize: 17, paddingVertical: 12, color: colors.text },
  hint: { fontSize: 12, color: colors.muted },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.lg },
});
