// Original low-poly sports car built from primitives: black body, gold trim, glowing lights.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createCar() {
    const car = new THREE.Group();
    const body = new THREE.Group(); // rolls/pitches on its suspension
    car.add(body);

    const paint = new THREE.MeshPhysicalMaterial({
        color: 0x0c0d10, metalness: 0.6, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12,
    });
    const gold = new THREE.MeshStandardMaterial({
        color: 0xd9b778, metalness: 1, roughness: 0.25, emissive: 0x6a4e1e, emissiveIntensity: 0.35,
    });
    const glass = new THREE.MeshPhysicalMaterial({
        color: 0x0a0c10, metalness: 0.2, roughness: 0.05, transmission: 0, clearcoat: 1,
    });
    const trim = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.7 });

    const add = (geo, mat, x, y, z, parent = body) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        parent.add(m);
        return m;
    };

    // lower body + wedge nose
    add(new RoundedBoxGeometry(1.92, 0.5, 4.3, 4, 0.14), paint, 0, 0.58, 0);
    const nose = add(new RoundedBoxGeometry(1.86, 0.28, 1.3, 4, 0.12), paint, 0, 0.84, 1.35);
    nose.rotation.x = 0.12;
    // cabin
    const cabin = add(new RoundedBoxGeometry(1.56, 0.5, 1.95, 4, 0.2), glass, 0, 1.05, -0.25);
    cabin.scale.set(1, 1, 1);
    add(new RoundedBoxGeometry(1.6, 0.08, 1.5, 2, 0.04), paint, 0, 1.31, -0.3); // roof
    // gold side stripes
    add(new THREE.BoxGeometry(0.02, 0.06, 3.6), gold, 0.97, 0.66, 0);
    add(new THREE.BoxGeometry(0.02, 0.06, 3.6), gold, -0.97, 0.66, 0);
    // front splitter + rear diffuser
    add(new THREE.BoxGeometry(1.9, 0.06, 0.3), trim, 0, 0.36, 2.12);
    add(new THREE.BoxGeometry(1.7, 0.12, 0.25), trim, 0, 0.4, -2.12);
    // spoiler
    add(new THREE.BoxGeometry(1.8, 0.06, 0.42), paint, 0, 1.2, -1.95);
    add(new THREE.BoxGeometry(1.82, 0.02, 0.06), gold, 0, 1.235, -1.76);
    add(new THREE.BoxGeometry(0.08, 0.32, 0.12), trim, 0.6, 1.02, -1.95);
    add(new THREE.BoxGeometry(0.08, 0.32, 0.12), trim, -0.6, 1.02, -1.95);

    // lights
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d6, emissiveIntensity: 3 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2a1a, emissiveIntensity: 1.2 });
    add(new THREE.BoxGeometry(0.5, 0.08, 0.06), headMat, 0.6, 0.78, 2.16);
    add(new THREE.BoxGeometry(0.5, 0.08, 0.06), headMat, -0.6, 0.78, 2.16);
    add(new THREE.BoxGeometry(1.6, 0.07, 0.05), tailMat, 0, 0.82, -2.16);

    // headlight beam (one spot, cheaper than two)
    const beam = new THREE.SpotLight(0xfff1d6, 60, 38, 0.55, 0.6, 1.4);
    beam.position.set(0, 0.8, 2.0);
    beam.target.position.set(0, 0, 14);
    body.add(beam, beam.target);

    // gold underglow (fake light pool, no real light)
    const glowTex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grd.addColorStop(0, 'rgba(255,214,140,0.85)');
        grd.addColorStop(0.5, 'rgba(217,170,90,0.25)');
        grd.addColorStop(1, 'rgba(217,170,90,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(c);
    })();
    const under = new THREE.Mesh(
        new THREE.PlaneGeometry(3.6, 6),
        new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }),
    );
    under.rotation.x = -Math.PI / 2;
    under.position.y = 0.02;
    car.add(under);

    // wheels
    const tyreGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 24);
    tyreGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.32, 10);
    rimGeo.rotateZ(Math.PI / 2);
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    const wheels = [];
    for (const [x, z, front] of [[0.88, 1.36, true], [-0.88, 1.36, true], [0.88, -1.36, false], [-0.88, -1.36, false]]) {
        const pivot = new THREE.Group(); // steering
        pivot.position.set(x, 0.36, z);
        const spin = new THREE.Group();  // rolling
        const tyre = new THREE.Mesh(tyreGeo, tyreMat);
        const rim = new THREE.Mesh(rimGeo, gold);
        tyre.castShadow = true;
        spin.add(tyre, rim);
        pivot.add(spin);
        car.add(pivot);
        wheels.push({ pivot, spin, front, x, z });
    }

    return { car, body, wheels, tailMat, beam, under };
}
