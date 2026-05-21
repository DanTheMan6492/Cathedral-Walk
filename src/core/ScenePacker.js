// ScenePacker.js
// Handles all geometry extraction and texture packing for the raytracer.
//
// Pipeline:
//   flattenScene(object)                        → rawPositions, rawNormals
//   reorderTris(rawPositions, rawNormals, order) → rawPositions, rawNormals (reordered)
//   packTextures(rawPositions, rawNormals)       → positionTexture, normalTexture, triCount, texWidth, texHeight

import * as THREE from 'three';

const TEX_WIDTH = 4096;

// ---- flattenScene ---------------------------------------------------------
// Walks a Three.js object and extracts all triangle data into flat arrays.
// Returns raw Float32Arrays rather than textures — the BVH builder reads
// these directly, and packTextures turns them into GPU textures afterwards.
//
// Layout: [x0,y0,z0,0, x1,y1,z1,0, x2,y2,z2,0, ...] (4 floats per vertex, RGBA padding)
// Triangle i occupies floats [i*12 .. i*12+11]

export function flattenScene(object) {
    const positions = [];
    const normals   = [];

    object.traverse(child => {
        if (!child.isMesh) return;

        const geo = child.geometry;
        if (!geo.attributes.normal) geo.computeVertexNormals();

        const posAttr  = geo.attributes.position;
        const normAttr = geo.attributes.normal;
        const index    = geo.index;
        const triCount = index ? index.count / 3 : posAttr.count / 3;

        for (let i = 0; i < triCount; i++) {
            const a = index ? index.getX(i * 3 + 0) : i * 3 + 0;
            const b = index ? index.getX(i * 3 + 1) : i * 3 + 1;
            const c = index ? index.getX(i * 3 + 2) : i * 3 + 2;

            positions.push(posAttr.getX(a), posAttr.getY(a), posAttr.getZ(a), 0.0);
            positions.push(posAttr.getX(b), posAttr.getY(b), posAttr.getZ(b), 0.0);
            positions.push(posAttr.getX(c), posAttr.getY(c), posAttr.getZ(c), 0.0);

            normals.push(normAttr.getX(a), normAttr.getY(a), normAttr.getZ(a), 0.0);
            normals.push(normAttr.getX(b), normAttr.getY(b), normAttr.getZ(b), 0.0);
            normals.push(normAttr.getX(c), normAttr.getY(c), normAttr.getZ(c), 0.0);
        }
    });

    return {
        rawPositions: new Float32Array(positions),
        rawNormals:   new Float32Array(normals),
    };
}

// ---- reorderTris ----------------------------------------------------------
// Rebuilds position and normal arrays in BVH leaf order so that each leaf's
// triangles are contiguous. orderedTris is the index array from buildBVH —
// each entry is a triangle index into the original rawPositions/rawNormals.
//
// Must be called after buildBVH and before packTextures.

export function reorderTris(rawPositions, rawNormals, orderedTris) {
    const positions = [];
    const normals   = [];

    for (const triIndex of orderedTris) {
        const base = triIndex * 12; // 3 vertices * 4 floats

        for (let v = 0; v < 3; v++) {
            const offset = base + v * 4;
            positions.push(
                rawPositions[offset + 0],
                rawPositions[offset + 1],
                rawPositions[offset + 2],
                0.0
            );
            normals.push(
                rawNormals[offset + 0],
                rawNormals[offset + 1],
                rawNormals[offset + 2],
                0.0
            );
        }
    }

    return {
        rawPositions: new Float32Array(positions),
        rawNormals:   new Float32Array(normals),
    };
}

// ---- packTextures ---------------------------------------------------------
// Takes raw position and normal arrays and uploads them to the GPU as
// DataTextures the fragment shader can read via texelFetch.

export function packTextures(rawPositions, rawNormals) {
    const triCount    = rawPositions.length / 12;
    const texelCount  = triCount * 3;
    const texWidth    = TEX_WIDTH;
    const texHeight   = Math.ceil(texelCount / texWidth);
    const totalTexels = texWidth * texHeight;

    const posPadded  = new Float32Array(totalTexels * 4);
    const normPadded = new Float32Array(totalTexels * 4);
    posPadded.set(rawPositions);
    normPadded.set(rawNormals);

    return {
        positionTexture: buildTexture(posPadded,  texWidth, texHeight),
        normalTexture:   buildTexture(normPadded, texWidth, texHeight),
        triCount,
        texWidth,
        texHeight,
    };
}

// ---- packBVH --------------------------------------------------------------
// Packs the flat BVH node array into a DataTexture the shader can traverse.
//
// Each node occupies exactly 3 texels (3 * vec4 = 12 floats):
//
//   texel 0: [ box.min.x, box.min.y, box.min.z, isLeaf        ]
//   texel 1: [ box.max.x, box.max.y, box.max.z, unused        ]
//   texel 2: [ data0,     data1,     unused,    unused        ]
//
//   where data0/data1 mean:
//     interior node — data0 = leftIndex,  data1 = rightIndex
//     leaf node     — data0 = triStart,   data1 = triCount
//
// The shader reads texel 0.w to distinguish leaf (1.0) from interior (0.0),
// then reads texel 2.xy as either child indices or triangle range.
// Node i occupies texels [i*3, i*3+1, i*3+2].

export function packBVH(nodes) {
    const TEXELS_PER_NODE = 3;
    const texelCount  = nodes.length * TEXELS_PER_NODE;
    const texWidth    = TEX_WIDTH;
    const texHeight   = Math.ceil(texelCount / texWidth);
    const totalTexels = texWidth * texHeight;

    const data = new Float32Array(totalTexels * 4); // 4 floats per texel

    for (let i = 0; i < nodes.length; i++) {
        const node   = nodes[i];
        const base   = i * TEXELS_PER_NODE * 4; // 4 floats per texel

        // Texel 0: box min + isLeaf flag
        data[base + 0] = node.box.min.x;
        data[base + 1] = node.box.min.y;
        data[base + 2] = node.box.min.z;
        data[base + 3] = node.isLeaf ? 1.0 : 0.0;

        // Texel 1: box max
        data[base + 4] = node.box.max.x;
        data[base + 5] = node.box.max.y;
        data[base + 6] = node.box.max.z;
        data[base + 7] = 0.0; // unused

        // Texel 2: child indices (interior) or triangle range (leaf)
        data[base + 8]  = node.isLeaf ? node.triStart  : node.leftIndex;
        data[base + 9]  = node.isLeaf ? node.triCount  : node.rightIndex;
        data[base + 10] = 0.0; // unused
        data[base + 11] = 0.0; // unused
    }

    return {
        bvhTexture: buildTexture(data, texWidth, texHeight),
        nodeCount:  nodes.length,
        texWidth,
    };
}

// ---- buildTexture ---------------------------------------------------------
// Builds a 2D floating point RGBA DataTexture from a flat Float32Array.
// Each texel stores one vec4 readable in GLSL via texelFetch.
// We use RGBA rather than RGB because WebGL 2 doesn't support RGB float textures.

function buildTexture(data, width, height) {
    const tex = new THREE.DataTexture(
        data,
        width,
        height,
        THREE.RGBAFormat,
        THREE.FloatType,
    );
    tex.needsUpdate = true;
    return tex;
}