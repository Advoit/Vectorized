import { describe, expect, it } from 'vitest';
import {
  exportBaseName,
  fileNameWithExtension,
  MAX_PNG_PIXELS,
  MAX_PNG_SIDE,
  validatePngDimensions,
} from '../src/export/download';
import { sanitizeBaseName } from '../src/image/load';

describe('export file names', () => {
  it('sanitizes unsafe characters and keeps a useful fallback', () => {
    expect(sanitizeBaseName('Mein Logo!.png')).toBe('Mein Logo!');
    expect(sanitizeBaseName('bad/name:with*chars?.jpg')).toBe('bad-name-with-chars');
    expect(sanitizeBaseName('bild.name.png')).toBe('bild.name');
    expect(sanitizeBaseName('   .hidden   ')).toBe('hidden');
    expect(sanitizeBaseName('')).toBe('vektor');
    expect(sanitizeBaseName('....')).toBe('vektor');
    expect(sanitizeBaseName('a'.repeat(200))).toHaveLength(60);
  });

  it('derives the default vector base name without duplicating the suffix', () => {
    expect(exportBaseName('beispiel-logo')).toBe('beispiel-logo-vektor');
    expect(exportBaseName('beispiel-logo-vektor')).toBe('beispiel-logo-vektor');
  });

  it('normalizes the extension and strips a typed one', () => {
    expect(fileNameWithExtension('beispiel-logo-vektor', 'svg')).toBe(
      'beispiel-logo-vektor.svg',
    );
    expect(fileNameWithExtension('beispiel-logo-vektor.svg', 'svg')).toBe(
      'beispiel-logo-vektor.svg',
    );
    expect(fileNameWithExtension('My Export.PNG', 'png')).toBe('My Export.png');
    expect(fileNameWithExtension('   ', 'png')).toBe('vektor.png');
  });
});

describe('PNG target limits', () => {
  it('accepts normal and maximum single-side target sizes', () => {
    expect(validatePngDimensions(2400, 1600)).toBeNull();
    expect(validatePngDimensions(1, 1)).toBeNull();
    expect(validatePngDimensions(MAX_PNG_SIDE, 100)).toBeNull();
  });

  it('rejects invalid and oversized targets', () => {
    expect(validatePngDimensions(0, 100)).toBe('invalid');
    expect(validatePngDimensions(-4, 100)).toBe('invalid');
    expect(validatePngDimensions(Number.NaN, 100)).toBe('invalid');
    expect(validatePngDimensions(Number.POSITIVE_INFINITY, 100)).toBe('invalid');
    expect(validatePngDimensions(MAX_PNG_SIDE + 1, 100)).toBe('limit');
    expect(validatePngDimensions(MAX_PNG_SIDE, MAX_PNG_SIDE)).toBe('limit');
    expect(validatePngDimensions(MAX_PNG_PIXELS, 2)).toBe('limit');
  });
});
