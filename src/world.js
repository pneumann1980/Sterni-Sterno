/**
 * world.js
 * Three.js scene, renderer, camera, and underwater environment.
 * Camera tracks the midpoint between the two active characters.
 */

import * as THREE from 'three';

export const WORLD_SIZE = 38; // full playable diameter
export const WORLD_HALF = WORLD_SIZE / 2;

export class World {
  constructor() {
    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._buildEnvironment();
    window.addEventListener('resize', () => this._onResize());
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

  // ── Environment ────────────────────────────────────────────────────────────

  _buildEnvironment() {
    this._addLights();
    this._addFloor();
    this._addBoundaryDarkening();
    this._addDecorations();
  }

  _addLights() {
    // Ambient — cool blue-green underwater feel
    const ambient = new THREE.AmbientLight(0x224488, 0.7);
    this.scene.add(ambient);

    // Main directional — filtered light from surface
    const sun = new THREE.DirectionalLight(0x6699cc, 1.1);
    sun.position.set(8, 22, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far  = 60;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -25;
    sun.shadow.camera.right = sun.shadow.camera.top  =  25;
    this.scene.add(sun);

    // Caustic shimmer — two slowly oscillating point lights
    this._causticLights = [];
    const causticColors = [0x0099ff, 0x00ddcc];
    causticColors.forEach((col, i) => {
      const pt = new THREE.PointLight(col, 0.6, 40);
      pt.position.set(-6 + i * 12, 9, -4 + i * 8);
      this.scene.add(pt);
      this._causticLights.push(pt);
    });
  }

  _addFloor() {
    // Sandy seabed inside bounds
    const floorGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 24, 24);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xb8994a });
    const floor    = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Darker outer plane (beyond boundary)
    const outerGeo = new THREE.PlaneGeometry(WORLD_SIZE * 4, WORLD_SIZE * 4);
    const outerMat = new THREE.MeshLambertMaterial({ color: 0x001122 });
    const outer    = new THREE.Mesh(outerGeo, outerMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    this.scene.add(outer);
  }

  _addBoundaryDarkening() {
    // Inside-facing dark box — creates a gradient wall effect at the edges
    const wallGeo = new THREE.BoxGeometry(WORLD_SIZE, 18, WORLD_SIZE);
    const wallMat = new THREE.MeshBasicMaterial({
      color:       0x001833,
      transparent: true,
      opacity:     0.28,
      side:        THREE.BackSide,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 8;
    this.scene.add(wall);
  }

  _addDecorations() {
    // Rocks / coral clusters as cover
    const rockData = [
      { pos: [-5, 0, -6], scale: [1.0, 1.4, 0.9] },
      { pos: [ 6, 0,  5], scale: [0.8, 1.1, 1.0] },
      { pos: [-8, 0,  4], scale: [1.2, 0.8, 1.1] },
      { pos: [ 9, 0, -4], scale: [0.7, 1.5, 0.8] },
      { pos: [ 0, 0, -9], scale: [1.0, 1.0, 1.3] },
      { pos: [-3, 0,  9], scale: [0.9, 1.2, 0.9] },
      { pos: [ 7, 0, -8], scale: [1.1, 0.9, 1.0] },
      { pos: [-7, 0,  8], scale: [0.8, 1.3, 0.8] },
    ];

    const rockMat = new THREE.MeshLambertMaterial({ color: 0x334455 });
    const coralMat = new THREE.MeshLambertMaterial({ color: 0xcc4422 });

    rockData.forEach(({ pos, scale }, i) => {
      const isCoral = i % 3 === 2;
      const geo  = new THREE.DodecahedronGeometry(0.55, 0);
      const mesh = new THREE.Mesh(geo, isCoral ? coralMat : rockMat);
      mesh.position.set(...pos);
      mesh.scale.set(...scale);
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    });

    // Kelp strands
    const kelpPositions = [
      [-13, 0, -10], [13, 0, 10], [-10, 0, 13], [10, 0, -13],
      [-15, 0,  0 ], [15, 0,  0], [ 0,  0, 15], [ 0,  0, -15],
      [-12, 0,  6 ], [12, 0, -6],
    ];

    kelpPositions.forEach(([x, , z]) => {
      const h    = 1.6 + Math.random() * 2.2;
      const kelp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.11, h, 5),
        new THREE.MeshLambertMaterial({ color: 0x226633 + Math.floor(Math.random() * 0x002200) })
      );
      kelp.position.set(x, h / 2, z);
      kelp.rotation.z = (Math.random() - 0.5) * 0.3;
      this.scene.add(kelp);
    });

    // Scattered pebbles on the floor
    for (let i = 0; i < 30; i++) {
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
    }
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

    const dist     = p1.distanceTo(p2);
    const camDist  = Math.max(14, dist * 1.4 + 4);
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
