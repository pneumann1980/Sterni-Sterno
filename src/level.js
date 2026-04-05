/**
 * level.js
 * Level/arena definitions for Seestern Fighters v0.8.
 * Map expanded to match WORLD_SIZE 55 — obstacles spread wider,
 * extra spawn positions added for multi-AI mode (up to 5 characters).
 *
 * Pickup entries:
 *   { pos, weapon: 'weaponKey' }   — weapon pickup
 *   { pos, ability: 'abilityKey' } — ability pickup
 */

const level1 = {
  id:          'arena1',
  name:        'Offene Arena',
  floorColor:  0xb8994a,
  fogColor:    0x003366,
  fogDensity:  0.010,   // lower density for bigger map
  ambientColor: 0x224488,
  sunColor:    0x6699cc,
  obstacles: [
    { type: 'rock',   pos: [ -7, 0,  -8], scale: [1.0, 1.4, 0.9], radius: 1.1 },
    { type: 'coral',  pos: [  8, 0,   7], scale: [0.8, 1.1, 1.0], radius: 0.9 },
    { type: 'rock',   pos: [-12, 0,   5], scale: [1.2, 0.8, 1.1], radius: 1.0 },
    { type: 'coral',  pos: [ 13, 0,  -5], scale: [0.7, 1.5, 0.8], radius: 0.8 },
    { type: 'rock',   pos: [  0, 0, -13], scale: [1.0, 1.0, 1.3], radius: 1.0 },
    { type: 'barrel', pos: [ -4, 0,  13], scale: [0.9, 1.2, 0.9], radius: 0.8 },
    { type: 'rock',   pos: [ 10, 0, -11], scale: [1.1, 0.9, 1.0], radius: 0.9 },
    { type: 'rock',   pos: [-10, 0,  11], scale: [0.8, 1.3, 0.8], radius: 0.9 },
    { type: 'rock',   pos: [  5, 0,   0], scale: [1.0, 0.8, 1.0], radius: 0.9 },
    { type: 'coral',  pos: [ -5, 0,   0], scale: [0.7, 1.1, 0.7], radius: 0.7 },
  ],
  decorations: [],
  pickups: [
    { pos: [  0,  0,   0], weapon:  'blasenkanone'  },
    { pos: [ -5,  0,   5], weapon:  'muschelShooter' },
    { pos: [  5,  0,  -5], ability: 'stachelAura'    },
    { pos: [ 10,  0,  10], ability: 'novaBlast'      },
    { pos: [-10,  0, -10], ability: 'einbuddeln'     },
    { pos: [  0,  0,  10], weapon:  'muschelShooter' },
    { pos: [  0,  0, -10], weapon:  'blasenkanone'   },
    { pos: [ 12,  0,   0], ability: 'novaBlast'      },
    { pos: [-12,  0,   0], ability: 'stachelAura'    },
  ],
  // 5 spawn positions: player1 + up to 4 AI
  spawnPositions: [
    [-12,  0,   0],  // player 1
    [ 12,  0,   0],  // AI 1
    [  0,  0, -12],  // AI 2
    [  0,  0,  12],  // AI 3
    [ -9,  0,  -9],  // AI 4
  ],
};

const level2 = {
  id:          'arena2',
  name:        'Felsenenge',
  floorColor:  0x6b5a38,
  fogColor:    0x001a33,
  fogDensity:  0.012,
  ambientColor: 0x112244,
  sunColor:    0x4466aa,
  obstacles: [
    { type: 'pillar', pos: [ -7, 0,   0], scale: [0.8, 2.5, 0.8], radius: 0.9 },
    { type: 'pillar', pos: [  7, 0,   0], scale: [0.8, 2.5, 0.8], radius: 0.9 },
    { type: 'rock',   pos: [ -4, 0,  -7], scale: [1.3, 1.0, 1.2], radius: 1.2 },
    { type: 'rock',   pos: [  4, 0,   7], scale: [1.3, 1.0, 1.2], radius: 1.2 },
    { type: 'pillar', pos: [-12, 0,  -4], scale: [0.6, 3.0, 0.6], radius: 0.7 },
    { type: 'pillar', pos: [ 12, 0,   4], scale: [0.6, 3.0, 0.6], radius: 0.7 },
    { type: 'rock',   pos: [  0, 0, -10], scale: [1.5, 1.2, 1.0], radius: 1.3 },
    { type: 'rock',   pos: [  0, 0,  10], scale: [1.5, 1.2, 1.0], radius: 1.3 },
    { type: 'pillar', pos: [ -9, 0,   9], scale: [0.7, 2.0, 0.7], radius: 0.8 },
    { type: 'pillar', pos: [  9, 0,  -9], scale: [0.7, 2.0, 0.7], radius: 0.8 },
    { type: 'rock',   pos: [-12, 0,   8], scale: [1.0, 0.9, 1.0], radius: 0.9 },
    { type: 'rock',   pos: [ 12, 0,  -8], scale: [1.0, 0.9, 1.0], radius: 0.9 },
  ],
  decorations: [],
  pickups: [
    { pos: [  0,  0,   0], weapon:  'blasenkanone'  },
    { pos: [-10,  0,   0], weapon:  'muschelShooter' },
    { pos: [ 10,  0,   0], ability: 'stachelAura'    },
    { pos: [  0,  0,  -6], weapon:  'muschelShooter' },
    { pos: [ -6,  0,   8], ability: 'novaBlast'      },
    { pos: [  6,  0,  -8], ability: 'einbuddeln'     },
    { pos: [  8,  0,   8], weapon:  'blasenkanone'   },
    { pos: [ -8,  0,  -8], ability: 'novaBlast'      },
  ],
  spawnPositions: [
    [-14,  0,   0],
    [ 14,  0,   0],
    [  0,  0, -14],
    [  0,  0,  14],
    [-10,  0,  10],
  ],
};

const level3 = {
  id:          'arena3',
  name:        'Korallenwald',
  floorColor:  0x8a7a50,
  fogColor:    0x004455,
  fogDensity:  0.011,
  ambientColor: 0x225566,
  sunColor:    0x55aaaa,
  obstacles: [
    { type: 'coral', pos: [ -6, 0,  -6], scale: [0.9, 1.6, 0.9], radius: 0.9 },
    { type: 'coral', pos: [  6, 0,   6], scale: [0.9, 1.6, 0.9], radius: 0.9 },
    { type: 'coral', pos: [ -9, 0,   4], scale: [1.1, 1.2, 1.0], radius: 1.0 },
    { type: 'coral', pos: [  9, 0,  -4], scale: [1.1, 1.2, 1.0], radius: 1.0 },
    { type: 'rock',  pos: [  0, 0, -12], scale: [1.2, 1.0, 1.2], radius: 1.1 },
    { type: 'rock',  pos: [  0, 0,  12], scale: [1.2, 1.0, 1.2], radius: 1.1 },
    { type: 'coral', pos: [-13, 0,  -7], scale: [0.7, 2.0, 0.7], radius: 0.8 },
    { type: 'coral', pos: [ 13, 0,   7], scale: [0.7, 2.0, 0.7], radius: 0.8 },
    { type: 'rock',  pos: [  7, 0, -11], scale: [1.0, 0.8, 1.0], radius: 0.9 },
    { type: 'rock',  pos: [ -7, 0,  11], scale: [1.0, 0.8, 1.0], radius: 0.9 },
  ],
  decorations: [],
  pickups: [
    { pos: [  0,  0,   0], weapon:  'blasenkanone'  },
    { pos: [ -4,  0,   8], weapon:  'muschelShooter' },
    { pos: [  4,  0,  -8], ability: 'stachelAura'    },
    { pos: [ -7,  0, -10], weapon:  'muschelShooter' },
    { pos: [  8,  0,  10], ability: 'novaBlast'      },
    { pos: [-10,  0,   7], ability: 'einbuddeln'     },
    { pos: [ 11,  0,  -5], weapon:  'blasenkanone'   },
    { pos: [  0,  0,  -7], ability: 'novaBlast'      },
  ],
  spawnPositions: [
    [-12,  0,   0],
    [ 12,  0,   0],
    [  0,  0, -12],
    [  0,  0,  12],
    [ 10,  0,  10],
  ],
};

export const LEVELS = [level1, level2, level3];
