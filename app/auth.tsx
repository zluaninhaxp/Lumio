import { Redirect, useLocalSearchParams } from 'expo-router';
/** Keep legacy auth deep links working with the independent pages. */
export default function LegacyAuthScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <Redirect href={mode === 'login' ? '/login' : '/register'} />;
}
