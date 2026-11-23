import { describe, expect, it } from 'vitest';
import { contrast, deltaE, matrixFor, paletteRisks, parseHex, simulate, simulatePixels, toHex, toLab } from './vision';

describe('colour parsing', () => {
  it('parses 3- and 6-digit hex and formats back', () => {
    expect(parseHex('#0af')).toEqual([0, 170, 255]);
    expect(parseHex('E8112D')).toEqual([232, 17, 45]);
    expect(parseHex('#12345')).toBeNull();
    expect(toHex([0, 170, 255])).toBe('#00aaff');
  });
});

describe('simulation', () => {
  it('leaves greys unchanged (rows of each matrix sum to 1)', () => {
    for (const k of ['protan', 'deutan', 'tritan', 'achroma'] as const) {
      const out = simulate([128, 128, 128], k);
      out.forEach((c) => expect(Math.abs(c - 128)).toBeLessThanOrEqual(1));
    }
  });
  it('makes pure red and green much closer for red-green deficiencies', () => {
    const red: [number, number, number] = [220, 30, 30], green: [number, number, number] = [40, 160, 40];
    const normal = deltaE(red, green);
    expect(deltaE(simulate(red, 'deutan'), simulate(green, 'deutan'))).toBeLessThan(normal / 2);
    expect(deltaE(simulate(red, 'protan'), simulate(green, 'protan'))).toBeLessThan(normal / 2);
  });
  it('turns everything grey for achromatopsia and blends severities', () => {
    const [r, g, b] = simulate([200, 40, 120], 'achroma');
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(matrixFor('protan', 0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(simulate([200, 40, 120], 'protan', 0)).toEqual([200, 40, 120]);
    const half = simulate([220, 30, 30], 'protan', 0.5), full = simulate([220, 30, 30], 'protan', 1);
    expect(half[0]).toBeGreaterThan(full[0]);
  });
  it('processes RGBA pixel buffers in place without touching alpha', () => {
    const px = new Uint8ClampedArray([220, 30, 30, 128, 0, 0, 255, 255]);
    simulatePixels(px, 'deutan');
    expect(px[3]).toBe(128);
    expect(px[7]).toBe(255);
    expect([px[0], px[1], px[2]]).toEqual(simulate([220, 30, 30], 'deutan'));
  });
});

describe('colour difference and palettes', () => {
  it('computes Lab and CIE76 differences', () => {
    expect(toLab([255, 255, 255])[0]).toBeCloseTo(100, 0);
    expect(toLab([0, 0, 0])[0]).toBeCloseTo(0, 5);
    expect(deltaE([10, 10, 10], [10, 10, 10])).toBe(0);
    expect(deltaE([0, 0, 0], [255, 255, 255])).toBeCloseTo(100, 0);
  });
  it('flags a red/green pair but not a blue/orange pair', () => {
    const { pairs, flagged } = paletteRisks([parseHex('#d62728')!, parseHex('#2ca02c')!, parseHex('#1f77b4')!, parseHex('#ff7f0e')!]);
    expect(pairs).toHaveLength(6);
    expect(flagged.map((p) => `${p.i}-${p.j}`)).toContain('0-1');
    expect(flagged.map((p) => `${p.i}-${p.j}`)).not.toContain('2-3');
  });
  it('computes WCAG contrast', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBe(21);
    expect(contrast([255, 255, 255], [255, 255, 255])).toBe(1);
  });
});
