import { describe, expect, test } from 'vitest';
import { parseToleranceCommand } from '../lib/search/tolerance';

describe('parseToleranceCommand', () => {
  test('5% de tolerância -> PLUS_MINUS 5', () => {
    const cmd = parseToleranceCommand('5% de tolerância');
    expect(cmd).not.toBeNull();
    expect(cmd!.percent).toBe(5);
    expect(cmd!.mode).toBe('PLUS_MINUS');
  });

  test('tol 10% pra mais -> PLUS_ONLY 10', () => {
    const cmd = parseToleranceCommand('tol 10% pra mais');
    expect(cmd).not.toBeNull();
    expect(cmd!.percent).toBe(10);
    expect(cmd!.mode).toBe('PLUS_ONLY');
  });

  test('5% pra menos -> MINUS_ONLY 5', () => {
    const cmd = parseToleranceCommand('5% pra menos');
    expect(cmd).not.toBeNull();
    expect(cmd!.percent).toBe(5);
    expect(cmd!.mode).toBe('MINUS_ONLY');
  });

  test('±3% -> PLUS_MINUS 3', () => {
    const cmd = parseToleranceCommand('±3%');
    expect(cmd).not.toBeNull();
    expect(cmd!.percent).toBe(3);
    expect(cmd!.mode).toBe('PLUS_MINUS');
  });

  test('texto sem % nem tolerancia -> null', () => {
    const cmd = parseToleranceCommand('quero produtos maiores');
    expect(cmd).toBeNull();
  });
});

