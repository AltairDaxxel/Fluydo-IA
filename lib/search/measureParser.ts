import type { ApplicationType, MaterialType, ProductType } from './types';

export type MeasureSemantics = {
  internalDiameter?: number | null; // DI
  externalDiameter?: number | null; // DE
  section?: number | null; // seção (oring)
  heightOrThickness?: number | null; // altura/espessura (retentor/anel/junta)
};

export type ParsedMeasures = {
  numbers: number[];
  semantics: MeasureSemantics;
  raw: string;
};

function toNum(s: string): number | null {
  const n = Number.parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function normalizeTextPTBR(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0300-\u036f/g, '')
    .replace(/×/g, 'x');
}

export function parseMeasures(text: string): ParsedMeasures {
  const raw = text || '';
  const t = normalizeTextPTBR(raw);
  const numbers: number[] = [];
  const regex = /(\d+(?:[.,]\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(t)) !== null) {
    const n = toNum(m[1]);
    if (n != null) numbers.push(n);
  }

  const semantics: MeasureSemantics = {};

  // Semântica explícita: "interno 28", "di 28", "di=28", "de 35", etc.
  // Entre rótulo e número: espaço ou "=" (ex.: di=10).
  const pairs: Array<[RegExp, keyof MeasureSemantics]> = [
    [/\b(di|diametro\s*interno|interno)[\s=]+(\d+(?:[.,]\d+)?)/g, 'internalDiameter'],
    [/\b(de|diametro\s*externo|externo)[\s=]+(\d+(?:[.,]\d+)?)/g, 'externalDiameter'],
    [/\b(secao|secc?ao|espessura)[\s=]+(\d+(?:[.,]\d+)?)/g, 'section'],
    [/\b(altura|largura|espessura)[\s=]+(\d+(?:[.,]\d+)?)/g, 'heightOrThickness'],
  ];

  for (const [re, key] of pairs) {
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(t)) !== null) {
      const val = toNum(mm[2]);
      if (val != null) semantics[key] = val;
    }
  }

  return { numbers, semantics, raw };
}

export function inferProductType(text: string): ProductType {
  const t = normalizeTextPTBR(text);
  if (/\b(o[\s-]?ring|oring)\b/.test(t)) return 'ORING';
  if (/\bretentor(es)?\b/.test(t)) return 'RETENTOR';
  if (/\banel\b/.test(t)) return 'ANEL';
  if (/\bgaxeta\b/.test(t)) return 'GAXETA';
  if (/\bjunta\b/.test(t)) return 'JUNTA';
  return 'UNKNOWN';
}

export function inferMaterial(text: string): MaterialType {
  const t = normalizeTextPTBR(text);
  if (/\bnbr\b/.test(t)) return 'NBR';
  if (/\b(viton|fkm)\b/.test(t)) return 'VITON';
  if (/\b(silicone|silic)\b/.test(t)) return 'SILICONE';
  return 'UNKNOWN';
}

/**
 * Extrai Material + Dureza (Shore A) como filtro essencial.
 * Padrão: (Sigla)(Dureza) ex.: NBR70, NBR 90, VITON80, SILICONE60, FKM80.
 * Retorna token único para a busca (ex.: "NBR70") para não trazer NBR90 quando pediu NBR70.
 */
const MATERIAL_DUREZA_REGEX =
  /\b(NBR|VITON|FKM|SILICONE|EPDM|SIL|NEOPRENE|PU|NYLON)\s*(\d{2,3})\b(?:\s*shore\s*a?)?/gi;

export function parseMaterialDureza(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const m = MATERIAL_DUREZA_REGEX.exec(text);
  MATERIAL_DUREZA_REGEX.lastIndex = 0;
  if (!m) return null;
  const sigla = (m[1] || '').toUpperCase();
  const dureza = (m[2] || '').trim();
  return sigla && dureza ? `${sigla}${dureza}` : null;
}

export function inferApplication(text: string): ApplicationType {
  const t = normalizeTextPTBR(text);
  if (/\beixo\b/.test(t)) return 'EIXO';
  if (/\bpistao\b/.test(t)) return 'PISTAO';
  if (/\bhaste\b/.test(t)) return 'HASTE';
  if (/\btampa\b/.test(t)) return 'TAMPA';
  return 'UNKNOWN';
}

export function extractKeywords(text: string): string[] {
  const t = normalizeTextPTBR(text)
    .replace(/[^\w\s.,x-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // remove tokens que só atrapalham a busca semântica
  const stop = new Set([
    'de',
    'do',
    'da',
    'para',
    'pra',
    'por',
    'um',
    'uma',
    'preciso',
    'quero',
    'me',
    'com',
    'medida',
    'linha',
    'interno',
    'externo',
    'diametro',
    'di',
    'de',
    'secao',
    'espessura',
    'altura',
    'largura',
    'x',
  ]);

  return t
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((w) => !stop.has(w))
    .filter((w) => !/^\d+(?:[.,]\d+)?$/.test(w));
}

