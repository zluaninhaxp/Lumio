import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius } from '../../../src/constants/theme';
import type { PublicUser } from '../../../src/types/user';

export function UserAvatar({ user, size = 36, onPress }: { user?: PublicUser | null; size?: number; onPress?: () => void }) {
  const initials = (user?.name || user?.email || 'U').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const content = user?.photo
    ? <Image source={{ uri: user.photo }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityLabel={`Foto de ${user?.name || 'usuário'}`} />
    : <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}><Text style={[styles.initials, { fontSize: Math.max(12, size * 0.34) }]}>{initials}</Text></View>;
  if (!onPress) return content;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Abrir menu da conta" hitSlop={4} style={styles.touchable}>{content}</TouchableOpacity>;
}

const styles = StyleSheet.create({
  touchable: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fallback: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold' },
});
