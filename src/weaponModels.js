/**
 * weaponModels.js
 * Builder functions returning THREE.Group for each weapon type.
 * Used for character weapon mounts and pickup markers.
 */

import * as THREE from 'three';

/** Shell Gun (Muschel) — fan of flat curved plates */
export function buildShellGunMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xddaa55 });
  // Central body — sphere
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat);
  g.add(body);
  // 3 curved "shell" plates arranged in a fan
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI - Math.PI / 3;
    const plate = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 5, 8, Math.PI * 0.7), mat);
    plate.position.set(Math.cos(angle) * 0.18, 0, Math.sin(angle) * 0.18);
    plate.rotation.y = angle;
    g.add(plate);
  }
  return g;
}

/** Bubble Cannon (Blasenkanone) — barrel + bubble */
export function buildBubbleCannonMesh() {
  const g = new THREE.Group();
  const barrelMat = new THREE.MeshLambertMaterial({ color: 0x4499ff });
  const bubbleMat = new THREE.MeshLambertMaterial({ color: 0x88ccff, transparent: true, opacity: 0.7 });
  // Barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.45, 8), barrelMat);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.22, 0, 0);
  g.add(barrel);
  // Bubble at tip
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), bubbleMat);
  bubble.position.set(0.47, 0, 0);
  g.add(bubble);
  return g;
}

/** Spike Aura (Stachel) — ring of rotating spikes */
export function buildSpikeAuraMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xff4400, emissive: 0x441100 });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 5), mat);
    spike.position.set(Math.cos(angle) * 0.32, 0, Math.sin(angle) * 0.32);
    spike.rotation.z = -Math.PI / 2;
    spike.rotation.y = angle;
    g.add(spike);
  }
  return g;
}

/** Coral Gun (Koralle) — branching coral structure */
export function buildCoralGunMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xff6688, emissive: 0x220011 });
  // Main stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.35, 6), mat);
  stem.position.set(0.17, 0, 0);
  stem.rotation.z = Math.PI / 2;
  g.add(stem);
  // Three branches
  for (let i = 0; i < 3; i++) {
    const bAngle = (i / 3) * Math.PI * 2;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.22, 5), mat);
    branch.position.set(0.30 + Math.cos(bAngle) * 0.08, Math.sin(bAngle) * 0.08, 0);
    branch.rotation.z = Math.PI / 2 + (i - 1) * 0.4;
    g.add(branch);
  }
  return g;
}

/** Generic pickup marker (replaces plain ring) */
export function buildPickupMarkerMesh(weaponType) {
  const g = new THREE.Group();
  let model;
  if (weaponType === 'pistole' || weaponType === 'shell')       model = buildShellGunMesh();
  else if (weaponType === 'blasenkanone' || weaponType === 'bubble') model = buildBubbleCannonMesh();
  else if (weaponType === 'saege' || weaponType === 'spike')    model = buildSpikeAuraMesh();
  else                                                           model = buildCoralGunMesh();

  if (model) g.add(model);

  // Glow ring underneath
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.04, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.6 })
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  return g;
}
