import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

const INTRO_VIDEO = require('../../assets/media/intro.mp4');

const SIZE = 240;
const FADE = 28;

let didFinish = false;

export default function SplashMedia({
  onEnd,
  bgColor = '#007F6A',
  style,
}: {
  onEnd?: () => void;
  bgColor?: string;
  style?: any;
}) {
  const endedRef = React.useRef(didFinish);

  const onPlaybackStatusUpdate = React.useCallback(
    (status: any) => {
      if (status.isLoaded && status.didJustFinish && !endedRef.current) {
        endedRef.current = true;
        didFinish = true;
        onEnd?.();
      }
    },
    [onEnd]
  );

  React.useEffect(() => {
    if (didFinish) {
      onEnd?.();
    }
  }, [onEnd]);

  if (didFinish) return null;

  return (
    <View style={[s.container, style]}>
      <View style={s.frame}>
        <Video
          source={INTRO_VIDEO}
          style={s.video}
          rate={1.0}
          volume={1.0}
          isMuted={Platform.OS === 'web'}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping={false}
          useNativeControls={false}
          progressUpdateIntervalMillis={100}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />

        <LinearGradient
          colors={[bgColor, 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[s.top, { height: FADE }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', bgColor]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[s.bottom, { height: FADE }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={[bgColor, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[s.left, { width: FADE }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', bgColor]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[s.right, { width: FADE }]}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  frame: { width: SIZE, height: SIZE },
  video: { width: SIZE, height: SIZE, backgroundColor: 'transparent' },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  left: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  right: { position: 'absolute', top: 0, bottom: 0, right: 0 },
});
