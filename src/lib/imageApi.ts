import { supabase } from '@/integrations/supabase/client';
import { RefImage } from '@/types/image';

export async function generateImageApi(prompt: string, refImages: RefImage[] = []) {
  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: { prompt, refImages: refImages.map(r => ({ data: r.data, mimeType: r.mimeType })) },
  });

  if (error) throw new Error(error.message || 'Failed to generate image');
  if (data?.error) throw new Error(data.error);
  return data.imageUrl as string;
}

export async function editImageApi(imageUrl: string, instruction: string) {
  const { data, error } = await supabase.functions.invoke('edit-image', {
    body: { imageUrl, instruction },
  });

  if (error) throw new Error(error.message || 'Failed to edit image');
  if (data?.error) throw new Error(data.error);
  return data.imageUrl as string;
}
