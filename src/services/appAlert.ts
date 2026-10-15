import type { AppDialogProps, DialogAction } from '../components/app-dialog';

export type AlertOptions = { cancelable?: boolean; onDismiss?: () => void; variant?: AppDialogProps['variant']; icon?: AppDialogProps['icon'] };
export type AlertRequest = { title: string; message?: string; actions: DialogAction[]; options: AlertOptions };
type Listener = () => void;
const listeners = new Set<Listener>();
const queue: AlertRequest[] = [];
let current: AlertRequest | null = null;
let closing = false;
const emit = () => listeners.forEach(listener => listener());
const next = () => { if (!current && !closing) { current = queue.shift() ?? null; emit(); } };

/** Compatible call shape keeps existing business callbacks at their call sites. */
export const AppAlert = {
  alert(title: string, message?: string, actions?: DialogAction[], options: AlertOptions = {}) {
    if ([current, ...queue].some(request => request?.title === title && request.message === message)) return;
    queue.push({ title, message, actions: actions?.length ? actions : [{ text: 'OK' }], options });
    next();
  },
};

export const alertStore = {
  subscribe(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: () => current,
  finish(request: AlertRequest, action?: DialogAction) {
    if (current !== request) return;
    current = null;
    closing = true;
    emit();
    // Allow the original native fade-out to finish before showing a queued alert.
    setTimeout(() => { closing = false; next(); }, 350);
    if (action) action.onPress?.();
    else {
      const cancel = request.actions.find(button => button.style === 'cancel');
      cancel?.onPress?.();
      request.options.onDismiss?.();
    }
  },
};
