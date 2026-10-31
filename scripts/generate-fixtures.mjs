import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SS = 4;

const COLORS = {
  transparent: [0, 0, 0, 0],
  green: [43, 98, 72, 1],
  deepGreen: [29, 74, 52, 1],
  mint: [159, 190, 170, 1],
  ink: [35, 33, 29, 1],
  cream: [244, 241, 232, 1],
  paper: [250, 247, 239, 1],
  sand: [216, 201, 168, 1],
  terra: [192, 98, 59, 1],
  clay: [166, 79, 48, 1],
  blue: [62, 111, 140, 1],
  blueDeep: [43, 82, 107, 1],
  yellow: [217, 163, 58, 1],
  olive: [112, 127, 77, 1],
  sage: [148, 163, 126, 1],
  brown: [104, 78, 54, 1],
};

function alphaColor([r, g, b, a]) {
  return [r / 255, g / 255, b / 255, a];
}

class Surface {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.hiWidth = width * SS;
    this.hiHeight = height * SS;
    this.data = new Float64Array(this.hiWidth * this.hiHeight * 4);
  }

  composite(x, y, color, erase = false) {
    if (x < 0 || y < 0 || x >= this.hiWidth || y >= this.hiHeight) return;
    const index = (y * this.hiWidth + x) * 4;
    const data = this.data;
    const sourceAlpha = color[3];

    if (erase) {
      data[index + 3] *= 1 - sourceAlpha;
      if (data[index + 3] < 0.0001) {
        data[index] = 0;
        data[index + 1] = 0;
        data[index + 2] = 0;
        data[index + 3] = 0;
      }
      return;
    }

    if (sourceAlpha <= 0) return;
    const destinationAlpha = data[index + 3];
    const outAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
    if (outAlpha <= 0) return;
    for (let channel = 0; channel < 3; channel += 1) {
      data[index + channel] =
        (color[channel] * sourceAlpha +
          data[index + channel] * destinationAlpha * (1 - sourceAlpha)) /
        outAlpha;
    }
    data[index + 3] = outAlpha;
  }

  fillRect(x, y, width, height, color, erase = false) {
    const startX = Math.round(x * SS);
    const startY = Math.round(y * SS);
    const endX = Math.round((x + width) * SS);
    const endY = Math.round((y + height) * SS);
    for (let py = startY; py < endY; py += 1) {
      for (let px = startX; px < endX; px += 1) {
        this.composite(px, py, color, erase);
      }
    }
  }

  fillCircle(cx, cy, radius, color, erase = false) {
    const hx = cx * SS;
    const hy = cy * SS;
    const hr = radius * SS;
    const minX = Math.floor(hx - hr);
    const maxX = Math.ceil(hx + hr);
    const minY = Math.floor(hy - hr);
    const maxY = Math.ceil(hy + hr);
    const radiusSq = hr * hr;
    for (let py = minY; py <= maxY; py += 1) {
      const dy = py + 0.5 - hy;
      for (let px = minX; px <= maxX; px += 1) {
        const dx = px + 0.5 - hx;
        if (dx * dx + dy * dy <= radiusSq) {
          this.composite(px, py, color, erase);
        }
      }
    }
  }

  strokeSegment(x1, y1, x2, y2, width, color, erase = false) {
    const hx1 = x1 * SS;
    const hy1 = y1 * SS;
    const hx2 = x2 * SS;
    const hy2 = y2 * SS;
    const half = (width * SS) / 2;
    const minX = Math.floor(Math.min(hx1, hx2) - half);
    const maxX = Math.ceil(Math.max(hx1, hx2) + half);
    const minY = Math.floor(Math.min(hy1, hy2) - half);
    const maxY = Math.ceil(Math.max(hy1, hy2) + half);
    const vx = hx2 - hx1;
    const vy = hy2 - hy1;
    const lengthSq = vx * vx + vy * vy || 1;
    const halfSq = half * half;

    for (let py = minY; py <= maxY; py += 1) {
      for (let px = minX; px <= maxX; px += 1) {
        const dx = px + 0.5 - hx1;
        const dy = py + 0.5 - hy1;
        const t = Math.max(0, Math.min(1, (dx * vx + dy * vy) / lengthSq));
        const closestX = hx1 + vx * t;
        const closestY = hy1 + vy * t;
        const distanceX = px + 0.5 - closestX;
        const distanceY = py + 0.5 - closestY;
        if (distanceX * distanceX + distanceY * distanceY <= halfSq) {
          this.composite(px, py, color, erase);
        }
      }
    }
  }

  fillPolygon(points, color, erase = false) {
    const scaled = points.map(([x, y]) => [x * SS, y * SS]);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of scaled) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let py = Math.floor(minY); py <= Math.ceil(maxY); py += 1) {
      const sampleY = py + 0.5;
      const crossings = [];
      for (let i = 0; i < scaled.length; i += 1) {
        const [x1, y1] = scaled[i];
        const [x2, y2] = scaled[(i + 1) % scaled.length];
        if (y1 === y2) continue;
        if ((sampleY >= Math.min(y1, y2)) && (sampleY < Math.max(y1, y2))) {
          const t = (sampleY - y1) / (y2 - y1);
          crossings.push(x1 + (x2 - x1) * t);
        }
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const startX = Math.round(crossings[i]);
        const endX = Math.round(crossings[i + 1]);
        for (let px = startX; px < endX; px += 1) {
          this.composite(px, py, color, erase);
        }
      }
    }
  }

  fillRoundedRect(x, y, width, height, radius, color, erase = false) {
    const r = Math.min(radius, width / 2, height / 2);
    this.fillRect(x + r, y, width - r * 2, height, color, erase);
    this.fillRect(x, y + r, r, height - r * 2, color, erase);
    this.fillRect(x + width - r, y + r, r, height - r * 2, color, erase);
    this.fillCircle(x + r, y + r, r, color, erase);
    this.fillCircle(x + width - r, y + r, r, color, erase);
    this.fillCircle(x + r, y + height - r, r, color, erase);
    this.fillCircle(x + width - r, y + height - r, r, color, erase);
  }

  ring(cx, cy, outer, inner, color) {
    this.fillCircle(cx, cy, outer, color);
    this.fillCircle(cx, cy, inner, color, true);
  }

  toPng() {
    const width = this.width;
    const height = this.height;
    const rgba = new Uint8ClampedArray(width * height * 4);
    const samples = SS * SS;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let sumA = 0;
        for (let sy = 0; sy < SS; sy += 1) {
          for (let sx = 0; sx < SS; sx += 1) {
            const index = ((y * SS + sy) * this.hiWidth + (x * SS + sx)) * 4;
            const alpha = this.data[index + 3];
            sumR += this.data[index] * alpha;
            sumG += this.data[index + 1] * alpha;
            sumB += this.data[index + 2] * alpha;
            sumA += alpha;
          }
        }
        const out = (y * width + x) * 4;
        if (sumA > 0.00001) {
          rgba[out] = Math.round((sumR / sumA) * 255);
          rgba[out + 1] = Math.round((sumG / sumA) * 255);
          rgba[out + 2] = Math.round((sumB / sumA) * 255);
        }
        rgba[out + 3] = Math.round((sumA / samples) * 255);
      }
    }

    return encodePng(width, height, rgba);
  }
}

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function writePng(relativePath, surface) {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, surface.toPng());
  console.log(`wrote ${relativePath} (${surface.width}×${surface.height})`);
}

function logoMark(width, height) {
  const surface = new Surface(width, height);
  const scale = width / 640;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 172 * scale;

  surface.fillCircle(cx, cy, radius, alphaColor(COLORS.green));

  // Negative-space K cut from the disc.
  surface.fillRoundedRect(cx - 78 * scale, cy - 128 * scale, 35 * scale, 256 * scale, 3 * scale, [0, 0, 0, 1], true);
  surface.strokeSegment(
    cx - 46 * scale,
    cy + 2 * scale,
    cx + 82 * scale,
    cy - 118 * scale,
    34 * scale,
    [0, 0, 0, 1],
    true,
  );
  surface.strokeSegment(
    cx - 46 * scale,
    cy - 2 * scale,
    cx + 88 * scale,
    cy + 132 * scale,
    34 * scale,
    [0, 0, 0, 1],
    true,
  );

  // Separate accent dot.
  surface.fillCircle(cx + 158 * scale, cy - 142 * scale, 37 * scale, alphaColor(COLORS.terra));
  surface.fillCircle(cx + 158 * scale, cy - 142 * scale, 14 * scale, alphaColor(COLORS.cream));

  return surface;
}

function bwSymbol() {
  const surface = new Surface(600, 600);
  surface.fillRect(0, 0, 600, 600, alphaColor(COLORS.paper));

  const points = [];
  const cx = 300;
  const cy = 300;
  for (let i = 0; i < 24; i += 1) {
    const angle = (Math.PI * 2 * i) / 24 - Math.PI / 2;
    const radius = i % 2 === 0 ? 210 : 148;
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  surface.fillPolygon(points, alphaColor(COLORS.ink));
  surface.fillCircle(cx, cy, 82, alphaColor(COLORS.paper));
  surface.fillCircle(cx, cy, 42, alphaColor(COLORS.ink));
  surface.fillCircle(cx, cy, 14, alphaColor(COLORS.paper));

  return surface;
}

function illustration() {
  const surface = new Surface(800, 600);
  surface.fillRect(0, 0, 800, 600, alphaColor(COLORS.cream));

  // Sun and rays.
  surface.fillCircle(626, 148, 82, alphaColor(COLORS.yellow));
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    const x1 = 626 + Math.cos(angle) * 102;
    const y1 = 148 + Math.sin(angle) * 102;
    const x2 = 626 + Math.cos(angle) * 124;
    const y2 = 148 + Math.sin(angle) * 124;
    surface.strokeSegment(x1, y1, x2, y2, 7, alphaColor(COLORS.yellow));
  }

  // Back hills.
  surface.fillPolygon(
    [
      [0, 430],
      [140, 300],
      [286, 402],
      [420, 292],
      [580, 418],
      [800, 318],
      [800, 600],
      [0, 600],
    ],
    alphaColor(COLORS.sage),
  );
  surface.fillPolygon(
    [
      [0, 488],
      [190, 388],
      [352, 472],
      [520, 376],
      [680, 470],
      [800, 414],
      [800, 600],
      [0, 600],
    ],
    alphaColor(COLORS.olive),
  );

  // House.
  surface.fillRect(246, 366, 150, 112, alphaColor(COLORS.blue));
  surface.fillPolygon(
    [
      [228, 372],
      [321, 296],
      [414, 372],
    ],
    alphaColor(COLORS.clay),
  );
  surface.fillRect(308, 414, 38, 64, alphaColor(COLORS.cream));
  surface.fillRect(270, 392, 30, 28, alphaColor(COLORS.yellow));
  surface.fillRect(356, 392, 30, 28, alphaColor(COLORS.yellow));
  surface.fillRect(352, 310, 12, 34, alphaColor(COLORS.ink));

  // Tree.
  surface.fillRect(556, 396, 18, 92, alphaColor(COLORS.brown));
  surface.fillCircle(565, 350, 58, alphaColor(COLORS.green));
  surface.fillCircle(522, 384, 42, alphaColor(COLORS.deepGreen));
  surface.fillCircle(608, 386, 40, alphaColor(COLORS.deepGreen));

  // Foreground band and path.
  surface.fillRect(0, 524, 800, 76, alphaColor(COLORS.deepGreen));
  surface.fillPolygon(
    [
      [300, 600],
      [358, 600],
      [442, 484],
      [404, 484],
    ],
    alphaColor(COLORS.sand),
  );

  // Birds.
  surface.strokeSegment(132, 168, 158, 154, 6, alphaColor(COLORS.ink));
  surface.strokeSegment(158, 154, 184, 168, 6, alphaColor(COLORS.ink));
  surface.strokeSegment(196, 126, 216, 116, 5, alphaColor(COLORS.ink));
  surface.strokeSegment(216, 116, 236, 126, 5, alphaColor(COLORS.ink));

  return surface;
}

function largePoster() {
  const surface = new Surface(3200, 2000);
  surface.fillRect(0, 0, 3200, 2000, alphaColor(COLORS.paper));
  surface.fillRect(0, 0, 3200, 220, alphaColor(COLORS.deepGreen));
  surface.fillCircle(2470, 820, 510, alphaColor(COLORS.terra));
  surface.fillCircle(2470, 820, 250, alphaColor(COLORS.cream));
  surface.fillCircle(2470, 820, 116, alphaColor(COLORS.terra));

  for (let i = 0; i < 7; i += 1) {
    surface.fillRect(260, 470 + i * 170, 1180 - i * 78, 58, alphaColor(i % 2 === 0 ? COLORS.ink : COLORS.green));
  }

  surface.fillPolygon(
    [
      [0, 2000],
      [0, 1460],
      [660, 1640],
      [1180, 1430],
      [1780, 1700],
      [2380, 1510],
      [3200, 1740],
      [3200, 2000],
    ],
    alphaColor(COLORS.sage),
  );

  surface.fillRect(1180, 1840, 840, 40, alphaColor(COLORS.cream));

  return surface;
}

writePng('public/examples/beispiel-logo.png', logoMark(640, 640));
writePng('tests/fixtures/logo-transparent.png', logoMark(512, 512));
writePng('tests/fixtures/symbol-bw.png', bwSymbol());
writePng('tests/fixtures/illustration-color.png', illustration());
writePng('tests/fixtures/large.png', largePoster());

const invalid = Buffer.from(
  'This is intentionally not a PNG file. It exists to test the error path.\n',
  'utf8',
);
const invalidPath = join(root, 'tests/fixtures/invalid.png');
mkdirSync(dirname(invalidPath), { recursive: true });
writeFileSync(invalidPath, invalid);
console.log('wrote tests/fixtures/invalid.png (corrupt file)');
