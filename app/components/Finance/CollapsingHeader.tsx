import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';
import { FinanceFilterChips } from './FinanceFilterChips';

interface CategoryBar {
  name: string;
  value: number;
}

interface FinanceSummary {
  entradas: number;
  saidas: number;
  saldo: number;
  categories: CategoryBar[];
  maxVal: number;
}

interface CollapsingHeaderProps {
  summary: FinanceSummary;
  scrollY: Animated.Value;
  headerMinHeight: number;
  fmt: (v: number) => string;
  filterOptions: string[];
  selectedFilter: string;
  onFilterSelect: (filter: string) => void;
  onHeightChange?: (height: number) => void;
  search: string;
  searchVisible: boolean;
  onSearchChange: (text: string) => void;
  onSearchToggle: () => void;
}

const FILTERS_STRIP_HEIGHT = 54;

export function CollapsingHeader({
  summary,
  scrollY,
  headerMinHeight,
  fmt,
  filterOptions,
  selectedFilter,
  onFilterSelect,
  onHeightChange,
  search,
  searchVisible,
  onSearchChange,
  onSearchToggle,
}: CollapsingHeaderProps) {
  const [cardHeight, setCardHeight] = useState(0);

  const headerMaxHeight = cardHeight > 0
    ? Math.max(cardHeight + FILTERS_STRIP_HEIGHT, headerMinHeight)
    : headerMinHeight;
  const diff = headerMaxHeight - headerMinHeight;

  useEffect(() => {
    if (headerMaxHeight > 0) {
      onHeightChange?.(headerMaxHeight);
    }
  }, [headerMaxHeight, onHeightChange]);

  const handleCardLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) {
      setCardHeight(h);
    }
  }, []);

  const animatedStyles = useMemo(() => {
    const translate = scrollY.interpolate({
      inputRange: [0, diff],
      outputRange: [0, -diff],
      extrapolate: 'clamp',
    });

    const cardOpacity = scrollY.interpolate({
      inputRange: [0, diff * 0.5],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    const collapsedOpacity = scrollY.interpolate({
      inputRange: [diff * 0.4, diff],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return { translate, cardOpacity, collapsedOpacity };
  }, [scrollY, diff]);

  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  useEffect(() => {
    const threshold = diff * 0.4;
    const id = scrollY.addListener(({ value }) => {
      const collapsed = value >= threshold;
      setHeaderCollapsed((prev) => (prev !== collapsed ? collapsed : prev));
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, diff]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: headerMaxHeight,
          transform: [{ translateY: animatedStyles.translate }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.cardWrapper,
          { opacity: animatedStyles.cardOpacity },
        ]}
        onLayout={handleCardLayout}
        pointerEvents={headerCollapsed ? 'none' : 'auto'}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Entradas</Text>
              <Text style={styles.entradas}>{fmt(summary.entradas)}</Text>
            </View>
            <View style={styles.saidasCol}>
              <Text style={styles.summaryLabel}>Saídas</Text>
              <Text style={styles.saidas}>{fmt(summary.saidas)}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.periodLabel}>Saldo do período</Text>
          <Text
            style={[
              styles.saldo,
              { color: summary.saldo >= 0 ? Colors.accent : Colors.danger },
            ]}
          >
            {fmt(summary.saldo)}
          </Text>

          {summary.categories.length > 0 && (
            <View style={styles.catBars}>
              {summary.categories.map((cat) => (
                <View key={cat.name} style={styles.catRow}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.catValue}>{fmt(cat.value)}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.round(
                            (cat.value / summary.maxVal) * 100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

      </Animated.View>

      <Animated.View
        style={[
          styles.collapsedRowWrapper,
          { opacity: animatedStyles.collapsedOpacity },
        ]}
        pointerEvents={headerCollapsed ? 'auto' : 'none'}
      >
        <View style={styles.collapsedRow}>
          <Text style={styles.collapsedLabel}>Saldo</Text>
          <Text
            style={[
              styles.collapsedSaldo,
              { color: summary.saldo >= 0 ? Colors.accent : Colors.danger },
            ]}
          >
            {fmt(summary.saldo)}
          </Text>
        </View>
      </Animated.View>

      <View style={styles.filtersWrapper}>
        <FinanceFilterChips
          options={filterOptions}
          selected={selectedFilter}
          onSelect={onFilterSelect}
          search={search}
          searchVisible={searchVisible}
          onSearchChange={onSearchChange}
          onSearchToggle={onSearchToggle}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
    paddingHorizontal: Spacing.xl,
  },
  cardWrapper: {
    paddingTop: Spacing.xs,
  },
  summaryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  summaryLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  entradas: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.lg,
    color: Colors.accent,
  },
  saidasCol: { alignItems: 'flex-end' },
  saidas: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.lg,
    color: Colors.danger,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  periodLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  saldo: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: FontSize.xxxl,
    marginBottom: Spacing.xl,
  },
  catBars: { gap: Spacing.md },
  catRow: { gap: 4 },
  catName: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  catValue: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    position: 'absolute',
    right: 0,
  },
  barTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },

  collapsedRowWrapper: {
    position: 'absolute',
    bottom: 54,
    left: Spacing.xl,
    right: Spacing.xl,
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  collapsedLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  collapsedSaldo: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.lg,
  },

  filtersWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    marginHorizontal: -Spacing.sm,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.bg,
  },

});
