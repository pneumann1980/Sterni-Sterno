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

  // ── Shared FX helpers ────────────────────────────────────────────────────────

  /** Simple 2D coherent noise via layered sines. Returns -1..1 */
  _noise2D(x, z) {
    return (
      Math.sin(x * 1.73 + z * 2.31) * 0.500 +
      Math.sin(x * 3.07 - z * 1.97) * 0.250 +
      Math.sin(x * 5.29 + z * 4.13) * 0.125 +
      Math.sin(x * 7.71 - z * 6.37) * 0.063
    ) / 0.938;
  }

  /** Add a mesh to scene AND to the FX cleanup list. */
  _addFx(obj) {
    this.scene.add(obj);
    this._levelFxObjects.push(obj);
    return obj;
  }

  /**
   * Build a wandering curved path starting at (sx, sz) in direction `angle`
   * for `length` units.  Returns Array<THREE.Vector3>.
   */
  _crackPath(sx, sz, angle, length, steps = 10) {
    const pts = [new THREE.Vector3(sx, 0, sz)];
    let x = sx, z = sz, a = angle;
    const stepLen = length / steps;
    for (let i = 0; i < steps; i++) {
      a += (Math.random() - 0.5) * 0.55;
      x += Math.cos(a) * stepLen;
      z += Math.sin(a) * stepLen;
      pts.push(new THREE.Vector3(x, 0, z));
    }
    return pts;
  }

  /**
   * Build a catenary-shaped CatmullRomCurve3 (hanging rope/chain) between two points.
   * @param {number} sag – how much the rope droops at its midpoint
   */
  _catenary(x1, y1, z1, x2, y2, z2, sag, numPts = 10) {
    const pts = [];
    for (let i = 0; i <= numPts; i++) {
      const t  = i / numPts;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t - sag * 4 * t * (1 - t); // parabolic droop
      const pz = z1 + (z2 - z1) * t;
      pts.push(new THREE.Vector3(px, py, pz));
    }
    return new THREE.CatmullRomCurve3(pts);
  }

  // ── Volcano (arena7) FX ───────────────────────────────────────────────────────

  _buildVolcanoFx() {
    // ── Organic lava crack network (TubeGeometry on CatmullRomCurve3) ──
    const crackLights = [];

    const _makeCrack = (sx, sz, angle, length, depth) => {
      if (length < 1.0) return;
      const pts   = this._crackPath(sx, sz, angle, length, 12);
      const curve = new THREE.CatmullRomCurve3(pts);

      // Outer dark shadow tube
      const outerMesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 14, 0.09 + Math.random() * 0.05, 5, false),
        new THREE.MeshBasicMaterial({ color: 0x110000, transparent: true, opacity: 0.95 })
      );
      outerMesh.scale.y = 0.14;
      this._addFx(outerMesh);

      // Inner glowing lava tube
      const innerMesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 14, 0.038 + Math.random() * 0.018, 5, false),
        new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9 })
      );
      innerMesh.scale.y = 0.14;
      innerMesh._phase = Math.random() * Math.PI * 2;
      this._addFx(innerMesh);

      // Point light at crack midpoint
      const mid = curve.getPoint(0.5);
      const lt  = new THREE.PointLight(0xff4400, 0.6, 7);
      lt.position.set(mid.x, 0.35, mid.z);
      this._addFx(lt);
      crackLights.push({ light: lt, phase: Math.random() * Math.PI * 2 });

      // Branch off sub-cracks
      if (depth > 0) {
        const nb = 1 + Math.floor(Math.random() * 2);
        for (let b = 0; b < nb; b++) {
          const t  = 0.3 + Math.random() * 0.45;
          const bp = curve.getPoint(t);
          _makeCrack(bp.x, bp.z, angle + (Math.random() - 0.5) * Math.PI * 0.9,
            length * (0.4 + Math.random() * 0.3), depth - 1);
        }
      }
    };

    // Main cracks from centre
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      _makeCrack(0, 0, a, 7 + Math.random() * 4, 2);
    }
    // Offset secondary cracks
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 6;
      _makeCrack(Math.cos(a) * r, Math.sin(a) * r, Math.random() * Math.PI * 2,
        3 + Math.random() * 3, 1);
    }

    // ── Irregular lava pool (ShapeGeometry) ──
    const poolShape = new THREE.Shape();
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const r = 1.6 + this._noise2D(Math.cos(a) * 2.1, Math.sin(a) * 2.1) * 0.7;
      if (i === 0) poolShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else         poolShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const lavaPool = new THREE.Mesh(
      new THREE.ShapeGeometry(poolShape),
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.82 })
    );
    lavaPool.rotation.x = -Math.PI / 2;
    lavaPool.position.y = 0.022;
    this._addFx(lavaPool);

    const lavaLight = new THREE.PointLight(0xff3300, 2.5, 18);
    lavaLight.position.set(0, 1.5, 0);
    this._addFx(lavaLight);

    // ── Mini volcano cones (LatheGeometry with irregular profile) ──
    const miniLights = [];
    const miniPos = [[-8, -6], [7, 8], [-5, 10], [9, -9], [1, -11]];
    miniPos.forEach(([mx, mz]) => {
      const size = 0.7 + Math.random() * 0.6;
      const profile = [];
      for (let s = 0; s <= 8; s++) {
        const frac  = s / 8;
        const baseR = size * (1 - frac * frac) + this._noise2D(mx + s, mz + frac * 3) * 0.1 * size;
        profile.push(new THREE.Vector2(Math.max(0, baseR), frac * size * 2.2));
      }
      const cone = new THREE.Mesh(
        new THREE.LatheGeometry(profile, 12),
        new THREE.MeshLambertMaterial({ color: 0x2a1508,
          emissive: new THREE.Color(0xff2200), emissiveIntensity: 0.06 })
      );
      cone.position.set(mx, 0, mz);
      cone.castShadow = true;
      this._addFx(cone);

      const crater = new THREE.Mesh(
        new THREE.CircleGeometry(size * 0.22, 10),
        new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.85 })
      );
      crater.rotation.x = -Math.PI / 2;
      crater.position.set(mx, size * 2.2, mz);
      this._addFx(crater);

      const lt = new THREE.PointLight(0xff5500, 0.8, 6);
      lt.position.set(mx, size * 2.6, mz);
      this._addFx(lt);
      miniLights.push({ light: lt, crater, phase: Math.random() * Math.PI * 2 });
    });

    // ── Ash particles (THREE.Points) ──
    const ashCount = IS_MOBILE ? 60 : 130;
    const ashPos   = new Float32Array(ashCount * 3);
    const ashVY    = new Float32Array(ashCount);
    for (let i = 0; i < ashCount; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 9;
      ashPos[i*3] = Math.cos(a)*r; ashPos[i*3+1] = Math.random()*9; ashPos[i*3+2] = Math.sin(a)*r;
      ashVY[i] = 0.25 + Math.random() * 0.55;
    }
    const ashGeo = new THREE.BufferGeometry();
    ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
    this._addFx(new THREE.Points(ashGeo,
      new THREE.PointsMaterial({ color: 0x554433, size: 0.07, transparent: true, opacity: 0.5 })));

    // ── Ember particles (THREE.Points) ──
    const emberCount = IS_MOBILE ? 30 : 70;
    const emberPos   = new Float32Array(emberCount * 3);
    const emberVY    = new Float32Array(emberCount);
    const emberPh    = new Float32Array(emberCount);
    for (let i = 0; i < emberCount; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 3;
      emberPos[i*3] = Math.cos(a)*r; emberPos[i*3+1] = Math.random()*5; emberPos[i*3+2] = Math.sin(a)*r;
      emberVY[i] = 0.8 + Math.random() * 1.1; emberPh[i] = Math.random() * Math.PI * 2;
    }
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    this._addFx(new THREE.Points(emberGeo,
      new THREE.PointsMaterial({ color: 0xff7700, size: 0.12, transparent: true, opacity: 0.9 })));

    // ── Lava bubbles (small spheres rising in pool) ──
    const bubbles = [];
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 1.4;
      const bub = new THREE.Mesh(
        new THREE.SphereGeometry(0.055 + Math.random() * 0.085, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9 })
      );
      bub.position.set(Math.cos(a)*r, 0.03, Math.sin(a)*r);
      bub._maxY = 0.2 + Math.random() * 0.3;
      bub._spd  = 0.35 + Math.random() * 0.55;
      this._addFx(bub);
      bubbles.push(bub);
    }

    // ── Smoke vents ──
    miniPos.forEach(([mx, mz]) => this._smokeParticles.push(...this._createSmokeVent([mx, 0.3, mz])));
    this._smokeParticles.push(...this._createSmokeVent([0, 0.25, 0]));

    // ── Animation ──
    this._levelFxAnims.push((t, dt) => {
      // Ash drift
      const aArr = ashGeo.attributes.position.array;
      for (let i = 0; i < ashCount; i++) {
        aArr[i*3+1] += ashVY[i] * dt;
        aArr[i*3]   += Math.sin(t * 0.6 + i * 0.37) * 0.004;
        if (aArr[i*3+1] > 11) {
          const a = Math.random()*Math.PI*2, r = Math.random()*9;
          aArr[i*3] = Math.cos(a)*r; aArr[i*3+1] = 0; aArr[i*3+2] = Math.sin(a)*r;
        }
      }
      ashGeo.attributes.position.needsUpdate = true;

      // Ember arc
      const eArr = emberGeo.attributes.position.array;
      for (let i = 0; i < emberCount; i++) {
        eArr[i*3+1] += emberVY[i] * dt;
        eArr[i*3]   += Math.sin(t * 1.4 + emberPh[i]) * 0.013;
        eArr[i*3+2] += Math.cos(t * 1.2 + emberPh[i]) * 0.011;
        if (eArr[i*3+1] > 7) {
          const a = Math.random()*Math.PI*2, r = Math.random()*2.5;
          eArr[i*3] = Math.cos(a)*r; eArr[i*3+1] = 0; eArr[i*3+2] = Math.sin(a)*r;
        }
      }
      emberGeo.attributes.position.needsUpdate = true;

      // Pulse lava pool & central light
      lavaPool.material.opacity = 0.7 + 0.2 * Math.sin(t * 2.1);
      lavaPool.material.color.setHSL(0.04 - 0.015 * Math.sin(t * 1.7), 1, 0.37 + 0.09 * Math.sin(t * 2.3));
      lavaLight.intensity = 2.1 + 1.1 * Math.sin(t * 2.8);

      // Crack lights flicker
      for (const { light, phase } of crackLights) {
        light.intensity = 0.5 + 0.45 * Math.sin(t * 3.2 + phase);
      }

      // Mini volcano pulse
      for (const { light, crater, phase } of miniLights) {
        light.intensity = 0.7 + 0.6 * Math.sin(t * 2.5 + phase);
        crater.material.opacity = 0.75 + 0.2 * Math.sin(t * 3.1 + phase);
      }

      // Bubble rise & pop
      for (const b of bubbles) {
        b.position.y += b._spd * dt;
        if (b.position.y > b._maxY) {
          const a = Math.random()*Math.PI*2, r = Math.random()*1.4;
          b.position.set(Math.cos(a)*r, 0.02, Math.sin(a)*r);
          b.material.opacity = 0.9;
        } else {
          b.material.opacity = 0.9 * (1 - b.position.y / b._maxY);
        }
      }
    });

    this._levelFxAnims.push((t, dt) => this._updateSmoke(dt));
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
    const coralColors = [0xff6688, 0xff4466, 0xff8855, 0xffaa44, 0xee3377, 0xff7799];

    // ── Recursive branching coral (TubeGeometry on CatmullRomCurve3) ──
    const _branch = (x, y, z, dx, dz, length, level, color) => {
      if (level < 0 || length < 0.25) return;
      const segs = 8;
      const pts  = [new THREE.Vector3(x, y, z)];
      let cx = x, cy = y, cz = z;
      let cdx = dx, cdy = 1.0 + Math.random() * 0.3, cdz = dz;
      for (let s = 0; s < segs; s++) {
        cdx += (Math.random() - 0.5) * 0.13;
        cdy += (Math.random() - 0.5) * 0.07;
        cdz += (Math.random() - 0.5) * 0.13;
        const len = Math.sqrt(cdx*cdx + cdy*cdy + cdz*cdz);
        const sl = length / segs;
        cx += (cdx/len)*sl; cy += (cdy/len)*sl; cz += (cdz/len)*sl;
        pts.push(new THREE.Vector3(cx, cy, cz));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const r     = 0.03 + level * 0.022;
      this._addFx(new THREE.Mesh(
        new THREE.TubeGeometry(curve, segs, r, 5, false),
        new THREE.MeshLambertMaterial({
          color,
          emissive: new THREE.Color(color).multiplyScalar(0.18),
          emissiveIntensity: 0.35,
        })
      ));
      if (level === 0) {
        const tip = new THREE.Mesh(
          new THREE.SphereGeometry(0.055 + Math.random() * 0.04, 6, 5),
          new THREE.MeshLambertMaterial({ color: 0xffffff,
            emissive: new THREE.Color(color), emissiveIntensity: 0.6 })
        );
        tip.position.set(cx, cy, cz);
        this._addFx(tip);
      }
      if (level > 0) {
        const nb = 2 + Math.floor(Math.random() * 2);
        for (let b = 0; b < nb; b++) {
          const tp  = curve.getPoint(0.4 + Math.random() * 0.45);
          const ba  = Math.random() * Math.PI * 2;
          _branch(tp.x, tp.y, tp.z, Math.cos(ba)*0.5, Math.sin(ba)*0.5,
            length * (0.45 + Math.random() * 0.3), level - 1,
            coralColors[Math.floor(Math.random() * coralColors.length)]);
        }
      }
    };

    const clusters = [[-6,0,5],[7,0,-4],[-3,0,-9],[5,0,9],[-10,0,7],[10,0,-6]];
    clusters.forEach(([cx,,cz], i) => {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        _branch(cx + (Math.random()-0.5)*2, 0, cz + (Math.random()-0.5)*2,
          (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3,
          1.4 + Math.random() * 0.9, 2,
          coralColors[i % coralColors.length]);
      }
    });

    // ── Anemone clusters (rings of bent cones) ──
    const anemMeshes = [];
    [[-5,0,3],[5,0,-3],[-2,0,8],[2,0,-8],[10,0,2],[-10,0,-2]].forEach(([ax,,az]) => {
      const tentacles = 8 + Math.floor(Math.random() * 5);
      for (let t = 0; t < tentacles; t++) {
        const ang = (t / tentacles) * Math.PI * 2;
        const rr  = 0.22 + Math.random() * 0.14;
        const h   = 0.32 + Math.random() * 0.28;
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.04, h, 5),
          new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHSL(0.84 + Math.random() * 0.12, 0.9, 0.6),
            emissive: new THREE.Color(0xff3388), emissiveIntensity: 0.15,
          })
        );
        cone.position.set(ax + Math.cos(ang)*rr, h/2, az + Math.sin(ang)*rr);
        cone.rotation.z = Math.cos(ang) * 0.55;
        cone.rotation.x = Math.sin(ang) * 0.55;
        cone._phase  = Math.random() * Math.PI * 2;
        cone._speed  = 0.7 + Math.random() * 0.5;
        cone._bz     = cone.rotation.z;
        cone._bx     = cone.rotation.x;
        this._addFx(cone);
        anemMeshes.push(cone);
      }
    });

    // ── Torus shells on seabed ──
    [[-4,0,-5],[4,0,5],[-8,0,2],[8,0,-2],[-1,0,7],[1,0,-7],[-6,0,-9],[6,0,9]].forEach(([sx,,sz]) => {
      const or = 0.14 + Math.random() * 0.2;
      const tr = 0.05 + Math.random() * 0.07;
      const shell = new THREE.Mesh(
        new THREE.TorusGeometry(or, tr, 8, 16),
        new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(0.06 + Math.random() * 0.14, 0.7, 0.6 + Math.random() * 0.2),
          emissive: new THREE.Color(0xffaa55), emissiveIntensity: 0.05,
        })
      );
      shell.position.set(sx, tr, sz);
      shell.rotation.set(Math.random()*0.5, Math.random()*Math.PI, Math.random()*0.4);
      shell.castShadow = true;
      this._addFx(shell);
    });

    // ── Plankton particles (THREE.Points drifting upward) ──
    const plankCount = IS_MOBILE ? 80 : 180;
    const plankPos   = new Float32Array(plankCount * 3);
    const plankVY    = new Float32Array(plankCount);
    const plankPh    = new Float32Array(plankCount);
    for (let i = 0; i < plankCount; i++) {
      const a = Math.random()*Math.PI*2, r = Math.random()*WORLD_HALF*0.85;
      plankPos[i*3] = Math.cos(a)*r; plankPos[i*3+1] = Math.random()*10; plankPos[i*3+2] = Math.sin(a)*r;
      plankVY[i] = 0.07 + Math.random() * 0.18; plankPh[i] = Math.random() * Math.PI * 2;
    }
    const plankGeo = new THREE.BufferGeometry();
    plankGeo.setAttribute('position', new THREE.BufferAttribute(plankPos, 3));
    this._addFx(new THREE.Points(plankGeo,
      new THREE.PointsMaterial({ color: 0x88ffcc, size: 0.055, transparent: true, opacity: 0.5 })));

    // ── Animated caustic point lights ──
    const caustics = [];
    [[-6,2,-4],[6,2,4],[0,3,-8],[-8,2,6]].forEach(([lx,ly,lz], i) => {
      const lt = new THREE.PointLight(0x00ddaa, 0.55, 15);
      lt.position.set(lx, ly, lz);
      this._addFx(lt);
      caustics.push({ light: lt, phase: i * 1.57 });
    });

    // ── Dense swaying seagrass ──
    const grassBlades = [];
    const numGrass = IS_MOBILE ? 50 : 110;
    for (let i = 0; i < numGrass; i++) {
      const a = Math.random()*Math.PI*2, rr = 3 + Math.random()*13;
      const gx = Math.cos(a)*rr, gz = Math.sin(a)*rr;
      const h = 0.35 + Math.random() * 0.65;
      const mat = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(0.30 + Math.random()*0.09, 0.88, 0.3 + Math.random()*0.15),
        side: THREE.DoubleSide,
      });
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.07, h), mat);
        blade.position.set(gx + (Math.random()-0.5)*0.25, h/2, gz + (Math.random()-0.5)*0.25);
        blade.rotation.y = Math.random() * Math.PI;
        blade._phase = Math.random() * Math.PI * 2;
        blade._speed = 0.7 + Math.random() * 0.7;
        this._addFx(blade);
        grassBlades.push(blade);
      }
    }

    // ── Animation ──
    this._levelFxAnims.push((t, dt) => {
      // Drift plankton
      const pArr = plankGeo.attributes.position.array;
      for (let i = 0; i < plankCount; i++) {
        pArr[i*3+1] += plankVY[i] * dt;
        pArr[i*3]   += Math.sin(t * 0.4 + plankPh[i]) * 0.003;
        if (pArr[i*3+1] > 12) {
          const a = Math.random()*Math.PI*2, r = Math.random()*WORLD_HALF*0.85;
          pArr[i*3] = Math.cos(a)*r; pArr[i*3+1] = 0; pArr[i*3+2] = Math.sin(a)*r;
        }
      }
      plankGeo.attributes.position.needsUpdate = true;

      // Sway anemones
      for (const c of anemMeshes) {
        c.rotation.z = c._bz + 0.15 * Math.sin(t * c._speed + c._phase);
        c.rotation.x = c._bx + 0.08 * Math.sin(t * c._speed * 0.8 + c._phase + 1);
      }

      // Sway seagrass
      for (const blade of grassBlades) {
        blade.rotation.z = 0.14 * Math.sin(t * blade._speed + blade._phase);
        blade.rotation.x = 0.05 * Math.sin(t * blade._speed * 0.6 + blade._phase + 2);
      }

      // Caustic shimmer
      for (const { light, phase } of caustics) {
        light.intensity = 0.38 + 0.32 * Math.sin(t * 1.7 + phase);
        light.color.setHSL(0.46 + 0.06 * Math.sin(t * 0.9 + phase), 0.9, 0.5);
      }
    });
  }

  // ── Pirate Ship (arena4) FX ───────────────────────────────────────────────────

  _buildPirateShipFx() {
    // ── Animated ocean with vertex wave displacement ──
    const wSegs   = IS_MOBILE ? 16 : 32;
    const oceanGeo = new THREE.PlaneGeometry(WORLD_SIZE * 2.5, WORLD_SIZE * 2.5, wSegs, wSegs);
    const oceanMat = new THREE.MeshLambertMaterial({ color: 0x015f8f, transparent: true, opacity: 0.85 });
    const ocean    = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.1;
    this._addFx(ocean);

    // ── Catenary hanging ropes (TubeGeometry on parabolic curves) ──
    const ropeConfigs = [
      [-3,3.5,-1,  3,3.5,-1, 0.6],
      [-3,3.5, 1,  3,3.5, 1, 0.5],
      [-2,4.0, 0,  0,2.6, 2, 0.45],
      [ 0,2.6, 2,  2,4.0, 0, 0.45],
      [-4,3.8,-3,  0,2.9, 0, 0.7],
      [ 4,3.8,-3,  0,2.9, 0, 0.7],
      [-5,0.8, 0, -5,0.8, 4, 0.28],
      [ 5,0.8, 0,  5,0.8, 4, 0.28],
    ];
    ropeConfigs.forEach(([x1,y1,z1,x2,y2,z2,sag]) => {
      const curve = this._catenary(x1,y1,z1,x2,y2,z2,sag,12);
      this._addFx(new THREE.Mesh(
        new THREE.TubeGeometry(curve, 12, 0.022 + Math.random()*0.016, 5, false),
        new THREE.MeshLambertMaterial({ color: 0x3a2408,
          emissive: new THREE.Color(0x160900), emissiveIntensity: 0.12 })
      ));
    });

    // ── Wood plank gap lines (thin TubeGeometry stripes across deck) ──
    for (let row = -6.5; row <= 6.5; row += 0.62) {
      const pts = [
        new THREE.Vector3(-6.8 + Math.random()*0.1, 0.006, row + (Math.random()-0.5)*0.06),
        new THREE.Vector3( 6.8 - Math.random()*0.1, 0.006, row + (Math.random()-0.5)*0.06),
      ];
      this._addFx(new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 2, 0.011, 4, false),
        new THREE.MeshBasicMaterial({ color: 0x130900, transparent: true, opacity: 0.5 })
      ));
    }

    // ── Scattered debris at random angles ──
    const debrisGeos = [
      new THREE.BoxGeometry(0.65, 0.06, 0.11),
      new THREE.BoxGeometry(0.42, 0.06, 0.10),
      new THREE.BoxGeometry(0.85, 0.05, 0.10),
      new THREE.CylinderGeometry(0.055, 0.055, 0.52, 6),
    ];
    const debrisColors = [0x4a2f0a, 0x5c3a0e, 0x3d2508, 0x3d2508];
    for (let i = 0; i < 20; i++) {
      const idx = i % debrisGeos.length;
      const mesh = new THREE.Mesh(debrisGeos[idx],
        new THREE.MeshLambertMaterial({ color: debrisColors[idx] }));
      const a = Math.random()*Math.PI*2, r = 2.5 + Math.random()*9;
      mesh.position.set(Math.cos(a)*r, 0.04, Math.sin(a)*r);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      mesh.rotation.z = (Math.random()-0.5) * 0.35;
      mesh.castShadow = true;
      this._addFx(mesh);
    }

    // ── Broken hull fragments (large angled planks) ──
    [[-8.5, 0, 0],[8.5, 0, 0],[0, 0, -9.5]].forEach(([hx,,hz]) => {
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(1.6 + Math.random()*0.8, 0.08, 0.32),
        new THREE.MeshLambertMaterial({ color: 0x3a2006 })
      );
      hull.position.set(hx, 0.1, hz);
      hull.rotation.y = Math.random() * Math.PI;
      hull.rotation.z = (Math.random()-0.5) * 0.65;
      hull.castShadow = true;
      this._addFx(hull);
    });

    // ── Mast crossbeam (cylinder) ──
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 7.2, 7),
      new THREE.MeshLambertMaterial({ color: 0x4a2f0a })
    );
    beam.rotation.z = Math.PI / 2;
    beam.position.set(0, 3.8, 0);
    beam.castShadow = true;
    this._addFx(beam);

    // ── Sail with bowed shape ──
    const sailGeo = new THREE.PlaneGeometry(5.5, 3.0, 6, 4);
    const sPos    = sailGeo.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
      const nx = sPos.getX(i) / 2.75;
      const ny = sPos.getY(i) / 1.5;
      sPos.setZ(i, 0.28 * Math.sin(nx * Math.PI) * Math.cos(ny * Math.PI * 0.5));
    }
    sPos.needsUpdate = true;
    const sail = new THREE.Mesh(sailGeo,
      new THREE.MeshLambertMaterial({ color: 0xccc0a0, transparent: true, opacity: 0.78, side: THREE.DoubleSide }));
    sail.position.set(0, 2.4, 0.5);
    this._addFx(sail);

    // ── Water spray particles at ship edges ──
    const sprayCount = IS_MOBILE ? 40 : 90;
    const sprayPos   = new Float32Array(sprayCount * 3);
    const sprayVX    = new Float32Array(sprayCount);
    const sprayVY    = new Float32Array(sprayCount);
    const sprayVZ    = new Float32Array(sprayCount);
    const sprayOX    = new Float32Array(sprayCount);
    const sprayOZ    = new Float32Array(sprayCount);
    const edges      = [[-8,-3],[-8,0],[-8,3],[8,-3],[8,0],[8,3],[-3,-8],[0,-8],[3,-8]];
    for (let i = 0; i < sprayCount; i++) {
      const [ox, oz] = edges[i % edges.length];
      sprayOX[i] = ox; sprayOZ[i] = oz;
      sprayPos[i*3]   = ox + (Math.random()-0.5)*0.4;
      sprayPos[i*3+1] = Math.random() * 1.2;
      sprayPos[i*3+2] = oz + (Math.random()-0.5)*0.4;
      sprayVX[i] = (Math.random()-0.5)*0.7;
      sprayVY[i] = 0.5 + Math.random()*1.1;
      sprayVZ[i] = (Math.random()-0.5)*0.7;
    }
    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
    this._addFx(new THREE.Points(sprayGeo,
      new THREE.PointsMaterial({ color: 0xaaddff, size: 0.075, transparent: true, opacity: 0.6 })));

    // ── Ship lanterns ──
    [[0,4.0,0],[-6.5,0.9,0],[6.5,0.9,0]].forEach(([lx,ly,lz]) => {
      const lt = new THREE.PointLight(0xff9933, 0.85, 10);
      lt.position.set(lx,ly,lz);
      this._addFx(lt);
    });

    // ── Foam ring ──
    const foam = new THREE.Mesh(
      new THREE.RingGeometry(7.5, 9.5, 32),
      new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.18,
        side: THREE.DoubleSide, depthWrite: false })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.y = 0.005;
    this._addFx(foam);

    // ── Animation ──
    this._levelFxAnims.push((t, dt) => {
      // Animate ocean wave vertices (modify local Z = world Y height)
      const wPos = oceanGeo.attributes.position;
      for (let i = 0; i < wPos.count; i++) {
        const wx = wPos.getX(i);
        const wy = wPos.getY(i); // local Y axis (world -Z after rotation)
        wPos.setZ(i,
          0.13 * Math.sin(wx * 0.5 + t * 1.2) +
          0.08 * Math.sin(wx * 1.1 - wy * 0.7 + t * 1.7) +
          0.05 * Math.sin(wy * 0.9 + t * 0.9)
        );
      }
      oceanGeo.attributes.position.needsUpdate = true;
      if (!IS_MOBILE) oceanGeo.computeVertexNormals();
      ocean.material.color.setHSL(0.57, 0.86, 0.14 + 0.04 * Math.sin(t * 0.7));

      // Sail gentle sway
      sail.rotation.y = 0.07 * Math.sin(t * 0.85);

      // Foam pulse
      foam.material.opacity = 0.13 + 0.07 * Math.sin(t * 1.1);

      // Water spray
      const sArr = sprayGeo.attributes.position.array;
      for (let i = 0; i < sprayCount; i++) {
        sArr[i*3]   += sprayVX[i] * dt;
        sArr[i*3+1] += (sprayVY[i] - 1.6 * (sArr[i*3+1] + 0.4)) * dt;
        sArr[i*3+2] += sprayVZ[i] * dt;
        if (sArr[i*3+1] < -0.4 || sArr[i*3+1] > 2.2) {
          sArr[i*3]   = sprayOX[i] + (Math.random()-0.5)*0.4;
          sArr[i*3+1] = 0;
          sArr[i*3+2] = sprayOZ[i] + (Math.random()-0.5)*0.4;
          sprayVX[i]  = (Math.random()-0.5)*0.7;
          sprayVY[i]  = 0.5 + Math.random()*1.1;
          sprayVZ[i]  = (Math.random()-0.5)*0.7;
        }
      }
      sprayGeo.attributes.position.needsUpdate = true;
    });
  }
}
