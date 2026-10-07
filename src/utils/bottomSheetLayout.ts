type BottomSheetLayoutInput = {
  /** Actual modal viewport after native resize / KeyboardAvoidingView. */
  viewportHeight: number;
  topInset: number;
  bottomInset: number;
  keyboardVisible: boolean;
  paddingBottom: number;
  minHeight: number;
  maxHeight?: number;
  sheetHeight?: number | `${number}%`;
};

/** Floating iPad keyboards must not remove the Home Indicator's safe area. */
export function isBottomKeyboard(
  frame: { screenY: number; height: number; width: number } | undefined,
  windowWidth: number,
  screenHeight: number,
  bottomInset: number,
) {
  return !!frame && frame.height > 0 && frame.width >= windowWidth &&
    frame.screenY < screenHeight && frame.screenY + frame.height >= screenHeight - bottomInset;
}

export function getBottomSheetLayout(input: BottomSheetLayoutInput) {
  const availableHeight = Math.max(0, input.viewportHeight - input.topInset);
  // A docked keyboard replaces the unsafe bottom region; its height is already
  // consumed by native adjustResize (Android) or KeyboardAvoidingView (iOS).
  const bottomInset = input.keyboardVisible ? 0 : Math.max(0, input.bottomInset);
  const maxHeight = Math.max(0, Math.min(input.maxHeight ?? availableHeight, availableHeight));
  const requestedHeight = typeof input.sheetHeight === 'string'
    ? availableHeight * parseFloat(input.sheetHeight) / 100
    : input.sheetHeight;
  return {
    paddingBottom: input.paddingBottom + bottomInset,
    minHeight: Math.min(Math.max(0, input.minHeight), maxHeight),
    maxHeight,
    // Existing explicit sizing includes the normal chrome, but not safe area.
    // Unsized sheets stay intrinsic: never assign them a height.
    height: requestedHeight === undefined ? undefined : Math.max(0, Math.min(requestedHeight + bottomInset, maxHeight)),
  };
}
