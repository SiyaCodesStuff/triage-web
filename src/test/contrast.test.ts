import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
function theme(selector: string) {
  const block = css.split(`${selector} {`)[1]?.split('}')[0];
  if (!block) throw new Error(`Missing theme ${selector}`);
  return Object.fromEntries(
    [...block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
}
function luminance(color: string | undefined): number {
  if (!color) throw new Error('Missing contrast token');
  const neutral = /^oklch\(([\d.]+) 0 0\)$/.exec(color);
  if (neutral?.[1]) return Number(neutral[1]) ** 3;
  if (!/^#[a-f0-9]{6}$/i.test(color))
    throw new Error(`Unsupported color ${color}`);
  const channel = (offset: number) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
function contrast(first: string | undefined, second: string | undefined) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe.each([':root', '.dark'])('%s theme contrast', (selector) => {
  const colors = theme(selector);
  it.each([
    ['--foreground', '--background'],
    ['--card-foreground', '--card'],
    ['--muted-foreground', '--background'],
    ['--muted-foreground', '--card'],
    ['--muted-foreground', '--muted'],
    ['--primary-foreground', '--primary'],
    ['--secondary-foreground', '--secondary'],
    ['--accent-foreground', '--accent'],
    ['--popover-foreground', '--popover'],
    ['--destructive', '--background'],
    ['--destructive', '--card'],
    ['--destructive-foreground', '--destructive'],
  ])('keeps text %s on %s above 4.5:1', (foreground, background) => {
    expect(
      contrast(colors[foreground], colors[background]),
    ).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps destructive hover-button text above 4.5:1', () => {
    const destructive = colors['--destructive'];
    if (!destructive || !/^#[a-f0-9]{6}$/i.test(destructive))
      throw new Error('Expected opaque destructive token');
    const background = luminance(colors['--card']);
    const backgroundChannel =
      background <= 0.0031308
        ? 12.92 * background
        : 1.055 * background ** (1 / 2.4) - 0.055;
    const channels = [1, 3, 5].map((offset) => {
      const mixed =
        (0.9 * parseInt(destructive.slice(offset, offset + 2), 16)) / 255 +
        0.1 * backgroundChannel;
      return mixed <= 0.04045
        ? mixed / 12.92
        : ((mixed + 0.055) / 1.055) ** 2.4;
    });
    const hover =
      0.2126 * (channels[0] ?? 0) +
      0.7152 * (channels[1] ?? 0) +
      0.0722 * (channels[2] ?? 0);
    const text = luminance(colors['--destructive-foreground']);
    expect(
      (Math.max(text, hover) + 0.05) / (Math.min(text, hover) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['--background', '--card', '--secondary'])(
    'keeps focus and control borders against %s above 3:1',
    (background) => {
      expect(
        contrast(colors['--ring'], colors[background]),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrast(colors['--input'], colors[background]),
      ).toBeGreaterThanOrEqual(3);
    },
  );
});
