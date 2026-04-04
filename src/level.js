/**
 * level.js
 * Level/arena definitions for Seestern Fighters.
 * Each level is a plain data object describing environment, obstacles,
 * decorations, pickups, and spawn positions.
 *
 * Pickup entries:
 *   { pos, weapon: 'weaponKey' }   — drops a weapon pickup
 *   { pos, ability: 'abilityKey' } — drops an ability pickup
 */

const level1 = {
  id:          'arena1',
  name:        'Offene Arena',
  floorColor:  0xb8994a,
  fogColor:    0x003366,
  fogDensity:  0.014,
  ambientColor: 0x224488,
  sunColor:    0x6699cc,
  obstacles: [
    { type: 'rock',   pos: [-5,  0, -6], scale: [1.0, 1.4, 0.9], radius: 1.1 },
    { type: 'coral',  pos: [ 6,  0,  5], scale: [0.8, 1.1, 1.0], radius: 0.9 },
    { type: 'rock',   pos: [-8,  0,  4], scale: [1.2, 0.8, 1.1], radius: 1.0 },
    { type: 'coral',  pos: [ 9,  0, -4], scale: [0.7, 1.5, 0.8], radius: 0.8 },
    { type: 'rock',   pos: [ 0,  0, -9], scale: [1.0, 1.0, 1.3], radius: 1.0 },
    { type: 'barrel', pos: [-3,  0,  9], scale: [0.9, 1.2, 0.9], radius: 0.8 },
    { type: 'rock',   pos: [ 7,  0, -8], scale: [1.1, 0.9, 1.0], radius: 0.9 },
    { type: 'rock',   pos: [-7,  0,  8], scale: [0.8, 1.3, 0.8], radius: 0.9 },
  ],
  decorations: [
    { type: 'kelp',    pos: [-13, 0, -10] },
    { type: 'kelp',    pos: [ 13, 0,  10] },
    { type: 'kelp',    pos: [-10, 0,  13] },
    { type: 'kelp',    pos: [ 10, 0, -13] },
    { type: 'pebble',  pos: [ -2, 0,   3] },
    { type: 'pebble',  pos: [  4, 0,  -2] },
    { type: 'seagrass',pos: [-14, 0,   5] },
    { type: 'seagrass',pos: [ 14, 0,  -5] },
  ],
  pickups: [
    { pos: [ 0, 0,  0], weapon:  'blasenkanone'  },
    { pos: [-4, 0,  4], weapon:  'muschelShooter' },
    { pos: [ 4, 0, -4], ability: 'stachelAura'    },
    { pos: [ 7, 0,  7], ability: 'novaBlast'      },
    { pos: [-7, 0, -7], ability: 'einbuddeln'     },
  ],
  spawnPositions: [[-8, 0, 0], [8, 0, 0]],
};

const level2 = {
  id:          'arena2',
  name:        'Felsenenge',
  floorColor:  0x6b5a38,
  fogColor:    0x001a33,
  fogDensity:  0.020,
  ambientColor: 0x112244,
  sunColor:    0x4466aa,
  obstacles: [
    { type: 'pillar', pos: [-5,  0,  0], scale: [0.8, 2.5, 0.8], radius: 0.9 },
    { type: 'pillar', pos: [ 5,  0,  0], scale: [0.8, 2.5, 0.8], radius: 0.9 },
    { type: 'rock',   pos: [-3,  0, -5], scale: [1.3, 1.0, 1.2], radius: 1.2 },
    { type: 'rock',   pos: [ 3,  0,  5], scale: [1.3, 1.0, 1.2], radius: 1.2 },
    { type: 'pillar', pos: [-8,  0, -3], scale: [0.6, 3.0, 0.6], radius: 0.7 },
    { type: 'pillar', pos: [ 8,  0,  3], scale: [0.6, 3.0, 0.6], radius: 0.7 },
    { type: 'rock',   pos: [ 0,  0, -7], scale: [1.5, 1.2, 1.0], radius: 1.3 },
    { type: 'rock',   pos: [ 0,  0,  7], scale: [1.5, 1.2, 1.0], radius: 1.3 },
    { type: 'pillar', pos: [-6,  0,  6], scale: [0.7, 2.0, 0.7], radius: 0.8 },
    { type: 'pillar', pos: [ 6,  0, -6], scale: [0.7, 2.0, 0.7], radius: 0.8 },
  ],
  decorations: [
    { type: 'kelp',    pos: [-15, 0,   0] },
    { type: 'kelp',    pos: [ 15, 0,   0] },
    { type: 'pebble',  pos: [  1, 0,   2] },
    { type: 'pebble',  pos: [ -2, 0,  -3] },
    { type: 'pebble',  pos: [  5, 0,   2] },
    { type: 'seagrass',pos: [-11, 0,  -8] },
    { type: 'seagrass',pos: [ 11, 0,   8] },
  ],
  pickups: [
    { pos: [ 0, 0,  0], weapon:  'blasenkanone'  },
    { pos: [-7, 0,  0], weapon:  'muschelShooter' },
    { pos: [ 7, 0,  0], ability: 'stachelAura'    },
    { pos: [ 0, 0, -4], weapon:  'muschelShooter' },
    { pos: [-4, 0,  6], ability: 'novaBlast'      },
    { pos: [ 4, 0, -6], ability: 'einbuddeln'     },
  ],
  spawnPositions: [[-10, 0, 0], [10, 0, 0]],
};

const level3 = {
  id:          'arena3',
  name:        'Korallenwald',
  floorColor:  0x8a7a50,
  fogColor:    0x004455,
  fogDensity:  0.016,
  ambientColor: 0x225566,
  sunColor:    0x55aaaa,
  obstacles: [
    { type: 'coral', pos: [-4,  0, -4], scale: [0.9, 1.6, 0.9], radius: 0.9 },
    { type: 'coral', pos: [ 4,  0,  4], scale: [0.9, 1.6, 0.9], radius: 0.9 },
    { type: 'coral', pos: [-6,  0,  3], scale: [1.1, 1.2, 1.0], radius: 1.0 },
    { type: 'coral', pos: [ 6,  0, -3], scale: [1.1, 1.2, 1.0], radius: 1.0 },
    { type: 'rock',  pos: [ 0,  0, -8], scale: [1.2, 1.0, 1.2], radius: 1.1 },
    { type: 'rock',  pos: [ 0,  0,  8], scale: [1.2, 1.0, 1.2], radius: 1.1 },
    { type: 'coral', pos: [-9,  0, -5], scale: [0.7, 2.0, 0.7], radius: 0.8 },
    { type: 'coral', pos: [ 9,  0,  5], scale: [0.7, 2.0, 0.7], radius: 0.8 },
  ],
  decorations: [
    { type: 'kelp',    pos: [-13, 0, -10] },
    { type: 'kelp',    pos: [ 13, 0,  10] },
    { type: 'kelp',    pos: [-10, 0,  13] },
    { type: 'kelp',    pos: [ 10, 0, -13] },
    { type: 'kelp',    pos: [ -8, 0,   0] },
    { type: 'kelp',    pos: [  8, 0,   0] },
    { type: 'kelp',    pos: [  0, 0,  10] },
    { type: 'kelp',    pos: [  0, 0, -10] },
    { type: 'seagrass',pos: [ -5, 0,   7] },
    { type: 'seagrass',pos: [  5, 0,  -7] },
    { type: 'pebble',  pos: [  2, 0,   2] },
    { type: 'pebble',  pos: [ -3, 0,  -1] },
  ],
  pickups: [
    { pos: [ 0, 0,  0], weapon:  'blasenkanone'  },
    { pos: [-3, 0,  6], weapon:  'muschelShooter' },
    { pos: [ 3, 0, -6], ability: 'stachelAura'    },
    { pos: [-5, 0, -7], weapon:  'muschelShooter' },
    { pos: [ 6, 0,  7], ability: 'novaBlast'      },
    { pos: [-7, 0,  5], ability: 'einbuddeln'     },
  ],
  spawnPositions: [[-8, 0, 0], [8, 0, 0]],
};

export const LEVELS = [level1, level2, level3];
