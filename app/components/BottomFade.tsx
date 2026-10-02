import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/constants/theme';

export function BottomFade() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(248,252,250,0)', Colors.appBackground]}
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
