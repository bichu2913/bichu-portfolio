// Bichu Drift — step 1: driving prototype.
// Fixed-timestep physics, chase camera, drift scoring with combos, tyre marks, smoke, sound.
import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { createCar } from './car.js';
import { createWorld, ARENA } from './world.js';
import { createSkids, createSmoke } from './effects.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);

const { moon, cones } = createWorld(scene);
const { car, body, wheels, tailMat, under } = createCar(renderer);
scene.add(car);
const skids = createSkids(scene);
const smoke = createSmoke(scene);
const input = createInput();
const audio = createAudio();
const vehicle = new Vehicle();

const START = { x: 0, z: -40, heading: 0 };
vehicle.reset(START.x, START.z, START.heading);

/* ---------- HUD ---------- */
const $ = (s) => document.querySelector(s);
const hud = {
    speed: $('.hud-speed-val'),
    angle: $('.hud-angle'),
    drift: $('.hud-drift'),
    driftScore: $('.hud-drift-score'),
    combo: $('.hud-drift-combo'),
    bar: $('.hud-drift-bar span'),
    total: $('.hud-total-val'),
    best: $('.hud-best b'),
};

/* ---------- Scoring ---------- */
const score = {
    total: 0,
    best: 0,
    run: 0,          // points in the current drift chain
    combo: 1,
    idle: 0,         // seconds since the car stopped drifting
    chainWindow: 1.6,
};
try { score.best = Number(localStorage.getItem('drift-best')) || 0; } catch { /* storage blocked */ }
hud.best.textContent = score.best.toLocaleString();

const bank = () => {
    if (score.run < 1) return;
    score.total += Math.round(score.run);
    if (score.total > score.best) {
        score.best = score.total;
        try { localStorage.setItem('drift-best', String(score.best)); } catch { /* storage blocked */ }
    }
    hud.drift.classList.remove('is-on', 'is-lost');
    hud.drift.classList.add('is-banked');
    setTimeout(() => hud.drift.classList.remove('is-banked'), 700);
    score.run = 0;
    score.combo = 1;
};

const lose = () => {
    if (score.run < 1) return;
    hud.drift.classList.add('is-lost');
    setTimeout(() => hud.drift.classList.remove('is-on', 'is-lost'), 600);
    score.run = 0;
    score.combo = 1;
};

/* ---------- Simulation step ---------- */
let shake = 0;
const wheelWorld = new THREE.Vector3();

function step(dt) {
    vehicle.update(dt, input.state);

    // arena walls
    const limit = ARENA - 1.2;
    let impact = 0;
    if (vehicle.x > limit) { vehicle.x = limit; impact = Math.max(impact, vehicle.collide(-1, 0)); }
    if (vehicle.x < -limit) { vehicle.x = -limit; impact = Math.max(impact, vehicle.collide(1, 0)); }
    if (vehicle.z > limit) { vehicle.z = limit; impact = Math.max(impact, vehicle.collide(0, -1)); }
    if (vehicle.z < -limit) { vehicle.z = -limit; impact = Math.max(impact, vehicle.collide(0, 1)); }
    if (impact > 4) { shake = Math.min(1, impact / 20); lose(); }

    cones.update(dt, vehicle);

    // drift scoring: angle × speed, multiplied by the combo
    const angleDeg = Math.abs(vehicle.slip) * 57.3;
    if (vehicle.drifting) {
        if (score.idle > 0 && score.run > 0) score.combo = Math.min(9, score.combo + 1); // chained
        score.idle = 0;
        score.run += angleDeg * vehicle.speed * dt * 0.12 * score.combo;
    } else if (score.run > 0) {
        score.idle += dt;
        if (score.idle > score.chainWindow) bank();
    }
}

/* ---------- Visual sync (once per rendered frame) ---------- */
const camPos = new THREE.Vector3(START.x, 4, START.z - 9);
let camMode = 'showcase'; // 'showcase' → 'swing' → 'chase'
let showcaseTime = 0;
let swingT = 0;
let swingFrom = 0;
const camLook = new THREE.Vector3();
const tmp = new THREE.Vector3();

function syncVisuals(dt, frameDt) {
    car.position.set(vehicle.x, 0, vehicle.z);
    car.rotation.y = vehicle.heading;

    // suspension: lean against cornering, squat/dive with accel
    body.rotation.z += ((vehicle.latAccel * 0.0045) - body.rotation.z) * Math.min(1, 8 * frameDt);
    body.rotation.x += ((-vehicle.longAccel * 0.0016) - body.rotation.x) * Math.min(1, 6 * frameDt);

    for (const w of wheels) {
        w.spin.rotation.x = vehicle.wheelSpin;
        if (w.front) w.pivot.rotation.y = vehicle.steerAngle || 0;
    }
    tailMat.emissiveIntensity = vehicle.braking || vehicle.handbrake ? 4 : 1.2;
    under.material.opacity = 0.45 + Math.min(0.3, vehicle.speed * 0.008);

    // tyre marks + smoke from the rear wheels
    const sliding = vehicle.drifting || vehicle.handbrake && vehicle.speed > 5 || (vehicle.braking && vehicle.speed > 18);
    const driftAmount = vehicle.drifting ? Math.min(1, Math.abs(vehicle.slip) * 2.2) : 0;
    for (const [i, w] of wheels.entries()) {
        if (w.front) continue;
        wheelWorld.set(w.x, 0, w.z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, vehicle.heading).add(car.position);
        skids.mark(i, wheelWorld.x, wheelWorld.z, sliding);
        if (vehicle.drifting && Math.random() < 0.55) smoke.emit(wheelWorld.x, wheelWorld.z, vehicle.vx, vehicle.vz, driftAmount);
    }
    smoke.update(frameDt);

    const fx = Math.sin(vehicle.heading);
    const fz = Math.cos(vehicle.heading);
    const sp = vehicle.speed;

    // showcase (start screen) and the swing into the chase view
    showcaseTime += frameDt;
    if (camMode !== 'chase') {
        let angle;
        let radius;
        let height;
        if (camMode === 'showcase') {
            angle = Math.sin(showcaseTime * 0.35) * 0.75;   // sway around the front of the car
            radius = 6.4;
            height = 1.25;
        } else {
            swingT = Math.min(1, swingT + frameDt / 1.4);
            const e = swingT < 0.5 ? 4 * swingT ** 3 : 1 - (-2 * swingT + 2) ** 3 / 2; // ease in-out
            angle = swingFrom + (Math.PI * Math.sign(swingFrom || 1) - swingFrom) * e;
            radius = 6.4 + (8 - 6.4) * e;
            height = 1.25 + (3.3 - 1.25) * e;
            if (swingT >= 1) camMode = 'chase';
        }
        const a = vehicle.heading + angle;
        camPos.set(vehicle.x + Math.sin(a) * radius, height, vehicle.z + Math.cos(a) * radius);
        camera.position.copy(camPos);
        camLook.set(vehicle.x, 0.62, vehicle.z);
        if (camMode === 'showcase' && innerWidth > 900) {
            // frame the car to the right of the start card
            const dx = camLook.x - camPos.x;
            const dz = camLook.z - camPos.z;
            const l = Math.hypot(dx, dz);
            camLook.x += (dz / l) * 1.5;
            camLook.z -= (dx / l) * 1.5;
        }
        camera.lookAt(camLook);
        if (camera.fov !== 50 && camMode === 'showcase') { camera.fov = 50; camera.updateProjectionMatrix(); }
    }

    // chase camera: swings toward the direction of travel during drifts
    if (camMode === 'chase') {
    let dx = fx;
    let dz = fz;
    if (sp > 3 && vehicle.forwardSpeed > 0) {
        const vx = vehicle.vx / sp;
        const vz = vehicle.vz / sp;
        dx = fx * 0.6 + vx * 0.4;
        dz = fz * 0.6 + vz * 0.4;
        const l = Math.hypot(dx, dz);
        dx /= l; dz /= l;
    }
    const back = 7.5 + Math.min(2.5, sp * 0.05);
    tmp.set(vehicle.x - dx * back, 3.1 + Math.min(1.2, sp * 0.02), vehicle.z - dz * back);
    camPos.lerp(tmp, 1 - Math.exp(-6 * frameDt));
    camera.position.copy(camPos);
    if (shake > 0) {
        camera.position.x += (Math.random() - 0.5) * shake * 0.6;
        camera.position.y += (Math.random() - 0.5) * shake * 0.4;
        shake = Math.max(0, shake - frameDt * 2.5);
    }
    camLook.set(vehicle.x + fx * 3, 0.9, vehicle.z + fz * 3);
    camera.lookAt(camLook);
    }
    const fov = camMode === 'showcase' ? 50 : 60 + Math.min(16, sp * 0.35);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, 3 * frameDt); camera.updateProjectionMatrix(); }

    // shadows follow the car
    moon.position.set(vehicle.x - 30, 50, vehicle.z - 20);
    moon.target.position.set(vehicle.x, 0, vehicle.z);

    // HUD
    hud.speed.textContent = Math.round(Math.abs(vehicle.forwardSpeed) * 3.6);
    hud.angle.textContent = `${Math.round(Math.abs(vehicle.slip) * 57.3)}°`;
    hud.total.textContent = score.total.toLocaleString();
    hud.best.textContent = score.best.toLocaleString();
    if (score.run > 0) {
        hud.drift.classList.add('is-on');
        hud.drift.classList.remove('is-banked');
        hud.driftScore.textContent = Math.round(score.run).toLocaleString();
        hud.combo.textContent = `x${score.combo}`;
        hud.bar.style.width = `${Math.max(0, 100 - (score.idle / score.chainWindow) * 100)}%`;
    }

    audio.update(vehicle.forwardSpeed, input.state.throttle, driftAmount);
}

/* ---------- Loop ---------- */
const STEP = 1 / 120;
let acc = 0;
let last = performance.now();
let running = false;

function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min(0.1, (now - last) / 1000);
    last = now;

    input.poll();
    if (running) {
        if (input.consume('r')) {
            vehicle.reset(START.x, START.z, START.heading);
            skids.clear();
            lose();
        }
        if (input.consume('m')) toggleSound();
        acc += frameDt;
        while (acc >= STEP) { step(STEP); acc -= STEP; }
    }
    input.endFrame();
    syncVisuals(STEP, frameDt);
    renderer.render(scene, camera);
}

function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);

/* ---------- UI ---------- */
const intro = $('.intro');
const startBtn = $('[data-action="start"]');
const soundBtn = $('[data-action="sound"]');

const setSoundIcon = () => {
    soundBtn.classList.toggle('is-off', audio.muted);
    soundBtn.querySelector('i').className = `bi ${audio.muted ? 'bi-volume-mute-fill' : 'bi-volume-up-fill'}`;
};
function toggleSound() { audio.toggle(); setSoundIcon(); }
setSoundIcon();

const begin = () => {
    if (camMode === 'showcase') {
        swingFrom = Math.sin(showcaseTime * 0.35) * 0.75;
        swingT = 0;
        camMode = 'swing';
    }
    intro.classList.remove('is-open');
    audio.start();
    audio.resume();
    running = true;
    last = performance.now();
    acc = 0;
    canvas.focus?.();
};
startBtn.addEventListener('click', begin);
soundBtn.addEventListener('click', toggleSound);
$('[data-action="help"]').addEventListener('click', () => {
    running = false;
    audio.suspend();
    intro.classList.add('is-open');
});
addEventListener('keydown', (e) => {
    if (intro.classList.contains('is-open') && (e.key === 'Enter' || e.key === ' ') && startBtn.classList.contains('is-ready')) {
        e.preventDefault();
        begin();
    }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else if (running) audio.resume(); });

// Warm up: compile every material (including the hidden smoke and empty skid layer) before
// the first drift, so there is no stutter the first time effects appear.
smoke.sprites.forEach((s) => { s.visible = true; });
skids.mesh.count = 1;
renderer.compile(scene, camera);
renderer.render(scene, camera);
smoke.sprites.forEach((s) => { s.visible = false; });
skids.mesh.count = 0;
requestAnimationFrame(() => {
    startBtn.classList.add('is-ready');
    startBtn.disabled = false;
});

// expose for automated testing only
window.__drift = { vehicle, score, input };
