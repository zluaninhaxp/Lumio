/** Coordinates are measured in the same native window. The scroll viewport
 * can end above the keyboard when the modal keeps a fixed action footer. */
export function getModalFocusScrollOffset({ offset, viewportTop, viewportHeight, keyboardTop, inputTop, inputHeight, gap = 16 }: {
  offset: number; viewportTop: number; viewportHeight: number; keyboardTop: number; inputTop: number; inputHeight: number; gap?: number;
}): number {
  const top = viewportTop + gap;
  const bottom = Math.min(viewportTop + viewportHeight, keyboardTop) - gap;
  // A very tall multiline field cannot fit in full; keep its top accessible.
  const height = Math.min(inputHeight, Math.max(0, bottom - top));
  const delta = inputTop < top ? inputTop - top : Math.max(0, inputTop + height - bottom);
  return Math.max(0, offset + delta);
}
