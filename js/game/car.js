// Original 90s-style drift coupé: long hood, fastback roof, wide flares, slim green headlights,
// deep-dish cyan wheels and a GT wing. Purple paint with a blue sheen.
// Body and glasshouse are extruded from side profiles so the silhouette reads like a real car.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const WIDTH = 1.84;

// Side profile (x = along the car, front is +x) → extruded across the width, centred.
function extrudeProfile(points, depth, bevel, arches = []) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        const p = points[i];
        if (p === 'arches') {
            // bottom edge, front to rear, with wheel-arch cut-outs centred on the axle height
            for (const [cx, r, y, cy] of arches) {
                shape.lineTo(cx + r, y);
                shape.lineTo(cx + r, cy);
                shape.absarc(cx, cy, r, 0, Math.PI, false);
                shape.lineTo(cx - r, y);
            }
            continue;
        }
        shape.lineTo(p[0], p[1]);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: depth - bevel * 2,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 5,
        curveSegments: 18,
    });
    geo.rotateY(-Math.PI / 2);            // profile x → world z (forward), extrusion → world x
    geo.translate((depth - bevel * 2) / 2, 0, 0);
    geo.computeVertexNormals();
    return geo;
}

export function createCar(renderer) {
    const car = new THREE.Group();
    const body = new THREE.Group(); // rolls/pitches on its suspension
    car.add(body);

    // reflections for the paint and glass only (the night scene itself stays dark)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const paint = new THREE.MeshPhysicalMaterial({
        color: 0x6a2c9e, metalness: 0.55, roughness: 0.28,
        clearcoat: 1, clearcoatRoughness: 0.06,
        iridescence: 0.55, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 600], // purple → blue sheen
        envMap: env, envMapIntensity: 1.1,
    });
    const glass = new THREE.MeshPhysicalMaterial({
        color: 0x0b1020, metalness: 0.1, roughness: 0.04, clearcoat: 1, envMap: env, envMapIntensity: 1.6,
    });
    const black = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.55, metalness: 0.2, envMap: env, envMapIntensity: 0.4 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xbfc6d6, metalness: 1, roughness: 0.2, envMap: env });
    const cyan = new THREE.MeshStandardMaterial({
        color: 0x2fd6e6, metalness: 0.9, roughness: 0.25, emissive: 0x0b4a52, emissiveIntensity: 0.6, envMap: env,
    });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x1aff6a, emissive: 0x22ff66, emissiveIntensity: 1.6, toneMapped: false });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x400010, emissive: 0xff1f4b, emissiveIntensity: 1.4 });
    const amber = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff9a1f, emissiveIntensity: 1.4 });

    const add = (geo, mat, x = 0, y = 0, z = 0, parent = body) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        parent.add(m);
        return m;
    };

    // ---- main body: low nose, long hood, belt line, short deck
    const WR = 0.41;              // wheel-arch radius
    const FA = 1.36;              // axle offset
    const WY = 0.36;              // axle height = tyre radius
    const bodyGeo = extrudeProfile([
        [-2.22, 0.24],                        // rear bottom
        [-2.3, 0.42], [-2.3, 0.74],           // rear face
        [-2.18, 0.86], [-1.62, 0.9],          // decklid
        [0.72, 0.88],                         // belt line / cowl
        [1.6, 0.8], [2.12, 0.7],              // hood sloping to the nose
        [2.3, 0.56], [2.34, 0.36],            // front face
        [2.22, 0.24],                         // front bottom
        'arches',
    ], WIDTH, 0.09, [[FA, WR, 0.24, WY], [-FA, WR, 0.24, WY]]);
    add(bodyGeo, paint);

    // ---- glasshouse (fastback) + painted roof and pillars
    add(extrudeProfile([
        [0.72, 0.88], [-0.12, 1.25], [-0.82, 1.28], [-1.7, 0.93], [-1.6, 0.89],
    ], WIDTH - 0.3, 0.07), glass);
    add(new RoundedBoxGeometry(WIDTH - 0.3, 0.05, 0.8, 3, 0.02), paint, 0, 1.355, -0.47);
    for (const s of [1, -1]) {
        const pillar = add(new THREE.BoxGeometry(0.05, 0.06, 1.0), paint, s * 0.785, 1.1, 0.3);
        pillar.rotation.x = -0.5;                 // A-pillar along the windscreen
        const mirror = add(new RoundedBoxGeometry(0.2, 0.1, 0.14, 2, 0.03), paint, s * 1.0, 0.98, 0.58);
        mirror.rotation.y = s * 0.2;
    }

    // ---- wide fender flares
    const flareGeo = new THREE.TorusGeometry(WR + 0.03, 0.07, 8, 28, Math.PI);
    flareGeo.rotateY(Math.PI / 2);
    for (const z of [FA, -FA]) for (const s of [1, -1]) add(flareGeo, paint, s * (WIDTH / 2 + 0.01), WY, z);

    // ---- front: slim green lights, grille, intake, splitter, fog lights
    for (const s of [1, -1]) {
        add(new RoundedBoxGeometry(0.48, 0.1, 0.08, 2, 0.03), black, s * 0.6, 0.6, 2.36);
        add(new THREE.BoxGeometry(0.42, 0.055, 0.04), headMat, s * 0.6, 0.6, 2.405);
        add(new THREE.BoxGeometry(0.13, 0.06, 0.03), amber, s * 0.74, 0.4, 2.45);
        // side vent behind the front wheel
        add(new THREE.BoxGeometry(0.02, 0.1, 0.32), black, s * (WIDTH / 2 + 0.02), 0.55, 0.62);
    }
    add(new THREE.BoxGeometry(0.62, 0.07, 0.04), black, 0, 0.6, 2.39);          // grille slot
    add(new RoundedBoxGeometry(1.1, 0.15, 0.06, 2, 0.03), black, 0, 0.4, 2.44); // lower intake
    add(new THREE.BoxGeometry(WIDTH + 0.06, 0.04, 0.26), black, 0, 0.17, 2.38);  // splitter
    const hoodVent = add(new THREE.BoxGeometry(0.5, 0.02, 0.3), black, 0, 0.925, 1.25);
    hoodVent.rotation.x = 0.12;

    // ---- side skirts
    for (const s of [1, -1]) add(new THREE.BoxGeometry(0.06, 0.08, 1.7), black, s * (WIDTH / 2 + 0.02), 0.27, 0);

    // ---- rear: full-width light bar, diffuser, exhausts, GT wing
    add(new THREE.BoxGeometry(WIDTH - 0.2, 0.09, 0.04), tailMat, 0, 0.72, -2.41);
    add(new THREE.BoxGeometry(WIDTH - 0.3, 0.13, 0.2), black, 0, 0.3, -2.36);
    for (const s of [1, -1]) {
        const ex = add(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 14), chrome, s * 0.55, 0.28, -2.44);
        ex.rotation.x = Math.PI / 2;
        add(new THREE.BoxGeometry(0.05, 0.3, 0.12), black, s * 0.62, 1.02, -2.0); // wing stalks
    }
    const wing = add(new RoundedBoxGeometry(WIDTH + 0.08, 0.05, 0.38, 2, 0.02), paint, 0, 1.18, -2.02);
    wing.rotation.x = -0.06;
    for (const s of [1, -1]) add(new THREE.BoxGeometry(0.03, 0.18, 0.4), paint, s * (WIDTH / 2 + 0.06), 1.16, -2.02);

    // ---- headlight beam (one spot, cheaper than two), slightly green-white
    const beam = new THREE.SpotLight(0xe9ffef, 70, 40, 0.55, 0.6, 1.4);
    beam.position.set(0, 0.62, 2.1);
    beam.target.position.set(0, 0, 14);
    body.add(beam, beam.target);

    // ---- neon underglow (fake light pool, no real light): purple → cyan
    const glowTex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grd.addColorStop(0, 'rgba(170,90,255,0.8)');
        grd.addColorStop(0.55, 'rgba(60,200,255,0.25)');
        grd.addColorStop(1, 'rgba(60,200,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(c);
    })();
    const under = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 6.2),
        new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }),
    );
    under.rotation.x = -Math.PI / 2;
    under.position.y = 0.02;
    car.add(under);

    // ---- wheels: tyre with sidewall, deep-dish cyan rim with spokes, brake disc
    const tyreGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 32);
    tyreGeo.rotateZ(Math.PI / 2);
    const sidewall = new THREE.TorusGeometry(0.31, 0.05, 8, 32);
    sidewall.rotateY(Math.PI / 2);
    const lipGeo = new THREE.TorusGeometry(0.255, 0.022, 8, 32);
    lipGeo.rotateY(Math.PI / 2);
    const dishGeo = new THREE.CylinderGeometry(0.255, 0.255, 0.06, 28);
    dishGeo.rotateZ(Math.PI / 2);
    const spokeGeo = new THREE.BoxGeometry(0.04, 0.4, 0.06);
    const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12);
    hubGeo.rotateZ(Math.PI / 2);
    const discGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.03, 24);
    discGeo.rotateZ(Math.PI / 2);
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.92 });
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x0a2a30, metalness: 0.6, roughness: 0.4 });

    const wheels = [];
    for (const [x, z, front] of [[0.86, FA, true], [-0.86, FA, true], [0.86, -FA, false], [-0.86, -FA, false]]) {
        const side = Math.sign(x);
        const pivot = new THREE.Group(); // steering
        pivot.position.set(x, WY, z);
        const spin = new THREE.Group();  // rolling
        const tyre = new THREE.Mesh(tyreGeo, tyreMat);
        tyre.castShadow = true;
        const wall = new THREE.Mesh(sidewall, tyreMat);
        wall.position.x = side * 0.14;
        const lip = new THREE.Mesh(lipGeo, cyan);
        lip.position.x = side * 0.15;
        const dish = new THREE.Mesh(dishGeo, dishMat);
        dish.position.x = side * 0.09;           // deep dish: face sits inside the lip
        spin.add(tyre, wall, lip, dish);
        for (let i = 0; i < 5; i++) {
            const spoke = new THREE.Mesh(spokeGeo, cyan);
            spoke.position.x = side * 0.12;
            spoke.rotation.x = (i / 5) * Math.PI;
            spin.add(spoke);
        }
        const hub = new THREE.Mesh(hubGeo, chrome);
        hub.position.x = side * 0.14;
        spin.add(hub);
        const disc = new THREE.Mesh(discGeo, chrome);
        disc.position.x = side * 0.02;
        pivot.add(spin, disc);
        car.add(pivot);
        wheels.push({ pivot, spin, front, x, z });
    }

    return { car, body, wheels, tailMat, beam, under };
}
