import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Keyboard, Platform, ScrollView, TextInput, type ScrollViewProps } from 'react-native';
import { getModalFocusScrollOffset } from '../utils/modalFocus';

/** The modal viewport already avoids the keyboard. Reveal focus within that
 * viewport without adding a second keyboard-sized spacer to the form. */
export const ModalScrollView = forwardRef<ScrollView, ScrollViewProps>(function ModalScrollView(
  { onFocus, onLayout, onScroll, onContentSizeChange, keyboardShouldPersistTaps = 'handled', ...props }, ref,
) {
  const scroll = useRef<ScrollView>(null);
  const focused = useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput>>(null);
  const offset = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useImperativeHandle(ref, () => scroll.current!, []);
  const reveal = useCallback(() => {
    const input = focused.current;
    if (Platform.OS === 'web' || !input || input !== TextInput.State.currentlyFocusedInput() || !Keyboard.isVisible()) return;
    scroll.current?.getNativeScrollRef()?.measureInWindow((_: number, top: number, __: number, height: number) => {
      input.measureInWindow((___, inputTop, ____, inputHeight) => {
        if (focused.current !== input || input !== TextInput.State.currentlyFocusedInput()) return;
        const nextOffset = getModalFocusScrollOffset({ offset: offset.current, viewportTop: top, viewportHeight: height,
          keyboardTop: Keyboard.metrics()?.screenY ?? Infinity, inputTop, inputHeight });
        if (Math.abs(nextOffset - offset.current) > 1) scroll.current?.scrollTo({ y: nextOffset, animated: true });
      });
    });
  }, []);
  const scheduleReveal = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(reveal, 80);
  }, [reveal]);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', scheduleReveal);
    return () => { show.remove(); if (timer.current) clearTimeout(timer.current); };
  }, [scheduleReveal]);
  return <ScrollView {...props} ref={scroll} keyboardShouldPersistTaps={keyboardShouldPersistTaps} scrollEventThrottle={16}
    onFocus={event => { if (Platform.OS !== 'web') { focused.current = TextInput.State.currentlyFocusedInput(); scheduleReveal(); } onFocus?.(event); }}
    onLayout={event => { scheduleReveal(); onLayout?.(event); }}
    onContentSizeChange={(width, height) => { scheduleReveal(); onContentSizeChange?.(width, height); }}
    onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }} />;
});
