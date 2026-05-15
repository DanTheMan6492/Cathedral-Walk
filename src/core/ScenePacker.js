import * as THREE from 'three';

// Walks a Three.js object (e.g. the result of OBJLoader) and extracts all triangle
// data into two DataTextures the fragment shader can read via texelFetch:
//
//   positionTexture: stores vertex positions, 3 texels per triangle (one per vertex)
//   normalTexture:   stores vertex normals,   3 texels per triangle (one per vertex)
//
// Triangle i occupies texels [i*3, i*3+1, i*3+2] in each texture.
//
// TODO: once BVH is implemented, build and return the BVH texture here as well.

// Width of the 2D texture in texels
// WebGL has a guaranteed minimum max texture size of 4096.
const TEX_WIDTH = 4096;

// possible TODO: index the geometrey to reduce the size of the texture
export function packScene(object) {
    const positions = [];
    const normals = [];

    // Traverse through all objects in the scene graph and push vertex info into shared list
    object.traverse(child => {
        // traverse goes through all objects. We only care about meshes.
        if (!child.isMesh) return; 

        const geo = child.geometry;

        // Ensure geometry has normals and compute them if missing
        if (!geo.attributes.normal) {
            geo.computeVertexNormals();
        }

        const posAttr  = geo.attributes.position;
        const normAttr = geo.attributes.normal;
        const index    = geo.index; // check if geometrey is indexed or not
        const triCount = index ? index.count / 3 : posAttr.count / 3; 

        for (let i = 0; i < triCount; i++) {
            // Get the three vertex indices for each triangle
            const a = index ? index.getX(i * 3 + 0) : i * 3 + 0;
            const b = index ? index.getX(i * 3 + 1) : i * 3 + 1;
            const c = index ? index.getX(i * 3 + 2) : i * 3 + 2;

            // Pack positions (3 floats per vertex, 3 vertices per triangle)
            positions.push(posAttr.getX(a), posAttr.getY(a), posAttr.getZ(a), 0.0);
            positions.push(posAttr.getX(b), posAttr.getY(b), posAttr.getZ(b), 0.0);
            positions.push(posAttr.getX(c), posAttr.getY(c), posAttr.getZ(c), 0.0);

            normals.push(normAttr.getX(a), normAttr.getY(a), normAttr.getZ(a), 0.0);
            normals.push(normAttr.getX(b), normAttr.getY(b), normAttr.getZ(b), 0.0);
            normals.push(normAttr.getX(c), normAttr.getY(c), normAttr.getZ(c), 0.0);
        }
    });

    const triCount   = positions.length / 12; // 9 floats per triangle (3 vertices * 3 floats)
    const texelCount = triCount * 3;         // 3 texels per triangle (one per vertex)

    // Textures are 2D to stay within GPU max texture width limits
    // Compute 2D texture dimensions
    const texWidth  = TEX_WIDTH;
    const texHeight = Math.ceil(texelCount / texWidth);

    // Pad arrays to fill the full rectangle (GPU requires complete rows)
    const totalTexels = texWidth * texHeight;
    const posPadded  = new Float32Array(totalTexels * 4); // 4 floats per texel now
    const normPadded = new Float32Array(totalTexels * 4);
    posPadded.set(positions);
    normPadded.set(normals);

    return {
        positionTexture: buildTexture(posPadded,  texWidth, texHeight),
        normalTexture:   buildTexture(normPadded, texWidth, texHeight),
        triCount,
        texWidth,   // pass these to the shader so it knows how to convert
        texHeight,  // flat index → 2D coordinate
    };
}

// Builds a 2D floating point RGB DataTexture from a flat Float32Array.
// Each texel stores one vec3 (x, y, z) readable in GLSL via texelFetch.
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