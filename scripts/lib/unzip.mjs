// Minimal, dependency-free ZIP reader. An .xlsx is a ZIP of XML parts, and
// pulling in a package for a build-time script isn't worth the supply-chain
// surface. Handles stored (0) and deflated (8) entries, which is all Excel emits.

import { inflateRawSync } from 'node:zlib';

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

/**
 * @param {Buffer} buf
 * @returns {Map<string, Buffer>} entry name -> uncompressed bytes
 */
export function unzip(buf) {
  const eocd = findEOCD(buf);
  const entryCount = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // central directory offset

  const out = new Map();

  for (let n = 0; n < entryCount; n++) {
    if (buf.readUInt32LE(p) !== CEN_SIG) {
      throw new Error(`corrupt zip: bad central directory signature at ${p}`);
    }
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    if (buf.readUInt32LE(localOffset) !== LOC_SIG) {
      throw new Error(`corrupt zip: bad local header for ${name}`);
    }
    const locNameLen = buf.readUInt16LE(localOffset + 26);
    const locExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + locNameLen + locExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compressedSize);

    if (!name.endsWith('/')) {
      if (method === 0) out.set(name, Buffer.from(raw));
      else if (method === 8) out.set(name, inflateRawSync(raw));
      else throw new Error(`unsupported zip compression method ${method} for ${name}`);
    }

    p += 46 + nameLen + extraLen + commentLen;
  }

  return out;
}

function findEOCD(buf) {
  // EOCD is at the end, but may be followed by a variable-length comment.
  const min = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new Error('not a zip file: end-of-central-directory record not found');
}
