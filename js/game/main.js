// Bichu Drift — free drift + 60-second score attack with a global leaderboard.
// Fixed-timestep physics, chase camera, drift scoring with combos, tyre marks, smoke, sound.
import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { createCar } from './car.js';
import { createWorld, ARENA } from './world.js';
import { createSkids, createSmoke } from './effects.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createTrack, collideIslands } from './track.js';
import { leaderboard, cleanName } from './leaderboard.js';

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
createTrack(scene);
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
    if (game.mode === 'attack' && score.total > score.best) {
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

const NO_INPUT = { throttle: 0, brake: 0, steer: 0, handbrake: false };
const COAST = { throttle: 0, brake: 0.25, steer: 0, handbrake: false };

function step(dt) {
    const controls = game.phase === 'playing' ? input.state : game.phase === 'results' ? COAST : NO_INPUT;
    vehicle.update(dt, controls);

    // arena walls
    const limit = ARENA - 1.2;
    let impact = 0;
    if (vehicle.x > limit) { vehicle.x = limit; impact = Math.max(impact, vehicle.collide(-1, 0)); }
    if (vehicle.x < -limit) { vehicle.x = -limit; impact = Math.max(impact, vehicle.collide(1, 0)); }
    if (vehicle.z > limit) { vehicle.z = limit; impact = Math.max(impact, vehicle.collide(0, -1)); }
    if (vehicle.z < -limit) { vehicle.z = -limit; impact = Math.max(impact, vehicle.collide(0, 1)); }
    impact = Math.max(impact, collideIslands(vehicle));
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

function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min(0.1, (now - last) / 1000);
    last = now;

    input.poll();
    if (game.phase !== 'menu') {
        if (game.phase === 'playing' && input.consume('r')) {
            vehicle.reset(START.x, START.z, START.heading);
            skids.clear();
            lose();
        }
        if (input.consume('m')) toggleSound();
        if (input.consume('escape') && game.phase === 'playing') openMenu();
        acc += frameDt;
        while (acc >= STEP) { step(STEP); acc -= STEP; }
        if (game.phase === 'playing' && game.mode === 'attack') {
            game.timeLeft = (game.endsAt - performance.now()) / 1000; // real clock, even on slow devices
            ui.timerVal.textContent = Math.max(0, game.timeLeft).toFixed(1);
            ui.timer.classList.toggle('is-low', game.timeLeft < 10);
            if (game.timeLeft <= 0) endAttack();
        }
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

/* ---------- Game flow ---------- */
const ATTACK_SECONDS = 60;
const game = { mode: 'free', phase: 'menu', timeLeft: ATTACK_SECONDS, endsAt: 0 };

const ui = {
    intro: $('.intro'),
    modes: [...document.querySelectorAll('[data-mode]')],
    tabs: [...document.querySelectorAll('.intro-tabs [data-tab]')],
    menuBoard: $('.intro .board-list'),
    timer: $('.hud-timer'),
    timerVal: $('.hud-timer span'),
    countdown: $('.countdown'),
    results: $('.results'),
    resScore: $('.results-score'),
    resBest: $('.results-best'),
    resForm: $('.results-form'),
    resName: $('#player-name'),
    resStatus: $('.results-status'),
    resBoard: $('.results-board'),
    sound: $('[data-action="sound"]'),
};

const setSoundIcon = () => {
    ui.sound.classList.toggle('is-off', audio.muted);
    ui.sound.querySelector('i').className = `bi ${audio.muted ? 'bi-volume-mute-fill' : 'bi-volume-up-fill'}`;
};
function toggleSound() { audio.toggle(); setSoundIcon(); }
setSoundIcon();
ui.sound.addEventListener('click', toggleSound);

// ---- leaderboard rendering
const renderBoard = (list, rows, highlight) => {
    if (!rows.length) {
        list.innerHTML = '<li class="board-empty">No scores yet. Be the first!</li>';
        return;
    }
    list.replaceChildren(...rows.map((r) => {
        const li = document.createElement('li');
        const name = document.createElement('span');
        name.textContent = r.name;
        const pts = document.createElement('b');
        pts.textContent = r.score.toLocaleString();
        li.append(name, pts);
        if (highlight && r.name === highlight.name && r.score === highlight.score) li.classList.add('is-you');
        return li;
    }));
};
const loadBoard = async (list, highlight) => {
    try {
        renderBoard(list, await leaderboard.top(10), highlight);
    } catch {
        list.innerHTML = '<li class="board-empty">Leaderboard is offline right now.</li>';
    }
};
loadBoard(ui.menuBoard);

ui.tabs.forEach((tab) => tab.addEventListener('click', () => {
    ui.tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    document.querySelectorAll('.intro-pane').forEach((p) => { p.hidden = p.dataset.pane !== tab.dataset.tab; });
}));

// ---- starting a run
const swingToChase = () => {
    if (camMode === 'showcase') {
        swingFrom = Math.sin(showcaseTime * 0.35) * 0.75;
        swingT = 0;
        camMode = 'swing';
    }
};

const resetRun = () => {
    vehicle.reset(START.x, START.z, START.heading);
    skids.clear();
    Object.assign(score, { total: 0, run: 0, combo: 1, idle: 0 });
    hud.drift.classList.remove('is-on', 'is-lost', 'is-banked');
    last = performance.now();
    acc = 0;
};

function startMode(mode) {
    game.mode = mode;
    ui.intro.classList.remove('is-open');
    ui.results.classList.remove('is-open');
    audio.start();
    audio.resume();
    swingToChase();
    resetRun();
    ui.timer.hidden = mode !== 'attack';
    if (mode === 'attack') {
        game.timeLeft = ATTACK_SECONDS;
        ui.timerVal.textContent = ATTACK_SECONDS.toFixed(1);
        ui.timer.classList.remove('is-low');
        runCountdown();
    } else {
        game.phase = 'playing';
    }
}

let countdownTimers = [];
function runCountdown() {
    game.phase = 'countdown';
    countdownTimers.forEach(clearTimeout);
    countdownTimers = ['3', '2', '1', 'GO'].map((label, i) => setTimeout(() => {
        if (game.phase !== 'countdown') return;
        ui.countdown.innerHTML = `<span>${label}</span>`;
        if (label === 'GO') {
            game.phase = 'playing';
            game.endsAt = performance.now() + ATTACK_SECONDS * 1000;
            setTimeout(() => { ui.countdown.innerHTML = ''; }, 700);
        }
    }, 600 + i * 800)); // the first beat waits for the camera swing
}

function endAttack() {
    bank();
    game.phase = 'results';
    ui.timer.hidden = true;
    const final = score.total;
    const isBest = final > 0 && final >= score.best;
    ui.resScore.textContent = final.toLocaleString();
    ui.resBest.innerHTML = isBest ? '<b>New personal best!</b>' : `Personal best <b>${score.best.toLocaleString()}</b>`;
    ui.resForm.classList.toggle('is-done', final < 1);
    ui.resForm.querySelector('button').disabled = false;
    ui.resStatus.textContent = final < 1 ? 'Drift to score points next time!' : '';
    ui.resStatus.className = 'results-status';
    try { ui.resName.value = localStorage.getItem('drift-name') || ''; } catch { /* storage blocked */ }
    ui.resBoard.innerHTML = '';
    loadBoard(ui.resBoard);
    setTimeout(() => {
        ui.results.classList.add('is-open');
        if (final > 0) ui.resName.focus({ preventScroll: true });
    }, 900);
}

ui.resForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = cleanName(ui.resName.value);
    if (name.length < 2) {
        ui.resStatus.textContent = 'Use 2–16 letters or numbers.';
        ui.resStatus.className = 'results-status is-err';
        return;
    }
    const btn = ui.resForm.querySelector('button');
    btn.disabled = true;
    ui.resStatus.textContent = 'Submitting…';
    ui.resStatus.className = 'results-status';
    try {
        const rank = await leaderboard.submit(name, score.total);
        try { localStorage.setItem('drift-name', name); } catch { /* storage blocked */ }
        ui.resForm.classList.add('is-done');
        ui.resStatus.textContent = rank <= 10 ? `You're #${rank} on the leaderboard!` : `Saved. You're #${rank} worldwide.`;
        ui.resStatus.className = 'results-status is-ok';
        await loadBoard(ui.resBoard, { name, score: score.total });
        loadBoard(ui.menuBoard);
    } catch (err) {
        btn.disabled = false;
        ui.resStatus.textContent = String(err.message).includes('too many') ? 'Leaderboard is busy, try again in a minute.' : 'Could not submit right now. Try again.';
        ui.resStatus.className = 'results-status is-err';
    }
});

function openMenu() {
    game.phase = 'menu';
    countdownTimers.forEach(clearTimeout);
    ui.timer.hidden = true;
    ui.countdown.innerHTML = '';
    ui.results.classList.remove('is-open');
    ui.intro.classList.add('is-open');
    audio.suspend();
    loadBoard(ui.menuBoard);
}

ui.modes.forEach((b) => b.addEventListener('click', () => startMode(b.dataset.mode)));
$('[data-action="retry"]').addEventListener('click', () => startMode('attack'));
$('[data-action="menu"]').addEventListener('click', openMenu);
$('[data-action="help"]').addEventListener('click', openMenu);
addEventListener('keydown', (e) => {
    if (ui.intro.classList.contains('is-open') && e.key === 'Enter' && !ui.modes[0].disabled) {
        e.preventDefault();
        startMode('attack');
    }
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        audio.suspend();
        if (game.phase === 'playing' && game.mode === 'free') openMenu();
    } else if (game.phase !== 'menu') audio.resume();
});

// Warm up: compile every material (including the hidden smoke and empty skid layer) before
// the first drift, so there is no stutter the first time effects appear.
smoke.sprites.forEach((s) => { s.visible = true; });
skids.mesh.count = 1;
renderer.compile(scene, camera);
renderer.render(scene, camera);
smoke.sprites.forEach((s) => { s.visible = false; });
skids.mesh.count = 0;
requestAnimationFrame(() => ui.modes.forEach((b) => { b.disabled = false; }));

// expose for automated testing only
window.__drift = { vehicle, score, input, game };
