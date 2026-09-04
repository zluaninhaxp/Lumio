import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '../../../src/constants/theme';
import { useAppStore } from '../../../src/store';
import { getPluginDefinition } from '../../../src/plugins/registry';

export type Relation = 'client' | 'supplier' | 'employee';

interface TaskPeopleSelectorProps {
  clientId?: string;
  supplierId?: string;
  employeeId?: string;
  onChange: (relation: Relation, id?: string) => void;
  onBeforeNavigate?: (relation: Relation) => void;
}

export function TaskPeopleSelector({ clientId, supplierId, employeeId, onChange, onBeforeNavigate }: TaskPeopleSelectorProps) {
  const router = useRouter();
  const { clienteItems, fornecedorItems, employeeItems, activatedPlugins } = useAppStore();
  const [open, setOpen] = useState<Relation | null>(null);

  const data: Record<Relation, { label: string; items: Array<{ id: string; name: string }> ; selected?: string }> = {
    client: { label: 'Cliente', items: clienteItems, selected: clientId },
    supplier: { label: 'Fornecedor', items: fornecedorItems, selected: supplierId },
    employee: { label: 'Funcionário', items: employeeItems, selected: employeeId },
  };

  const openRelationPlugin = (relation: Relation) => {
    const pluginId = relation === 'client' ? 'clientes' : relation === 'supplier' ? 'fornecedores' : 'equipe';
    const navigate = () => {
      if (activatedPlugins.includes(pluginId)) {
        const route = getPluginDefinition(pluginId)?.route;
        if (route) router.push(route as any);
      } else {
        router.push(`/plugins/store?highlight=${pluginId}` as any);
      }
    };
    if (onBeforeNavigate) {
      onBeforeNavigate(relation);
      return;
    }
    setTimeout(navigate, 0);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Atribuir para</Text>
      {(Object.keys(data) as Relation[]).map((relation) => {
        const current = data[relation];
        const selected = current.items.find((item) => item.id === current.selected)?.name ?? 'Ninguém';
        const isOpen = open === relation;
        return (
          <View key={relation} style={styles.block}>
            <TouchableOpacity style={styles.summary} onPress={() => setOpen(isOpen ? null : relation)}>
              <View style={styles.summaryText}>
                <Text style={styles.label}>{current.label}</Text>
                <Text style={styles.value} numberOfLines={1}>{selected}</Text>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={17} color={Colors.textMuted} />
            </TouchableOpacity>
            {isOpen && (
              <View style={styles.optionsPanel}>
                <View style={styles.optionsHeader}>
                  <Text style={styles.optionsTitle}>Vincular {current.label.toLowerCase()}</Text>
                  <TouchableOpacity style={styles.addRelationChip} onPress={() => openRelationPlugin(relation)}>
                    <Ionicons name="add" size={15} color={Colors.accent} />
                    <Text style={styles.addRelationText}>Novo</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.options}>
                  <TouchableOpacity
                    style={[styles.chip, !current.selected && styles.chipActive]}
                    onPress={() => { onChange(relation); setOpen(null); }}
                  >
                    <Text style={[styles.chipText, !current.selected && styles.chipTextActive]}>Não atribuir</Text>
                  </TouchableOpacity>
                  {current.items.map((item) => {
                    const active = item.id === current.selected;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => { onChange(relation, item.id); setOpen(null); }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  title: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  block: { gap: 4 },
  summary: {
    minHeight: 42,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryText: { flex: 1, gap: 1 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs, color: Colors.textMuted },
  value: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.sm, color: Colors.primary },
  optionsPanel: {
    marginTop: 2,
    padding: Spacing.sm,
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionsTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  addRelationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: '#FFFFFF',
  },
  addRelationText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.accent,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
});
