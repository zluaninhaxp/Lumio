import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, PanResponder, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ControlOpacity, Colors, Spacing, FontSize } from '../../src/constants/theme';
import { useAppStore, type CalendarEvent, type Atendimento } from '../../src/store';
import { useCalendarState } from '../../src/hooks/useCalendarState';
import { CollapsibleCalendar } from '../../src/components/Calendar/CollapsibleCalendar';
import { BottomSheet } from '../../src/components/Calendar/BottomSheet';
import { EventForm } from '../../src/components/Calendar/EventForm';
import { EventListItem } from '../../src/components/Calendar/EventListItem';
import { FilterChips } from '../../src/components/Calendar/FilterChips';
import { SkeletonLoader } from '../../src/components/Calendar/SkeletonLoader';
import { EmptyState } from '../../src/components/Calendar/EmptyState';
import { FAB, FAB_LAYOUT } from '../../src/components/Calendar/FAB';
import { AppointmentForm } from '../../src/components/Calendar/AppointmentForm';
import { useAuth } from '../../src/hooks/useAuth';
import { UserAvatar } from '../../src/components/account/UserAvatar';
import { AccountSheet } from '../../src/components/account/AccountSheet';
import { BottomFade } from '../../src/components/BottomFade';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { EventFormData } from '../../src/components/Calendar/EventForm';
import type { Relation } from '../../src/components/Tasks/TaskPeopleSelector';
import { clearRelationDraft, getRelationDraft, saveRelationDraft, setPendingRelation } from '../../src/utils/relationDraft';
import { useConfirmedSave } from "../../src/hooks/use-confirmed-save";
import { confirmAction } from "../../src/services/confirmedAction";

export default function CalendarioScreen() {
  const router = useRouter();
  const { returnToCalendar, createdId, relation } = useLocalSearchParams<{
    returnToCalendar?: string;
    createdId?: string;
    relation?: Relation;
  }>();
  const { currentUser } = useAuth();
  const [accountVisible, setAccountVisible] = useState(false);
  const {
    visibleYear,
    visibleMonth,
    selectedDate,
    calendarExpanded,
    filter,
    monthLabel,
    cells,
    selectedWeekDays,
    setFilter,
    toggleCalendar,
    selectDay,
    prevMonth,
    nextMonth,
    prevDay,
    nextDay,
    isToday,
    isSelected,
    dateString,
    formatSelectedDate,
  } = useCalendarState();

  const { events, toggleEvent, removeEvent, addEvent, addTask, calendarizeTask, refreshContratos, markTransactionReceived, clienteItems, orcamentos, activatedPlugins, addAtendimento, concludeAtendimento, updateAtendimento, removeAtendimento } = useAppStore();
  const { transactions, fornecedorItems, markSupplierTransactionPaid } = useAppStore();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [appointmentSheetVisible, setAppointmentSheetVisible] = useState(false);
  const [pendingEventDraft, setPendingEventDraft] = useState<EventFormData | null>(() => getRelationDraft<EventFormData>('calendar'));

  useEffect(() => { refreshContratos(); }, [refreshContratos]);

  useEffect(() => {
    if (returnToCalendar !== '1' || !createdId || !relation) return;
    const draft = setPendingRelation('calendar', relation, createdId);
    setPendingEventDraft((draftState) => draft ? { ...draftState, ...draft } as EventFormData : draftState);
    setSheetVisible(true);
    router.setParams({ returnToCalendar: undefined, createdId: undefined, relation: undefined });
  }, [createdId, relation, returnToCalendar, router]);

  const supplierDueEvents = useMemo(() => transactions.flatMap((transaction) => {
    if (!transaction.supplierId || !transaction.supplierDueDate || transaction.supplierPaid) return [];
    const supplier = fornecedorItems.find((item) => item.id === transaction.supplierId);
    if (!supplier) return [];
    return [{ id: `supplier-due:${transaction.id}`, date: transaction.supplierDueDate, time: null, description: `Vencimento: ${supplier.name} · ${transaction.description}`, done: false, type: 'event' as const }];
  }), [transactions, fornecedorItems]);

  const calendarEvents = useMemo(() => [...events, ...supplierDueEvents], [events, supplierDueEvents]);

  const eventsForSelectedDate = useMemo(() => {
    const filtered = calendarEvents.filter((e) => e.date === selectedDate);
    if (filter !== 'all') {
      return filtered.filter((e) => e.type === filter);
    }
    return filtered;
  }, [calendarEvents, selectedDate, filter]);

  const sortedEvents = useMemo(() => {
    return [...eventsForSelectedDate].sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return -1;
      if (!b.time) return 1;
      return a.time.localeCompare(b.time);
    });
  }, [eventsForSelectedDate]);

  const filterCounts = useMemo(() => {
    const allEvents = calendarEvents.filter((e) => e.date === selectedDate);
    return {
      all: allEvents.length,
      event: allEvents.filter((e) => e.type === 'event').length,
      task: allEvents.filter((e) => e.type === 'task').length,
    };
  }, [calendarEvents, selectedDate]);

  const handleToggleCalendarEvent = useCallback((id: string) => { void confirmAction("calendario.tsx:handleToggleCalendarEvent:113" + ':' + id, () => {
  if (id.startsWith('supplier-due:')) {
        markSupplierTransactionPaid(id.replace('supplier-due:', ''), true);
        return;
      }
  if (id.startsWith('contract-due:')) {
        const [, contractId, expectedDate] = id.split(':');
        const transaction = useAppStore.getState().transactions.find((item) => item.contractId === contractId && item.expectedDate === expectedDate);
        if (transaction) markTransactionReceived(transaction.id, true);
        return;
      }
  if (id.startsWith('appointment:')) {
        concludeAtendimento(id.replace('appointment:', ''));
        return;
      }
  toggleEvent(id);
  return () => {  };
  }); }, [markSupplierTransactionPaid, markTransactionReceived, concludeAtendimento, toggleEvent]);

  const handleMonthChange = useCallback(
    (direction: -1 | 1) => {
      if (direction === -1) prevMonth();
      else nextMonth();
    },
    [prevMonth, nextMonth]
  );

  const handleSelectDayEvent = useCallback(
    (day: number, exactDate?: string) => {
      selectDay(day, exactDate);
    },
    [selectDay]
  );

  const handleSaveConfirmation = useConfirmedSave();
    const handleSave = useCallback(
        (data: Omit<CalendarEvent, 'id' | 'done'>) => { return handleSaveConfirmation.run(() => {
          if (data.type === 'task') {
                  const taskId = addTask({
                    description: data.description,
                    done: false,
                    dueDate: data.date,
                    dueDateLabel: null,
                    priority: 'media',
                    subtasks: [],
                    tags: [],
                    clientId: data.clientId,
                    supplierId: data.supplierId,
                    employeeId: data.employeeId,
                    createdAt: new Date().toISOString(),
                  });
                  calendarizeTask(taskId, {
                    date: data.date,
                    time: data.time,
                    eventType: data.eventType,
                    clientId: data.clientId,
                    supplierId: data.supplierId,
                    employeeId: data.employeeId,
                  });
                } else {
                  addEvent(data);
                }
          return () => {
          clearRelationDraft('calendar');
          setPendingEventDraft(null);
          setSheetVisible(false);
          };
          }); },
        [addEvent, addTask, calendarizeTask]
      );

  const handleSaveAppointmentConfirmation = useConfirmedSave();
    const handleSaveAppointment = useCallback((data: Omit<Atendimento, 'id' | 'calendarEventId'>) => { return handleSaveAppointmentConfirmation.run(() => { if (!addAtendimento(data)) return; return () => setAppointmentSheetVisible(false); }); }, [addAtendimento]);

  const handleDeleteCalendarItem = useCallback((id: string) => { void confirmAction("calendario.tsx:handleDeleteCalendarItem:192" + ':' + id, () => {
  if (id.startsWith('appointment:')) removeAtendimento(id.replace('appointment:', ''));
      else removeEvent(id);
  return () => {  };
  }); }, [removeAtendimento, removeEvent]);

  const handleCancelCalendarItem = useCallback((id: string) => {
    if (id.startsWith('appointment:')) updateAtendimento(id.replace('appointment:', ''), { status: 'cancelado' });
  }, [updateAtendimento]);

  const handleCompleteStart = useCallback((id: string) => {
    setCompletingId(id);
  }, []);

  const handleCompleteEnd = useCallback((id: string) => {
    setCompletingId(null);
  }, []);

  const listPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 25 && Math.abs(gs.dy) < 15,
        onPanResponderRelease: (_, gs) => {
          if (gs.dx > 50) {
            prevDay();
          } else if (gs.dx < -50) {
            nextDay();
          }
        },
      }),
    [prevDay, nextDay]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendário</Text>
        <View style={styles.headerActions}>
          {activatedPlugins.includes('agenda') && <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.newAppointment} onPress={() => setAppointmentSheetVisible(true)}><Ionicons name="time-outline" size={18} color={Colors.accentIcon} /><Text style={styles.newAppointmentText}>Atendimento</Text></TouchableOpacity>}
          <UserAvatar user={currentUser} onPress={() => setAccountVisible(true)} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: FAB_LAYOUT.clearance }}
        showsVerticalScrollIndicator={false}
        {...listPanResponder.panHandlers}
      >
        <CollapsibleCalendar
          visibleYear={visibleYear}
          visibleMonth={visibleMonth}
          selectedDate={selectedDate}
          calendarExpanded={calendarExpanded}
          monthLabel={monthLabel}
          cells={cells}
          selectedWeekDays={selectedWeekDays}
          isToday={isToday}
          isSelected={isSelected}
          dateString={dateString}
           events={calendarEvents}
          onSelectDay={handleSelectDayEvent}
          onPrevMonth={() => handleMonthChange(-1)}
          onNextMonth={() => handleMonthChange(1)}
          onToggleExpand={toggleCalendar}
        />

        <View style={styles.eventsSection}>
          <View style={styles.eventsHeader}>
            <Text style={styles.eventsDateLabel}>{formatSelectedDate()}</Text>
            <Text style={styles.eventsCount}>
              {filterCounts.all > 0
                ? `${filterCounts.all} compromisso${filterCounts.all > 1 ? 's' : ''}`
                : ''}
            </Text>
          </View>

          <FilterChips selected={filter} onSelect={setFilter} counts={filterCounts} />

          {sortedEvents.length === 0 ? (
            <EmptyState filter={filter !== 'all' ? filter : undefined} />
          ) : (
            sortedEvents.map((event) => (
              <View key={event.id} style={styles.eventItemWrapper}>
                <EventListItem
                  item={event}
                   onToggle={handleToggleCalendarEvent}
                   onDelete={handleDeleteCalendarItem}
                   onCancel={handleCancelCalendarItem}
                  completingId={completingId}
                  onCompleteStart={handleCompleteStart}
                  onCompleteEnd={handleCompleteEnd}
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <BottomFade />

      <FAB onPress={() => setSheetVisible(true)} />

      <BottomSheet visible={sheetVisible} onClose={() => { clearRelationDraft('calendar'); setPendingEventDraft(null); setSheetVisible(false); }} height={620}>
        <EventForm
          key={pendingEventDraft ? `calendar-draft-${pendingEventDraft.clientId ?? ''}-${pendingEventDraft.supplierId ?? ''}-${pendingEventDraft.employeeId ?? ''}` : 'calendar-new'}
          initialDate={selectedDate}
          initialData={pendingEventDraft ?? undefined}
          onSave={handleSave}
          onCancel={() => { clearRelationDraft('calendar'); setPendingEventDraft(null); setSheetVisible(false); }}
          onBeforeNavigate={(relation, data) => {
            saveRelationDraft('calendar', data);
            setPendingEventDraft(data);
            setSheetVisible(false);
            setTimeout(() => {
              const pluginId = relation === 'client' ? 'clientes' : relation === 'supplier' ? 'fornecedores' : 'equipe';
              const route = useAppStore.getState().activatedPlugins.includes(pluginId)
                ? ({ clientes: '/plugins/clientes', fornecedores: '/plugins/fornecedores', equipe: '/plugins/equipe' } as const)[pluginId]
                : `/plugins/store?highlight=${pluginId}`;
              router.push(`${route}${route.includes('?') ? '&' : '?'}returnToCalendar=1&relation=${relation}` as any);
            }, 240);
          }} locked={handleSaveConfirmation.locked}
        />
      </BottomSheet>
      <BottomSheet visible={appointmentSheetVisible} onClose={() => setAppointmentSheetVisible(false)}>
        <AppointmentForm initialDate={selectedDate} clients={clienteItems} quotes={activatedPlugins.includes('orcamentos') ? orcamentos : []} onSave={handleSaveAppointment} onCancel={() => setAppointmentSheetVisible(false)} locked={handleSaveAppointmentConfirmation.locked} />
      </BottomSheet>
      <AccountSheet visible={accountVisible} onClose={() => setAccountVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.appBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  newAppointment: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accentLight, borderRadius: 999, paddingHorizontal: Spacing.sm, paddingVertical: 7 },
  newAppointmentText: { color: Colors.accentText, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: FontSize.xxl,
    color: Colors.primary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: Colors.onAction,
  },
  eventsSection: {
    paddingTop: Spacing.xl,
    paddingBottom: 12,
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  eventsDateLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  eventsCount: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  eventItemWrapper: {
    paddingHorizontal: Spacing.xl,
  },
});
