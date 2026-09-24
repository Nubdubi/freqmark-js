import { bitsToBytes, bytesToBits } from '../core/bits.js';
import { BLOCK_SIZE, dct8, idct8, type Block8 } from '../core/dct.js';
import { COEFF_A, COEFF_B, PILOT_COEFF_A, PILOT_COEFF_B, embedBit, embedCoefficientPair } from './coefficients.js';
import { buildFrame, FRAME_BITS, parseFrame, type SupportedFrameVersion } from './frame.js';
import { DEFAULT_PLACEMENT_SEED, placementPermutation, slotForBlock, TILE_BLOCKS } from './layout.js';
import { LEGACY_TILE_BLOCKS } from './layout.js';
import { analyzeTextureBlock } from '../perceptual/texture.js';
import { repetition3 } from '../ecc/repetition.js';
import { DEFAULT_PILOT_SEED, getPilotPattern, pilotActive, pilotBit, pilotConfidence } from '../sync/pilot.js';

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function readCenteredLumaBlock(
  data: Uint8ClampedArray,
  width: number,
  originX: number,
  originY: number,
): Block8 {
  const block: Block8 = Array.from({ length: BLOCK_SIZE }, () => Array(BLOCK_SIZE).fill(0));

  for (let y = 0; y < BLOCK_SIZE; y++) {
    for (let x = 0; x < BLOCK_SIZE; x++) {
      const px = originX + x;
      const py = originY + y;
      const i = (py * width + px) * 4;
      block[y][x] = luminance(data[i], data[i + 1], data[i + 2]) - 128;
    }
  }

  return block;
}

function applyLumaDeltaBlock(
  data: Uint8ClampedArray,
  width: number,
  originX: number,
  originY: number,
  originalCentered: Block8,
  updatedCentered: Block8,
): void {
  for (let y = 0; y < BLOCK_SIZE; y++) {
    for (let x = 0; x < BLOCK_SIZE; x++) {
      const delta = updatedCentered[y][x] - originalCentered[y][x];
      const px = originX + x;
      const py = originY + y;
      const i = (py * width + px) * 4;

      data[i] = clampByte(data[i] + delta);
      data[i + 1] = clampByte(data[i + 1] + delta);
      data[i + 2] = clampByte(data[i + 2] + delta);
    }
  }
}

function sampleLumaBilinear(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, x - x0));
  const ty = Math.max(0, Math.min(1, y - y0));

  const at = (px: number, py: number): number => {
    const i = (py * width + px) * 4;
    return luminance(data[i], data[i + 1], data[i + 2]) - 128;
  };

  const a = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const b = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return a * (1 - ty) + b * ty;
}

const C = Array.from({ length: 8 }, (_, i) => (i === 0 ? 1 / Math.sqrt(2) : 1));
const COS = Array.from({ length: 8 }, (_, p) =>
  Array.from({ length: 8 }, (_, f) => Math.cos(((2 * p + 1) * f * Math.PI) / 16)),
);

function sampledCoefficient(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  originX: number,
  originY: number,
  blockSize: number,
  u: number,
  v: number,
): number {
  let sum = 0;
  for (let sy = 0; sy < 8; sy++) {
    for (let sx = 0; sx < 8; sx++) {
      const px = originX + ((sx + 0.5) * blockSize) / 8 - 0.5;
      const py = originY + ((sy + 0.5) * blockSize) / 8 - 0.5;
      const value = sampleLumaBilinear(data, width, height, px, py);
      sum += value * COS[sx][u] * COS[sy][v];
    }
  }
  return 0.25 * C[u] * C[v] * sum;
}

function readSampledBit(
  source: ImageData,
  originX: number,
  originY: number,
  blockSize: number,
): { bit: number; margin: number; signedMargin: number } {
  const a = sampledCoefficient(
    source.data,
    source.width,
    source.height,
    originX,
    originY,
    blockSize,
    COEFF_A.x,
    COEFF_A.y,
  );
  const b = sampledCoefficient(
    source.data,
    source.width,
    source.height,
    originX,
    originY,
    blockSize,
    COEFF_B.x,
    COEFF_B.y,
  );
  const signedMargin = a - b;
  return {
    bit: signedMargin >= 0 ? 1 : 0,
    margin: Math.abs(signedMargin),
    signedMargin,
  };
}

export interface EmbedEngineOptions {
  strength: number;
  /** Spatial thinning. 1 is strongly recommended for crop-resistant v2 layout. */
  density: number;
  /** Skip perceptually smooth blocks. Defaults to true. */
  adaptive?: boolean;
  /** Minimum normalized texture score required for embedding. Default 0.08. */
  textureThreshold?: number;
  /** Minimum fraction of strength used just above the texture threshold. */
  minStrengthFactor?: number;
  /** Test/migration hook. New encodes should use the default v3 frame. */
  frameVersion?: SupportedFrameVersion;
  /** Public, non-secret seed used only to disperse the spatial pattern. */
  placementSeed?: string;
  pilotSeed?: string;
}

export interface EmbedEngineResult {
  imageData: ImageData;
  blocksUsed: number;
  repetitionsPerBit: number;
  tileBlocks: number;
  blocksSkippedSmooth: number;
  averageStrength: number;
}

export function embedFingerprintIntoImageData(
  source: ImageData,
  fingerprint: string,
  options: EmbedEngineOptions,
): EmbedEngineResult {
  const { width, height } = source;
  const data = new Uint8ClampedArray(source.data);
  const frameVersion = options.frameVersion ?? 3;
  const rawFrameBits = Uint8Array.from(bytesToBits(buildFrame(fingerprint, frameVersion)));
  const frameBits = frameVersion === 3 ? repetition3.encode(rawFrameBits) : rawFrameBits;
  const tileBlocks = frameVersion === 3 ? TILE_BLOCKS : LEGACY_TILE_BLOCKS;
  const placementSeed = options.placementSeed ?? DEFAULT_PLACEMENT_SEED;
  const permutation = frameVersion === 3
    ? placementPermutation(frameBits.length, frameVersion, placementSeed)
    : undefined;
  const pilotSeed = options.pilotSeed ?? DEFAULT_PILOT_SEED;
  let used = 0;
  let skippedSmooth = 0;
  let strengthSum = 0;
  const adaptive = options.adaptive ?? true;
  const textureThreshold = Math.max(0, Math.min(1, options.textureThreshold ?? 0.08));
  const textureSamples = new Float32Array(BLOCK_SIZE * BLOCK_SIZE);
  const minStrengthFactor = Math.max(0.1, Math.min(1, options.minStrengthFactor ?? 0.35));

  const blocksX = Math.floor(width / BLOCK_SIZE);
  const blocksY = Math.floor(height / BLOCK_SIZE);

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const slot = slotForBlock(bx, by, 0, 0, tileBlocks, frameBits.length, frameVersion, placementSeed, permutation);
      if (slot % options.density !== 0) continue;

      const originX = bx * BLOCK_SIZE;
      const originY = by * BLOCK_SIZE;
      const original = readCenteredLumaBlock(data, width, originX, originY);
      let blockStrength = options.strength;
      if (adaptive) {
        for (let y = 0; y < BLOCK_SIZE; y++) {
          for (let x = 0; x < BLOCK_SIZE; x++) textureSamples[y * BLOCK_SIZE + x] = original[y][x];
        }
        const textureScore = analyzeTextureBlock(textureSamples, BLOCK_SIZE, BLOCK_SIZE).score;
        if (textureScore < textureThreshold) {
          skippedSmooth++;
          continue;
        }
        const normalized = (textureScore - textureThreshold) / Math.max(0.0001, 1 - textureThreshold);
        blockStrength *= minStrengthFactor + (1 - minStrengthFactor) * normalized;
      }
      const coeff = dct8(original);
      embedBit(coeff, frameBits[slot], blockStrength);
      if (frameVersion === 3 && pilotActive(bx, by, pilotSeed)) {
        embedCoefficientPair(coeff, PILOT_COEFF_A, PILOT_COEFF_B, pilotBit(bx, by, pilotSeed), Math.max(2, blockStrength * 0.16));
      }
      const updated = idct8(coeff);
      applyLumaDeltaBlock(data, width, originX, originY, original, updated);
      used++;
      strengthSum += blockStrength;
    }
  }

  if (used < frameBits.length) {
    throw new Error(
      `Image is too small for reliable embedding. Used ${used} blocks; need at least ${frameBits.length}.`,
    );
  }

  return {
    imageData: new ImageData(data, width, height),
    blocksUsed: used,
    repetitionsPerBit: used / frameBits.length,
    tileBlocks,
    blocksSkippedSmooth: skippedSmooth,
    averageStrength: used ? strengthSum / used : 0,
  };
}

interface GridCell {
  bx: number;
  by: number;
  bit: number;
  margin: number;
  signedMargin: number;
  pilotBit: number;
  pilotMargin: number;
}

export interface DetectionTransform {
  /** Estimated current-image pixel size corresponding to one original 8x8 block. */
  blockSize: number;
  /** Pixel offset used to reacquire the DCT grid after cropping. */
  offsetX: number;
  offsetY: number;
  /** Spatial tile phase used to reacquire repeated v2 payload layout. */
  phaseX: number;
  phaseY: number;
}

export interface DetectEngineOptions {
  density: number;
  minMargin: number;
  /** Scan multiple geometric hypotheses for crop/resize resilience. Default false at engine level. */
  robust?: boolean;
  /** Candidate current-image block sizes. 8 means no resize. */
  blockSizes?: number[];
  /** Pixel step while searching crop/grid alignment. Lower is slower but stronger. */
  offsetStep?: number;
  /** Must match encode placementSeed for v3. */
  placementSeed?: string;
  pilotSeed?: string;
}

export interface DetectEngineResult {
  found: boolean;
  fingerprint: string | null;
  confidence: number;
  blocksRead: number;
  repetitionsPerBit: number;
  frame: {
    version: 2 | 3 | null;
    preambleValid: boolean;
    magicValid: boolean;
    versionValid: boolean;
    crcValid: boolean;
  };
  correctedBits: number;
  rawBitErrors: number;
  sync: {
    found: boolean;
    confidence: number;
    scale: number;
    offsetX: number;
    offsetY: number;
    rotationDeg: number;
    perspectiveCorrected: boolean;
  };
  bitAgreement: number;
  coverage: number;
  candidatesTested: number;
  transform: DetectionTransform | null;
}

interface CandidateResult extends Omit<DetectEngineResult, 'candidatesTested'> {
  score: number;
}

function makeOffsetCandidates(blockSize: number, robust: boolean, requestedStep?: number): number[] {
  if (!robust) return [0];
  const step = Math.max(1, Math.floor(requestedStep ?? 1));
  const values = new Set<number>([0]);
  for (let value = step; value < blockSize; value += step) values.add(value);
  values.add(Math.max(0, blockSize - 1));
  return [...values].sort((a, b) => a - b);
}

function readSampledCoefficientPair(
  source: ImageData,
  originX: number,
  originY: number,
  blockSize: number,
  first: { x: number; y: number },
  second: { x: number; y: number },
): { bit: number; margin: number } {
  const a = sampledCoefficient(source.data, source.width, source.height, originX, originY, blockSize, first.x, first.y);
  const b = sampledCoefficient(source.data, source.width, source.height, originX, originY, blockSize, second.x, second.y);
  return { bit: a - b >= 0 ? 1 : 0, margin: Math.abs(a - b) };
}

function buildGrid(
  source: ImageData,
  blockSize: number,
  offsetX: number,
  offsetY: number,
): GridCell[] {
  const cells: GridCell[] = [];
  const blocksX = Math.floor((source.width - offsetX) / blockSize);
  const blocksY = Math.floor((source.height - offsetY) / blockSize);

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const originX = offsetX + bx * blockSize;
      const originY = offsetY + by * blockSize;
      const read = readSampledBit(source, originX, originY, blockSize);
      const pilot = readSampledCoefficientPair(source, originX, originY, blockSize, PILOT_COEFF_A, PILOT_COEFF_B);
      cells.push({ bx, by, ...read, pilotBit: pilot.bit, pilotMargin: pilot.margin });
    }
  }
  return cells;
}

function evaluatePhase(
  cells: GridCell[],
  phaseX: number,
  phaseY: number,
  transform: Omit<DetectionTransform, 'phaseX' | 'phaseY'>,
  options: DetectEngineOptions,
  ecc: boolean,
  tileBlocks: number,
): CandidateResult {
  const encodedBits = ecc ? FRAME_BITS * repetition3.repetitions : FRAME_BITS;
  const placementSeed = options.placementSeed ?? DEFAULT_PLACEMENT_SEED;
  const permutation = ecc ? placementPermutation(encodedBits, 3, placementSeed) : undefined;
  const votes = Array.from({ length: encodedBits }, () => ({ zero: 0, one: 0, count: 0 }));
  const syncPattern = ecc ? getPilotPattern(options.pilotSeed ?? DEFAULT_PILOT_SEED) : null;
  let used = 0;
  let pilotMatches = 0;
  let pilotTotal = 0;

  for (const cell of cells) {
    const slot = slotForBlock(
      cell.bx,
      cell.by,
      phaseX,
      phaseY,
      tileBlocks,
      encodedBits,
      ecc ? 3 : 2,
      placementSeed,
      permutation,
    );
    if (slot % options.density !== 0) continue;

    const weight = Math.max(0.15, Math.min(4, cell.margin / Math.max(1, options.minMargin)));
    if (cell.bit === 1) votes[slot].one += weight;
    else votes[slot].zero += weight;
    votes[slot].count++;
    used++;
    const logicalX = cell.bx + phaseX;
    const logicalY = cell.by + phaseY;
    const pilotIndex = ((logicalY & 31) * 32) + (logicalX & 31);
    if (syncPattern && syncPattern.active[pilotIndex] === 1 && cell.pilotMargin >= options.minMargin * 0.2) {
      pilotTotal++;
      if (cell.pilotBit === syncPattern.bits[pilotIndex]) {
        pilotMatches++;
      }
    }
  }

  let agreementSum = 0;
  let covered = 0;
  const bits = votes.map(({ zero, one, count }) => {
    if (count > 0) {
      covered++;
      const total = zero + one;
      agreementSum += total > 0 ? Math.max(zero, one) / total : 0;
    }
    return one >= zero ? 1 : 0;
  });

  const coverage = covered / encodedBits;
  const bitAgreement = covered > 0 ? agreementSum / covered : 0;
  const eccResult = ecc ? repetition3.decode(Uint8Array.from(bits)) : { data: Uint8Array.from(bits), corrected: 0, success: true };
  const parsed = parseFrame(bitsToBytes([...eccResult.data]));
  const syncConfidence = ecc ? pilotConfidence(pilotMatches, pilotTotal) : 0;
  const structuralScore =
    (parsed.magicValid ? 0.15 : 0) +
    (parsed.versionValid ? 0.10 : 0) +
    (parsed.crcValid ? 0.30 : 0);
  const confidence = Math.max(
    0,
    Math.min(1, bitAgreement * 0.30 + coverage * 0.15 + structuralScore),
  );
  const valid = parsed.valid && eccResult.success && coverage >= 0.70 && (ecc ? parsed.version === 3 : parsed.version === 2);
  const score = confidence + (valid ? 1 : 0) + syncConfidence * 0.2;

  return {
    found: valid,
    fingerprint: valid ? parsed.fingerprint : null,
    confidence,
    blocksRead: used,
    repetitionsPerBit: used / encodedBits,
    frame: {
      version: parsed.version,
      preambleValid: parsed.preambleValid,
      magicValid: parsed.magicValid,
      versionValid: parsed.versionValid,
      crcValid: parsed.crcValid,
    },
    bitAgreement,
    coverage,
    correctedBits: eccResult.corrected,
    rawBitErrors: eccResult.corrected,
    sync: {
      found: ecc && syncConfidence >= 0.20,
      confidence: syncConfidence,
      scale: transform.blockSize / BLOCK_SIZE,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
      rotationDeg: 0,
      perspectiveCorrected: false,
    },
    transform: {
      ...transform,
      phaseX,
      phaseY,
    },
    score,
  };
}

function bestPhaseForGrid(
  cells: GridCell[],
  transform: Omit<DetectionTransform, 'phaseX' | 'phaseY'>,
  options: DetectEngineOptions,
  ecc: boolean,
  tileBlocks: number,
): CandidateResult {
  let best: CandidateResult | null = null;

  for (let phaseY = 0; phaseY < tileBlocks; phaseY++) {
    for (let phaseX = 0; phaseX < tileBlocks; phaseX++) {
      const current = evaluatePhase(cells, phaseX, phaseY, transform, options, ecc, tileBlocks);
      if (!best || current.score > best.score) best = current;
      if (current.found && current.confidence >= 0.92) return current;
    }
  }

  return best!;
}

export function detectFingerprintFromImageData(
  source: ImageData,
  options: DetectEngineOptions,
): DetectEngineResult {
  const robust = options.robust ?? false;
  const defaultSizes = robust ? [8, 7, 9, 6, 10] : [8];
  const blockSizes = (options.blockSizes?.length ? options.blockSizes : defaultSizes)
    .map((v) => Math.max(4, Math.min(16, Math.round(v))))
    .filter((v, i, arr) => arr.indexOf(v) === i);

  let best: CandidateResult | null = null;
  let candidatesTested = 0;

  const layouts = [{ ecc: true, tileBlocks: TILE_BLOCKS }, { ecc: false, tileBlocks: LEGACY_TILE_BLOCKS }];
  for (const { ecc, tileBlocks } of layouts) for (const blockSize of blockSizes) {
    const offsets = makeOffsetCandidates(blockSize, robust, options.offsetStep);
    for (const offsetY of offsets) {
      for (const offsetX of offsets) {
        if (source.width - offsetX < blockSize * 4 || source.height - offsetY < blockSize * 4) {
          continue;
        }

        const cells = buildGrid(source, blockSize, offsetX, offsetY);
        if (cells.length < (ecc ? FRAME_BITS * 3 : FRAME_BITS)) continue;

        const current = bestPhaseForGrid(
          cells,
          { blockSize, offsetX, offsetY },
          options,
          ecc,
          tileBlocks,
        );
        candidatesTested++;

        if (!best || current.score > best.score) best = current;

        // Exact-size original/crop usually reaches this threshold quickly.
        if (current.found && current.confidence >= 0.92) {
          return { ...current, candidatesTested };
        }
      }
    }
  }

  if (!best) {
    return {
      found: false,
      fingerprint: null,
      confidence: 0,
      blocksRead: 0,
      repetitionsPerBit: 0,
      frame: { version: null, preambleValid: false, magicValid: false, versionValid: false, crcValid: false },
      bitAgreement: 0,
      coverage: 0,
      correctedBits: 0,
      rawBitErrors: 0,
      sync: { found: false, confidence: 0, scale: 1, offsetX: 0, offsetY: 0, rotationDeg: 0, perspectiveCorrected: false },
      candidatesTested,
      transform: null,
    };
  }

  return { ...best, candidatesTested };
}


export function detectFingerprintAtTransformFromImageData(
  source: ImageData,
  transform: DetectionTransform,
  options: Pick<DetectEngineOptions, 'density' | 'minMargin' | 'placementSeed' | 'pilotSeed'>,
): DetectEngineResult {
  const cells = buildGrid(source, transform.blockSize, transform.offsetX, transform.offsetY);
  if (cells.length < FRAME_BITS) {
    return {
      found: false,
      fingerprint: null,
      confidence: 0,
      blocksRead: cells.length,
      repetitionsPerBit: cells.length / FRAME_BITS,
      frame: { version: null, preambleValid: false, magicValid: false, versionValid: false, crcValid: false },
      bitAgreement: 0,
      coverage: 0,
      correctedBits: 0,
      rawBitErrors: 0,
      sync: {
        found: false,
        confidence: 0,
        scale: transform.blockSize / BLOCK_SIZE,
        offsetX: transform.offsetX,
        offsetY: transform.offsetY,
        rotationDeg: 0,
        perspectiveCorrected: false,
      },
      candidatesTested: 1,
      transform,
    };
  }

  const evaluated = evaluatePhase(
    cells,
    transform.phaseX,
    transform.phaseY,
    { blockSize: transform.blockSize, offsetX: transform.offsetX, offsetY: transform.offsetY },
    { density: options.density, minMargin: options.minMargin, placementSeed: options.placementSeed, pilotSeed: options.pilotSeed },
    true,
    TILE_BLOCKS,
  );
  return { ...evaluated, candidatesTested: 1 };
}

export interface RevealEngineOptions {
  transform?: DetectionTransform | null;
  boost?: number;
}

/**
 * Produce a human-visible diagnostic map of the hidden DCT signal.
 * This is a decoder visualization, not a visible watermark stored in the source image.
 */
export function revealWatermarkFromImageData(
  source: ImageData,
  options: RevealEngineOptions = {},
): ImageData {
  const transform = options.transform ?? {
    blockSize: 8,
    offsetX: 0,
    offsetY: 0,
    phaseX: 0,
    phaseY: 0,
  };
  const boost = Math.max(1, options.boost ?? 6);
  const out = new Uint8ClampedArray(source.width * source.height * 4);

  // Dim grayscale background.
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4;
      const l = luminance(source.data[i], source.data[i + 1], source.data[i + 2]);
      const base = clampByte(l * 0.18);
      out[i] = base;
      out[i + 1] = base;
      out[i + 2] = base;
      out[i + 3] = 255;
    }
  }

  const bs = transform.blockSize;
  const blocksX = Math.floor((source.width - transform.offsetX) / bs);
  const blocksY = Math.floor((source.height - transform.offsetY) / bs);

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const ox = transform.offsetX + bx * bs;
      const oy = transform.offsetY + by * bs;
      const { bit, margin } = readSampledBit(source, ox, oy, bs);
      const intensity = clampByte(Math.min(255, 48 + margin * boost));
      const value = bit ? intensity : 255 - intensity;

      for (let py = Math.floor(oy); py < Math.min(source.height, Math.ceil(oy + bs)); py++) {
        for (let px = Math.floor(ox); px < Math.min(source.width, Math.ceil(ox + bs)); px++) {
          const i = (py * source.width + px) * 4;
          out[i] = value;
          out[i + 1] = value;
          out[i + 2] = value;
          out[i + 3] = 255;
        }
      }
    }
  }

  return new ImageData(out, source.width, source.height);
}
