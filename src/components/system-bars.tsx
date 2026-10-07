import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { Colors } from '../constants/theme';
import { getSystemBarSurfaces, systemBarIconStyle } from '../utils/systemBarAppearance';

/** Backgrounds come from the screens; this controls only foreground contrast. */
export function SystemBars() {
  const pathname = usePathname();
  const { top, bottom } = getSystemBarSurfaces(pathname, Colors);
  const statusStyle = systemBarIconStyle(top);
  const navigationStyle = systemBarIconStyle(bottom);
  useEffect(() => {
    const apply = () => {
      // Root surface fills uncovered pixels during screen/keyboard transitions.
      void SystemUI.setBackgroundColorAsync(bottom).catch(error => {
        if (__DEV__) console.warn('[system-bars] root surface', error);
      });
      if (Platform.OS === 'android') NavigationBar.setStyle(navigationStyle === 'dark' ? 'light' : 'dark');
    };
    apply();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') apply(); });
    return () => subscription.remove();
  }, [bottom, navigationStyle]);
  return <StatusBar style={statusStyle} />;
}
