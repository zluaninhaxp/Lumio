import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../../../src/constants/theme';
import type { Atendimento, ClienteItem, Orcamento } from '../../../src/store';

interface AppointmentFormProps {
  initialDate: string;
  clients: ClienteItem[];
  quotes: Orcamento[];
  onSave: (data: Omit<Atendimento, 'id' | 'calendarEventId'>) => void;
  onCancel: () => void;
}

export function AppointmentForm({ initialDate, clients, quotes, onSave, onCancel }: AppointmentFormProps) {
  const [clientId, setClientId] = useState<string | undefined>();
  const [quoteId, setQuoteId] = useState<string | undefined>();
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [service, setService] = useState('');
  const availableQuotes = useMemo(() => quotes.filter((quote) => quote.status === 'aprovado' && (!clientId || quote.clientId === clientId)), [quotes, clientId]);
  const save = () => {
    const durationValue = Number(duration) || 0;
    if (!service.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || durationValue <= 0) return;
    onSave({ clientId, quoteId, date, time, duration: durationValue, service: service.trim(), status: 'confirmado', createdAt: new Date().toISOString() });
  };
  return <View style={styles.container}><Text style={styles.title}>Novo atendimento</Text><Text style={styles.label}>Serviço</Text><TextInput style={styles.input} value={service} onChangeText={setService} placeholder="Ex: Avaliação inicial" placeholderTextColor={Colors.textMuted} /><Text style={styles.label}>Cliente (opcional)</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><TouchableOpacity style={[styles.chip, !clientId && styles.activeChip]} onPress={() => { setClientId(undefined); setQuoteId(undefined); }}><Text style={[styles.chipText, !clientId && styles.activeChipText]}>Sem cliente</Text></TouchableOpacity>{clients.map((client) => <TouchableOpacity key={client.id} style={[styles.chip, clientId === client.id && styles.activeChip]} onPress={() => { setClientId(client.id); setQuoteId(undefined); }}><Text style={[styles.chipText, clientId === client.id && styles.activeChipText]}>{client.name}</Text></TouchableOpacity>)}</ScrollView>{availableQuotes.length > 0 && <><Text style={styles.label}>Orçamento aprovado (opcional)</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><TouchableOpacity style={[styles.chip, !quoteId && styles.activeChip]} onPress={() => setQuoteId(undefined)}><Text style={[styles.chipText, !quoteId && styles.activeChipText]}>Sem vínculo</Text></TouchableOpacity>{availableQuotes.map((quote) => <TouchableOpacity key={quote.id} style={[styles.chip, quoteId === quote.id && styles.activeChip]} onPress={() => { setQuoteId(quote.id); if (quote.clientId) setClientId(quote.clientId); }}><Text style={[styles.chipText, quoteId === quote.id && styles.activeChipText]}>#{quote.id.slice(-6)}</Text></TouchableOpacity>)}</ScrollView></>}<Text style={styles.label}>Data (AAAA-MM-DD)</Text><TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="2026-08-14" placeholderTextColor={Colors.textMuted} /><Text style={styles.label}>Horário (HH:MM)</Text><TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="15:00" placeholderTextColor={Colors.textMuted} keyboardType="numbers-and-punctuation" /><Text style={styles.label}>Duração (minutos)</Text><TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="60" placeholderTextColor={Colors.textMuted} /><View style={styles.actions}><TouchableOpacity style={styles.cancel} onPress={onCancel}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={styles.save} onPress={save}><Text style={styles.saveText}>Agendar</Text></TouchableOpacity></View></View>;
}

const styles = StyleSheet.create({ container: { gap: Spacing.sm }, title: { color: Colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.xl, marginBottom: Spacing.sm }, label: { color: Colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, marginTop: Spacing.xs }, input: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, color: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md }, chips: { gap: Spacing.sm }, chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }, activeChip: { backgroundColor: Colors.primary, borderColor: Colors.primary }, chipText: { color: Colors.textSecondary, fontSize: FontSize.sm }, activeChipText: { color: '#FFF' }, actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg }, cancel: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' }, cancelText: { color: Colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }, save: { flex: 1, backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' }, saveText: { color: '#FFF', fontFamily: 'PlusJakartaSans_600SemiBold' } });
