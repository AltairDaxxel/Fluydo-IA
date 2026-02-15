/**
 * Extrai texto de imagem via Groq Vision (Llama 4 Scout).
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL_VISION = 'meta-llama/llama-4-scout-17b-16e-instruct';

export async function extrairTextoDeImagem(
  base64: string,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return '';

  const url = `data:${mimeType};base64,${base64}`;
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL_VISION,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extraia todo o texto desta imagem. Se for uma lista de produtos (códigos, descrições, quantidades), transcreva a lista completa, um item por linha, no formato: código ou descrição, quantidade.',
            },
            {
              type: 'image_url',
              image_url: { url },
            },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.2,
    }),
  });

  if (!res.ok) return '';
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || '';
}
