// The 3D "technology core" in the Services intro: a faceted gold core with four orbiting
// discipline nodes (Apps, AI, Backend, Design), linked by pulsing beams, inside a field of gold dust.
// Loaded on demand by js/services.js; renders only while visible.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

export function mountCore(box, { reduceMotion = false, finePointer = false } = {}) {
    const canvas = box.querySelector('canvas');
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
        box.classList.add('no-webgl');
        return;
    }
    const mobile = matchMedia('(max-width: 767px)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    const GOLD = new THREE.Color('#d9b778');
    const LIGHT = new THREE.Color('#f3dfae');
    const rig = new THREE.Group();
    scene.add(rig);

    // --- Core: wire icosahedron around a softly glowing faceted heart
    const coreWire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.35, 1)),
        new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.85 }),
    );
    const heart = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.82, 0),
        new THREE.MeshBasicMaterial({ color: LIGHT, transparent: true, opacity: 0.16, wireframe: false }),
    );
    const heartEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.82, 0)),
        new THREE.LineBasicMaterial({ color: LIGHT, transparent: true, opacity: 0.9 }),
    );
    rig.add(coreWire, heart, heartEdges);

    // soft glow sprite behind the core
    const glowTex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(243,223,174,0.55)');
        grad.addColorStop(0.4, 'rgba(217,183,120,0.18)');
        grad.addColorStop(1, 'rgba(217,183,120,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(c);
    })();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(6.5, 6.5, 1);
    rig.add(glow);

    // --- Orbits with discipline nodes
    const orbits = [
        { r: 2.5, tilt: [1.2, 0, 0.3], speed: 0.32, phase: 0 },
        { r: 2.9, tilt: [0.4, 0, -0.9], speed: -0.24, phase: 1.6 },
        { r: 2.25, tilt: [-0.9, 0, 1.1], speed: 0.4, phase: 3.1 },
        { r: 3.2, tilt: [1.7, 0, -0.2], speed: -0.18, phase: 4.4 },
    ].map((o) => {
        const g = new THREE.Group();
        g.rotation.set(...o.tilt);
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(o.r, 0.006, 6, 160),
            new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.35 }),
        );
        const node = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.16, 0),
            new THREE.MeshBasicMaterial({ color: LIGHT }),
        );
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.scale.set(1.1, 1.1, 1);
        node.add(halo);
        g.add(ring, node);
        rig.add(g);
        return { ...o, group: g, node };
    });

    // beams from core to each node (updated per frame)
    const beamGeo = new THREE.BufferGeometry();
    const beamPos = new Float32Array(orbits.length * 6);
    beamGeo.setAttribute('position', new THREE.BufferAttribute(beamPos, 3));
    const beamMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.25 });
    const beams = new THREE.LineSegments(beamGeo, beamMat);
    scene.add(beams);

    // --- Gold dust
    const DUST = mobile ? 160 : 320;
    const dustPos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
        const r = 3.4 + Math.random() * 2.6;
        const t = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        dustPos.set([r * Math.sin(ph) * Math.cos(t), r * Math.cos(ph) * 0.75, r * Math.sin(ph) * Math.sin(t)], i * 3);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
        color: GOLD, size: 0.035, transparent: true, opacity: 0.75, depthWrite: false,
    }));
    scene.add(dust);

    // --- Sizing
    let running = false;
    const resize = () => {
        const { width, height } = box.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        if (!running) frame(performance.now(), true);
    };

    // --- Pointer parallax
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    if (finePointer) {
        addEventListener('pointermove', (e) => {
            pointer.tx = (e.clientX / innerWidth - 0.5) * 2;
            pointer.ty = (e.clientY / innerHeight - 0.5) * 2;
        }, { passive: true });
    }

    const tmp = new THREE.Vector3();
    let last = performance.now();
    let t = 0;
    function frame(now, once = false) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (!reduceMotion) t += dt;

        pointer.x += (pointer.tx - pointer.x) * 0.05;
        pointer.y += (pointer.ty - pointer.y) * 0.05;

        coreWire.rotation.set(t * 0.18, t * 0.26, 0);
        heart.rotation.set(-t * 0.3, -t * 0.22, 0);
        heartEdges.rotation.copy(heart.rotation);
        const pulse = 1 + Math.sin(t * 2) * 0.04;
        heart.scale.setScalar(pulse);
        heartEdges.scale.setScalar(pulse);
        glow.material.opacity = 0.85 + Math.sin(t * 2) * 0.15;

        orbits.forEach((o, i) => {
            const a = o.phase + t * o.speed;
            o.node.position.set(Math.cos(a) * o.r, Math.sin(a) * o.r, 0);
            o.node.rotation.set(t, t * 1.3, 0);
            o.node.getWorldPosition(tmp);
            beamPos.set([0, 0, 0, tmp.x, tmp.y, tmp.z], i * 6);
        });
        beamGeo.attributes.position.needsUpdate = true;
        beamMat.opacity = 0.18 + (Math.sin(t * 3) * 0.5 + 0.5) * 0.22;

        rig.rotation.y = pointer.x * 0.45 + Math.sin(t * 0.2) * 0.15;
        rig.rotation.x = pointer.y * 0.3;
        dust.rotation.y = t * 0.03 + pointer.x * 0.15;
        dust.rotation.x = pointer.y * 0.08;

        renderer.render(scene, camera);
        if (!once && running) requestAnimationFrame(frame);
    }

    const setRunning = (on) => {
        if (reduceMotion || on === running) return;
        running = on;
        if (on) { last = performance.now(); requestAnimationFrame(frame); }
    };

    new ResizeObserver(resize).observe(box);
    resize();
    box.classList.add('is-ready');

    let visible = false;
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        setRunning(visible && !document.hidden);
    }).observe(box);
    document.addEventListener('visibilitychange', () => setRunning(visible && !document.hidden));
}
