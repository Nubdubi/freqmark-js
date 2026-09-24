const { getPilotPattern, pilotActive, pilotBit, pilotConfidence } = await import('../dist/sync/pilot.js');

const sequence = Array.from({ length: 64 }, (_, i) => pilotBit(i % 8, Math.floor(i / 8), 'sync-test'));
const again = Array.from({ length: 64 }, (_, i) => pilotBit(i % 8, Math.floor(i / 8), 'sync-test'));
const other = Array.from({ length: 64 }, (_, i) => pilotBit(i % 8, Math.floor(i / 8), 'other-seed'));
if (!sequence.every((bit, i) => bit === again[i])) process.exit(1);
if (sequence.every((bit, i) => bit === other[i])) process.exit(1);
if (pilotConfidence(64, 64) !== 1 || pilotConfidence(32, 64) !== 0) process.exit(1);
const pattern = getPilotPattern('sync-test');
const activeCount = pattern.active.reduce((sum, value) => sum + value, 0);
if (activeCount < 180 || activeCount > 330 || pilotActive(3, 4, 'sync-test') !== Boolean(pattern.active[4 * 32 + 3])) process.exit(1);
if (!(() => { try { getPilotPattern('x'.repeat(257)); return false; } catch { return true; } })()) process.exit(1);
console.log('freqmark-js sync pilot test passed');
