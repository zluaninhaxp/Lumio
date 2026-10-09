import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ControlOpacity, Colors, Spacing, Radius, FontSize, SurfaceStyles } from '../../../src/constants/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
  visible: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  onClose,
  visible,
}: SearchBarProps) {
  return (
    <View style={[styles.container, !visible && styles.hidden]}>
      <Ionicons name="search-outline" size={18} color={Colors.iconMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder="Buscar por descrição, categoria ou valor..."
        placeholderTextColor={Colors.placeholder}
        autoFocus={visible}
      />
      {value.length > 0 && (
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={Colors.iconMuted} />
        </TouchableOpacity>
      )}
      <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={onClose} hitSlop={8}>
        <Ionicons name="chevron-up" size={20} color={Colors.iconMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
      ...SurfaceStyles.control,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm
  },
  hidden: { display: 'none' },
  input: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.primary,
    paddingVertical: 0,
  },
});
