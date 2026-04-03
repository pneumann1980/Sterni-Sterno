/**
 * world.js
 * Three.js scene, renderer, camera, and underwater environment.
 * Camera tracks the midpoint between the two active characters.
 * Environment colors are configurable from level definitions.
 */

import * as THREE from 'three';

export const WORLD_SIZE = 38; // full playable diameter
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
    this._sunLight.shadow.camera.left   = this._sunLight.shadow.camera.bottom = -22;
    this._sunLight.shadow.camera.right  = this._sunLight.shadow.camera.top    =  22;
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

    // Spawn pickups
    if (pickupManager && WEAPONS_MAP) {
      pickupManager.spawnFromLevel(levelDef, WEAPONS_MAP);
    }
  }

  unloadLevel(obstacleSystem, pickupManager) {
    if (obstacleSystem) obstacleSystem.clear(this.scene);
    if (pickupManager)  pickupManager.clear();
    this._clearDecorations();
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
   * Smoothly moves camera to frame both characters.
   * @param {THREE.Vector3} p1
   * @param {THREE.Vector3} p2
   * @param {number} dt
   */
  updateCamera(p1, p2, dt) {
    const mid = new THREE.Vector3(
      (p1.x + p2.x) / 2,
      0,
      (p1.z + p2.z) / 2
    );

    const dist      = p1.distanceTo(p2);
    const camDist   = Math.max(14, dist * 1.4 + 4);
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
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
