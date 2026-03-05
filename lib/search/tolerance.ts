/**
 * Detecção de comandos de tolerância em português informal.
 * Exemplos suportados:
 * - 5% de tolerância, com 5%, ±5%, 5% pra mais, 5% pra menos, 5% para ambos os lados, etc.
 */

export type ToleranceMode = 'PLUS_MINUS' | 'PLUS_ONLY' | 'MINUS_ONLY';

export interface ToleranceCommand {
  percent: number;
  mode: ToleranceMode;
}

/** Normaliza texto para comparação (minúsculas, sem acento). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0300-\u036f/g, '');
}

/**
 * Faz o parse de um comando de tolerância.
 * Retorna null quando não reconhecer intenção clara de tolerância.
 */
export function parseToleranceCommand(text: string): ToleranceCommand | null {
  const original = text || '';
  const trimmed = original.trim();
  if (!trimmed) return null;

  const norm = normalize(trimmed);

  // Precisa ter um número com % ou mencionar "tolerancia"/"tol"
  const percentMatch = norm.match(/(\d+(?:[.,]\d+)?)\s*%/);
  let percent: number | null = null;
  if (percentMatch) {
    percent = parseFloat(percentMatch[1].replace(',', '.'));
  } else if (/\btolerancia\b|\btol\b/.test(norm)) {
    const numMatch = norm.match(/(\d+(?:[.,]\d+)?)/);
    if (numMatch) percent = parseFloat(numMatch[1].replace(',', '.'));
  }

  if (percent == null || !Number.isFinite(percent) || percent <= 0) return null;

  // Limite de sanidade: até 50%
  if (percent > 50) return null;

  // Determina modo
  let mode: ToleranceMode = 'PLUS_MINUS';

  const hasMais = /\bmais\b|\bacima\b/.test(norm);
  const hasMenos = /\bmenos\b|\babaixo\b|\bmenor\b|\bbaixo\b/.test(norm);

  if (hasMais && !hasMenos) {
    mode = 'PLUS_ONLY';
  } else if (hasMenos && !hasMais) {
    mode = 'MINUS_ONLY';
  } else {
    // ±, "mais ou menos", "pra mais ou menos", etc. caem aqui
    mode = 'PLUS_MINUS';
  }

  return { percent, mode };
}

