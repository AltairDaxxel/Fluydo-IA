import { describe, expect, test } from 'vitest';
import { parseMeasures, parseMaterialDureza } from '../lib/search/measureParser';
import { intelligentSearchEngine } from '../lib/search/intelligentSearchEngine';
import { variantesAnelOring } from '../lib/busca-prisma';

describe('measureParser', () => {
  test('oring 28,17 x 3,53 nbr', () => {
    const p = parseMeasures('oring 28,17 x 3,53 nbr');
    expect(p.numbers[0]).toBeCloseTo(28.17, 2);
    expect(p.numbers[1]).toBeCloseTo(3.53, 2);
  });

  test('explicit DI/DE tokens', () => {
    const p = parseMeasures('anel interno 28 externo 35');
    expect(p.semantics.internalDiameter).toBeCloseTo(28, 2);
    expect(p.semantics.externalDiameter).toBeCloseTo(35, 2);
  });
});

describe('parseMaterialDureza', () => {
  test('NBR70, NBR90, VITON80', () => {
    expect(parseMaterialDureza('oring nbr70')).toBe('NBR70');
    expect(parseMaterialDureza('NBR 90')).toBe('NBR90');
    expect(parseMaterialDureza('VITON80')).toBe('VITON80');
  });
  test('oring 28 por 3.53 em nbr90', () => {
    expect(parseMaterialDureza('oring 28 por 3.53 em nbr90')).toBe('NBR90');
  });
  test('sem material+dureza retorna null', () => {
    expect(parseMaterialDureza('só oring')).toBeNull();
    expect(parseMaterialDureza('NBR')).toBeNull();
  });
});

describe('intelligentSearchEngine heuristics', () => {
  test('oring 28,17 x 3,53 nbr -> ORING DI+secao STRICT', () => {
    const plan = intelligentSearchEngine('oring 28,17 x 3,53 nbr');
    expect(plan.intent.productType).toBe('ORING');
    expect(plan.intent.material).toBe('NBR');
    expect(plan.semantics.internalDiameter).toBeCloseTo(28.17, 2);
    expect(plan.semantics.section).toBeCloseTo(3.53, 2);
    expect(plan.queryMode).toBe('STRICT');
    expect(plan.dims.dim1).toBeCloseTo(28.17, 2);
    expect(plan.dims.dim3).toBeCloseTo(3.53, 2);
  });

  test('o-ring 80 x 2,5 viton marrom', () => {
    const plan = intelligentSearchEngine('o-ring 80 x 2,5 viton marrom');
    expect(plan.intent.productType).toBe('ORING');
    expect(plan.intent.material).toBe('VITON');
    expect(plan.semantics.internalDiameter).toBeCloseTo(80, 2);
    expect(plan.semantics.section).toBeCloseTo(2.5, 2);
  });

  test('oring para eixo 28 -> ORING DI BROAD (não trava em pergunta)', () => {
    const plan = intelligentSearchEngine('oring para eixo 28', { preferSearchOverClarify: true });
    expect(plan.intent.productType).toBe('ORING');
    expect(plan.intent.application).toBe('EIXO');
    expect(plan.semantics.internalDiameter).toBeCloseTo(28, 2);
    expect(plan.queryMode).toBe('BROAD');
  });

  test('retentor 110x130x13 -> RETENTOR STRICT', () => {
    const plan = intelligentSearchEngine('retentor 110x130x13');
    expect(plan.intent.productType).toBe('RETENTOR');
    expect(plan.semantics.internalDiameter).toBeCloseTo(110, 2);
    expect(plan.semantics.externalDiameter).toBeCloseTo(130, 2);
    expect(plan.semantics.heightOrThickness).toBeCloseTo(13, 2);
    expect(plan.queryMode).toBe('STRICT');
  });

  test('anel 46 x 2 nbr -> ANEL', () => {
    const plan = intelligentSearchEngine('anel 46 x 2 nbr');
    expect(plan.intent.productType).toBe('ANEL');
    expect(plan.intent.material).toBe('NBR');
    expect(plan.semantics.internalDiameter).toBeCloseTo(46, 2);
    expect(plan.semantics.section).toBeCloseTo(2, 2);
  });

  test('preciso de gaxeta -> GAXETA needs clarification', () => {
    const plan = intelligentSearchEngine('preciso de gaxeta');
    expect(plan.intent.productType).toBe('GAXETA');
    expect(plan.needsClarification).toBe(true);
  });
});

describe('anel e oring mesmo produto (busca-prisma)', () => {
  test('variantesAnelOring: anel e oring retornam [anel, oring]', () => {
    expect(variantesAnelOring('anel')).toEqual(['anel', 'oring']);
    expect(variantesAnelOring('oring')).toEqual(['anel', 'oring']);
  });
  test('variantesAnelOring: outra palavra retorna só ela', () => {
    expect(variantesAnelOring('retentor')).toEqual(['retentor']);
    expect(variantesAnelOring('gaxeta')).toEqual(['gaxeta']);
  });
});

