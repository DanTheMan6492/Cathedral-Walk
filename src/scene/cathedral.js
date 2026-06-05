import * as THREE from 'three';

//dimension

const NAVE_LENGTH = 82;
const NAVE_WIDTH = 16;
const AISLE_WIDTH = 5.2;
const WALL_HEIGHT = 23;
const COL_SPACING = 6;
const COL_RADIUS = 0.45;
const COL_HEIGHT = 14;
const VAULT_Y = 22.5;

//material

const matFloor = new THREE.MeshPhongMaterial({ color: 0x9c968a, shininess: 80, specular: 0x333333 });
const matAisle = new THREE.MeshPhongMaterial({ color: 0xd9c79a, shininess: 110, specular: 0x555555 });
// const matAisleOld = new THREE.MeshPhongMaterial({ color: 0xb4a070, shininess: 40 });
// too brown
const matWall = new THREE.MeshPhongMaterial({ color: 0xc7c0b2, shininess: 18 });
const matPillar = new THREE.MeshPhongMaterial({ color: 0xddd7c9, shininess: 28 });
const matVault = new THREE.MeshPhongMaterial({ color: 0xb6afa0, shininess: 14, side: THREE.DoubleSide });
const matRib    = new THREE.MeshPhongMaterial({ color: 0x8f8679, shininess: 30 });
const matJoint  = new THREE.MeshPhongMaterial({ color: 0x6f675d, shininess: 8 });
const matGold   = new THREE.MeshPhongMaterial({ color: 0xd8b452, shininess: 160, specular: 0xffffff });
// const matGold = new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 250, specular: 0xffffff });
const matWood = new THREE.MeshPhongMaterial({ color: 0x5a3b2b, shininess: 32 });
const matAltar = new THREE.MeshPhongMaterial({ color: 0xf0dfb4, shininess: 120, specular: 0x777777 });
const matStatue = new THREE.MeshPhongMaterial({ color: 0xe2ded4, shininess: 36, specular: 0x444444 });
const matCarpet = new THREE.MeshPhongMaterial({ color: 0x7b1f2a, shininess: 36, specular: 0x331111 });
const matGlassB = glassMaterial(0x2e61ff, 0x18327d); // royal blue
const matGlassR = glassMaterial(0xe0443e, 0x651814); // ruby
const matGlassA = glassMaterial(0xf0ba3f, 0x6b4510); // amber
const matGlassG = glassMaterial(0x3fc18b, 0x164f37); // emerald
const matLead   = new THREE.MeshPhongMaterial({ color: 0x151413, shininess: 75, specular: 0x4a4740 });
const matRecess = new THREE.MeshPhongMaterial({ color: 0x746d63, shininess: 10 });
// const matDebugWire = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true }); used while debugging the rose window alignment. dont need it now.

function glassMaterial(color, emissive) {
    const material = new THREE.MeshPhongMaterial({
        color,
        emissive,
        emissiveIntensity: 0.58,
        shininess: 180,
        specular: 0xffffff,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    material.userData.rayType = 2;
    return material;
}

function finishMesh(group, mesh, name) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (name) mesh.name = name;
    group.add(mesh);
    return mesh;
}

// function _dbgDot(group, x, y, z, color = 0xff00ff) {
//     const m = new THREE.Mesh(
//         new THREE.BoxGeometry(0.25, 0.25, 0.25),
//         new THREE.MeshBasicMaterial({ color }),
//     );
//     m.position.set(x, y, z);
//     group.add(m);
//     return m;
// }
//
// usage example (from when the rose was off by 0.2m in z):
//   _dbgDot(group, halfLen - 0.46, 15.9, 0, 0xff0000);
//   _dbgDot(group, halfLen - 0.22, 15.9, 0, 0x00ff00); 
//
// function _dbgAxes(group, x, y, z, len = 1.0) {
//     addBox(group, len, 0.04, 0.04, x + len/2, y, z, new THREE.MeshBasicMaterial({color:0xff0000}));
//     addBox(group, 0.04, len, 0.04, x, y + len/2, z, new THREE.MeshBasicMaterial({color:0x00ff00}));
//     addBox(group, 0.04, 0.04, len, x, y, z + len/2, new THREE.MeshBasicMaterial({color:0x0000ff}));
// }

function addBox(group, w, h, d, x, y, z, material, name, rotation = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    return finishMesh(group, mesh, name);
}

function addCylinder(group, rTop, rBottom, h, x, y, z, material, segments = 24, name = null) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
    mesh.position.set(x, y, z);
    return finishMesh(group, mesh, name);
}

function addCone(group, r, h, x, y, z, material, segments = 16, name = null) {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, segments), material);
    mesh.position.set(x, y, z);
    return finishMesh(group, mesh, name);
}

function addSphere(group, r, x, y, z, material, segments = 16, name = null) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, segments, Math.max(8, segments / 2)), material);
    mesh.position.set(x, y, z);
    return finishMesh(group, mesh, name);
}

function addPlane(group, w, h, x, y, z, material, name = null, rotation = null) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    return finishMesh(group, mesh, name);
}

function addGlassSlab(group, w, h, x, y, z, material, name = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.055), material);
    mesh.position.set(x, y, z);
    return finishMesh(group, mesh, name);
}

function addLeadFrame(group, w, h, x, y, z, name = 'window-lead') {
    addBox(group, w + 0.12, 0.075, 0.12, x, y - h * 0.5, z, matLead, name);
    addBox(group, w + 0.12, 0.075, 0.12, x, y + h * 0.5, z, matLead, name);
    addBox(group, 0.075, h + 0.12, 0.12, x - w * 0.5, y, z, matLead, name);
    addBox(group, 0.075, h + 0.12, 0.12, x + w * 0.5, y, z, matLead, name);
}

function addTorus(group, radius, tube, x, y, z, material, name = null, rotation = null) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 48), material);
    mesh.position.set(x, y, z);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    return finishMesh(group, mesh, name);
}

function addQuad(group, a, b, c, d, material, name = null) {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        a.x, a.y, a.z,
        b.x, b.y, b.z,
        c.x, c.y, c.z,
        a.x, a.y, a.z,
        c.x, c.y, c.z,
        d.x, d.y, d.z,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return finishMesh(group, new THREE.Mesh(geometry, material), name);
}

function addBeam(group, a, b, radius, material, segments = 10, name = null) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, segments), material);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return finishMesh(group, mesh, name);
}

function addTube(group, points, radius, material, name = null) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const tubularSegments = Math.max(14, points.length - 1);
    const radialSegments = radius < 0.1 ? 5 : 6;
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments), material);
    return finishMesh(group, mesh, name);
}

function archPoints(a, apex, b) {
    const left = new THREE.QuadraticBezierCurve3(
        a,
        new THREE.Vector3((a.x + apex.x) * 0.5, apex.y, (a.z + apex.z) * 0.5),
        apex
    );
    const right = new THREE.QuadraticBezierCurve3(
        apex,
        new THREE.Vector3((b.x + apex.x) * 0.5, apex.y, (b.z + apex.z) * 0.5),
        b
    );
    return left.getPoints(7).concat(right.getPoints(7).slice(1));
}

function addPointedArch(group, a, apex, b, radius, material, name = null) {
    return addTube(group, archPoints(a, apex, b), radius, material, name);
}

function addClusteredColumn(group, x, z) {
    //addCylinder(group, COL_RADIUS, COL_RADIUS, COL_HEIGHT, x, COL_HEIGHT/2, z, matPillar);
    //addBox(group, 1.4, 0.4, 1.4, x, COL_HEIGHT + 0.2, z, matRib);


    addBox(group, 1.7, 0.35, 1.7, x, 0.18, z, matRib);
    addCylinder(group, COL_RADIUS, COL_RADIUS * 1.05, COL_HEIGHT, x, COL_HEIGHT * 0.5, z, matPillar, 32);

    const offsets = [
        [0.52, 0], [-0.52, 0], [0, 0.52], [0, -0.52],
        // [0.37, 0.37], [-0.37, 0.37], [0.37, -0.37], [-0.37, -0.37],
    ];
    for (const [dx, dz] of offsets) {
        addCylinder(group, 0.13, 0.15, COL_HEIGHT * 0.96, x + dx, COL_HEIGHT * 0.5, z + dz, matPillar, 12);
    }

    // capital. astragal + abacus + impost (had to google these terms lol)
    addCylinder(group, 0.82, 0.82, 0.28, x, COL_HEIGHT + 0.14, z, matRib, 24);
    addBox(group, 1.55, 0.42, 1.55, x, COL_HEIGHT + 0.42, z, matRib);
    addCylinder(group, 0.78, 0.92, 0.55, x, COL_HEIGHT + 0.84, z, matPillar, 24);
}

function addArcade(group, xs, halfNav) {
    for (const x of xs) {
        addClusteredColumn(group, x, -halfNav);
        addClusteredColumn(group, x,  halfNav);
    }

    for (let i = 0; i < xs.length - 1; i++) {
        const x0 = xs[i];
        const x1 = xs[i + 1];
        const xm = (x0 + x1) * 0.5;
        for (const side of [-1, 1]) {
            const z = side * halfNav;
            addPointedArch(
                group,
                new THREE.Vector3(x0 + 0.25, COL_HEIGHT + 0.55, z),
                new THREE.Vector3(xm, COL_HEIGHT + 4.1, z),
                new THREE.Vector3(x1 - 0.25, COL_HEIGHT + 0.55, z),
                0.23,
                matRib
            );
            addPointedArch(
                group,
                new THREE.Vector3(x0 + 0.45, COL_HEIGHT + 0.15, z),
                new THREE.Vector3(xm, COL_HEIGHT + 3.2, z),
                new THREE.Vector3(x1 - 0.45, COL_HEIGHT + 0.15, z),
                0.08,
                matPillar
            );
        }
    }
}

function addMasonryCoursing(group, z, side, xs) {
    // fake mortar lines on the wall surface. very thin dark boxes, just enough
    // to break up the flat stone color. you only really see them up close.
    // tried to do it with a texture first but the bake script kept washing out
    // the joints. boxes were faster to get working.
    const faceZ = z - side * 0.42;

    for (let y = 1.2; y < WALL_HEIGHT - 1.0; y += 1.28) {
        addBox(group, NAVE_LENGTH - 3.0, 0.045, 0.08, 0, y, faceZ, matJoint);
    }

    for (let i = 0; i < xs.length - 1; i++) {
        const x0 = xs[i];
        const x1 = xs[i + 1];
        for (let y = 1.8; y < WALL_HEIGHT - 1.6; y += 2.56) {
            const stagger = ((Math.floor(y * 10) + i) % 2) * 1.45; // pseudo random but deterministic
            addBox(group, 0.055, 0.72, 0.09, x0 + 1.25 + stagger, y, faceZ, matJoint);
            addBox(group, 0.055, 0.72, 0.09, x1 - 1.25 - stagger * 0.55, y + 1.12, faceZ, matJoint);
        }
    }
}

function addWindowTracery(group, xm, bayW, baseY, glassH, z, side, colorSet, label) {
    const glassZ = z - side * 0.39;
    const leadZ = z - side * 0.52;
    const paneW = bayW * 0.24;
    const paneH = glassH * 0.31;
    const lowerY = baseY + glassH * 0.24;
    const midY = baseY + glassH * 0.58;
    const topY = baseY + glassH * 0.86;

    for (let col = -1; col <= 1; col++) {
        const x = xm + col * bayW * 0.21;
        addGlassSlab(group, paneW, paneH, x, lowerY, glassZ, colorSet[(col + 4) % colorSet.length], label);
        addLeadFrame(group, paneW, paneH, x, lowerY, leadZ);

        addGlassSlab(group, paneW * 0.9, paneH * 0.78, x, midY, glassZ - side * 0.015, colorSet[(col + 5) % colorSet.length], label);
        addLeadFrame(group, paneW * 0.9, paneH * 0.78, x, midY, leadZ);

        addGlassSlab(group, paneW * 0.72, paneH * 0.58, x, topY - glassH * 0.035, glassZ - side * 0.025, colorSet[(col + 6) % colorSet.length], label);
        addLeadFrame(group, paneW * 0.72, paneH * 0.58, x, topY - glassH * 0.035, leadZ);
    }

    addBox(group, 0.1, glassH * 0.86, 0.14, xm, baseY + glassH * 0.49, leadZ, matLead, `${label}-center-lead`);
    addBox(group, bayW * 0.82, 0.11, 0.15, xm, lowerY + paneH * 0.52, leadZ, matLead, `${label}-transom`);
    addBox(group, bayW * 0.76, 0.11, 0.15, xm, midY + paneH * 0.4, leadZ, matLead, `${label}-transom`);
    addTorus(group, bayW * 0.12, 0.045, xm - bayW * 0.14, topY, leadZ, matLead, `${label}-tracery`);
    addTorus(group, bayW * 0.12, 0.045, xm + bayW * 0.14, topY, leadZ, matLead, `${label}-tracery`);
    addTorus(group, bayW * 0.09, 0.04, xm, topY + glassH * 0.08, leadZ, matLead, `${label}-oculus`);
}

function addWindowReveal(group, xm, bayW, baseY, glassH, z, side, scale = 1.0) {
    const frontZ = z - side * 0.55;
    const revealZ = z - side * 0.35;
    const shadowZ = z - side * 0.47;
    const revealDepth = 0.72;
    const frameW = bayW * 0.88 * scale;
    const topY = baseY + glassH;
    const midY = baseY + glassH * 0.5;
    const jambW = 0.46 * scale;
    const capH = 0.42 * scale;

    addBox(group, jambW, glassH + 1.7, revealDepth, xm - frameW * 0.5, midY, revealZ, matWall, 'window-jamb');
    addBox(group, jambW, glassH + 1.7, revealDepth, xm + frameW * 0.5, midY, revealZ, matWall, 'window-jamb');
    addBox(group, frameW + jambW * 1.35, capH, revealDepth, xm, baseY - 0.26, revealZ, matWall, 'window-sill');
    addBox(group, frameW + jambW * 1.1, capH * 0.7, revealDepth, xm, topY + 0.42, revealZ, matWall, 'window-lintel');

    addBox(group, 0.12 * scale, glassH * 0.96, 0.14, xm - frameW * 0.42, midY, frontZ, matRecess, 'window-recess-lip');
    addBox(group, 0.12 * scale, glassH * 0.96, 0.14, xm + frameW * 0.42, midY, frontZ, matRecess, 'window-recess-lip');
    addBox(group, frameW * 0.84, 0.12 * scale, 0.14, xm, baseY + 0.08, frontZ, matRecess, 'window-recess-lip');
    addBox(group, frameW * 0.78, 0.13 * scale, 0.16, xm, topY - glassH * 0.08, frontZ, matRecess, 'window-recess-lip');

    addPointedArch(
        group,
        new THREE.Vector3(xm - frameW * 0.5, topY - glassH * 0.2, frontZ),
        new THREE.Vector3(xm, topY + glassH * 0.18, frontZ),
        new THREE.Vector3(xm + frameW * 0.5, topY - glassH * 0.2, frontZ),
        0.22 * scale,
        matWall,
        'window-stone-arch'
    );
    addPointedArch(
        group,
        new THREE.Vector3(xm - frameW * 0.42, topY - glassH * 0.23, shadowZ),
        new THREE.Vector3(xm, topY + glassH * 0.1, shadowZ),
        new THREE.Vector3(xm + frameW * 0.42, topY - glassH * 0.23, shadowZ),
        0.09 * scale,
        matLead,
        'window-inner-arch'
    );
}

function addNicheStatue(group, x, z, side) {
    const faceZ = z - side * 0.62;
    addBox(group, 1.0, 0.28, 0.55, x, 3.05, faceZ, matRib, 'statue-plinth');
    addCylinder(group, 0.18, 0.24, 1.6, x, 4.0, faceZ, matStatue, 12, 'statue-body');
    addSphere(group, 0.24, x, 4.95, faceZ, matStatue, 12, 'statue-head');
    addCone(group, 0.34, 0.9, x, 4.45, faceZ, matStatue, 12, 'statue-robe');
    addPointedArch(
        group,
        new THREE.Vector3(x - 0.78, 3.1, faceZ),
        new THREE.Vector3(x, 6.4, faceZ),
        new THREE.Vector3(x + 0.78, 3.1, faceZ),
        0.075,
        matRib,
        'statue-niche'
    );
}

function addWallsAndWindows(group, xs, halfLen, halfNav, wallOuter) {
    const wallThick = 0.65;
    const sillH = 2.8;
    const glassBase = 4.1;
    const glassH = 8.6;
    const clerestoryBase = 14.4;
    const clerestoryH = 5.8;

    for (const side of [-1, 1]) {
        const z = side * wallOuter;

        addBox(group, NAVE_LENGTH, sillH, wallThick, 0, sillH * 0.5, z, matWall);
        addBox(group, NAVE_LENGTH, WALL_HEIGHT - 20.8, wallThick, 0, 21.9, z, matWall);
        addMasonryCoursing(group, z, side, xs);

        for (const x of xs) {
            addBox(group, 0.72, WALL_HEIGHT, wallThick * 1.35, x, WALL_HEIGHT * 0.5, z, matWall);
            addBox(group, 0.5, 3.8, wallThick * 1.45, x, 2.7, z - side * 0.2, matRib);
        }

        for (let i = 0; i < xs.length - 1; i++) {
            const x0 = xs[i];
            const x1 = xs[i + 1];
            const xm = (x0 + x1) * 0.5;
            const bayW = x1 - x0 - 1.05;
            const glassSet = [matGlassB, matGlassR, matGlassA, matGlassG];

            addBox(group, bayW + 0.15, 0.52, wallThick * 1.25, xm, glassBase - 0.72, z, matWall, 'window-lower-stone-band');
            addBox(group, bayW + 0.2, 0.95, wallThick * 1.25, xm, 13.55, z, matWall, 'window-spandrel');
            addBox(group, bayW + 0.1, 0.78, wallThick * 1.2, xm, clerestoryBase + clerestoryH + 0.68, z, matWall, 'clerestory-head-stone');

            addWindowReveal(group, xm, bayW, glassBase, glassH, z, side, 1.0);
            addWindowTracery(group, xm, bayW, glassBase, glassH, z, side, glassSet, 'stained-glass-pane');
            addPointedArch(
                group,
                new THREE.Vector3(xm - bayW * 0.39, glassBase + glassH * 0.75, z - side * 0.54),
                new THREE.Vector3(xm, glassBase + glassH + 1.3, z - side * 0.54),
                new THREE.Vector3(xm + bayW * 0.39, glassBase + glassH * 0.75, z - side * 0.54),
                0.11,
                matLead
            );

            addWindowReveal(group, xm, bayW * 0.72, clerestoryBase, clerestoryH, z, side, 0.74);
            addWindowTracery(group, xm, bayW * 0.72, clerestoryBase, clerestoryH, z, side, glassSet.slice().reverse(), 'clerestory-pane');
            addPointedArch(
                group,
                new THREE.Vector3(xm - bayW * 0.28, clerestoryBase + clerestoryH * 0.62, z - side * 0.54),
                new THREE.Vector3(xm, clerestoryBase + clerestoryH + 1.1, z - side * 0.54),
                new THREE.Vector3(xm + bayW * 0.28, clerestoryBase + clerestoryH * 0.62, z - side * 0.54),
                0.085,
                matLead
            );

            if (i % 2 === 0) addNicheStatue(group, xm, z, side);
        }

        addBox(group, NAVE_LENGTH, 0.45, wallThick * 1.5, 0, 13.6, z, matRib);
        addBox(group, NAVE_LENGTH, 0.38, wallThick * 1.5, 0, 20.7, z, matRib);
    }

    const endWallThick = 0.78;
    const doorW = 5.6;
    const doorH = 9;
    const sideW = (wallOuter * 2 - doorW) / 2;
    addBox(group, endWallThick, WALL_HEIGHT, sideW, -halfLen, WALL_HEIGHT / 2, wallOuter - sideW / 2, matWall);
    addBox(group, endWallThick, WALL_HEIGHT, sideW, -halfLen, WALL_HEIGHT / 2, -wallOuter + sideW / 2, matWall);
    addBox(group, endWallThick, WALL_HEIGHT - doorH, doorW, -halfLen, doorH + (WALL_HEIGHT - doorH) * 0.5, 0, matWall);
    addPointedArch(
        group,
        new THREE.Vector3(-halfLen - 0.42, 1.3, -doorW * 0.5),
        new THREE.Vector3(-halfLen - 0.42, doorH + 2.1, 0),
        new THREE.Vector3(-halfLen - 0.42, 1.3, doorW * 0.5),
        0.18,
        matRib,
        'west-portal'
    );

    addBox(group, endWallThick, WALL_HEIGHT, wallOuter * 2, halfLen, WALL_HEIGHT / 2, 0, matWall);
}

function addVault(group, xs, halfNav, wallOuter) {
    const shellXs = [-NAVE_LENGTH * 0.5, ...xs, NAVE_LENGTH * 0.5];
    const springY = COL_HEIGHT + 0.9;
    const ridgeY = VAULT_Y + 0.85;

    for (let i = 0; i < shellXs.length - 1; i++) {
        const x0 = shellXs[i];
        const x1 = shellXs[i + 1];
        const crown0 = new THREE.Vector3(x0, ridgeY, 0);
        const crown1 = new THREE.Vector3(x1, ridgeY, 0);

        addQuad(
            group,
            new THREE.Vector3(x0, springY, -halfNav - 0.35),
            new THREE.Vector3(x1, springY, -halfNav - 0.35),
            crown1,
            crown0,
            matVault,
            'vault-panel'
        );
        addQuad(
            group,
            crown0,
            crown1,
            new THREE.Vector3(x1, springY, halfNav + 0.35),
            new THREE.Vector3(x0, springY, halfNav + 0.35),
            matVault,
            'vault-panel'
        );

        for (const side of [-1, 1]) {
            for (const t of [0.34, 0.66]) {
                const y = springY * (1 - t) + ridgeY * t;
                const z = side * (halfNav + 0.35) * (1 - t);
                addBeam(
                    group,
                    new THREE.Vector3(x0 + 0.1, y, z),
                    new THREE.Vector3(x1 - 0.1, y, z),
                    0.028,
                    matJoint,
                    6,
                    'vault-stone-course'
                );
            }
        }
    }

    addBeam(
        group,
        new THREE.Vector3(xs[0], VAULT_Y + 0.2, 0),
        new THREE.Vector3(xs[xs.length - 1], VAULT_Y + 0.2, 0),
        0.18,
        matRib,
        14,
        'ridge-rib'
    );

    for (const x of xs) {
        addPointedArch(
            group,
            new THREE.Vector3(x, COL_HEIGHT + 0.85, -halfNav),
            new THREE.Vector3(x, VAULT_Y + 0.75, 0),
            new THREE.Vector3(x, COL_HEIGHT + 0.85, halfNav),
            0.16,
            matRib,
            'transverse-rib'
        );
    }

    for (let i = 0; i < xs.length - 1; i++) {
        const x0 = xs[i];
        const x1 = xs[i + 1];
        const xm = (x0 + x1) * 0.5;
        const apex = new THREE.Vector3(xm, VAULT_Y + 0.4, 0);
        addTube(group, [
            new THREE.Vector3(x0, COL_HEIGHT + 0.85, -halfNav),
            new THREE.Vector3(xm - 1.0, VAULT_Y - 0.4, -1.1),
            apex,
            new THREE.Vector3(xm + 1.0, VAULT_Y - 0.4, 1.1),
            new THREE.Vector3(x1, COL_HEIGHT + 0.85, halfNav),
        ], 0.085, matRib, 'diagonal-rib');
        addTube(group, [
            new THREE.Vector3(x0, COL_HEIGHT + 0.85, halfNav),
            new THREE.Vector3(xm - 1.0, VAULT_Y - 0.4, 1.1),
            apex,
            new THREE.Vector3(xm + 1.0, VAULT_Y - 0.4, -1.1),
            new THREE.Vector3(x1, COL_HEIGHT + 0.85, -halfNav),
        ], 0.085, matRib, 'diagonal-rib');
    }

    for (const side of [-1, 1]) {
        const z = side * (halfNav + AISLE_WIDTH * 0.5);
        addBox(group, NAVE_LENGTH, 0.34, AISLE_WIDTH, 0, COL_HEIGHT + 1.1, z, matVault);
        addBeam(
            group,
            new THREE.Vector3(xs[0], COL_HEIGHT + 1.4, side * (halfNav + 0.25)),
            new THREE.Vector3(xs[xs.length - 1], COL_HEIGHT + 1.4, side * (wallOuter - 0.7)),
            0.08,
            matRib,
            10
        );
    }
}

function addRoseWindow(group, halfLen) {
    // function buildRealRosePetals(cx, cy, r) {
    //     const petals = new THREE.Group();
    //     const petalCount = 8;
    //     for (let i = 0; i < petalCount; i++) {
    //         const a0 = (i / petalCount) * Math.PI * 2;
    //         const a1 = ((i + 1) / petalCount) * Math.PI * 2;
    //         const shape = new THREE.Shape();
    //         shape.moveTo(0, 0);
    //         shape.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    //         shape.absarc(0, 0, r, a0, a1, false);
    //         shape.lineTo(0, 0);
    //         const geo = new THREE.ShapeGeometry(shape);
    //         const mesh = new THREE.Mesh(geo, COLORS[i % 4]);
    //         mesh.position.set(cx, cy, 0);
    //         mesh.rotation.y = Math.PI / 2;
    //         petals.add(mesh);
    //     }
    //     return petals;
    // }
    //
    //   if you uncomment this also bump glass.userData.rayType handling in
    //   ScenePacker. tried several times, gave up.

    const x = halfLen - 0.46;
    const y = 15.9;
    const radius = 3.1;

    addPlane(group, radius * 1.78, radius * 1.78, x - 0.08, y, 0, matGlassB, 'rose-glass', [0, Math.PI / 2, 0]);
    addTorus(group, radius, 0.14, x - 0.16, y, 0, matRib, 'rose-window', [0, Math.PI / 2, 0]);
    addTorus(group, radius * 0.54, 0.09, x - 0.18, y, 0, matRib, 'rose-inner', [0, Math.PI / 2, 0]);
    addSphere(group, 0.22, x - 0.3, y, 0, matGold, 16);

    const center = new THREE.Vector3(x - 0.22, y, 0);
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const end = new THREE.Vector3(x - 0.22, y + Math.sin(a) * radius * 0.92, Math.cos(a) * radius * 0.92);
        addBeam(group, center, end, 0.055, matRib, 8);
    }

    const colors = [matGlassR, matGlassA, matGlassG, matGlassB];
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        addPlane(
            group,
            0.72,
            1.25,
            x - 0.26,
            y + Math.sin(a) * radius * 0.62,
            Math.cos(a) * radius * 0.62,
            colors[i % colors.length],
            'rose-petal',
            [0, Math.PI / 2, a]
        );
    }
}

function addAltar(group, halfLen) {
    const x = halfLen - 7.2;
    addBox(group, 9.5, 0.35, 12, x - 1.0, 0.18, 0, matAltar, 'sanctuary-platform');

    // 4 steps going up to the altar. each step gets narrower in z (13.2 - i*1.5)
    // so it looks like a pyramid not a staircase from the side.
    for (let i = 0; i < 4; i++) {
        addBox(group, 1.0, 0.18, 13.2 - i * 1.5, x - 5.3 - i * 0.62, 0.09 + i * 0.18, 0, matAltar);
    }

    addBox(group, 2.6, 1.15, 5.6, x, 0.78, 0, matAltar, 'altar');
    addBox(group, 3.6, 0.36, 6.5, x, 1.56, 0, matAltar, 'altar-top');
    addBox(group, 0.22, 5.6, 0.22, x + 1.0, 4.2, 0, matGold, 'altar-cross');
    addBox(group, 0.22, 0.22, 2.0, x + 1.0, 5.35, 0, matGold, 'altar-crossbar');

    for (const z of [-3.6, 3.6]) {
        addCylinder(group, 0.22, 0.3, 2.2, x - 1.6, 1.3, z, matGold, 16);
        addSphere(group, 0.28, x - 1.6, 2.55, z, matGlassA, 12);
    }

    addPointedArch(
        group,
        new THREE.Vector3(halfLen - 0.95, 3.4, -6.2),
        new THREE.Vector3(halfLen - 0.95, 14.2, 0),
        new THREE.Vector3(halfLen - 0.95, 3.4, 6.2),
        0.22,
        matRib,
        'apse-arch'
    );

    addBox(group, 0.28, 8.4, 10.4, halfLen - 0.78, 7.1, 0, matAltar, 'reredos-back');
    addBox(group, 0.32, 0.32, 10.9, halfLen - 1.02, 11.45, 0, matGold, 'reredos-crown');
    for (const z of [-4.2, -2.1, 0, 2.1, 4.2]) {
        addBox(group, 0.36, 6.7, 1.25, halfLen - 1.08, 7.0, z, matWall, 'reredos-panel');
        addBox(group, 0.4, 6.95, 0.12, halfLen - 1.23, 7.0, z - 0.7, matRib);
        addBox(group, 0.4, 6.95, 0.12, halfLen - 1.23, 7.0, z + 0.7, matRib);
        addPointedArch(
            group,
            new THREE.Vector3(halfLen - 1.3, 4.2, z - 0.62),
            new THREE.Vector3(halfLen - 1.3, 10.4, z),
            new THREE.Vector3(halfLen - 1.3, 4.2, z + 0.62),
            0.055,
            matGold,
            'reredos-arch'
        );
    }

    for (const side of [-1, 1]) {
        for (let i = 0; i < 7; i++) {
            const h = 3.2 + i * 0.35;
            const z = side * (5.5 + i * 0.28);
            addCylinder(group, 0.07, 0.08, h, halfLen - 1.25, 2.0 + h * 0.5, z, matGold, 10, 'organ-pipe');
        }
    }
}

function addPews(group, xs) {
    for (let i = 0; i < xs.length; i++) {
        const x = xs[i];
        for (const side of [-1, 1]) {
            const z = side * 3.9;
            addBox(group, 2.1, 0.22, 3.2, x, 0.54, z, matWood, 'pew-seat');
            addBox(group, 0.18, 1.1, 3.3, x - 0.88, 0.93, z, matWood, 'pew-back');
            addBox(group, 2.3, 0.78, 0.16, x, 0.78, z + side * 1.7, matWood, 'pew-end');
        }
    }
}

function addChandeliers(group, xs) {
    for (const x of xs) {
        addBeam(group, new THREE.Vector3(x, VAULT_Y - 0.4, 0), new THREE.Vector3(x, 15.3, 0), 0.035, matGold, 8);
        addTorus(group, 1.05, 0.08, x, 14.9, 0, matGold, 'chandelier-ring', [Math.PI / 2, 0, 0]);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const z = Math.cos(a) * 1.05;
            const y = 14.9 + Math.sin(a) * 0.04;
            const px = x + Math.sin(a) * 1.05;
            addSphere(group, 0.12, px, y, z, matGlassA, 10, 'chandelier-light');
        }
        const light = new THREE.PointLight(0xffd58a, 0.45, 18);
        light.position.set(x, 14.6, 0);
        group.add(light);
    }
}

function addFloorPattern(group, halfLen, wallOuter) {
    addBox(group, NAVE_LENGTH, 0.18, (wallOuter + 1.0) * 2, 0, -0.09, 0, matFloor, 'floor');
    addBox(group, NAVE_LENGTH - 8, 0.045, 4.2, 0, 0.012, 0, matAisle, 'golden-aisle');
    addBox(group, NAVE_LENGTH - 18, 0.058, 2.05, -3.5, 0.07, 0, matCarpet, 'processional-carpet');
    addBox(group, NAVE_LENGTH - 12, 0.055, 0.22, 0, 0.038, -2.35, matRib);
    addBox(group, NAVE_LENGTH - 12, 0.055, 0.22, 0, 0.038,  2.35, matRib);
    addBox(group, NAVE_LENGTH - 18, 0.066, 0.1, -3.5, 0.085, -1.12, matGold);
    addBox(group, NAVE_LENGTH - 18, 0.066, 0.1, -3.5, 0.085,  1.12, matGold);

    for (let x = -halfLen + 7; x < halfLen - 9; x += 6) {
        addBox(group, 0.18, 0.06, 4.2, x, 0.05, 0, matRib);
    }

    for (let x = -halfLen + 10; x < halfLen - 14; x += 4) {
        addBox(group, 0.12, 0.07, 2.05, x, 0.095, 0, matGold);
    }
}

export function buildCathedral() {
    const group = new THREE.Group();
    group.name = 'cathedral';

    const halfLen = NAVE_LENGTH / 2;
    const halfNav = NAVE_WIDTH / 2;
    const wallOuter = halfNav + AISLE_WIDTH + 0.8;     // +0.8 for the wall thickness
    const pillarCount = 12;
    const startX = -((pillarCount - 1) * COL_SPACING) / 2;
    const xs = Array.from({ length: pillarCount }, (_, i) => startX + i * COL_SPACING);

    addFloorPattern(group, halfLen, wallOuter);
    addArcade(group, xs, halfNav);
    addWallsAndWindows(group, xs, halfLen, halfNav, wallOuter);
    addVault(group, xs, halfNav, wallOuter);
    addRoseWindow(group, halfLen);
    addAltar(group, halfLen);
    addPews(group, [-27, -21, -15, -9, -3, 3, 9, 15, 21]);
    // originally 11 with -33 and 27 but the back ones were inside
    //   the west doorway alcove and looked wrong.
    addChandeliers(group, [-18, 0, 18]);

    // for (const x of xs) {
    //     _dbgDot(group, x, 0.1, -halfNav, 0xff00ff);
    //     _dbgDot(group, x,  0.1,  halfNav, 0xff00ff);
    // }
    //
    // _dbgAxes(group, 0, 0.1, 0, 3.0);
    // _dbgDot(group, -halfLen + 6.8, 1.75, 0, 0xff0000);
    //
    // group.traverse(o => { if (o.isMesh) o.material = matDebugWire; });
    // group.traverse(o => {
    //     if (o.isMesh && o.geometry.attributes.position) {
    //         const n = o.geometry.attributes.position.count / 3;
    //         console.log(o.name || '(anon)', '->', Math.round(n), 'tris');
    //     }
    // });

    return {
        group,
        bounds: {
            length: NAVE_LENGTH,
            width: wallOuter * 2,
            height: VAULT_Y + 3,
        },
        spawn: {
            position: new THREE.Vector3(-halfLen + 6.8, 1.75, 0),
            yaw: -Math.PI / 2,
            pitch: -0.02,
        },
        
        // _altSpawns: {
        //     altar:    { position: new THREE.Vector3(halfLen - 14, 1.75, 0),  yaw:  Math.PI / 2,  pitch: 0.05 },
        //     side:     { position: new THREE.Vector3(0, 1.75, halfNav - 1),    yaw: 0,             pitch: 0    },
        //     birdseye: { position: new THREE.Vector3(0, VAULT_Y - 1, 0),       yaw: -Math.PI / 2,  pitch: -1.3 },
        // },
    };
}