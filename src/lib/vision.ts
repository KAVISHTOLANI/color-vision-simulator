/*
 * Colour-vision deficiency simulation.
 * Protan/deutan/tritan use the full-severity matrices from Machado, Oliveira & Fernandes (2009),
 * applied in linear RGB. Partial severities are approximated by blending with the identity matrix.
 * Achromatopsia is approximated as relative luminance (Rec. 709 weights).
 */

export type Kind = 'normal' | 'protan' | 'deutan' | 'tritan' | 'achroma';
export const KIND_LABEL: Record<Kind, string> = {
  normal: 'Typical colour vision',
  protan: 'Protanopia (red-blind)',
  deutan: 'Deuteranopia (green-blind)',
  tritan: 'Tritanopia (blue-blind)',
  achroma: 'Achromatopsia (no colour)',
};
export const KIND_NOTE: Record<Kind, string> = {
  normal: 'Reference view.',
  protan: 'Reds look darker and are easily confused with greens and browns.',
  deutan: 'The most common type: reds and greens are hard to tell apart.',
  tritan: 'Rare: blues and greens, and yellows and pinks, are confused.',
  achroma: 'Very rare: only lightness differs.',
};

type M = [number, number, number, number, number, number, number, number, number];
export const MATRICES: Record<'protan' | 'deutan' | 'tritan', M> = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

const toLin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toSrgb = (v: number) => { const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, c)) * 255); };

// Lookup table for speed when processing images.
const LIN = Array.from({ length: 256 }, (_, i) => toLin(i));

export function matrixFor(kind: Kind, severity: number): M | null {
  if (kind === 'normal' || kind === 'achroma') return null;
  const s = Math.min(1, Math.max(0, severity));
  const m = MATRICES[kind];
  const id: M = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  return m.map((v, i) => id[i] + (v - id[i]) * s) as M;
}

export type RGB = [number, number, number];

export function simulate(rgb: RGB, kind: Kind, severity = 1): RGB {
  if (kind === 'normal' || severity <= 0) return rgb;
  const [r, g, b] = rgb.map((c) => LIN[Math.round(c)]);
  if (kind === 'achroma') {
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const mix = (c: number) => c + (y - c) * Math.min(1, severity);
    return [toSrgb(mix(r)), toSrgb(mix(g)), toSrgb(mix(b))];
  }
  const m = matrixFor(kind, severity)!;
  return [toSrgb(m[0] * r + m[1] * g + m[2] * b), toSrgb(m[3] * r + m[4] * g + m[5] * b), toSrgb(m[6] * r + m[7] * g + m[8] * b)];
}

/** Simulates in place on canvas ImageData pixels (RGBA). */
export function simulatePixels(data: Uint8ClampedArray, kind: Kind, severity = 1): void {
  if (kind === 'normal' || severity <= 0) return;
  const m = matrixFor(kind, severity);
  for (let i = 0; i < data.length; i += 4) {
    const r = LIN[data[i]], g = LIN[data[i + 1]], b = LIN[data[i + 2]];
    if (m) {
      data[i] = toSrgb(m[0] * r + m[1] * g + m[2] * b);
      data[i + 1] = toSrgb(m[3] * r + m[4] * g + m[5] * b);
      data[i + 2] = toSrgb(m[6] * r + m[7] * g + m[8] * b);
    } else {
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const s = Math.min(1, severity);
      data[i] = toSrgb(r + (y - r) * s);
      data[i + 1] = toSrgb(g + (y - g) * s);
      data[i + 2] = toSrgb(b + (y - b) * s);
    }
  }
}

export function parseHex(s: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export const toHex = (rgb: RGB) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');

/** CIE L*a*b* (D65). */
export function toLab(rgb: RGB): [number, number, number] {
  const [r, g, b] = rgb.map((c) => LIN[Math.round(c)]);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 colour difference. Roughly: < 2 barely perceptible, < 10 similar at a glance, > 25 clearly different. */
export function deltaE(a: RGB, b: RGB): number {
  const [l1, a1, b1] = toLab(a), [l2, a2, b2] = toLab(b);
  return Math.round(Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 10) / 10;
}

export interface PairRisk {
  i: number;
  j: number;
  normal: number;
  simulated: Record<Exclude<Kind, 'normal'>, number>;
  worst: Exclude<Kind, 'normal'>;
}

/** For every pair of palette colours, the colour difference under each deficiency. */
export function paletteRisks(colors: RGB[], threshold = 12): { pairs: PairRisk[]; flagged: PairRisk[] } {
  const kinds: Exclude<Kind, 'normal'>[] = ['protan', 'deutan', 'tritan', 'achroma'];
  const pairs: PairRisk[] = [];
  for (let i = 0; i < colors.length; i++)
    for (let j = i + 1; j < colors.length; j++) {
      const simulated = Object.fromEntries(kinds.map((k) => [k, deltaE(simulate(colors[i], k), simulate(colors[j], k))])) as PairRisk['simulated'];
      const worst = kinds.reduce((w, k) => (simulated[k] < simulated[w] ? k : w), 'protan' as Exclude<Kind, 'normal'>);
      pairs.push({ i, j, normal: deltaE(colors[i], colors[j]), simulated, worst });
    }
  // Only flag pairs that are distinct normally but collapse under a deficiency (ignoring achromatopsia, which is very rare).
  const flagged = pairs.filter((p) => p.normal >= threshold && Math.min(p.simulated.protan, p.simulated.deutan, p.simulated.tritan) < threshold);
  return { pairs, flagged };
}

/** WCAG relative luminance contrast, useful to suggest lightness differences as a fix. */
export function contrast(a: RGB, b: RGB): number {
  const L = (c: RGB) => 0.2126 * LIN[c[0]] + 0.7152 * LIN[c[1]] + 0.0722 * LIN[c[2]];
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}
