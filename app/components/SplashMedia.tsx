import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';

const INTRO_VIDEO = require('../../assets/media/intro.mp4');

// Tamanho do "cartão" de vídeo no centro da tela — voltou a ser pequeno e
// centralizado (não tela cheia), como era a intenção original de splash.
const SIZE = 240;
const CORNER_RADIUS = 32;

// Se por qualquer motivo o vídeo não emitir `playToEnd` (arquivo corrompido,
// player travado, dispositivo lento, etc.), este é o tempo máximo que
// esperamos antes de navegar mesmo assim. É recalculado com a duração real
// assim que o player informa (`sourceLoad`), e cai para este valor enquanto
// isso não acontece.
const FALLBACK_MAX_MS = 20000;

interface SplashMediaProps {
  onEnd?: () => void;
  bgColor?: string;
  style?: any;
}

export default function SplashMedia({ onEnd, bgColor = '#007F6A', style }: SplashMediaProps) {
  const hasEndedRef = useRef(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const player = useVideoPlayer(INTRO_VIDEO, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  const finish = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    onEnd?.();
  };

  // Caminho normal: o vídeo chega ao fim sozinho.
  useEventListener(player, 'playToEnd', finish);

  // Assim que sabemos a duração real do arquivo, ajustamos o timeout de
  // segurança para (duração + uma margem), em vez de depender só do valor
  // fixo de fallback.
  useEventListener(player, 'sourceLoad', (payload) => {
    if (payload?.duration && payload.duration > 0) {
      setDurationMs(payload.duration * 1000);
    }
  });

  // Rede de segurança: se o status virar "error", não deixamos a splash
  // travada — seguimos em frente mesmo assim (melhor pular a animação do
  // que prender o usuário numa tela sem saída). Também cobre o caso em que
  // o player fica "readyToPlay" mas, por alguma corrida entre a montagem e
  // o `play()` inicial, não está de fato tocando — tenta retomar uma vez.
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') {
      finish();
      return;
    }
    if (status === 'readyToPlay' && !player.playing) {
      player.play();
    }
  });

  useEffect(() => {
    const timeoutMs = durationMs ? durationMs + 3000 : FALLBACK_MAX_MS;
    const timer = setTimeout(finish, timeoutMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.card, { width: SIZE, height: SIZE, backgroundColor: bgColor }]}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          // O padrão 'surfaceView' renderiza numa camada nativa separada que
          // IGNORA o `overflow: hidden` / `borderRadius` da View pai no
          // Android — é por isso que o conteúdo do vídeo vazava para fora
          // do cartão arredondado. 'textureView' é composto normalmente
          // dentro da hierarquia de views e respeita o recorte.
          surfaceType="textureView"
        />
        <LinearGradient
          pointerEvents="none"
          colors={[`${bgColor}CC`, `${bgColor}00`]}
          style={styles.fadeTop}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[`${bgColor}00`, `${bgColor}CC`]}
          style={styles.fadeBottom}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: CORNER_RADIUS,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SIZE * 0.25,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SIZE * 0.25,
  },
});
