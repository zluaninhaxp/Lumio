import { StyleSheet } from 'react-native';
import { TextStyles, nativeTextStyle } from '../constants/theme';

// Family only: each module retains its existing size, color and hierarchy.
export const ModuleTextStyles = StyleSheet.create({
  search: { fontFamily: TextStyles.body.fontFamily },
  metadata: { fontFamily: TextStyles.metadata.fontFamily },
  headerTitle: { ...nativeTextStyle(TextStyles.screenTitle), flexShrink: 1, textAlign: 'center' },
});
