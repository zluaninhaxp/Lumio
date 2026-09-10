import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, Radius, Spacing } from '../../../src/constants/theme';

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
}

export function BottomSheet({
  visible,
  onClose,
  children,
  height = SHEET_HEIGHT,
  minHeight = 0,
  maxHeight,
  sheetHeight,
}: BottomSheetProps) {
  const resolvedSheetHeight = typeof sheetHeight === 'string'
    ? SCREEN_HEIGHT * (parseFloat(sheetHeight) / 100)
    : sheetHeight;
  const translateY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const open = useCallback(() => {
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
    (cb?: () => void) => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (cb) cb();
        else onClose();
      });
    },
    [translateY, backdropOpacity, onClose, height]
  );

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
             <View style={styles.handle} />
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
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
});
