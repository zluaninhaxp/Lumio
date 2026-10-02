import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** Mesmo acabamento branco/mint do balão do onboarding. */
export function LumioSurfaceFill({ radius = 21 }: { radius?: number }) {
  return <LinearGradient pointerEvents="none" colors={['#FFFFFF', '#FFFFFF', '#E4F2EC']}
    locations={[0, 0.55, 1]} style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]} />;
}
