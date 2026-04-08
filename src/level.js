/**
 * level.js
 * Level/arena definitions for Seestern Fighters v0.11.
 * 8 levels total — 3 original + 5 new themed arenas.
 * WORLD_SIZE = 55, WORLD_HALF = 27.
 *
 * Obstacle types: rock, coral, coral_low (jumpable), barrel, pillar,
 *                 ship_hull (walkable ship walls), ruin_wall
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


// ── Level 4: Piratenschiff ─────────────────────────────────────────────────────
// A sunken pirate ship dominates the center — players can walk through the open
// sides into the interior. Barrels and mast provide cover inside.
// Ship orientation: N-S walls block entry from north/south; W-E sides are open.
const level4 = {
  id:           'arena4',
  name:         'Piratenschiff',
  floorColor:   0x9a7840,   // sandy sea-bed
  fogColor:     0x002a55,
  fogDensity:   0.009,
  ambientColor: 0x224466,
  sunColor:     0x6699cc,

  obstacles: [
    // ── Ship hull — North wall (3 planks, blocks entry from north) ──
    { type: 'ship_hull', pos: [-4.5, 0, -5.5], scale: [1,1,1], radius: 1.1 },
    { type: 'ship_hull', pos: [ 0.0, 0, -5.5], scale: [1,1,1], radius: 1.1 },
    { type: 'ship_hull', pos: [ 4.5, 0, -5.5], scale: [1,1,1], radius: 1.1 },
    // ── Ship hull — South wall ──
    { type: 'ship_hull', pos: [-4.5, 0,  5.5], scale: [1,1,1], radius: 1.1 },
    { type: 'ship_hull', pos: [ 0.0, 0,  5.5], scale: [1,1,1], radius: 1.1 },
    { type: 'ship_hull', pos: [ 4.5, 0,  5.5], scale: [1,1,1], radius: 1.1 },
    // ── Ship hull — West side (two segments with gap in centre = entry) ──
    { type: 'ship_hull', pos: [-6.2, 0, -3.2], scale: [1,1,1], radius: 1.0, rotY: Math.PI/2 },
    { type: 'ship_hull', pos: [-6.2, 0,  3.2], scale: [1,1,1], radius: 1.0, rotY: Math.PI/2 },
    // ── Ship hull — East side ──
    { type: 'ship_hull', pos: [ 6.2, 0, -3.2], scale: [1,1,1], radius: 1.0, rotY: Math.PI/2 },
    { type: 'ship_hull', pos: [ 6.2, 0,  3.2], scale: [1,1,1], radius: 1.0, rotY: Math.PI/2 },
    // ── Interior: mast (central pillar) and barrels ──
    { type: 'pillar', pos: [ 0, 0,  0],  scale: [0.6, 3.5, 0.6], radius: 0.6 },
    { type: 'barrel', pos: [ 2, 0,  2],  scale: [1, 1.1, 1],     radius: 0.7 },
    { type: 'barrel', pos: [-2, 0, -2],  scale: [1, 1.1, 1],     radius: 0.7 },
    { type: 'barrel', pos: [ 2, 0, -2],  scale: [1, 1.1, 1],     radius: 0.7 },
    // ── Exterior rocks / cannon debris ──
    { type: 'rock',   pos: [-12, 0, -9], scale: [1.2, 1.0, 1.1], radius: 1.1 },
    { type: 'rock',   pos: [ 12, 0,  9], scale: [1.1, 0.9, 1.2], radius: 1.0 },
    { type: 'rock',   pos: [ 14, 0, -7], scale: [1.0, 1.0, 1.0], radius: 0.9 },
    { type: 'rock',   pos: [-14, 0,  7], scale: [1.3, 1.1, 1.0], radius: 1.2 },
    { type: 'barrel', pos: [ 10, 0,  0], scale: [1.1, 1.0, 1.1], radius: 0.8 },
    { type: 'barrel', pos: [-10, 0,  0], scale: [1.1, 1.0, 1.1], radius: 0.8 },
    { type: 'rock',   pos: [  0, 0, -14],scale: [1.0, 0.8, 1.0], radius: 0.9 },
    { type: 'rock',   pos: [  0, 0,  14],scale: [1.0, 0.8, 1.0], radius: 0.9 },
  ],
  decorations: [],
  pickups: [
    // Inside the ship
    { pos: [-3,  0,  0],  weapon:  'muschelShooter' },
    { pos: [ 3,  0,  0],  weapon:  'blasenkanone'   },
    { pos: [ 0,  0,  3],  ability: 'einbuddeln'     },
    { pos: [ 0,  0, -3],  ability: 'novaBlast'      },
    // Outside
    { pos: [-11, 0, -4],  weapon:  'muschelShooter' },
    { pos: [ 11, 0,  4],  weapon:  'blasenkanone'   },
    { pos: [ -8, 0,  9],  ability: 'stachelAura'    },
    { pos: [  8, 0, -9],  ability: 'novaBlast'      },
    { pos: [  0, 0, -10], weapon:  'muschelShooter' },
    { pos: [  0, 0,  10], ability: 'stachelAura'    },
  ],
  spawnPositions: [
    [-14,  0,   0],   // player 1 — far west
    [ 14,  0,   0],   // AI 1     — far east
    [  0,  0, -14],   // AI 2     — far north
    [  0,  0,  14],   // AI 3     — far south
    [-10,  0, -10],   // AI 4     — NW corner
  ],
};

// ── Level 5: Korallenriff ──────────────────────────────────────────────────────
// Dense reef with low coral_low formations — they block shots but players can
// jump over them to dodge and chase. Bright, colourful underwater feel.
const level5 = {
  id:           'arena5',
  name:         'Korallenriff',
  floorColor:   0xd4b878,   // bright sandy white
  fogColor:     0x004466,
  fogDensity:   0.009,
  ambientColor: 0x226688,
  sunColor:     0x66ccbb,

  obstacles: [
    // ── Central coral clusters (jumpable — only block shots on the ground) ──
    { type: 'coral_low', pos: [ -3, 0,  0],  scale: [1.2, 1.0, 1.1], radius: 0.9 },
    { type: 'coral_low', pos: [  3, 0,  0],  scale: [1.1, 1.0, 1.2], radius: 0.9 },
    { type: 'coral_low', pos: [  0, 0, -3],  scale: [1.0, 1.2, 1.0], radius: 0.9 },
    { type: 'coral_low', pos: [  0, 0,  3],  scale: [1.2, 0.9, 1.1], radius: 0.9 },
    // ── Mid-ring jumpable coral cover ──
    { type: 'coral_low', pos: [ -7, 0, -6],  scale: [1.0, 1.1, 1.0], radius: 0.8 },
    { type: 'coral_low', pos: [  7, 0, -6],  scale: [1.1, 0.9, 1.0], radius: 0.8 },
    { type: 'coral_low', pos: [ -7, 0,  6],  scale: [1.0, 1.0, 1.1], radius: 0.8 },
    { type: 'coral_low', pos: [  7, 0,  6],  scale: [1.1, 1.0, 1.0], radius: 0.8 },
    { type: 'coral_low', pos: [ -5, 0,  9],  scale: [0.9, 1.0, 0.9], radius: 0.7 },
    { type: 'coral_low', pos: [  5, 0,  9],  scale: [1.0, 1.1, 0.9], radius: 0.7 },
    { type: 'coral_low', pos: [ -5, 0, -9],  scale: [0.9, 0.9, 1.0], radius: 0.7 },
    { type: 'coral_low', pos: [  5, 0, -9],  scale: [1.0, 1.0, 1.1], radius: 0.7 },
    // ── Tall solid coral (impassable — tall cover) ──
    { type: 'coral', pos: [-11, 0, -2],  scale: [1.0, 1.8, 1.0], radius: 1.0 },
    { type: 'coral', pos: [ 11, 0, -2],  scale: [1.0, 1.8, 1.0], radius: 1.0 },
    { type: 'coral', pos: [-11, 0,  2],  scale: [1.0, 1.8, 1.0], radius: 1.0 },
    { type: 'coral', pos: [ 11, 0,  2],  scale: [1.0, 1.8, 1.0], radius: 1.0 },
    { type: 'rock',  pos: [  0, 0,  14], scale: [1.3, 1.0, 1.2], radius: 1.2 },
    { type: 'rock',  pos: [  0, 0, -14], scale: [1.3, 1.0, 1.2], radius: 1.2 },
  ],
  decorations: [],
  pickups: [
    { pos: [  0, 0,   0], weapon:  'blasenkanone'  },
    { pos: [-8,  0,   0], weapon:  'muschelShooter' },
    { pos: [  8, 0,   0], weapon:  'muschelShooter' },
    { pos: [  0, 0,  -8], ability: 'novaBlast'      },
    { pos: [  0, 0,   8], ability: 'stachelAura'    },
    { pos: [ -4, 0,  -5], ability: 'einbuddeln'     },
    { pos: [  4, 0,   5], weapon:  'blasenkanone'   },
    { pos: [-10, 0,  10], ability: 'novaBlast'      },
    { pos: [ 10, 0, -10], ability: 'stachelAura'    },
  ],
  spawnPositions: [
    [-13,  0,   0],
    [ 13,  0,   0],
    [  0,  0, -13],
    [  0,  0,  13],
    [-10,  0, -10],
  ],
};

// ── Level 6: Versunkene Stadt ──────────────────────────────────────────────────
// Ancient ruins on the ocean floor — crumbling pillars and ruin walls create
// tight corridors. Eerie atmosphere with deep blue-green lighting.
const level6 = {
  id:           'arena6',
  name:         'Versunkene Stadt',
  floorColor:   0x5a5040,   // dark mossy stone
  fogColor:     0x001a33,
  fogDensity:   0.011,
  ambientColor: 0x1a3355,
  sunColor:     0x4488cc,

  obstacles: [
    // ── Central temple archway (two columns) ──
    { type: 'pillar', pos: [-2.5, 0,  0],  scale: [0.7, 4.0, 0.7], radius: 0.8 },
    { type: 'pillar', pos: [ 2.5, 0,  0],  scale: [0.7, 4.0, 0.7], radius: 0.8 },
    // ── Ruin wall fragments ──
    { type: 'ruin_wall', pos: [ -8, 0, -5],  scale: [1,1,1], radius: 1.1, rotY: 0.4        },
    { type: 'ruin_wall', pos: [  8, 0,  5],  scale: [1,1,1], radius: 1.1, rotY: -0.4       },
    { type: 'ruin_wall', pos: [ -8, 0,  5],  scale: [1,1,1], radius: 1.1, rotY: -0.3       },
    { type: 'ruin_wall', pos: [  8, 0, -5],  scale: [1,1,1], radius: 1.1, rotY: 0.3        },
    { type: 'ruin_wall', pos: [  0, 0, -9],  scale: [1,1.2,1], radius: 1.2, rotY: Math.PI/2 },
    { type: 'ruin_wall', pos: [  0, 0,  9],  scale: [1,1.2,1], radius: 1.2, rotY: Math.PI/2 },
    // ── Fallen pillars and rubble ──
    { type: 'pillar', pos: [-12, 0, -8],  scale: [0.8, 1.8, 0.8], radius: 0.9 },
    { type: 'pillar', pos: [ 12, 0,  8],  scale: [0.8, 1.8, 0.8], radius: 0.9 },
    { type: 'pillar', pos: [-12, 0,  8],  scale: [0.6, 2.5, 0.6], radius: 0.7 },
    { type: 'pillar', pos: [ 12, 0, -8],  scale: [0.6, 2.5, 0.6], radius: 0.7 },
    { type: 'rock',   pos: [ -5, 0, -11], scale: [1.2, 0.8, 1.3], radius: 1.1 },
    { type: 'rock',   pos: [  5, 0,  11], scale: [1.2, 0.8, 1.3], radius: 1.1 },
    { type: 'rock',   pos: [ 13, 0,  -1], scale: [1.0, 0.7, 1.0], radius: 0.9 },
    { type: 'rock',   pos: [-13, 0,   1], scale: [1.0, 0.7, 1.0], radius: 0.9 },
  ],
  decorations: [],
  pickups: [
    { pos: [  0, 0,   0], weapon:  'blasenkanone'  },
    { pos: [ -6, 0,   7], weapon:  'muschelShooter' },
    { pos: [  6, 0,  -7], weapon:  'muschelShooter' },
    { pos: [-10, 0,   0], ability: 'stachelAura'    },
    { pos: [ 10, 0,   0], ability: 'novaBlast'      },
    { pos: [  0, 0,  -6], ability: 'einbuddeln'     },
    { pos: [  4, 0,  -3], weapon:  'blasenkanone'   },
    { pos: [ -4, 0,   3], ability: 'novaBlast'      },
    { pos: [  9, 0,   9], ability: 'stachelAura'    },
    { pos: [ -9, 0,  -9], weapon:  'muschelShooter' },
  ],
  spawnPositions: [
    [-15,  0,   0],
    [ 15,  0,   0],
    [  0,  0, -15],
    [  0,  0,  15],
    [-11,  0,  11],
  ],
};

// ── Level 7: Vulkansee ────────────────────────────────────────────────────────
// Active volcanic sea-floor — rocks arranged in a circular crater ring with a
// central lava vent. Hot spring barrels pulse as cover in the outer zone.
const level7 = {
  id:           'arena7',
  name:         'Vulkansee',
  floorColor:   0x5a3a1a,   // volcanic rock
  fogColor:     0x2a1200,
  fogDensity:   0.010,
  ambientColor: 0x553311,
  sunColor:     0xff7722,

  obstacles: [
    // ── Central lava vent (tall pillar) ──
    { type: 'pillar', pos: [0, 0, 0],   scale: [0.9, 4.5, 0.9], radius: 1.0 },
    // ── Inner crater ring (6 large rocks) ──
    { type: 'rock', pos: [ 5.0, 0,   0],  scale: [1.3, 1.6, 1.2], radius: 1.2 },
    { type: 'rock', pos: [-5.0, 0,   0],  scale: [1.3, 1.6, 1.2], radius: 1.2 },
    { type: 'rock', pos: [ 2.5, 0,  4.3], scale: [1.2, 1.5, 1.1], radius: 1.1 },
    { type: 'rock', pos: [-2.5, 0,  4.3], scale: [1.2, 1.5, 1.1], radius: 1.1 },
    { type: 'rock', pos: [ 2.5, 0, -4.3], scale: [1.2, 1.5, 1.1], radius: 1.1 },
    { type: 'rock', pos: [-2.5, 0, -4.3], scale: [1.2, 1.5, 1.1], radius: 1.1 },
    // ── Outer lava-field boulders ──
    { type: 'rock', pos: [ 11, 0,   0],   scale: [1.4, 1.0, 1.3], radius: 1.2 },
    { type: 'rock', pos: [-11, 0,   0],   scale: [1.4, 1.0, 1.3], radius: 1.2 },
    { type: 'rock', pos: [  0, 0,  11],   scale: [1.3, 1.1, 1.4], radius: 1.2 },
    { type: 'rock', pos: [  0, 0, -11],   scale: [1.3, 1.1, 1.4], radius: 1.2 },
    { type: 'rock', pos: [  8, 0,   8],   scale: [1.1, 0.9, 1.1], radius: 1.0 },
    { type: 'rock', pos: [ -8, 0,   8],   scale: [1.1, 0.9, 1.1], radius: 1.0 },
    { type: 'rock', pos: [  8, 0,  -8],   scale: [1.1, 0.9, 1.1], radius: 1.0 },
    { type: 'rock', pos: [ -8, 0,  -8],   scale: [1.1, 0.9, 1.1], radius: 1.0 },
    // ── Hot spring barrels ──
    { type: 'barrel', pos: [ 7, 0,  -2], scale: [1.1, 1.2, 1.1], radius: 0.8 },
    { type: 'barrel', pos: [-7, 0,   2], scale: [1.1, 1.2, 1.1], radius: 0.8 },
  ],
  decorations: [],
  pickups: [
    { pos: [  7, 0,   7], weapon:  'blasenkanone'  },
    { pos: [ -7, 0,  -7], weapon:  'muschelShooter' },
    { pos: [  7, 0,  -7], ability: 'stachelAura'    },
    { pos: [ -7, 0,   7], ability: 'novaBlast'      },
    { pos: [  0, 0,   7], weapon:  'muschelShooter' },
    { pos: [  0, 0,  -7], weapon:  'blasenkanone'   },
    { pos: [ 13, 0,   5], ability: 'einbuddeln'     },
    { pos: [-13, 0,  -5], ability: 'novaBlast'      },
    { pos: [  5, 0,  13], ability: 'stachelAura'    },
    { pos: [ -5, 0, -13], weapon:  'muschelShooter' },
  ],
  spawnPositions: [
    [-15,  0,   0],
    [ 15,  0,   0],
    [  0,  0, -15],
    [  0,  0,  15],
    [ 13,  0,  13],
  ],
};

// ── Level 8: Tiefsee-Graben ───────────────────────────────────────────────────
// The deepest ocean trench — near-zero visibility, narrow rock corridors.
// Coral patches provide fragile cover between cliff walls.
const level8 = {
  id:           'arena8',
  name:         'Tiefsee-Graben',
  floorColor:   0x1e2535,   // deep ocean floor
  fogColor:     0x001122,
  fogDensity:   0.013,
  ambientColor: 0x0a1f3a,
  sunColor:     0x2266cc,

  obstacles: [
    // ── Trench walls — two parallel rock corridors ──
    { type: 'rock', pos: [ -8, 0, -12], scale: [1.5, 2.0, 1.3], radius: 1.4 },
    { type: 'rock', pos: [ -8, 0,  -6], scale: [1.3, 1.8, 1.4], radius: 1.3 },
    { type: 'rock', pos: [ -8, 0,   0], scale: [1.4, 2.2, 1.3], radius: 1.3 },
    { type: 'rock', pos: [ -8, 0,   6], scale: [1.5, 1.9, 1.2], radius: 1.4 },
    { type: 'rock', pos: [ -8, 0,  12], scale: [1.3, 2.0, 1.4], radius: 1.3 },
    { type: 'rock', pos: [  8, 0, -12], scale: [1.5, 2.0, 1.3], radius: 1.4 },
    { type: 'rock', pos: [  8, 0,  -6], scale: [1.3, 1.8, 1.4], radius: 1.3 },
    { type: 'rock', pos: [  8, 0,   0], scale: [1.4, 2.2, 1.3], radius: 1.3 },
    { type: 'rock', pos: [  8, 0,   6], scale: [1.5, 1.9, 1.2], radius: 1.4 },
    { type: 'rock', pos: [  8, 0,  12], scale: [1.3, 2.0, 1.4], radius: 1.3 },
    // ── Mid-lane jumpable coral (staggered — players can leap over) ──
    { type: 'coral_low', pos: [ 0, 0,  -9], scale: [1.0, 1.0, 1.0], radius: 0.8 },
    { type: 'coral_low', pos: [ 0, 0,   0], scale: [1.1, 1.0, 1.0], radius: 0.9 },
    { type: 'coral_low', pos: [ 0, 0,   9], scale: [1.0, 1.0, 1.1], radius: 0.8 },
    { type: 'coral_low', pos: [-3, 0,  -4], scale: [0.9, 1.0, 0.9], radius: 0.7 },
    { type: 'coral_low', pos: [ 3, 0,   4], scale: [0.9, 1.0, 0.9], radius: 0.7 },
    // ── Deep trench pillars ──
    { type: 'pillar', pos: [-13, 0, -4], scale: [0.7, 5.0, 0.7], radius: 0.8 },
    { type: 'pillar', pos: [ 13, 0,  4], scale: [0.7, 5.0, 0.7], radius: 0.8 },
    { type: 'pillar', pos: [ -2, 0, 13], scale: [0.5, 3.5, 0.5], radius: 0.6 },
    { type: 'pillar', pos: [  2, 0,-13], scale: [0.5, 3.5, 0.5], radius: 0.6 },
  ],
  decorations: [],
  pickups: [
    { pos: [  3, 0,  -8], weapon:  'blasenkanone'  },
    { pos: [ -3, 0,   8], weapon:  'muschelShooter' },
    { pos: [  0, 0,   5], ability: 'einbuddeln'     },
    { pos: [  0, 0,  -5], ability: 'stachelAura'    },
    { pos: [ 12, 0, -10], weapon:  'muschelShooter' },
    { pos: [-12, 0,  10], weapon:  'blasenkanone'   },
    { pos: [ 12, 0,  10], ability: 'novaBlast'      },
    { pos: [-12, 0, -10], ability: 'novaBlast'      },
    { pos: [  4, 0,  13], ability: 'stachelAura'    },
    { pos: [ -4, 0, -13], weapon:  'muschelShooter' },
  ],
  spawnPositions: [
    [-14,  0,   0],
    [ 14,  0,   0],
    [  0,  0, -14],
    [  0,  0,  14],
    [-11,  0, -11],
  ],
};

export const LEVELS = [level1, level2, level3, level4, level5, level6, level7, level8];
