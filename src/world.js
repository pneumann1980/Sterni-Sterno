/**
 * world.js
 * Three.js scene, renderer, camera, and underwater environment.
 * Camera tracks the midpoint between the two active characters.
 * Environment colors are configurable from level definitions.
 */

import * as THREE from 'three';

export const WORLD_SIZE = 55; // full playable diameter (enlarged in v0.8)
export const WORLD_HALF = WORLD_SIZE / 2;

// Detect mobile for performance tuning
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);

const MAX_PARTICLES = IS_MOBILE ? 20 : 50;

export class World {
  constructor() {
    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._buildBaseEnvironment();
    this._addWaterParticles();
    window.addEventListener('resize', () => this._onResize());
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE });
    // On mobile: cap pixel ratio at 1.5 to save fill-rate
    this.renderer.setPixelRatio(IS_MOBILE
      ? Math.min(window.devicePixelRatio, 1.5)
      : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x003366);
    this.scene.fog = new THREE.FogExp2(0x003366, 0.014);
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      300
    );
    this.camera.position.set(0, 16, 12);
    this.camera.lookAt(0, 0, 0);
    this._camTarget = new THREE.Vector3();
  }

  // ── Base environment (persists across levels) ──────────────────────────────

  _buildBaseEnvironment() {
    this._addLights();
    this._addFloor();
    this._addBoundaryDarkening();
  }

  _addLights(ambientColor = 0x1a3a5c, sunColor = 0x88aabb) {
    // Remove old lights if re-adding
    if (this._ambientLight) this.scene.remove(this._ambientLight);
    if (this._sunLight)     this.scene.remove(this._sunLight);
    if (this._fillLight)    this.scene.remove(this._fillLight);

    // Stronger ambient with blue-teal underwater tone
    this._ambientLight = new THREE.AmbientLight(ambientColor, 0.9);
    this.scene.add(this._ambientLight);

    // Main sun — filtered surface light (slightly warm)
    this._sunLight = new THREE.DirectionalLight(sunColor, 1.3);
    this._sunLight.position.set(10, 28, 8);
    this._sunLight.castShadow = true;
    this._sunLight.shadow.mapSize.setScalar(IS_MOBILE ? 512 : 1024);
    this._sunLight.shadow.camera.near   = 1;
    this._sunLight.shadow.camera.far    = 70;
    this._sunLight.shadow.camera.left   = this._sunLight.shadow.camera.bottom = -35;
    this._sunLight.shadow.camera.right  = this._sunLight.shadow.camera.top    =  35;
    this.scene.add(this._sunLight);

    // Secondary fill light from below — simulates caustic bounce
    this._fillLight = new THREE.DirectionalLight(0x003355, 0.4);
    this._fillLight.position.set(-5, -8, -5);
    this.scene.add(this._fillLight);

    // Caustic shimmer point lights — animate in updateCamera()
    if (this._causticLights) {
      this._causticLights.forEach(l => this.scene.remove(l));
    }
    this._causticLights = [];
    const causticData = [
      { color: 0x0099ff, pos: [-7, 10, -5] },
      { color: 0x00ddcc, pos: [ 7, 10,  5] },
      { color: 0x0055ff, pos: [ 0,  8, -8] },
    ];
    causticData.forEach(({ color, pos }) => {
      const pt = new THREE.PointLight(color, 0.55, 45);
      pt.position.set(...pos);
      this.scene.add(pt);
      this._causticLights.push(pt);
    });

    // Coral glow — warm pink accent near bottom
    if (!this._coralGlow) {
      this._coralGlow = new THREE.PointLight(0xff4466, 0.3, 20);
      this._coralGlow.position.set(-4, 1, 9);
      this.scene.add(this._coralGlow);
    }
  }

  _addFloor(floorColor = 0xb8994a) {
    if (this._floor) this.scene.remove(this._floor);

    // Base sand layer with vertex color variation
    const floorGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 32, 32);
    const colors = [];
    const posArr = floorGeo.attributes.position.array;
    for (let i = 0; i < posArr.length / 3; i++) {
      const nx = posArr[i * 3]     / WORLD_SIZE + 0.5;
      const nz = posArr[i * 3 + 1] / WORLD_SIZE + 0.5; // plane is XY before rotation
      const noise = Math.sin(nx * 18) * Math.cos(nz * 12) * 0.06 +
                    Math.sin(nx * 7 + nz * 11) * 0.04;
      const r = 0.72 + noise;
      const g = 0.60 + noise * 0.8;
      const b = 0.28 + noise * 0.3;
      colors.push(r, g, b);
    }
    floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const floorMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this._floor = new THREE.Mesh(floorGeo, floorMat);
    this._floor.rotation.x = -Math.PI / 2;
    this._floor.receiveShadow = true;
    this.scene.add(this._floor);

    if (!this._outerFloor) {
      // Dark outer boundary — built once
      const outerMat = new THREE.MeshLambertMaterial({ color: 0x000d1a });
      this._outerFloor = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE * 5, WORLD_SIZE * 5), outerMat);
      this._outerFloor.rotation.x = -Math.PI / 2;
      this._outerFloor.position.y = -0.05;
      this.scene.add(this._outerFloor);
    }
  }

  _addBoundaryDarkening() {
    if (this._boundaryWall) return; // only build once
    const wallGeo = new THREE.BoxGeometry(WORLD_SIZE, 18, WORLD_SIZE);
    const wallMat = new THREE.MeshBasicMaterial({
      color:       0x001833,
      transparent: true,
      opacity:     0.28,
      side:        THREE.BackSide,
    });
    this._boundaryWall = new THREE.Mesh(wallGeo, wallMat);
    this._boundaryWall.position.y = 8;
    this.scene.add(this._boundaryWall);
  }

  // ── Water particles ────────────────────────────────────────────────────────

  _addWaterParticles() {
    this._particles = [];
    const geo = new THREE.SphereGeometry(0.04, 4, 4);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x44aaff,
        transparent: true,
        opacity: 0.3 + Math.random() * 0.3,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * WORLD_SIZE * 0.9,
        Math.random() * 8,
        (Math.random() - 0.5) * WORLD_SIZE * 0.9
      );
      this.scene.add(mesh);
      this._particles.push({
        mesh,
        speed: 0.3 + Math.random() * 0.7,
        drift: (Math.random() - 0.5) * 0.2,
      });
    }
  }

  _updateParticles(dt) {
    for (const p of this._particles) {
      p.mesh.position.y   += p.speed * dt;
      p.mesh.position.x   += p.drift * dt;
      if (p.mesh.position.y > 10) {
        // Reset to ground
        p.mesh.position.set(
          (Math.random() - 0.5) * WORLD_SIZE * 0.9,
          -0.5,
          (Math.random() - 0.5) * WORLD_SIZE * 0.9
        );
      }
    }
  }

  // ── Level loading ──────────────────────────────────────────────────────────

  /**
   * Apply level-specific colors and build obstacles/decorations.
   * @param {object} levelDef
   * @param {ObstacleSystem} obstacleSystem
   * @param {PickupManager} pickupManager
   * @param {object} WEAPONS_MAP
   */
  loadLevel(levelDef, obstacleSystem, pickupManager, WEAPONS_MAP) {
    this.unloadLevel(obstacleSystem, pickupManager);

    // Apply level colors
    this.scene.background.setHex(levelDef.fogColor);
    this.scene.fog.color.setHex(levelDef.fogColor);
    this.scene.fog.density = levelDef.fogDensity;

    this._addLights(levelDef.ambientColor, levelDef.sunColor);
    this._addFloor(levelDef.floorColor);

    // Build obstacles
    obstacleSystem.buildFromLevel(levelDef, this.scene);

    // Add decorations
    this._buildDecorations(levelDef.decorations || []);

    // Add level-specific environment FX
    this._loadLevelFx(levelDef.id);

    // Spawn pickups
    if (pickupManager && WEAPONS_MAP) {
      pickupManager.spawnFromLevel(levelDef, WEAPONS_MAP);
    }
  }

  unloadLevel(obstacleSystem, pickupManager) {
    if (obstacleSystem) obstacleSystem.clear(this.scene);
    if (pickupManager)  pickupManager.clear();
    this._clearDecorations();
    this._clearLevelFx();
  }

  _buildDecorations(decorations) {
    this._decorationMeshes = this._decorationMeshes || [];
    this._addRocksAndCorals();
    this._addKelpForest();
    this._addSeagrass();
    this._addPebbleField();
  }

  _addRocksAndCorals() {
    const rockConfigs = [
      { pos: [-5, 0, -6],  scale: [1.1, 1.5, 0.9], color: 0x445566 },
      { pos: [ 6, 0,  5],  scale: [0.8, 1.1, 1.0], color: 0x334455 },
      { pos: [-8, 0,  4],  scale: [1.4, 0.9, 1.2], color: 0x556677 },
      { pos: [ 9, 0, -4],  scale: [0.7, 1.6, 0.8], color: 0x445566 },
      { pos: [ 0, 0, -9],  scale: [1.2, 1.1, 1.4], color: 0x334455 },
      { pos: [-3, 0,  9],  scale: [1.0, 1.3, 0.9], color: 0x445566 },
      { pos: [ 7, 0, -8],  scale: [1.3, 0.8, 1.1], color: 0x556677 },
      { pos: [-7, 0,  8],  scale: [0.9, 1.4, 0.8], color: 0x334455 },
      { pos: [-11, 0, -3], scale: [0.7, 0.8, 0.7], color: 0x556677 },
      { pos: [ 11, 0,  3], scale: [0.9, 1.0, 0.8], color: 0x445566 },
    ];
    rockConfigs.forEach(({ pos, scale, color }) => {
      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.6, 1),
        new THREE.MeshLambertMaterial({ color })
      );
      mesh.position.set(...pos);
      mesh.scale.set(...scale);
      mesh.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
      mesh.castShadow = mesh.receiveShadow = true;
      this.scene.add(mesh);
      this._decorationMeshes.push(mesh);
    });

    // Coral clusters — bright, organic
    const coralColors = [0xff6688, 0xff4466, 0xff8844, 0xffaa44];
    const coralPositions = [
      [-4, 0, 7], [4, 0, -7], [-9, 0, 6], [9, 0, -6],
      [3, 0, -11], [-3, 0, 11], [11, 0, 7], [-11, 0, -7],
    ];
    coralPositions.forEach(([x, , z], i) => {
      const count = 2 + Math.floor(Math.random() * 3);
      for (let c = 0; c < count; c++) {
        const h = 0.6 + Math.random() * 0.9;
        const coral = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04 + Math.random() * 0.04, 0.06 + Math.random() * 0.06, h, 6),
          new THREE.MeshLambertMaterial({
            color: coralColors[i % coralColors.length],
            emissive: coralColors[i % coralColors.length],
            emissiveIntensity: 0.15,
          })
        );
        coral.position.set(x + (Math.random() - 0.5) * 0.6, h / 2, z + (Math.random() - 0.5) * 0.6);
        coral.rotation.z = (Math.random() - 0.5) * 0.4;
        this.scene.add(coral);
        this._decorationMeshes.push(coral);

        // Coral tip ball
        const tip = new THREE.Mesh(
          new THREE.SphereGeometry(0.07 + Math.random() * 0.05, 6, 5),
          new THREE.MeshLambertMaterial({
            color: 0xffffff,
            emissive: coralColors[i % coralColors.length],
            emissiveIntensity: 0.4,
          })
        );
        tip.position.copy(coral.position);
        tip.position.y += h / 2 + 0.05;
        this.scene.add(tip);
        this._decorationMeshes.push(tip);
      }
    });
  }

  _addKelpForest() {
    const kelpPositions = [
      [-13, 0, -10], [13, 0, 10], [-10, 0, 13], [10, 0, -13],
      [-15, 0,  0 ], [15, 0,  0], [ 0,  0, 15], [ 0,  0, -15],
      [-12, 0,  6 ], [12, 0, -6], [-6, 0, -12], [6, 0, 12],
      [-14, 0,  8 ], [14, 0, -8],
    ];
    const kelpColors = [0x1a6630, 0x228840, 0x2a9950, 0x1d7535];
    kelpPositions.forEach(([x, , z], i) => {
      const count = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < count; k++) {
        const h = 1.8 + Math.random() * 2.5;
        const kelp = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.09, h, 5),
          new THREE.MeshLambertMaterial({ color: kelpColors[i % kelpColors.length] })
        );
        kelp.position.set(x + (Math.random() - 0.5) * 0.8, h / 2, z + (Math.random() - 0.5) * 0.8);
        kelp.rotation.z = (Math.random() - 0.5) * 0.35;
        kelp.rotation.x = (Math.random() - 0.5) * 0.2;
        this.scene.add(kelp);
        this._decorationMeshes.push(kelp);
      }
    });
  }

  _addSeagrass() {
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a8845, side: THREE.DoubleSide });
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r     = 3 + Math.random() * 14;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const h = 0.3 + Math.random() * 0.5;
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.06, h), mat);
        blade.position.set(x + (Math.random() - 0.5) * 0.2, h / 2, z + (Math.random() - 0.5) * 0.2);
        blade.rotation.y = Math.random() * Math.PI;
        blade.rotation.z = (Math.random() - 0.5) * 0.5;
        this.scene.add(blade);
        this._decorationMeshes.push(blade);
      }
    }
  }

  _addPebbleField() {
    const pebbleMats = [
      new THREE.MeshLambertMaterial({ color: 0x556677 }),
      new THREE.MeshLambertMaterial({ color: 0x445566 }),
      new THREE.MeshLambertMaterial({ color: 0x667788 }),
      new THREE.MeshLambertMaterial({ color: 0x778899 }),
    ];
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 17;
      const pebble = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + Math.random() * 0.14, 5, 4),
        pebbleMats[i % pebbleMats.length]
      );
      pebble.position.set(Math.cos(angle) * r, 0.04, Math.sin(angle) * r);
      pebble.scale.y = 0.5 + Math.random() * 0.4;
      this.scene.add(pebble);
      this._decorationMeshes.push(pebble);
    }
  }

  _clearDecorations() {
    if (!this._decorationMeshes) return;
    for (const mesh of this._decorationMeshes) {
      this.scene.remove(mesh);
    }
    this._decorationMeshes = [];
  }

  // ── Per-frame ──────────────────────────────────────────────────────────────

  /**
   * Smoothly moves camera to frame two reference positions.
   * @param {THREE.Vector3} p1    — player position
   * @param {THREE.Vector3} p2    — second reference (nearest enemy)
   * @param {number}        dt
   */
  updateCamera(p1, p2, dt) {
    const mid = new THREE.Vector3(
      (p1.x + p2.x) / 2,
      0,
      (p1.z + p2.z) / 2
    );

    const dist    = p1.distanceTo(p2);
    const camDist = Math.max(18, Math.min(42, dist * 1.4 + 6)); // wider range for big map
    const targetPos = new THREE.Vector3(
      mid.x,
      camDist * 0.88,
      mid.z + camDist * 0.65
    );

    this.camera.position.lerp(targetPos, Math.min(1, 3 * dt));
    this._camTarget.lerp(mid, Math.min(1, 5 * dt));
    this.camera.lookAt(this._camTarget);

    // Animate caustic lights
    const t = performance.now() * 0.001;
    this._causticLights.forEach((light, i) => {
      light.intensity = 0.5 + 0.2 * Math.sin(t * 1.3 + i * 2.1);
    });

    // Update particles
    this._updateParticles(dt);

    // Update level-specific FX
    this._updateLevelFx(dt);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ── Level-specific environment FX ─────────────────────────────────────────────

  _loadLevelFx(levelId) {
    this._levelFxObjects  = this._levelFxObjects  || [];
    this._levelFxAnims    = this._levelFxAnims    || [];
    this._smokeParticles  = this._smokeParticles  || [];
    this._levelFxTimer    = 0;

    switch (levelId) {
      case 'arena7': this._buildVolcanoFx();    break;
      case 'arena5': this._buildCoralReefFx();  break;
      case 'arena4': this._buildPirateShipFx(); break;
    }
  }

  _clearLevelFx() {
    if (this._levelFxObjects) {
      for (const obj of this._levelFxObjects) {
        this.scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      }
      this._levelFxObjects = [];
    }
    if (this._smokeParticles) {
      for (const p of this._smokeParticles) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      }
      this._smokeParticles = [];
    }
    this._levelFxAnims = [];
  }

  _updateLevelFx(dt) {
    if (!this._levelFxAnims || this._levelFxAnims.length === 0) return;
    this._levelFxTimer = (this._levelFxTimer || 0) + dt;
    const t = this._levelFxTimer;
    for (const anim of this._levelFxAnims) anim(t, dt);
  }

  // ── Volcano (arena7) FX ───────────────────────────────────────────────────────

  _buildVolcanoFx() {
    // ── Glowing lava cracks radiating from center ──
    const crackConfigs = [
      { angle: 0,                length: 8, width: 0.35 },
      { angle: Math.PI / 3,      length: 6, width: 0.28 },
      { angle: 2 * Math.PI / 3,  length: 9, width: 0.32 },
      { angle: Math.PI,          length: 7, width: 0.30 },
      { angle: 4 * Math.PI / 3,  length: 5, width: 0.25 },
      { angle: 5 * Math.PI / 3,  length: 8, width: 0.30 },
    ];

    const crackMeshes = [];
    crackConfigs.forEach(({ angle, length, width }) => {
      const geo = new THREE.BoxGeometry(width, 0.04, length);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff4400, transparent: true, opacity: 0.85,
      });
      const crack = new THREE.Mesh(geo, mat);
      crack.position.set(
        Math.cos(angle) * (length / 2),
        0.015,
        Math.sin(angle) * (length / 2)
      );
      crack.rotation.y = -angle;
      this.scene.add(crack);
      this._levelFxObjects.push(crack);
      crackMeshes.push({ mesh: crack, phase: Math.random() * Math.PI * 2 });

      // Point light above each crack
      const light = new THREE.PointLight(0xff5500, 0.8, 8);
      light.position.set(
        Math.cos(angle) * (length / 2),
        0.5,
        Math.sin(angle) * (length / 2)
      );
      this.scene.add(light);
      this._levelFxObjects.push(light);
    });

    // ── Lava pool near center ──
    const lavaGeo = new THREE.CircleGeometry(2.2, 24);
    const lavaMat = new THREE.MeshBasicMaterial({
      color: 0xff4400, transparent: true, opacity: 0.75,
    });
    const lavaPool = new THREE.Mesh(lavaGeo, lavaMat);
    lavaPool.rotation.x = -Math.PI / 2;
    lavaPool.position.y = 0.02;
    this.scene.add(lavaPool);
    this._levelFxObjects.push(lavaPool);

    // Central lava glow light
    const lavaLight = new THREE.PointLight(0xff3300, 2.2, 14);
    lavaLight.position.set(0, 1.5, 0);
    this.scene.add(lavaLight);
    this._levelFxObjects.push(lavaLight);

    // ── Smoke sources (4 vents) ──
    const ventPositions = [
      [3.5, 0, 0], [-3.5, 0, 0], [0, 0, 3.5], [0, 0, -3.5],
    ];
    ventPositions.forEach(pos => {
      this._smokeParticles.push(...this._createSmokeVent(pos));
    });

    // ── Animation callbacks ──
    this._levelFxAnims.push((t) => {
      // Pulse crack emissive / opacity
      crackMeshes.forEach(({ mesh, phase }) => {
        mesh.material.opacity = 0.7 + 0.3 * Math.sin(t * 3.5 + phase);
      });
      // Pulse lava pool
      lavaPool.material.opacity = 0.65 + 0.2 * Math.sin(t * 2.1);
      lavaPool.material.color.setHSL(
        0.04 - 0.02 * Math.sin(t * 1.7),
        1.0,
        0.38 + 0.1 * Math.sin(t * 2.3)
      );
      // Pulse central light
      lavaLight.intensity = 2.0 + 0.8 * Math.sin(t * 2.8);
    });

    // Smoke animation
    this._levelFxAnims.push((t, dt) => {
      this._updateSmoke(dt);
    });
  }

  _createSmokeVent([x, y, z]) {
    const particles = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      const r   = 0.08 + Math.random() * 0.12;
      const geo = new THREE.SphereGeometry(r, 5, 4);
      const mat = new THREE.MeshBasicMaterial({
        color:       0x886655,
        transparent: true,
        opacity:     0.25 + Math.random() * 0.2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      // Random initial offset so they don't all start at same point
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.4,
        y + Math.random() * 3,
        z + (Math.random() - 0.5) * 0.4
      );
      this.scene.add(mesh);
      particles.push({
        mesh,
        origin: [x, y, z],
        vy:     0.4 + Math.random() * 0.6,
        vr:     (Math.random() - 0.5) * 0.3,
        maxY:   3.5 + Math.random() * 2,
        phase:  Math.random() * Math.PI * 2,
      });
    }
    return particles;
  }

  _updateSmoke(dt) {
    for (const p of this._smokeParticles) {
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.x += Math.sin(p.mesh.position.y * 0.8 + p.phase) * 0.012;
      p.mesh.position.z += Math.cos(p.mesh.position.y * 0.8 + p.phase) * 0.010;

      const frac = p.mesh.position.y / p.maxY;
      p.mesh.material.opacity = 0.3 * (1 - frac * frac);
      const s = 1 + frac * 1.8;
      p.mesh.scale.setScalar(s);

      if (p.mesh.position.y >= p.maxY) {
        // Reset to bottom of vent
        p.mesh.position.set(
          p.origin[0] + (Math.random() - 0.5) * 0.4,
          p.origin[1] + 0.1,
          p.origin[2] + (Math.random() - 0.5) * 0.4
        );
        p.mesh.scale.setScalar(1);
        p.mesh.material.opacity = 0.3;
      }
    }
  }

  // ── Coral Reef (arena5) FX ────────────────────────────────────────────────────

  _buildCoralReefFx() {
    // ── Underwater light shafts from above ──
    const shaftPositions = [
      [-8, 0, -8], [8, 0, 8], [-4, 0, 10], [4, 0, -10], [0, 0, 0],
    ];
    shaftPositions.forEach(([sx, , sz], idx) => {
      const height = 10 + Math.random() * 4;
      const geo    = new THREE.CylinderGeometry(0.15, 1.2, height, 10, 1, true);
      const mat    = new THREE.MeshBasicMaterial({
        color:       0xaaddff,
        transparent: true,
        opacity:     0.07 + idx * 0.01,
        side:        THREE.BackSide,
        depthWrite:  false,
      });
      const shaft = new THREE.Mesh(geo, mat);
      shaft.position.set(sx, height / 2, sz);
      this.scene.add(shaft);
      this._levelFxObjects.push(shaft);

      // Animate shaft opacity
      const phase = idx * 1.3;
      this._levelFxAnims.push((t) => {
        shaft.material.opacity = Math.max(0.03, 0.07 + 0.04 * Math.sin(t * 0.8 + phase));
      });
    });

    // ── Swaying seagrass patches ──
    const grassPositions = [
      [-6, 0, 3], [6, 0, -3], [-3, 0, -7], [3, 0, 7],
      [-9, 0, 7], [9, 0, -7], [0, 0, 12], [0, 0, -12],
    ];
    const grassMeshes = [];
    grassPositions.forEach(([gx, , gz]) => {
      const count = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const h   = 0.5 + Math.random() * 0.8;
        const geo = new THREE.CylinderGeometry(0.03, 0.05, h, 5);
        const mat = new THREE.MeshLambertMaterial({
          color:             new THREE.Color().setHSL(0.32 + Math.random() * 0.1, 0.9, 0.35),
          emissive:          new THREE.Color(0x004400),
          emissiveIntensity: 0.2,
        });
        const blade = new THREE.Mesh(geo, mat);
        blade.position.set(
          gx + (Math.random() - 0.5) * 1.0,
          h / 2,
          gz + (Math.random() - 0.5) * 1.0
        );
        blade._phase  = Math.random() * Math.PI * 2;
        blade._speed  = 0.8 + Math.random() * 0.6;
        this.scene.add(blade);
        this._levelFxObjects.push(blade);
        grassMeshes.push(blade);
      }
    });

    // ── Moving fish silhouettes (dark flat diamond shapes) ──
    const fishMeshes = [];
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.ConeGeometry(0.18, 0.5, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0x003355, transparent: true, opacity: 0.45 });
      const fish = new THREE.Mesh(geo, mat);
      fish.rotation.z = Math.PI / 2;
      fish._angle = Math.random() * Math.PI * 2;
      fish._radius = 10 + Math.random() * 6;
      fish._speed  = 0.3 + Math.random() * 0.4;
      fish._height = 1.5 + Math.random() * 3;
      fish.position.set(
        Math.cos(fish._angle) * fish._radius,
        fish._height,
        Math.sin(fish._angle) * fish._radius
      );
      this.scene.add(fish);
      this._levelFxObjects.push(fish);
      fishMeshes.push(fish);
    }

    // ── Animation ──
    this._levelFxAnims.push((t, dt) => {
      // Sway grass
      for (const blade of grassMeshes) {
        blade.rotation.z = 0.12 * Math.sin(t * blade._speed + blade._phase);
        blade.rotation.x = 0.06 * Math.sin(t * blade._speed * 0.7 + blade._phase + 1);
      }
      // Swim fish
      for (const fish of fishMeshes) {
        fish._angle += fish._speed * dt;
        fish.position.x = Math.cos(fish._angle) * fish._radius;
        fish.position.z = Math.sin(fish._angle) * fish._radius;
        fish.position.y = fish._height + 0.4 * Math.sin(t * 1.2 + fish._angle);
        fish.rotation.y = -fish._angle + Math.PI / 2;
        // Fade out at distance (simulate fog)
        const dist = Math.sqrt(fish.position.x ** 2 + fish.position.z ** 2);
        fish.material.opacity = Math.max(0, 0.45 - (dist - 10) * 0.03);
      }
    });

    // Ambient teal glow point light at center
    const glow = new THREE.PointLight(0x00ccaa, 0.6, 20);
    glow.position.set(0, 3, 0);
    this.scene.add(glow);
    this._levelFxObjects.push(glow);
    this._levelFxAnims.push((t) => {
      glow.intensity = 0.5 + 0.3 * Math.sin(t * 1.5);
    });
  }

  // ── Pirate Ship (arena4) FX ───────────────────────────────────────────────────

  _buildPirateShipFx() {
    const H = WORLD_HALF;

    // ── Ocean surface surrounding the ship ──
    const oceanGeo = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2, 1, 1);
    const oceanMat = new THREE.MeshLambertMaterial({
      color:       0x003a6e,
      transparent: true,
      opacity:     0.82,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.08;   // just below the floor/deck
    this.scene.add(ocean);
    this._levelFxObjects.push(ocean);

    // ── Foam ring at ship edges (white semi-transparent band) ──
    const foamGeo = new THREE.RingGeometry(7.5, 9.5, 32);
    const foamMat = new THREE.MeshBasicMaterial({
      color:       0xaaccff,
      transparent: true,
      opacity:     0.18,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
    const foam = new THREE.Mesh(foamGeo, foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.y = 0.005;
    this.scene.add(foam);
    this._levelFxObjects.push(foam);

    // ── Horizontal mast crossbeam ──
    const beamGeo = new THREE.BoxGeometry(6.0, 0.18, 0.18);
    const beamMat = new THREE.MeshLambertMaterial({ color: 0x5c3d1a });
    const beam    = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 3.5, 0);
    this.scene.add(beam);
    this._levelFxObjects.push(beam);

    // ── Sail cloth (semi-transparent flat plane) ──
    const sailGeo = new THREE.PlaneGeometry(5.0, 2.8);
    const sailMat = new THREE.MeshLambertMaterial({
      color:       0xd4c8a8,
      transparent: true,
      opacity:     0.75,
      side:        THREE.DoubleSide,
    });
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0, 2.2, 0.1);
    this.scene.add(sail);
    this._levelFxObjects.push(sail);

    // ── Cannons: 2 simple cylinder + box combos on each side ──
    [[-7.5, 0, -2.5], [-7.5, 0, 2.5], [7.5, 0, -2.5], [7.5, 0, 2.5]].forEach(([cx, cy, cz]) => {
      const barrelGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8);
      const barrelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
      const barrel    = new THREE.Mesh(barrelGeo, barrelMat);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(cx, 0.35, cz);
      this.scene.add(barrel);
      this._levelFxObjects.push(barrel);
    });

    // ── Ship lanterns (small orange point lights) ──
    [[0, 3.8, 0], [-6.0, 0.8, 0], [6.0, 0.8, 0]].forEach(([lx, ly, lz]) => {
      const light = new THREE.PointLight(0xff9933, 0.8, 9);
      light.position.set(lx, ly, lz);
      this.scene.add(light);
      this._levelFxObjects.push(light);
    });

    // ── Animation: subtle sail sway and foam pulse ──
    this._levelFxAnims.push((t) => {
      sail.rotation.y = 0.06 * Math.sin(t * 0.9);
      foam.material.opacity = 0.14 + 0.07 * Math.sin(t * 1.1);
      // Gentle ocean shimmer
      ocean.material.color.setHSL(0.57, 0.82, 0.15 + 0.03 * Math.sin(t * 0.7));
    });
  }
}
