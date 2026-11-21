// Tyre marks (instanced quads in a ring buffer) and tyre smoke (pooled sprites).
import * as THREE from 'three';

export function createSkids(scene, max = 2400) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x050505, transparent: true, opacity: 0.6, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    scene.add(mesh);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    let next = 0;
    const last = new Map(); // wheel id -> last point

    return {
        // add a mark segment for wheel `id` at (x, z); call with active=false to lift the pen
        mark(id, x, z, active) {
            const prev = last.get(id);
            if (!active) { last.delete(id); return; }
            if (prev) {
                const dx = x - prev.x;
                const dz = z - prev.z;
                const len = Math.hypot(dx, dz);
                if (len < 0.12) return;
                if (len < 3) {
                    q.setFromAxisAngle(up, Math.atan2(dx, dz));
                    pos.set((x + prev.x) / 2, 0.015, (z + prev.z) / 2);
                    scale.set(0.26, 1, len + 0.05);
                    m.compose(pos, q, scale);
                    mesh.setMatrixAt(next, m);
                    next = (next + 1) % max;
                    mesh.count = Math.min(max, mesh.count + 1);
                    mesh.instanceMatrix.needsUpdate = true;
                }
            }
            last.set(id, { x, z });
        },
        clear() { mesh.count = 0; next = 0; last.clear(); },
        mesh,
    };
}

export function createSmoke(scene, max = 90) {
    const tex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, 'rgba(220,215,205,0.55)');
        grd.addColorStop(1, 'rgba(220,215,205,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
    })();

    const pool = Array.from({ length: max }, () => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
        s.visible = false;
        scene.add(s);
        return { s, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, size: 1 };
    });
    let next = 0;

    return {
        sprites: pool.map((p) => p.s),
        emit(x, z, vx, vz, strength = 1) {
            const p = pool[next];
            next = (next + 1) % max;
            p.life = p.maxLife = 1.1 + Math.random() * 0.8;
            p.s.position.set(x + (Math.random() - 0.5) * 0.3, 0.35, z + (Math.random() - 0.5) * 0.3);
            p.vx = vx * 0.15 + (Math.random() - 0.5) * 0.8;
            p.vz = vz * 0.15 + (Math.random() - 0.5) * 0.8;
            p.vy = 0.5 + Math.random() * 0.6;
            p.size = 0.9 + strength * 0.6;
            p.s.visible = true;
        },
        update(dt) {
            for (const p of pool) {
                if (p.life <= 0) continue;
                p.life -= dt;
                const t = 1 - p.life / p.maxLife;
                p.s.position.x += p.vx * dt;
                p.s.position.y += p.vy * dt;
                p.s.position.z += p.vz * dt;
                const sz = p.size * (1 + t * 3.5);
                p.s.scale.set(sz, sz, 1);
                // keep the puff above the ground so it never gets cut off flat
                p.s.position.y = Math.max(p.s.position.y, sz * 0.42);
                p.s.material.opacity = Math.max(0, 0.55 * (1 - t) * Math.min(1, t * 6));
                if (p.life <= 0) p.s.visible = false;
            }
        },
    };
}
