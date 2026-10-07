import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
  useWindowDimensions,
  ScrollView,
  Keyboard,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, SurfaceStyles } from '../../../src/constants/theme';
import { getBottomSheetLayout, isBottomKeyboard } from '../../../src/utils/bottomSheetLayout';

const SHEET_HEIGHT = 420;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Initial animation distance only; does not set the sheet's layout height. */
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  sheetHeight?: number | `${number}%`;
  dismissible?: boolean;
}

export interface BottomSheetHandle {
  close: () => void;
}

// A native Modal has its own window: measure its insets rather than inheriting
// the screen/tab navigator's already-inset viewport.
export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(function BottomSheet(props, ref) {
  const modalRef = useRef<BottomSheetHandle | null>(null);
  return (
    <Modal visible={props.visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={() => modalRef.current?.close()}>
      <SafeAreaProvider>
        <BottomSheetContent {...props} ref={ref} modalRef={modalRef} />
      </SafeAreaProvider>
    </Modal>
  );
});

const BottomSheetContent = forwardRef<BottomSheetHandle, BottomSheetProps & {
  modalRef: React.MutableRefObject<BottomSheetHandle | null>;
}>(function BottomSheetContent({
  visible,
  onClose,
  children,
  height = SHEET_HEIGHT,
  minHeight = 0,
  maxHeight,
  sheetHeight,
  dismissible = true,
  modalRef,
}, ref) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [keyboardFrame, setKeyboardFrame] = useState(Keyboard.metrics());
  const keyboardVisible = isBottomKeyboard(keyboardFrame, windowWidth, Dimensions.get('screen').height, insets.bottom);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);
  const layout = getBottomSheetLayout({
    viewportHeight: viewportHeight ?? windowHeight,
    topInset: insets.top,
    bottomInset: insets.bottom,
    keyboardVisible,
    paddingBottom: Spacing.xxxl,
    minHeight, maxHeight, sheetHeight,
  });
  // Bounded consumers (sales, quotes, report editor) already own their scroll
  // and footer. Natural-height forms get an overflow-only scroll viewport.
  const ownsScroll = maxHeight !== undefined || sheetHeight !== undefined;
  const translateY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const heightRef = useRef(height);
  const closingRef = useRef(false);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', event => setKeyboardFrame(event.endCoordinates));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardFrame(undefined));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const open = useCallback(() => {
    closingRef.current = false;
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity]);

  const close = useCallback(
    (force = false) => {
      if ((!force && !dismissibleRef.current) || closingRef.current) return;
      closingRef.current = true;
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: heightRef.current,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onCloseRef.current();
        else closingRef.current = false;
      });
    },
    [translateY, backdropOpacity]
  );

  useImperativeHandle(ref, () => ({ close: () => close(true) }), [close]);
  useImperativeHandle(modalRef, () => ({ close: () => close() }), [close]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => dismissibleRef.current,
      onMoveShouldSetPanResponder: (_, gesture) => dismissibleRef.current && gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => { if (dismissibleRef.current) translateY.setValue(Math.max(0, gesture.dy)); },
      onPanResponderRelease: (_, gesture) => {
        if (dismissibleRef.current && (gesture.dy > 90 || gesture.vy > 0.8)) {
          close();
          return;
        }
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 10,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 10,
        }).start();
      },
    }),
  ).current;

  useEffect(() => {
    if (visible) {
      open();
    } else {
      translateY.setValue(Math.max(height, heightRef.current));
      backdropOpacity.setValue(0);
    }
  }, [visible, open, translateY, backdropOpacity, height]);

  return (
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={() => close()}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          pointerEvents="box-none"
          style={styles.keyboardViewport}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View pointerEvents="box-none" style={[styles.sheetViewport, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}
            onLayout={({ nativeEvent }) => setViewportHeight(nativeEvent.layout.height)}>
          <Animated.View
            onLayout={({ nativeEvent }) => { heightRef.current = nativeEvent.layout.height; }}
            style={[
              styles.sheet,
              { minHeight: layout.minHeight, maxHeight: layout.maxHeight, paddingBottom: layout.paddingBottom },
              layout.height !== undefined && { height: layout.height },
              styles.sizedSheet,
              { transform: [{ translateY }] },
            ]}
          >
             <View
               style={styles.handleHitArea}
               hitSlop={{ top: 16, bottom: 16, left: 48, right: 48 }}
               {...panResponder.panHandlers}
             >
               <View style={styles.handle} />
             </View>
            {ownsScroll ? children : (
              <ScrollView style={styles.naturalContent} keyboardShouldPersistTaps="handled"
                nestedScrollEnabled showsVerticalScrollIndicator={false}
                scrollEnabled={contentHeight > scrollHeight}
                onLayout={({ nativeEvent }) => setScrollHeight(nativeEvent.layout.height)}
                onContentSizeChange={(_, measuredHeight) => setContentHeight(measuredHeight)}>
                {children}
              </ScrollView>
            )}
          </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardViewport: { flex: 1 },
  sheetViewport: { flex: 1, justifyContent: 'flex-end' },
  naturalContent: { flexGrow: 0, flexShrink: 1 },
  backdrop: {
      ...SurfaceStyles.backdrop,
    ...StyleSheet.absoluteFillObject
  },
  sheet: {
      ...SurfaceStyles.overlay,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    flexShrink: 1,
  },
  sizedSheet: {
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  handleHitArea: {
    width: '100%',
    height: 32,
    alignItems: 'center',
  },
});
