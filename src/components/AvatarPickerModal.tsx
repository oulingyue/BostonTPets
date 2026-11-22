import { getPet } from '@game/catalog';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PetBadge } from '@/components/PetBadge';
import type { OwnedPet } from '@/lib/api';
import { colors, spacing } from '@/theme';

type Props = {
  visible: boolean;
  pets: OwnedPet[];
  currentPetId: string | null;
  onClose: () => void;
  onSelect: (petId: string | null) => void;
};

/** Pick a owned pet for your profile picture, or initials (clear). */
export function AvatarPickerModal({ visible, pets, currentPetId, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const sorted = [...pets].sort((a, b) => (getPet(a.pet_id)?.name ?? '').localeCompare(getPet(b.pet_id)?.name ?? ''));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md }]}>
          <View style={styles.grabber} />
          <Text style={styles.title} accessibilityRole="header">
            Profile picture
          </Text>
          <Text style={styles.subtitle}>Choose one of your pets, or use initials.</Text>
          <ScrollView contentContainerStyle={styles.grid}>
            <Pressable
              style={({ pressed }) => [styles.cell, !currentPetId && styles.cellSelected, pressed && { opacity: 0.7 }]}
              onPress={() => {
                onSelect(null);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="Use initials"
            >
              <View style={styles.initialsCircle}>
                <Text style={styles.initialsText}>Ab</Text>
              </View>
              <Text style={styles.label}>Initials</Text>
            </Pressable>
            {sorted.map((pet) => {
              const info = getPet(pet.pet_id);
              const selected = currentPetId === pet.pet_id;
              return (
                <Pressable
                  key={pet.pet_id}
                  style={({ pressed }) => [styles.cell, selected && styles.cellSelected, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    onSelect(pet.pet_id);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={info?.name ?? pet.pet_id}
                >
                  <PetBadge petId={pet.pet_id} owned isGold={pet.is_gold} size={56} />
                  <Text style={styles.label} numberOfLines={2}>
                    {info?.name ?? pet.pet_id}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    maxHeight: '80%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.locked, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 8 },
  cell: { width: 88, alignItems: 'center', padding: 8, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  cellSelected: { borderColor: colors.primary, backgroundColor: colors.background },
  initialsCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DA291C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  label: { fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'center', marginTop: 6 },
});