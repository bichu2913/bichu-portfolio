// The night lot: asphalt with a faint gold grid, boundary barriers, light poles with fake light pools,
// and knockable cones laid out as slalom lines and drift circles.
import * as THREE from 'three';

export const ARENA = 90; // half-size of the drivable square (m)

const glowTexture = (inner = 'rgba(255,214,150,0.55)') => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, inner);
    grd.addColorStop(1, 'rgba(255,214,150,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
};

function asphaltTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#20232a';
    g.fillRect(0, 0, 256, 256);
    const img = g.getImageData(0, 0, 256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 18;
        img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(217,183,120,0.22)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set((ARENA * 2 + 60) / 10, (ARENA * 2 + 60) / 10); // one grid cell = 10 m
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export function createWorld(scene) {
    scene.background = new THREE.Color(0x07080a);
    scene.fog = new THREE.FogExp2(0x07080a, 0.0075);

    // lights
    scene.add(new THREE.HemisphereLight(0x9aa6c4, 0x2a2010, 1.15));
    const moon = new THREE.DirectionalLight(0xc8d4ff, 1.5);
    moon.position.set(-30, 50, -20);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    const sc = moon.shadow.camera;
    sc.left = -25; sc.right = 25; sc.top = 25; sc.bottom = -25; sc.near = 1; sc.far = 140;
    moon.shadow.bias = -0.0005;
    scene.add(moon, moon.target);

    // ground
    const size = ARENA * 2 + 60;
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.92, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // painted drift circle in the middle
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(13.8, 14, 96),
        new THREE.MeshBasicMaterial({ color: 0xd9b778, transparent: true, opacity: 0.6 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    // barriers along the edge
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.8 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd9b778, emissive: 0xd9b778, emissiveIntensity: 0.9 });
    const seg = 6;
    const count = Math.round((ARENA * 2) / seg) * 4;
    const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(seg - 0.2, 1.1, 0.8), barrierMat, count);
    const stripes = new THREE.InstancedMesh(new THREE.BoxGeometry(seg - 0.2, 0.08, 0.82), stripeMat, count);
    blocks.castShadow = true;
    blocks.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let k = 0;
    for (let side = 0; side < 4; side++) {
        for (let p = -ARENA + seg / 2; p < ARENA; p += seg) {
            const along = side % 2 === 0;
            const edge = side < 2 ? ARENA + 0.4 : -ARENA - 0.4;
            const x = along ? p : edge;
            const z = along ? edge : p;
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), along ? 0 : Math.PI / 2);
            m.compose(new THREE.Vector3(x, 0.55, z), q, new THREE.Vector3(1, 1, 1));
            blocks.setMatrixAt(k, m);
            m.compose(new THREE.Vector3(x, 1.0, z), q, new THREE.Vector3(1, 1, 1));
            stripes.setMatrixAt(k, m);
            k++;
        }
    }
    scene.add(blocks, stripes);

    // light poles with fake light pools on the ground
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.6 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xfff1d6, emissiveIntensity: 2.5 });
    const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 9, 8);
    const lampGeo = new THREE.BoxGeometry(1.2, 0.18, 0.5);
    const poolGeo = new THREE.PlaneGeometry(34, 34);
    for (let a = -ARENA + 15; a <= ARENA - 15; a += 30) {
        for (const [x, z] of [[a, ARENA + 3], [a, -ARENA - 3], [ARENA + 3, a], [-ARENA - 3, a]]) {
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(x, 4.5, z);
            pole.castShadow = true;
            const lamp = new THREE.Mesh(lampGeo, lampMat);
            lamp.position.set(x - Math.sign(x) * (Math.abs(x) > ARENA ? 1 : 0), 9, z - Math.sign(z) * (Math.abs(z) > ARENA ? 1 : 0));
            const pool = new THREE.Mesh(poolGeo, poolMat);
            pool.rotation.x = -Math.PI / 2;
            pool.position.set(x * 0.9, 0.02, z * 0.9);
            scene.add(pole, lamp, pool);
        }
    }

    // distant city glow on the horizon
    const sky = new THREE.Mesh(
        new THREE.CylinderGeometry(260, 260, 60, 48, 1, true),
        new THREE.MeshBasicMaterial({
            side: THREE.BackSide, transparent: true, depthWrite: false,
            map: (() => {
                const c = document.createElement('canvas');
                c.width = 4; c.height = 128;
                const g = c.getContext('2d');
                const grd = g.createLinearGradient(0, 0, 0, 128);
                grd.addColorStop(0, 'rgba(7,8,10,0)');
                grd.addColorStop(0.75, 'rgba(120,90,40,0.25)');
                grd.addColorStop(1, 'rgba(217,183,120,0.35)');
                g.fillStyle = grd;
                g.fillRect(0, 0, 4, 128);
                return new THREE.CanvasTexture(c);
            })(),
        }),
    );
    sky.position.y = 20;
    scene.add(sky);

    return { moon, cones: createCones(scene) };
}

/* ---------- Cones: knockable, they drift back to their spot after a while ---------- */
function createCones(scene) {
    const spots = [];
    // slalom lines
    for (let i = 0; i < 8; i++) spots.push([-45, -50 + i * 12], [45, 50 - i * 12]);
    // drift circle markers
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        spots.push([Math.cos(a) * 8, Math.sin(a) * 8]);
    }

    const geo = new THREE.ConeGeometry(0.32, 0.8, 12);
    geo.translate(0, 0.4, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0x401800, roughness: 0.6 });
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    mesh.castShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);

    const cones = spots.map(([x, z]) => ({ hx: x, hz: z, x, z, vx: 0, vz: 0, tilt: 0, tiltAxis: 0, knocked: 0 }));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);

    const sync = () => {
        cones.forEach((c, i) => {
            axis.set(Math.cos(c.tiltAxis), 0, Math.sin(c.tiltAxis));
            q.setFromAxisAngle(axis, c.tilt);
            pos.set(c.x, 0, c.z);
            m.compose(pos, q, one);
            mesh.setMatrixAt(i, m);
        });
        mesh.instanceMatrix.needsUpdate = true;
    };
    sync();

    return {
        list: cones,
        // returns number of cones hit this step
        update(dt, car) {
            let hits = 0;
            for (const c of cones) {
                const dx = c.x - car.x;
                const dz = c.z - car.z;
                const d = Math.hypot(dx, dz);
                if (d < 1.7 && car.speed > 1.5) {
                    const nx = dx / (d || 1);
                    const nz = dz / (d || 1);
                    c.vx = car.vx * 0.9 + nx * car.speed * 0.4;
                    c.vz = car.vz * 0.9 + nz * car.speed * 0.4;
                    c.tiltAxis = Math.atan2(-c.vx, c.vz);
                    if (!c.knocked) hits++;
                    c.knocked = 6; // seconds until it returns
                }
                if (c.knocked > 0) {
                    c.x += c.vx * dt;
                    c.z += c.vz * dt;
                    c.vx *= 1 - 2.2 * dt;
                    c.vz *= 1 - 2.2 * dt;
                    c.tilt = Math.min(Math.PI / 2, c.tilt + Math.hypot(c.vx, c.vz) * dt * 1.5);
                    c.knocked -= dt;
                } else if (c.tilt > 0 || c.x !== c.hx) {
                    // glide back home
                    c.x += (c.hx - c.x) * Math.min(1, 3 * dt);
                    c.z += (c.hz - c.z) * Math.min(1, 3 * dt);
                    c.tilt = Math.max(0, c.tilt - 3 * dt);
                    if (Math.abs(c.x - c.hx) < 0.01 && Math.abs(c.z - c.hz) < 0.01) { c.x = c.hx; c.z = c.hz; }
                }
            }
            sync();
            return hits;
        },
    };
}
