// Pollinations.ai - Free image generation API (no API key needed)

export interface ImageGenerationRequest {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  url: string;
  status: "pending" | "generating" | "done" | "error";
  error?: string;
}

export function buildPollinationsUrl(req: ImageGenerationRequest): string {
  const encodedPrompt = encodeURIComponent(req.prompt);
  const w = req.width || 1024;
  const h = req.height || 1024;
  const seed = req.seed ?? Math.floor(Math.random() * 999999);
  const model = req.model || "flux";
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${w}&height=${h}&seed=${seed}&model=${model}&nologo=true`;
}

export async function generateImage(req: ImageGenerationRequest): Promise<string> {
  const url = buildPollinationsUrl(req);
  // Pre-fetch to trigger generation, then return the URL
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image generation failed: ${response.status}`);
  }
  return url;
}
