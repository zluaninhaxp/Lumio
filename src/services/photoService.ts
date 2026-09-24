import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '../lib/supabase';
import { fitWebpWithinLimit, PHOTO_MAX_BYTES, PHOTO_MAX_DIMENSION } from './photoOptimizationCore';

export const photoService = {
  async signedUrl(): Promise<string | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.functions.invoke('photo', { body: { action: 'signed_url' } });
    if (error) return null;
    return typeof data?.url === 'string' ? data.url : null;
  },
  async pickAndUpload(): Promise<string | null> {
    if (!supabase) throw new Error('Serviço de fotos não configurado.');
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (picked.canceled) return null;
    const asset = picked.assets[0];
    if (!asset || asset.width < 1 || asset.height < 1 || asset.width > 12000 || asset.height > 12000) throw new Error('Dimensões da imagem inválidas.');
    let blob: Blob;
    try {
      const context = ImageManipulator.manipulate(asset.uri);
      const longest = Math.max(asset.width, asset.height);
      if (longest > PHOTO_MAX_DIMENSION) {
        context.resize(asset.width >= asset.height ? { width: PHOTO_MAX_DIMENSION } : { height: PHOTO_MAX_DIMENSION });
      }
      const rendered = await context.renderAsync();
      const optimized = await fitWebpWithinLimit(async (quality) => {
        const saved = await rendered.saveAsync({ format: SaveFormat.WEBP, compress: quality });
        if (saved.width < 1 || saved.height < 1 || Math.max(saved.width, saved.height) > PHOTO_MAX_DIMENSION) {
          throw new Error('Invalid optimized image dimensions');
        }
        const response = await fetch(saved.uri);
        const candidate = await response.blob();
        return { blob: candidate, size: candidate.size };
      });
      blob = optimized.blob;
    } catch {
      throw new Error('Não foi possível otimizar a foto para envio. Escolha outra imagem.');
    }
    if (blob.size > PHOTO_MAX_BYTES) throw new Error('Não foi possível otimizar a foto para envio.');
    const { error } = await supabase.functions.invoke('photo', { body: blob, headers: { 'Content-Type': 'image/webp' } });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      if (status === 429) throw new Error('Limite de fotos atingido. Tente novamente mais tarde.');
      if (status === 413) throw new Error('Não foi possível enviar a foto otimizada. Escolha outra imagem.');
      throw new Error('Não foi possível enviar a foto. Tente novamente.');
    }
    const url = await this.signedUrl();
    if (!url) throw new Error('Foto enviada, mas não foi possível carregá-la.');
    return url;
  },
};
