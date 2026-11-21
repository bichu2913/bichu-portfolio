// Course layout on top of the open lot: a painted gold circuit, concrete islands to drift
// around (solid, with collision), and lit billboards about the portfolio around the edge.
import * as THREE from 'three';
import { ARENA } from './world.js';

// Islands the car collides with: [x, z, radius]
export const ISLANDS = [
    [-32, 22, 6], [32, -22, 6],
    [-40, -40, 4.5], [28, 24, 4.5],
    [0, 58, 7], [-58, 52, 4], [58, -55, 4],
];

// Circuit centre-line, threads between the islands (walled in Score Attack; open in Free Drift)
const CIRCUIT = [
    [0, -40], [30, -46], [52, -30], [46, -6], [56, 18], [72, 52],
    [40, 70], [14, 44], [-14, 44], [-40, 70], [-74, 60], [-60, 28],
    [-48, 2], [-74, -22], [-62, -66], [-26, -70],
];

function textTexture(lines, opts = {}) {
    const W = 1024;
    const H = 512;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, '#0d0f13');
    grd.addColorStop(1, '#1b1710');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#d9b778';
    g.lineWidth = 10;
    g.strokeRect(14, 14, W - 28, H - 28);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const total = lines.reduce((s, l) => s + l.size * 1.25, 0);
    let y = H / 2 - total / 2;
    for (const l of lines) {
        g.font = `${l.weight || 800} ${l.size}px ${l.font || 'Syne, Space Grotesk, sans-serif'}`;
        g.fillStyle = l.color || '#f3f5f7';
        if (l.glow) { g.shadowColor = l.color; g.shadowBlur = 30; } else g.shadowBlur = 0;
        y += l.size * 0.625;
        g.fillText(l.text, W / 2, y, W - 90);
        y += l.size * 0.625;
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}

const BOARDS = [
    [{ text: 'BICHU B NADHAN', size: 96, color: '#f3f5f7' }, { text: 'Flutter · Next.js · AI', size: 54, color: '#d9b778', weight: 600 }],
    [{ text: 'TIAN GOLD & DIAMOND', size: 76, color: '#d9b778', glow: true }, { text: 'Web + app + AI · built solo', size: 50, weight: 600 }],
    [{ text: '15+', size: 170, color: '#d9b778', glow: true }, { text: 'APPS SHIPPED', size: 62 }],
    [{ text: 'HAVE AN IDEA?', size: 96 }, { text: "Let's build it together", size: 56, color: '#d9b778', weight: 600 }],
    [{ text: 'MOBILE · WEB · AI', size: 84 }, { text: 'One developer, every layer', size: 50, color: '#d9b778', weight: 600 }],
    [{ text: 'WRITING ON AI', size: 90 }, { text: 'medium.com/@bichuamz', size: 52, color: '#d9b778', weight: 600 }],
];

export function createTrack(scene) {
    // ---- painted circuit: two gold edge lines + dashed centre
    const curve = new THREE.CatmullRomCurve3(CIRCUIT.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    const pts = curve.getSpacedPoints(420);
    const edge = (offset, width) => {
        const pos = [];
        const idx = [];
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            const n = pts[(i + 1) % pts.length];
            let tx = n.x - p.x;
            let tz = n.z - p.z;
            const l = Math.hypot(tx, tz) || 1;
            tx /= l; tz /= l;
            const nx = -tz;
            const nz = tx;
            pos.push(p.x + nx * (offset - width / 2), 0.012, p.z + nz * (offset - width / 2));
            pos.push(p.x + nx * (offset + width / 2), 0.012, p.z + nz * (offset + width / 2));
            if (i < pts.length - 1) {
                const a = i * 2;
                idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setIndex(idx);
        return geo;
    };
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd9b778, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    scene.add(new THREE.Mesh(edge(7, 0.35), lineMat), new THREE.Mesh(edge(-7, 0.35), lineMat));

    // dashed centre
    const dashGeo = new THREE.PlaneGeometry(0.25, 2.4);
    dashGeo.rotateX(-Math.PI / 2);
    const dashes = new THREE.InstancedMesh(dashGeo, new THREE.MeshBasicMaterial({ color: 0xf3f5f7, transparent: true, opacity: 0.25, depthWrite: false }), Math.floor(pts.length / 4));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0, k = 0; k < dashes.count; i += 4, k++) {
        const p = pts[i];
        const n = pts[(i + 1) % pts.length];
        q.setFromAxisAngle(up, Math.atan2(n.x - p.x, n.z - p.z));
        m.compose(new THREE.Vector3(p.x, 0.013, p.z), q, new THREE.Vector3(1, 1, 1));
        dashes.setMatrixAt(k, m);
    }
    scene.add(dashes);

    // ---- islands: concrete planters with a glowing gold rim and a small tree
    const concrete = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd9b778, emissive: 0xd9b778, emissiveIntensity: 1.2 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f3a2a, roughness: 0.9 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b2a1a, roughness: 0.9 });
    for (const [x, z, r] of ISLANDS) {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.2, 0.6, 40), concrete);
        base.position.set(x, 0.3, z);
        base.castShadow = base.receiveShadow = true;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(r + 0.05, 0.07, 6, 60), rimMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(x, 0.62, z);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 2.4, 8), trunkMat);
        trunk.position.set(x, 1.8, z);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(Math.min(2.4, r * 0.45), 0), leafMat);
        crown.position.set(x, 3.6, z);
        crown.castShadow = true;
        scene.add(base, rim, trunk, crown);
    }

    // ---- billboards outside the barrier, facing the arena
    const spots = [
        [0, ARENA + 9, Math.PI], [-50, ARENA + 9, Math.PI], [50, ARENA + 9, Math.PI],
        [0, -ARENA - 9, 0], [ARENA + 9, -30, -Math.PI / 2], [-ARENA - 9, 30, Math.PI / 2],
    ];
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.7 });
    spots.forEach(([x, z, rot], i) => {
        const group = new THREE.Group();
        const panel = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 10),
            new THREE.MeshBasicMaterial({ map: textTexture(BOARDS[i % BOARDS.length]), toneMapped: false }),
        );
        panel.position.y = 10;
        const back = new THREE.Mesh(new THREE.BoxGeometry(20.6, 10.6, 0.4), postMat);
        back.position.set(0, 10, -0.25);
        const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), postMat);
        post1.position.set(-6, 2.5, -0.3);
        const post2 = post1.clone();
        post2.position.x = 6;
        group.add(panel, back, post1, post2);
        group.position.set(x, 0, z);
        group.rotation.y = rot;
        scene.add(group);
    });

    return { islands: ISLANDS };
}

// Push the car out of any island it overlaps; returns the impact speed (0 if none).
export function collideIslands(vehicle, carRadius = 1.6) {
    let impact = 0;
    for (const [x, z, r] of ISLANDS) {
        const dx = vehicle.x - x;
        const dz = vehicle.z - z;
        const d = Math.hypot(dx, dz);
        const min = r + carRadius;
        if (d < min && d > 0.001) {
            const nx = dx / d;
            const nz = dz / d;
            vehicle.x = x + nx * min;
            vehicle.z = z + nz * min;
            impact = Math.max(impact, vehicle.collide(nx, nz));
        }
    }
    return impact;
}

/* ================= Race circuit (Score Attack) ================= */
export const HALF_WIDTH = 7;
const curve = new THREE.CatmullRomCurve3(CIRCUIT.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
const N = 600;
// samples: position + unit tangent, evenly spaced along the loop
const SAMPLES = curve.getSpacedPoints(N).slice(0, N).map((p, i, arr) => {
    const n = arr[(i + 1) % arr.length];
    const l = Math.hypot(n.x - p.x, n.z - p.z) || 1;
    return { x: p.x, z: p.z, tx: (n.x - p.x) / l, tz: (n.z - p.z) / l };
});
export const TRACK_LENGTH = curve.getLength();

// start grid: a few metres before the line (sample 0), facing along the track
export function startPose() {
    const s = SAMPLES[N - 8];
    return { x: s.x, z: s.z, heading: Math.atan2(s.tx, s.tz) };
}

// Nearest sample to (x, z), searching around a hint index (falls back to a full search).
export function project(x, z, hint = -1) {
    let best = -1;
    let bestD = Infinity;
    const scan = (from, to) => {
        for (let k = from; k <= to; k++) {
            const i = ((k % N) + N) % N;
            const s = SAMPLES[i];
            const d = (s.x - x) ** 2 + (s.z - z) ** 2;
            if (d < bestD) { bestD = d; best = i; }
        }
    };
    if (hint >= 0) scan(hint - 25, hint + 25);
    if (best < 0 || bestD > 400) { bestD = Infinity; scan(0, N - 1); }
    const s = SAMPLES[best];
    // signed lateral offset: + = left of the driving direction
    const lateral = (x - s.x) * -s.tz + (z - s.z) * s.tx;
    return { index: best, lateral, s };
}

// Keep the car between the walls; returns impact speed.
export function collideWalls(vehicle, hint, carRadius = 1.3) {
    const p = project(vehicle.x, vehicle.z, hint);
    const limit = HALF_WIDTH - carRadius;
    let impact = 0;
    if (Math.abs(p.lateral) > limit) {
        const side = Math.sign(p.lateral);
        const lx = -p.s.tz;
        const lz = p.s.tx;
        const over = Math.abs(p.lateral) - limit;
        vehicle.x -= lx * side * over;
        vehicle.z -= lz * side * over;
        impact = vehicle.collide(-lx * side, -lz * side);
    }
    return { impact, index: p.index };
}

export const SAMPLE_COUNT = N;
export const trackSample = (i) => SAMPLES[((i % N) + N) % N];

// Race walls + start line, hidden until a race starts.
export function createRaceCourse(scene) {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    const wallGeo = new THREE.BoxGeometry(1, 0.7, 0.35);
    const capGeo = new THREE.BoxGeometry(1, 0.08, 0.37);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.8 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xd9b778, emissive: 0xd9b778, emissiveIntensity: 1.1 });
    const walls = new THREE.InstancedMesh(wallGeo, wallMat, N * 2);
    const caps = new THREE.InstancedMesh(capGeo, capMat, N * 2);
    walls.castShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const offset = HALF_WIDTH + 0.2;
    let k = 0;
    for (const side of [1, -1]) {
        for (let i = 0; i < N; i++) {
            const a = SAMPLES[i];
            const b = SAMPLES[(i + 1) % N];
            const ax = a.x - a.tz * offset * side;
            const az = a.z + a.tx * offset * side;
            const bx = b.x - b.tz * offset * side;
            const bz = b.z + b.tx * offset * side;
            const len = Math.hypot(bx - ax, bz - az) + 0.05;
            q.setFromAxisAngle(up, Math.atan2(bx - ax, bz - az) + Math.PI / 2);
            m.compose(new THREE.Vector3((ax + bx) / 2, 0.35, (az + bz) / 2), q, new THREE.Vector3(len, 1, 1));
            walls.setMatrixAt(k, m);
            m.compose(new THREE.Vector3((ax + bx) / 2, 0.72, (az + bz) / 2), q, new THREE.Vector3(len, 1, 1));
            caps.setMatrixAt(k, m);
            k++;
        }
    }
    group.add(walls, caps);

    // chequered start / finish strip across sample 0
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 32;
    const g = c.getContext('2d');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#f3f5f7';
        g.fillRect(x * 16, y * 16, 16, 16);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s0 = SAMPLES[0];
    const line = new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, 1.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85 }));
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = -Math.atan2(s0.tx, s0.tz) + Math.PI / 2;
    line.position.set(s0.x, 0.02, s0.z);
    group.add(line);

    // gantry over the line
    const postMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.6 });
    const lx = -s0.tz;
    const lz = s0.tx;
    for (const side of [1, -1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), postMat);
        post.position.set(s0.x + lx * (HALF_WIDTH + 1) * side, 3, s0.z + lz * (HALF_WIDTH + 1) * side);
        group.add(post);
    }
    const banner = new THREE.Mesh(
        new THREE.BoxGeometry(HALF_WIDTH * 2 + 2.4, 1.1, 0.3),
        new THREE.MeshBasicMaterial({ map: (() => {
            const cv = document.createElement('canvas');
            cv.width = 1024; cv.height = 80;
            const gg = cv.getContext('2d');
            gg.fillStyle = '#0d0f13'; gg.fillRect(0, 0, 1024, 80);
            gg.fillStyle = '#d9b778'; gg.font = '800 54px Syne, sans-serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
            gg.fillText('BICHU DRIFT · START / FINISH', 512, 42);
            const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
        })(), toneMapped: false }),
    );
    banner.position.set(s0.x, 6, s0.z);
    banner.rotation.y = Math.atan2(lx, lz) + Math.PI / 2;
    group.add(banner);

    return { setVisible: (v) => { group.visible = v; } };
}
