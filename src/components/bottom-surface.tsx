import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../constants/theme';

/** Shared lower surface; the edge adds no layout height or touch target. */
export function BottomSurface({ children, organicEdge = true, style, ...props }: ViewProps & {
  children?: ReactNode;
  organicEdge?: boolean;
}) {
  return (
    <View {...props} style={[styles.surface, style]}>
      {organicEdge && (
        <View pointerEvents="none" style={styles.edge}>
          <Svg width="100%" height="32" viewBox="0 0 400 32" preserveAspectRatio="none">
            <Path d="M0 24 C85 24 110 4 220 9 C300 14 338 0 400 8 L400 32 L0 32Z" fill="#D6F5E8" opacity="0.12" />
            <Path d="M0 27 C100 10 144 30 245 19 C325 11 354 20 400 15 L400 32 L0 32Z" fill={Colors.bottomSurface} />
          </Svg>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { backgroundColor: Colors.bottomSurface, overflow: 'visible' },
  edge: { position: 'absolute', left: 0, right: 0, top: -24, height: 32 },
});
