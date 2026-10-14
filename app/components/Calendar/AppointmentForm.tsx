import { HorizontalOptions } from '../../../src/components/horizontal-options';
import { FormTextInput } from '../../../src/components/form-text-input';
import { useSheetDraft } from '../../../src/components/sheet-draft';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ControlOpacity, Colors, FontSize, Radius, Spacing, SurfaceStyles } from '../../../src/constants/theme';
import type { Atendimento, ClienteItem, Orcamento } from '../../../src/store';
import { taskFormStyles } from '../Tasks/taskFormStyles';
import { useRef } from "react";

interface AppointmentFormProps {
  initialDate: string;
  clients: ClienteItem[];
  quotes: Orcamento[];
  onSave: (data: Omit<Atendimento, 'id' | 'calendarEventId'>) => void | Promise<void>;
  onCancel: () => void;
    locked?: boolean;
}

export function AppointmentForm({ initialDate, clients, quotes, onSave, onCancel , locked = false }: AppointmentFormProps) {
  const [clientId, setClientId] = useState<string | undefined>();
  const [quoteId, setQuoteId] = useState<string | undefined>();
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [service, setService] = useState('');
  const requestClose = useSheetDraft({ clientId, quoteId, date, time, duration, service }, onCancel);

  const availableQuotes = useMemo(() => quotes.filter((quote) => quote.status === 'aprovado' && (!clientId || quote.clientId === clientId)), [quotes, clientId]);
  const saveBusy = useRef(false);
    const [saving, setSaving] = useState(false);
    const save = async () => { if (saveBusy.current) return; saveBusy.current = true; setSaving(true); try {

          const durationValue = Number(duration) || 0;
          if (!service.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || durationValue <= 0) return;
          await onSave({ clientId, quoteId, date, time, duration: durationValue, service: service.trim(), status: 'confirmado', createdAt: new Date().toISOString() });

      } finally { saveBusy.current = false; setSaving(false); } };
  return <View style={styles.container}><Text style={styles.title}>Novo atendimento</Text><Text style={styles.label}>Serviço</Text><FormTextInput style={styles.input} value={service} onChangeText={setService} placeholder="Ex: Avaliação inicial" placeholderTextColor={Colors.placeholder} editable={!locked && !saving} /><Text style={styles.label}>Cliente (opcional)</Text><HorizontalOptions contentContainerStyle={styles.chips}><TouchableOpacity activeOpacity={ControlOpacity.pressed} style={[styles.chip, !clientId && styles.activeChip]} onPress={() => { setClientId(undefined); setQuoteId(undefined); }}><Text style={[styles.chipText, !clientId && styles.activeChipText]}>Sem cliente</Text></TouchableOpacity>{clients.map((client) => <TouchableOpacity activeOpacity={ControlOpacity.pressed} key={client.id} style={[styles.chip, clientId === client.id && styles.activeChip]} onPress={() => { setClientId(client.id); setQuoteId(undefined); }}><Text style={[styles.chipText, clientId === client.id && styles.activeChipText]}>{client.name}</Text></TouchableOpacity>)}</HorizontalOptions>{availableQuotes.length > 0 && <><Text style={styles.label}>Orçamento aprovado (opcional)</Text><HorizontalOptions contentContainerStyle={styles.chips}><TouchableOpacity activeOpacity={ControlOpacity.pressed} style={[styles.chip, !quoteId && styles.activeChip]} onPress={() => setQuoteId(undefined)}><Text style={[styles.chipText, !quoteId && styles.activeChipText]}>Sem vínculo</Text></TouchableOpacity>{availableQuotes.map((quote) => <TouchableOpacity activeOpacity={ControlOpacity.pressed} key={quote.id} style={[styles.chip, quoteId === quote.id && styles.activeChip]} onPress={() => { setQuoteId(quote.id); if (quote.clientId) setClientId(quote.clientId); }}><Text style={[styles.chipText, quoteId === quote.id && styles.activeChipText]}>#{quote.id.slice(-6)}</Text></TouchableOpacity>)}</HorizontalOptions></>}<Text style={styles.label}>Data (AAAA-MM-DD)</Text><FormTextInput style={styles.input} value={date} onChangeText={setDate} placeholder="2026-08-14" placeholderTextColor={Colors.placeholder} editable={!locked && !saving} /><Text style={styles.label}>Horário (HH:MM)</Text><FormTextInput style={styles.input} value={time} onChangeText={setTime} placeholder="15:00" placeholderTextColor={Colors.placeholder} keyboardType="numbers-and-punctuation" editable={!locked && !saving} /><Text style={styles.label}>Duração (minutos)</Text><FormTextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="60" placeholderTextColor={Colors.placeholder} editable={!locked && !saving} /><View style={styles.actions}><TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.cancel} onPress={requestClose} accessibilityRole="button"><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity><TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.save} onPress={save} accessibilityRole="button" disabled={saving}><Text style={styles.saveText}>Agendar</Text></TouchableOpacity></View></View>;
}

const styles = StyleSheet.create({
  ...taskFormStyles,
  chips: { gap: 6, paddingVertical: 2 },
  chip: { ...SurfaceStyles.filter,
    borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  activeChip: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: FontSize.xs, fontFamily: 'PlusJakartaSans_500Medium' },
  activeChipText: { color: Colors.onAction },
  cancel: taskFormStyles.cancelBtn,
  cancelText: taskFormStyles.cancelBtnText,
  save: taskFormStyles.saveBtn,
  saveText: taskFormStyles.saveBtnText,
});
