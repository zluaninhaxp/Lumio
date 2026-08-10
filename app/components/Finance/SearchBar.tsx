import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';

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
      <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder="Buscar por descrição, categoria ou valor..."
        placeholderTextColor={Colors.textMuted}
        autoFocus={visible}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onClose} hitSlop={8}>
        <Ionicons name="chevron-up" size={20} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
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
