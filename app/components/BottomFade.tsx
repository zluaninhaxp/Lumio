import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/constants/theme';

export function BottomFade() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(239,239,237,0)', Colors.bg]}
      style={styles.bottom}
    />
  );
}

const styles = StyleSheet.create({
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 10,
    zIndex: 10,
    elevation: 2,
  },
});
