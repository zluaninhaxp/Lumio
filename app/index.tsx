import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/src/store';

const BG_COLOR = '#007F6A';
const SHOW_DURATION = 2000;

export default function Index() {
  const router = useRouter();
  const setHasSeenSplash = useAppStore((s) => s.setHasSeenSplash);

  useEffect(() => {
    setHasSeenSplash(true);
    const timer = setTimeout(() => {
      router.replace('/onboarding');
    }, SHOW_DURATION);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lumio</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 48,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
});
