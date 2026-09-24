export const PHOTO_MAX_BYTES = 1024 * 1024;
export const PHOTO_MAX_DIMENSION = 512;

// Five bounded attempts; never reduce below a usable portrait quality.
export const PHOTO_WEBP_QUALITIES = [0.85, 0.7, 0.55, 0.4, 0.3] as const;

export async function fitWebpWithinLimit<T extends { size: number }>(
  encode: (quality: number) => Promise<T>,
): Promise<T> {
  for (const quality of PHOTO_WEBP_QUALITIES) {
    const result = await encode(quality);
    if (result.size > 0 && result.size <= PHOTO_MAX_BYTES) return result;
  }
  throw new Error('Não foi possível otimizar a foto para até 1 MB. Escolha outra imagem.');
}
