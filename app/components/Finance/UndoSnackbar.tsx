import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';

export interface UndoSnackbarRef {
  show: (ids: string[]) => void;
  dismiss: () => void;
}

interface UndoSnackbarProps {
  onUndo: () => void;
}

export const UndoSnackbar = forwardRef<UndoSnackbarRef, UndoSnackbarProps>(
  function UndoSnackbar({ onUndo }, ref) {
    const [visible, setVisible] = useState(false);
    const [count, setCount] = useState(0);
    const translateY = useRef(new Animated.Value(100)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = useCallback(() => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }, []);

    const dismiss = useCallback(() => {
      clearTimer();
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
      });
    }, [translateY, clearTimer]);

    const show = useCallback(
      (ids: string[]) => {
        clearTimer();
        setCount(ids.length);
        setVisible(true);
        translateY.setValue(100);
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start();

        timerRef.current = setTimeout(() => {
          dismiss();
        }, 5000);
      },
      [translateY, dismiss, clearTimer]
    );

    useImperativeHandle(ref, () => ({ show, dismiss }), [show, dismiss]);

    useEffect(() => {
      return clearTimer;
    }, [clearTimer]);

    if (!visible) return null;

    return (
      <Animated.View
        style={[styles.container, { transform: [{ translateY }] }]}
        pointerEvents="box-none"
      >
        <View style={styles.bar}>
          <View style={styles.left}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
            <Text style={styles.text}>
              {count === 1
                ? 'Transação excluída'
                : `${count} transações excluídas`}
            </Text>
          </View>
          <TouchableOpacity onPress={onUndo} style={styles.undoBtn}>
            <Text style={styles.undoText}>Desfazer</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.xl,
    right: Spacing.xl,
    zIndex: 100,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  text: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: '#FFF',
  },
  undoBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  undoText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.sm,
    color: Colors.accent,
  },
});
