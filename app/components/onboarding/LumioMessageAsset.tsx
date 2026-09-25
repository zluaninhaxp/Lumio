import { Image, ImageSourcePropType, View } from 'react-native';
import SpeechBubble from './SpeechBubble';

// Future message PNGs can be registered by the existing line key here.
const messageAssets: Record<string, { source: ImageSourcePropType; aspectRatio: number }> = {};

export default function LumioMessageAsset({ messageKey, text }: { messageKey: string; text: string }) {
  const asset = messageAssets[messageKey];
  if (!text) return null;
  return (
    <View style={{ width: '100%', alignItems: 'center', paddingHorizontal: 12 }}>
      {asset ? (
        <Image source={asset.source} resizeMode="contain" style={{ width: '100%', aspectRatio: asset.aspectRatio }} />
      ) : (
        <SpeechBubble text={text} animationKey={messageKey} />
      )}
    </View>
  );
}
