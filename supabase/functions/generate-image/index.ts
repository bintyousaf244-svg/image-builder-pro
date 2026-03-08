const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function attemptGeneration(prompt: string, refImages: any[], apiKey: string): Promise<string | null> {
  const content: any[] = [{ type: 'text', text: prompt }];
  
  if (refImages && Array.isArray(refImages)) {
    for (const ref of refImages) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${ref.mimeType};base64,${ref.data}` }
      });
    }
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image',
      messages: [{ role: 'user', content }],
      modalities: ['image', 'text'],
    }),
  });

  if (response.status === 429) {
    throw new Error('RATE_LIMIT');
  }
  if (response.status === 402) {
    throw new Error('PAYMENT_REQUIRED');
  }
  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI gateway error:', response.status, errorText);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, refImages } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Retry up to 3 times if no image is returned
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const imageUrl = await attemptGeneration(prompt, refImages || [], LOVABLE_API_KEY);
        if (imageUrl) {
          return new Response(JSON.stringify({ imageUrl }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        console.log(`Attempt ${attempt}: No image in response, retrying...`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'RATE_LIMIT') {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment and try again.' }), {
              status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (error.message === 'PAYMENT_REQUIRED') {
            return new Response(JSON.stringify({ error: 'Usage limit reached. Please add credits in Settings → Workspace → Usage.' }), {
              status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        throw error;
      }
    }

    return new Response(JSON.stringify({ error: 'No image generated after multiple attempts. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Generate image error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
