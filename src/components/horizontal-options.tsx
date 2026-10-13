import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewProps, type StyleProp, type TextStyle } from 'react-native';
import { Spacing, TextStyles } from '../constants/theme';

export function getHorizontalContinuation(viewport: number, content: number, offset: number) {
  if (viewport <= 0 || content <= viewport + 1) return '';
  return offset + viewport >= content - 1 ? 'Deslize para voltar às opções' :
    offset > 1 ? 'Deslize para ver outras opções' : 'Deslize para ver mais opções';
}

/** A measured continuation hint for option strips; hidden when all choices fit. */
export function HorizontalOptions({ onLayout, onContentSizeChange, onScroll, children, hintStyle, ...props }: Omit<ScrollViewProps, 'horizontal'> & { hintStyle?: StyleProp<TextStyle> }) {
  const geometry = useRef({ viewport: 0, content: 0, offset: 0 });
  const [hint, setHint] = useState('');
  const update = () => {
    const { viewport, content, offset } = geometry.current;
    const next = getHorizontalContinuation(viewport, content, offset);
    setHint(previous => previous === next ? previous : next);
  };
  return <View>
    <ScrollView {...props} horizontal showsHorizontalScrollIndicator={false} scrollEventThrottle={16}
      onLayout={event => { geometry.current.viewport = event.nativeEvent.layout.width; update(); onLayout?.(event); }}
      onContentSizeChange={(width, height) => { geometry.current.content = width; update(); onContentSizeChange?.(width, height); }}
      onScroll={event => { geometry.current.offset = event.nativeEvent.contentOffset.x; update(); onScroll?.(event); }}>
      {children}
    </ScrollView>
    {!!hint && <Text pointerEvents="none" style={[styles.hint, hintStyle]}>{hint}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  hint: {
    ...TextStyles.metadata,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    flexShrink: 1,
  },
});
