/**
 * weaponModels.js
 * 3D model builders for each weapon type.
 * All models are large enough to read at a glance on screen.
 *
 * buildShellGunMesh()     — Muschel-Shooter (golden fan shell)
 * buildBubbleCannonMesh() — Blasenkanone (blue barrel + glowing bubble)
 * buildSpikeOrbitMesh()   — Stachel-Aura (orbit ring, attached to character body)
 * buildPickupMarkerMesh() — Floating pickup in the level
 */

import * as THREE from 'three';

// ── Muschel-Shooter ────────────────────────────────────────────────────────────
export function buildShellGunMesh() {
  const g   = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xdda840, emissive: 0x443300, emissiveIntensity: 0.3 });
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff0b0, emissive: 0x665500, emissiveIntensity: 0.4 });

  // Central pearl
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), lightMat);
  g.add(pearl);

  // 4 shell plates fanning outward
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 1.4 - Math.PI * 0.35;
    const plate = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.07, 5, 10, Math.PI * 0.75),
      mat
    );
    plate.position.set(Math.cos(angle) * 0.24, Math.sin(angle) * 0.10, 0);
    plate.rotation.z = angle + Math.PI / 2;
    g.add(plate);
  }

  // Barrel pointing forward (+X)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.10, 0.45, 8), mat);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.42, 0, 0);
  g.add(barrel);

  return g;
}

// ── Blasenkanone ───────────────────────────────────────────────────────────────
export function buildBubbleCannonMesh() {
  const g          = new THREE.Group();
  const barrelMat  = new THREE.MeshLambertMaterial({ color: 0x2277cc, emissive: 0x001144, emissiveIntensity: 0.3 });
  const ringMat    = new THREE.MeshLambertMaterial({ color: 0x44aaff, emissive: 0x002266, emissiveIntensity: 0.5 });
  const bubbleMat  = new THREE.MeshLambertMaterial({
    color: 0x88ddff, emissive: 0x004488, emissiveIntensity: 0.5,
    transparent: true, opacity: 0.75,
  });

  // Wide barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.16, 0.55, 10), barrelMat);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.28, 0, 0);
  g.add(barrel);

  // Decorative rings around barrel
  for (let r = 0; r < 3; r++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 6, 14), ringMat);
    ring.position.set(0.10 + r * 0.18, 0, 0);
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
  }

  // Large bubble at muzzle — this is what makes it recognisable
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bubbleMat);
  bubble.position.set(0.72, 0, 0);
  g.add(bubble);

  // Outer glow of bubble
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x44ccff, transparent: true, opacity: 0.18, side: THREE.BackSide });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), glowMat);
  glow.position.set(0.72, 0, 0);
  g.add(glow);

  return g;
}

// ── Stachel-Aura orbit ring ────────────────────────────────────────────────────
// Attached to the CHARACTER BODY (not weapon mount) — circles the whole starfish
export function buildSpikeOrbitMesh() {
  const g   = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({
    color: 0xff2200, emissive: 0x880000, emissiveIntensity: 0.6,
  });
  const tipMat = new THREE.MeshLambertMaterial({
    color: 0xff6600, emissive: 0xbb3300, emissiveIntensity: 0.7,
  });

  const SPIKE_COUNT  = 6;
  const ORBIT_RADIUS = 1.6;

  for (let i = 0; i < SPIKE_COUNT; i++) {
    const angle = (i / SPIKE_COUNT) * Math.PI * 2;

    // Spike base (thick cone body)
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.7, 6), mat);
    spike.position.set(Math.cos(angle) * ORBIT_RADIUS, 0.15, Math.sin(angle) * ORBIT_RADIUS);
    // Point outward: default cone is along +Y → rotate to point along +X then rotate Y to angle
    spike.rotation.set(0, angle, -Math.PI / 2);
    g.add(spike);

    // Glowing tip ball
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.10, 7, 6), tipMat);
    tip.position.set(
      Math.cos(angle) * (ORBIT_RADIUS + 0.42),
      0.15,
      Math.sin(angle) * (ORBIT_RADIUS + 0.42)
    );
    g.add(tip);
  }

  return g;
}

// ── Nova-Explosion pickup ───────────────────────────────────────────────────────
export function buildNovaBlastPickupMesh() {
  const g   = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xff6600, emissive: 0xcc2200, emissiveIntensity: 0.7 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.30, side: THREE.BackSide });

  // Central core — glowing sphere
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat);
  g.add(core);

  // 8 explosion spikes radiating outward
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.38, 5),
      mat
    );
    spike.position.set(Math.cos(angle) * 0.38, Math.sin(angle) * 0.38, 0);
    spike.rotation.z = angle - Math.PI / 2;
    g.add(spike);
  }

  // Outer glow
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), glowMat);
  g.add(glow);

  return g;
}

// ── Sand-Tarnung pickup ─────────────────────────────────────────────────────────
export function buildSandStealthPickupMesh() {
  const g      = new THREE.Group();
  const sandMat = new THREE.MeshLambertMaterial({ color: 0xc8a045, emissive: 0x6b4400, emissiveIntensity: 0.35 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x8b6020, emissive: 0x3a2000, emissiveIntensity: 0.25 });

  // Sandy mound (flattened half-sphere)
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), sandMat);
  mound.scale.y = 0.5;
  g.add(mound);

  // Buried outline of starfish arm (just a hint)
  const hint = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 5, 12), darkMat);
  hint.rotation.x = Math.PI / 2;
  hint.position.y = 0.02;
  g.add(hint);

  // Downward arrow indicator
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.85 });
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), arrowMat);
  arrow.position.y = 0.42;
  arrow.rotation.x = Math.PI; // pointing down
  g.add(arrow);

  return g;
}

// ── Pickup marker ──────────────────────────────────────────────────────────────
export function buildPickupMarkerMesh(weaponKey) {
  const g = new THREE.Group();

  // Choose model by weapon key
  let model;
  switch (weaponKey) {
    case 'muschelShooter': model = buildShellGunMesh();        break;
    case 'blasenkanone':   model = buildBubbleCannonMesh();    break;
    case 'stachelAura':    model = buildSpikeOrbitMesh();      break;
    case 'novaBlast':      model = buildNovaBlastPickupMesh(); break;
    case 'einbuddeln':     model = buildSandStealthPickupMesh(); break;
    default:               model = buildShellGunMesh();
  }

  // Scale up so it's unmissable in the level
  model.scale.setScalar(2.2);
  g.add(model);

  // Glowing ground ring
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.80 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.09, 6, 28), ringMat);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  // Second pulsing inner ring
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.40, 0.05, 5, 20),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.30 })
  );
  ring2.rotation.x = Math.PI / 2;
  g.add(ring2);

  return g;
}
