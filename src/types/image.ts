export interface GeneratedImage {
  id: number;
  prompt: string;
  url: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

export interface AppSettings {
  characterPrompt: string;
  bulkPrompts: string;
  aspectRatio: string;
  delayTime: number;
  style: string;
  colorTheme: string;
}

export interface RefImage {
  id: string;
  data: string;
  mimeType: string;
}
