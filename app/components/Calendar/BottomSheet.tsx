import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, Radius, Spacing, SurfaceStyles } from '../../../src/constants/theme';

const SHEET_HEIGHT = 420;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  sheetHeight?: number | `${number}%`;
  dismissible?: boolean;
}

export interface BottomSheetHandle {
  close: () => void;
}

export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(function BottomSheet({
  visible,
  onClose,
  children,
  height = SHEET_HEIGHT,
  minHeight = 0,
  maxHeight,
  sheetHeight,
  dismissible = true,
}, ref) {
  const resolvedSheetHeight = typeof sheetHeight === 'string'
    ? SCREEN_HEIGHT * (parseFloat(sheetHeight) / 100)
    : sheetHeight;
  const translateY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const heightRef = useRef(height);
  const closingRef = useRef(false);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;
  heightRef.current = height;

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
      translateY.setValue(height);
      backdropOpacity.setValue(0);
    }
  }, [visible, open, translateY, backdropOpacity, height]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => close()}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={() => close()}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'position' : undefined}
        >
          <Animated.View
            style={[
              styles.sheet,
              { minHeight },
              maxHeight !== undefined && { maxHeight },
              resolvedSheetHeight !== undefined && { height: resolvedSheetHeight },
              (maxHeight !== undefined || sheetHeight !== undefined) && styles.sizedSheet,
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
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
      ...SurfaceStyles.backdrop,
    ...StyleSheet.absoluteFillObject
  },
  sheet: {
      ...SurfaceStyles.overlay,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
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
