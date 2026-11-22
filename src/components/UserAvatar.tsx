import { Avatar } from '@/components/Avatar';
import { PetBadge } from '@/components/PetBadge';

type Props = {
  name: string;
  seed: string;
  size?: number;
  avatarPetId?: string | null;
  avatarIsGold?: boolean;
};

/** Profile image: pet sprite when set, otherwise initials on a line-colored circle. */
export function UserAvatar({ name, seed, size = 44, avatarPetId, avatarIsGold = false }: Props) {
  if (avatarPetId) {
    return <PetBadge petId={avatarPetId} owned isGold={avatarIsGold} size={size} />;
  }
  return <Avatar name={name} seed={seed} size={size} />;
}