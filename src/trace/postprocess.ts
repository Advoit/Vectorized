import { isValidHexColor } from './settings';
import type { BackgroundMode, TraceStats, TracedPath } from './types';

const PATH_COMMAND_PATTERN = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]+$/;
const TRANSFORM_PATTERN =
  /^translate\(\s*(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(?:[, ]\s*(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?))?\s*\)$/i;

function attributeValue(attributes: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`, 'i').exec(attributes);
  return match?.[1] ?? null;
}

export interface ParseOptions {
  keyColor: string | null;
}

export interface ParsedTrace {
  paths: TracedPath[];
  stats: TraceStats;
}

/**
 * Parses the SVG emitted by the local VTracer build and keeps only validated
 * path geometry. This is the only place where engine output enters the app.
 */
export function parseVtracerSvg(svg: string, width: number, height: number, options: ParseOptions): ParsedTrace {
  const paths: TracedPath[] = [];
  const colors = new Set<string>();
  let subpathCount = 0;
  let invalidPaths = 0;
  let keyPaths = 0;
  const pathPattern = /<path\b([^>]*)>/gi;
  const keyColor = options.keyColor?.toLowerCase() ?? null;

  for (const match of svg.matchAll(pathPattern)) {
    const attributes = match[1] ?? '';
    const d = attributeValue(attributes, 'd');
    const fill = attributeValue(attributes, 'fill');
    const transform = attributeValue(attributes, 'transform');

    if (!d || d.length > 8_000_000 || !d.startsWith('M') || !PATH_COMMAND_PATTERN.test(d)) {
      invalidPaths += 1;
      continue;
    }
    if (!isValidHexColor(fill)) {
      invalidPaths += 1;
      continue;
    }
    if (transform !== null && !TRANSFORM_PATTERN.test(transform)) {
      invalidPaths += 1;
      continue;
    }

    const normalizedFill = fill.toLowerCase();
    if (keyColor !== null && normalizedFill === keyColor) {
      keyPaths += 1;
      continue;
    }

    const subpaths = (d.match(/[Mm]/g) ?? []).length;
    subpathCount += subpaths;
    colors.add(normalizedFill);
    paths.push(transform ? { d, fill: normalizedFill, transform } : { d, fill: normalizedFill });
  }

  if (invalidPaths > 0 && paths.length === 0) {
    throw new Error('Die Tracing-Engine hat ungültige Pfaddaten geliefert.');
  }

  const baseDocument = buildSvgDocument(
    { width, height, paths },
    { background: 'transparent', backgroundColor: '#ffffff' },
  );

  return {
    paths,
    stats: {
      pathCount: paths.length,
      subpathCount,
      colorCount: colors.size,
      bytes: utf8ByteLength(baseDocument),
    },
  };
}

export interface SvgBuildOptions {
  background: BackgroundMode;
  backgroundColor: string;
  width?: number;
  height?: number;
  contours?: boolean;
  contourColor?: string;
}

export interface SvgGeometry {
  width: number;
  height: number;
  paths: readonly TracedPath[];
}

function formatNumber(value: number, digits = 3): string {
  return Number(value.toFixed(digits)).toString();
}

export function buildSvgDocument(geometry: SvgGeometry, options: SvgBuildOptions): string {
  const outWidth = options.width ?? geometry.width;
  const outHeight = options.height ?? geometry.height;
  const background = isValidHexColor(options.backgroundColor) ? options.backgroundColor : '#ffffff';
  const contourColor = isValidHexColor(options.contourColor) ? options.contourColor : '#1d1c19';
  const parts: string[] = [];

  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(outWidth)}" height="${formatNumber(outHeight)}" viewBox="0 0 ${geometry.width} ${geometry.height}">`,
  );

  if (options.background === 'white') {
    parts.push(
      `<rect width="${geometry.width}" height="${geometry.height}" fill="#ffffff"/>`,
    );
  } else if (options.background === 'custom') {
    parts.push(
      `<rect width="${geometry.width}" height="${geometry.height}" fill="${background}"/>`,
    );
  }

  for (const path of geometry.paths) {
    const transform = path.transform ? ` transform="${path.transform}"` : '';
    if (options.contours) {
      parts.push(
        `<path d="${path.d}" fill="none" stroke="${contourColor}" stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke"${transform}/>`,
      );
    } else {
      parts.push(`<path d="${path.d}" fill="${path.fill}"${transform}/>`);
    }
  }

  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MB`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value);
}
