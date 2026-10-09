import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ScrollView,
  TouchableOpacity,
  Text,
  TextInput,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ControlOpacity, Colors, Spacing, Radius, FontSize, SurfaceStyles } from '../../../src/constants/theme';

interface FinanceFilterChipsProps {
  options: string[];
  selected: string;
  onSelect: (filter: string) => void;
  search: string;
  searchVisible: boolean;
  onSearchChange: (text: string) => void;
  onSearchToggle: () => void;
}

export function FinanceFilterChips({
  options,
  selected,
  onSelect,
  search,
  searchVisible,
  onSearchChange,
  onSearchToggle,
}: FinanceFilterChipsProps) {
  const searchAnimation = useRef(new Animated.Value(searchVisible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(searchAnimation, {
      toValue: searchVisible ? 1 : 0,
      duration: searchVisible ? 260 : 180,
      useNativeDriver: true,
    }).start();
  }, [searchAnimation, searchVisible]);

  const searchOffset = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [32, 0],
  });
  const optionsOpacity = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.optionsLayer, { opacity: optionsOpacity, transform: [{ translateX: searchOffset }] }]}
        pointerEvents={searchVisible ? 'none' : 'auto'}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {options.map((option) => {
            const active = selected === option;
            const isIncome = option === 'Entradas';
            const isExpense = option === 'Saídas';

            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.chip,
                  active && styles.chipActive,
                  active && isIncome && styles.chipIncome,
                  active && isExpense && styles.chipExpense,
                ]}
                onPress={() => onSelect(option)}
                activeOpacity={ControlOpacity.pressed}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      <Animated.View
        style={[styles.searchLayer, { opacity: searchAnimation, transform: [{ translateX: searchOffset }] }]}
        pointerEvents={searchVisible ? 'auto' : 'none'}
      >
        <View style={styles.searchInputWrap}>
          <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={onSearchToggle} hitSlop={8} accessibilityLabel="Fechar busca">
            <Ionicons name="chevron-back" size={19} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={onSearchChange}
            placeholder="Buscar transação..."
            placeholderTextColor={Colors.placeholder}
            autoFocus={searchVisible}
            returnKeyType="search"
            accessibilityLabel="Buscar transações"
          />
          {search.length > 0 && (
            <TouchableOpacity activeOpacity={ControlOpacity.pressed}
              onPress={() => onSearchChange('')}
              hitSlop={8}
              accessibilityLabel="Limpar busca"
            >
              <Ionicons name="close-circle" size={18} color={Colors.iconMuted} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 42,
    backgroundColor: Colors.appBackground,
  },
  optionsLayer: {
    flex: 1,
  },
  content: {
    paddingLeft: 0,
    paddingRight: 0,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  chip: { minHeight: 48, minWidth: 48, justifyContent: "center",
      ...SurfaceStyles.filter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipIncome: { backgroundColor: Colors.actionBackground, borderColor: Colors.accentIcon },
  chipExpense: { backgroundColor: Colors.dangerActionBackground, borderColor: Colors.dangerIcon },
  chipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  chipTextActive: { color: Colors.onAction },
  searchLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 42,
    zIndex: 2,
  },
  searchInputWrap: {
      ...SurfaceStyles.control,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingVertical: 0,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
});
