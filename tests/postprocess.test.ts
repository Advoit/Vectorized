import { describe, expect, it } from 'vitest';
import {
  buildSvgDocument,
  formatBytes,
  formatCount,
  parseVtracerSvg,
  utf8ByteLength,
} from '../src/trace/postprocess';

const SAMPLE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
  <path d="M0 0L100 0L100 100L0 100Z" fill="#ff0000"/>
  <path d="M10 10L20 10L20 20Z" fill="#00AA00" transform="translate(4, 8)"/>
  <path d="M30 30L40 40Z" fill="#0000ff" transform="translate(1.5,-2)"/>
</svg>`;

describe('parseVtracerSvg', () => {
  it('extracts validated paths and computes statistics', () => {
    const parsed = parseVtracerSvg(SAMPLE_SVG, 200, 100, { keyColor: null });
    expect(parsed.paths).toHaveLength(3);
    expect(parsed.paths[0]).toEqual({ d: 'M0 0L100 0L100 100L0 100Z', fill: '#ff0000' });
    expect(parsed.paths[1]?.transform).toBe('translate(4, 8)');
    expect(parsed.stats.pathCount).toBe(3);
    expect(parsed.stats.subpathCount).toBe(3);
    expect(parsed.stats.colorCount).toBe(3);
    expect(parsed.stats.bytes).toBeGreaterThan(100);
  });

  it('removes paths that only represent the transparency key colour', () => {
    const svg = `<svg>
      <path d="M0 0L10 0L10 10Z" fill="#ff00ff"/>
      <path d="M2 2L8 2L8 8Z" fill="#123456"/>
      <path d="M4 4L6 4L6 6Z" fill="#FF00FF"/>
      <path d="M5 5L7 5L7 7Z" fill="#ff00ff" transform="translate(1,2)"/>
    </svg>`;
    const parsed = parseVtracerSvg(svg, 10, 10, { keyColor: '#ff00ff' });
    expect(parsed.paths).toEqual([{ d: 'M2 2L8 2L8 8Z', fill: '#123456' }]);
    expect(parsed.stats.subpathCount).toBe(1);
    expect(parsed.stats.colorCount).toBe(1);
  });

  it('keeps multiple subpaths within one path', () => {
    const svg = `<svg><path d="M0 0L2 0L2 2Z M5 5L7 5L7 7Z" fill="#abcdef"/></svg>`;
    const parsed = parseVtracerSvg(svg, 10, 10, { keyColor: null });
    expect(parsed.paths).toHaveLength(1);
    expect(parsed.stats.subpathCount).toBe(2);
  });

  it('rejects invalid geometry, colours and transforms', () => {
    const svg = `<svg>
      <path d="M0 0 script" fill="#ff0000"/>
      <path d="M0 0L10 10Z" fill="red"/>
      <path d="M0 0L10 10Z" fill="#abc"/>
      <path d="M0 0L10 10Z" fill="#ff0000" transform="rotate(45)"/>
      <path d="not-a-path" fill="#ff0000"/>
    </svg>`;
    expect(() => parseVtracerSvg(svg, 10, 10, { keyColor: null })).toThrow(/ungültige Pfaddaten/i);
  });

  it('ignores invalid paths when valid geometry exists', () => {
    const svg = `<svg>
      <path d="M0 0 script" fill="#ff0000"/>
      <path d="M1 1L9 1L9 9Z" fill="#00ff00"/>
    </svg>`;
    const parsed = parseVtracerSvg(svg, 10, 10, { keyColor: null });
    expect(parsed.paths).toHaveLength(1);
    expect(parsed.paths[0]?.fill).toBe('#00ff00');
  });
});

describe('buildSvgDocument', () => {
  const geometry = {
    width: 600,
    height: 400,
    paths: [
      { d: 'M0 0L100 0L100 100Z', fill: '#112233' },
      { d: 'M10 10L20 20Z', fill: '#445566', transform: 'translate(2,3)' },
    ],
  };

  it('writes a standalone document with viewBox and geometry size', () => {
    const svg = buildSvgDocument(geometry, {
      background: 'transparent',
      backgroundColor: '#ffffff',
    });
    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(svg).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">',
    );
    expect(svg).not.toContain('<rect');
    expect(svg).toContain('<path d="M0 0L100 0L100 100Z" fill="#112233"/>');
    expect(svg).toContain(
      '<path d="M10 10L20 20Z" fill="#445566" transform="translate(2,3)"/>',
    );
    expect(svg.endsWith('</svg>\n')).toBe(true);
  });

  it('adds white or custom backgrounds', () => {
    const white = buildSvgDocument(geometry, {
      background: 'white',
      backgroundColor: '#123456',
    });
    expect(white).toContain('<rect width="600" height="400" fill="#ffffff"/>');

    const custom = buildSvgDocument(geometry, {
      background: 'custom',
      backgroundColor: '#ABCDEF',
    });
    expect(custom).toContain('<rect width="600" height="400" fill="#ABCDEF"/>');

    const invalid = buildSvgDocument(geometry, {
      background: 'custom',
      backgroundColor: 'url(evil)',
    });
    expect(invalid).toContain('<rect width="600" height="400" fill="#ffffff"/>');
    expect(invalid).not.toContain('evil');
  });

  it('supports PNG output dimensions independently of the viewBox', () => {
    const svg = buildSvgDocument(geometry, {
      background: 'transparent',
      backgroundColor: '#ffffff',
      width: 1200,
      height: 800,
    });
    expect(svg).toContain('width="1200" height="800" viewBox="0 0 600 400"');
  });

  it('renders outline previews without fills', () => {
    const svg = buildSvgDocument(geometry, {
      background: 'transparent',
      backgroundColor: '#ffffff',
      contours: true,
      contourColor: '#00ff00',
    });
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#00ff00"');
    expect(svg).toContain('vector-effect="non-scaling-stroke"');
    expect(svg).not.toContain('fill="#112233"');
  });
});

describe('format helpers', () => {
  it('counts UTF-8 bytes rather than characters', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('ä')).toBe(2);
    expect(utf8ByteLength('Grüße')).toBe(7);
  });

  it('formats sizes and counts for German copy', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5,00 MB');
    expect(formatCount(1234567)).toBe('1.234.567');
  });
});
