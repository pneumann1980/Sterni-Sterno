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

  _addLights(ambientColor = 0x224488, sunColor = 0x6699cc) {
    // Remove old lights if re-adding
    if (this._ambientLight) this.scene.remove(this._ambientLight);
    if (this._sunLight)     this.scene.remove(this._sunLight);

    this._ambientLight = new THREE.AmbientLight(ambientColor, 0.7);
    this.scene.add(this._ambientLight);

    this._sunLight = new THREE.DirectionalLight(sunColor, 1.1);
    this._sunLight.position.set(8, 22, 10);
    this._sunLight.castShadow = true;
    this._sunLight.shadow.mapSize.setScalar(IS_MOBILE ? 512 : 1024);
    this._sunLight.shadow.camera.near   = 1;
    this._sunLight.shadow.camera.far    = 60;
    this._sunLight.shadow.camera.left   = this._sunLight.shadow.camera.bottom = -25;
    this._sunLight.shadow.camera.right  = this._sunLight.shadow.camera.top    =  25;
    this.scene.add(this._sunLight);

    // Caustic shimmer — two slowly oscillating point lights
    if (this._causticLights) {
      this._causticLights.forEach(l => this.scene.remove(l));
    }
    this._causticLights = [];
    const causticColors = [0x0099ff, 0x00ddcc];
    causticColors.forEach((col, i) => {
      const pt = new THREE.PointLight(col, 0.6, 40);
      pt.position.set(-6 + i * 12, 9, -4 + i * 8);
      this.scene.add(pt);
      this._causticLights.push(pt);
    });
  }

  _addFloor(floorColor = 0xb8994a) {
    if (this._floor) this.scene.remove(this._floor);

    const floorGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 24, 24);
    const floorMat = new THREE.MeshLambertMaterial({ color: floorColor });
    this._floor    = new THREE.Mesh(floorGeo, floorMat);
    this._floor.rotation.x = -Math.PI / 2;
    this._floor.receiveShadow = true;
    this.scene.add(this._floor);

    if (!this._outerFloor) {
      // Darker outer plane (beyond boundary) — built once
      const outerGeo = new THREE.PlaneGeometry(WORLD_SIZE * 4, WORLD_SIZE * 4);
      const outerMat = new THREE.MeshLambertMaterial({ color: 0x001122 });
      this._outerFloor = new THREE.Mesh(outerGeo, outerMat);
      this._outerFloor.rotation.x = -Math.PI / 2;
      this._outerFloor.position.y = -0.02;
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

    for (const dec of decorations) {
      let mesh;
      if (dec.type === 'kelp') {
        const h = 1.6 + Math.random() * 2.2;
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.11, h, 5),
          new THREE.MeshLambertMaterial({ color: 0x226633 + Math.floor(Math.random() * 0x002200) })
        );
        mesh.position.set(dec.pos[0], h / 2, dec.pos[2]);
        mesh.rotation.z = (Math.random() - 0.5) * 0.3;
      } else if (dec.type === 'seagrass') {
        const h = 0.6 + Math.random() * 0.8;
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.08, h, 4),
          new THREE.MeshLambertMaterial({ color: 0x44aa44 })
        );
        mesh.position.set(dec.pos[0], h / 2, dec.pos[2]);
        mesh.rotation.z = (Math.random() - 0.5) * 0.5;
      } else if (dec.type === 'pebble') {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.1 + Math.random() * 0.1, 5, 4),
          new THREE.MeshLambertMaterial({ color: 0x556677 })
        );
        mesh.position.set(dec.pos[0], 0.04, dec.pos[2]);
      }
      if (mesh) {
        this.scene.add(mesh);
        this._decorationMeshes.push(mesh);
      }
    }

    // Always scatter some pebbles
    for (let i = 0; i < 20; i++) {
      const pebble = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + Math.random() * 0.12, 5, 4),
        new THREE.MeshLambertMaterial({ color: 0x556677 })
      );
      pebble.position.set(
        (Math.random() - 0.5) * WORLD_SIZE * 0.8,
        0.04,
        (Math.random() - 0.5) * WORLD_SIZE * 0.8
      );
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
