// Example inputs for the store screenshots, as saved in localStorage.
const seed = {
  prefs: { precision: 16, fmt: { 1: 'ftin', 2: 'sqft', 3: 'cuyd' }, haptics: true, disclaimerSeen: true },
  wall: { member: '2x6', spacing: 16, height: 109.125, topPlates: 2, bottomPlates: 1, stock: 192, closed: true, wastePct: 10, runs: [
    { id: 1, length: 288, openings: [{ id: 11, kind: 'window', width: 48, height: 60, sill: 30, offset: 40, header: '2x10' }, { id: 12, kind: 'window', width: 48, height: 60, sill: 30, offset: 190, header: '2x10' }] },
    { id: 2, length: 192, openings: [{ id: 21, kind: 'door', width: 38, height: 82.5, sill: 0, offset: 120, header: '2x10' }] },
    { id: 3, length: 288, openings: [{ id: 31, kind: 'window', width: 72, height: 48, sill: 42, offset: 108, header: '2x12' }] },
    { id: 4, length: 192, openings: [] } ] },
  grout: { width: 8, lengthIn: 480, outside: true, heightIn: 120, spacingIn: 32, corners: 0, ends: 2, cellsPerCorner: 1, openingsSf: 0, wastePct: 3, pumpYd3: 0, closed: true, lintel: 'grout', runs: [
    { id: 5, length: 192, openings: [{ id: 51, kind: 'door', width: 40, height: 88, sill: 0, offset: 24, header: '' }, { id: 52, kind: 'window', width: 48, height: 48, sill: 40, offset: 112, header: '' }] },
    { id: 6, length: 160, openings: [{ id: 61, kind: 'window', width: 72, height: 48, sill: 40, offset: 48, header: '' }] },
    { id: 7, length: 192, openings: [] }, { id: 8, length: 160, openings: [] } ] },
  concrete: { wastePct: 5, pumpYd3: 0.5, selected: 0, pieces: [
    { id: 1, kind: 'slab', a: 240, b: 192, c: 6, count: 1 }, { id: 4, kind: 'round', a: 18, b: 96, c: 0, count: 4 },
    { id: 2, kind: 'column', a: 16, b: 16, c: 96, count: 2 }, { id: 3, kind: 'footing', a: 96, b: 24, c: 12, count: 2 } ] },
};
module.exports = seed;
