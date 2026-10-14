import { FeedbackEmptyState } from '../../../src/components/empty-state';

interface EmptyStateProps { filter?: 'all' | 'event' | 'task'; }

export function EmptyState({ filter }: EmptyStateProps) {
  const message = filter === 'event' ? 'Nenhum evento neste dia.' :
    filter === 'task' ? 'Nenhuma tarefa neste dia.' : 'Seu dia está livre!';
  return <FeedbackEmptyState variant="compact" icon={filter ? 'calendar-outline' : 'sunny-outline'}
    title={message} description={!filter ? 'Toque no botão + para adicionar um compromisso' : undefined}
  />;
}
