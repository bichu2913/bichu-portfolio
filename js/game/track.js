// Course layout on top of the open lot: a painted gold circuit, concrete islands to drift
// around (solid, with collision), and lit billboards about the portfolio around the edge.
import * as THREE from 'three';
import { ARENA } from './world.js';

// Islands the car collides with: [x, z, radius]
export const ISLANDS = [
    [-32, 22, 6], [32, -22, 6],
    [-62, -38, 4.5], [62, 38, 4.5],
    [0, 58, 7], [-58, 52, 4], [58, -55, 4],
];

// Circuit centre-line, threads between the islands (drawn only; you can drive anywhere)
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
