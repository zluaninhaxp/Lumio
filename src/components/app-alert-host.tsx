import { useRef, useSyncExternalStore } from 'react';
import { alertStore } from '../services/appAlert';
import { AppDialog } from './app-dialog';

export function AppAlertHost() {
  const request = useSyncExternalStore(alertStore.subscribe, alertStore.getSnapshot, alertStore.getSnapshot);
  const previous = useRef(request);
  if (request) previous.current = request;
  const content = request ?? previous.current;
  if (!content) return null;
  const variant = content.options.variant ?? (content.actions.some(action => action.style === 'destructive') ? 'destructive' : 'default');
  return <AppDialog visible={!!request} title={content.title} message={content.message} variant={variant} icon={content.options.icon}
    actions={content.actions.map(action => ({ ...action, onPress: () => alertStore.finish(content, action) }))}
    onCancel={() => { if (content.options.cancelable !== false) alertStore.finish(content); }} />;
}
