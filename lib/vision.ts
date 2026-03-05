/**
 * Extrai texto de imagem via OpenRouter (modelo com suporte a visão).
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL_VISION_DEFAULT = 'meta-llama/llama-3.2-11b-vision-instruct';

export async function extrairTextoDeImagem(
  base64: string,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return '';

  const model = process.env.OPENROUTER_MODEL_VISION?.trim() || OPENROUTER_MODEL_VISION_DEFAULT;
  const url = `data:${mimeType};base64,${base64}`;
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
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
