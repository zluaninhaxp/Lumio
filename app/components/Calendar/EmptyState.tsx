import { StyleSheet } from 'react-native';
import { FeedbackEmptyState } from '../../../src/components/empty-state';
import { Spacing } from '../../../src/constants/theme';
import { FAB_LAYOUT } from './FAB';

interface EmptyStateProps { filter?: 'all' | 'event' | 'task'; }

export function EmptyState({ filter }: EmptyStateProps) {
  const message = filter === 'event' ? 'Nenhum evento neste dia.' :
    filter === 'task' ? 'Nenhuma tarefa neste dia.' : 'Seu dia está livre!';
  return <FeedbackEmptyState variant="compact" icon={filter ? 'calendar-outline' : 'sunny-outline'}
    title={message} description={!filter ? 'Toque no botão + para adicionar um compromisso' : undefined}
    style={styles.clearance} />;
}

// Keep the reading area out of the FAB's horizontal band, even in a short expanded month.
const styles = StyleSheet.create({ clearance: { paddingRight: Spacing.xl + FAB_LAYOUT.size + Spacing.lg } });
