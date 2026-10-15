import { FontSize, Spacing } from '../constants/theme';

/** Keep the normal calendar geometry; grow room for scaled numeral line boxes. */
export function getCalendarTypography(fontScale: number) {
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  const numeralBox = Math.ceil(FontSize.sm * scale * 1.5) + Spacing.sm;
  const monthDiameter = Math.max(34, numeralBox);
  const compactDiameter = Math.max(30, numeralBox);
  const columnWidth = Math.max(48, monthDiameter + Spacing.sm);
  return { monthDiameter, compactDiameter, columnWidth, gridWidth: columnWidth * 7 };
}
