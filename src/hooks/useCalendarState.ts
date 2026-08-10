import { useState, useCallback, useMemo, useRef } from 'react';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS_SHORT = ['D','S','T','Q','Q','S','S'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function useCalendarState() {
  const today = useRef(new Date()).current;
  const todayStr = useMemo(() => today.toISOString().split('T')[0], [today]);

  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [calendarExpanded, setCalendarExpanded] = useState(true);
  const [filter, setFilter] = useState<'all' | 'event' | 'task'>('all');
  const [animating, setAnimating] = useState(false);

  const daysInMonth = useMemo(
    () => getDaysInMonth(visibleYear, visibleMonth),
    [visibleYear, visibleMonth]
  );

  const firstDay = useMemo(
    () => getFirstDayOfMonth(visibleYear, visibleMonth),
    [visibleYear, visibleMonth]
  );

  const monthLabel = useMemo(
    () => `${MONTHS[visibleMonth]} ${visibleYear}`,
    [visibleYear, visibleMonth]
  );

  const cells = useMemo(
    () =>
      Array(firstDay).fill(null).concat(
        Array.from({ length: daysInMonth }, (_, i) => i + 1)
      ),
    [firstDay, daysInMonth]
  );

  const dateString = useCallback(
    (day: number) =>
      `${visibleYear}-${String(visibleMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    [visibleYear, visibleMonth]
  );

  const isToday = useCallback(
    (day: number) =>
      day === today.getDate() && visibleMonth === today.getMonth() && visibleYear === today.getFullYear(),
    [today, visibleMonth, visibleYear]
  );

  const isSelected = useCallback(
    (day: number) => dateString(day) === selectedDate,
    [dateString, selectedDate]
  );

  const selectDay = useCallback(
    (day: number) => setSelectedDate(dateString(day)),
    [dateString]
  );

  const prevMonth = useCallback(() => {
    if (visibleMonth === 0) {
      setVisibleMonth(11);
      setVisibleYear((y) => y - 1);
    } else {
      setVisibleMonth((m) => m - 1);
    }
  }, [visibleMonth]);

  const nextMonth = useCallback(() => {
    if (visibleMonth === 11) {
      setVisibleMonth(0);
      setVisibleYear((y) => y + 1);
    } else {
      setVisibleMonth((m) => m + 1);
    }
  }, [visibleMonth]);

  const navigateDay = useCallback(
    (direction: -1 | 1) => {
      const current = new Date(selectedDate + 'T12:00:00');
      current.setDate(current.getDate() + direction);
      const newDateStr = current.toISOString().split('T')[0];
      setSelectedDate(newDateStr);
      const newMonth = current.getMonth();
      const newYear = current.getFullYear();
      if (newMonth !== visibleMonth || newYear !== visibleYear) {
        setVisibleMonth(newMonth);
        setVisibleYear(newYear);
      }
    },
    [selectedDate, visibleMonth, visibleYear]
  );

  const prevDay = useCallback(() => navigateDay(-1), [navigateDay]);
  const nextDay = useCallback(() => navigateDay(1), [navigateDay]);

  const toggleCalendar = useCallback(() => {
    setCalendarExpanded((prev) => !prev);
  }, []);

  const formatSelectedDate = useCallback(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }).toUpperCase();
  }, [selectedDate]);

  const selectedWeekDays = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    const dayOfWeek = d.getDay();
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - dayOfWeek);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return {
        day: date.getDate(),
        dateStr: date.toISOString().split('T')[0],
        label: DAYS_SHORT[i],
        index: i,
      };
    });
  }, [selectedDate]);

  return {
    visibleYear,
    visibleMonth,
    selectedDate,
    calendarExpanded,
    filter,
    animating,
    today: todayStr,
    monthLabel,
    cells,
    selectedWeekDays,
    setFilter,
    setCalendarExpanded,
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
    setAnimating,
  };
}
