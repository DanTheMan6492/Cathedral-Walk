import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import vertSrc from './shaders/raytrace.vert.glsl?raw';
import fragSrc from './shaders/raytrace.frag.glsl?raw';
import { flattenScene, reorderTris, packTextures, packBVH } from './core/ScenePacker.js';
import { buildBVH } from './core/BVH.js';
import { RayCamera } from './core/RayCamera.js';

// ---- Three.js setup ---------------------------------------------------------
// The Three.js camera is frozen at the origin — it exists only to satisfy
// the renderer. All actual camera movement is handled by RayCamera.

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 0);
camera.updateMatrixWorld();

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('app') });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.glslVersion = THREE.GLSL3;

// ---- Full-screen quad -------------------------------------------------------

const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vertSrc,
    fragmentShader: fragSrc,
    uniforms: {
        uResolution:    { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uCameraPos:     { value: new THREE.Vector3() },
        uCameraMatrix:  { value: new THREE.Matrix4() },
        uLightPos:      { value: new THREE.Vector3(3, 3, 3) },
        uPositions:     { value: null },
        uNormals:       { value: null },
        uUVs:           { value: null },
        uTriangleCount: { value: 0 },
        uTexWidth:      { value: 0 },
        uBVH:           { value: null },
        uBVHNodeCount:  { value: 0 },
        uBVHTexWidth:   { value: 0 },
        uFOV:           { value: 75.0 },
        uMatAlbedo:     { value: Array.from({ length: 16 }, () => new THREE.Vector3()) },
        uMatCount:      { value: 0 },
        uMatTextures:   { value: null },
        uMatHasTex:     { value: new Array(16).fill(0) },
        uMatLayer:      { value: new Array(16).fill(0) },
    },
    depthTest: false,
    depthWrite: false,
});
const quad = new THREE.Mesh(geometry, material);
scene.add(quad);

// ---- Ray camera -------------------------------------------------------------

const rayCamera = new RayCamera(
    renderer.domElement,
    new THREE.Vector3(0, 0, 5)
);

const MATERIAL_TEXTURES = {
    'Wolf_Body':  'textures/Wolf_Body.jpg',
    'Wolf_Eyes':  'textures/Wolf_Eyes_1.jpg',
    'Wolf_Fur':   'textures/Wolf_Body.jpg',
};

const TEX_LAYER_SIZE = 512;

async function loadMaterialTextures(materials, basePath) {
    const urlToLayer = new Map();
    for (const m of materials) {
        const url = MATERIAL_TEXTURES[m.name];
        if (url && !urlToLayer.has(url)) urlToLayer.set(url, urlToLayer.size);
    }

    const hasTex     = new Array(16).fill(0);
    const layerIndex = new Array(16).fill(0);
    for (let i = 0; i < materials.length; i++) {
        const url = MATERIAL_TEXTURES[materials[i].name];
        if (url) {
            hasTex[i]     = 1;
            layerIndex[i] = urlToLayer.get(url);
        }
    }

    if (urlToLayer.size === 0) {
        return { texture: null, hasTex, layerIndex, layerCount: 0 };
    }

    const layerCount = urlToLayer.size;
    const buffer     = new Uint8Array(TEX_LAYER_SIZE * TEX_LAYER_SIZE * 4 * layerCount);

    const canvas = document.createElement('canvas');
    canvas.width  = TEX_LAYER_SIZE;
    canvas.height = TEX_LAYER_SIZE;
    const ctx = canvas.getContext('2d',{willReadFrequently: true});

    await Promise.all([...urlToLayer.entries()].map(([url, layer]) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, TEX_LAYER_SIZE, TEX_LAYER_SIZE);
                ctx.save();
                ctx.scale(1, -1);
                ctx.drawImage(img, 0, -TEX_LAYER_SIZE, TEX_LAYER_SIZE, TEX_LAYER_SIZE);
                ctx.restore();
                const imgData = ctx.getImageData(0, 0, TEX_LAYER_SIZE, TEX_LAYER_SIZE);
                buffer.set(imgData.data, layer * TEX_LAYER_SIZE * TEX_LAYER_SIZE * 4);
                resolve();
            };
            img.onerror = (e) => {
                console.warn(`Material texture ${url} failed to load (layer ${layer})`);
                resolve();
            };
            img.src = basePath + url;
        });
    }));

    const tex = new THREE.DataArrayTexture(buffer, TEX_LAYER_SIZE, TEX_LAYER_SIZE, layerCount);
    tex.format      = THREE.RGBAFormat;
    tex.type        = THREE.UnsignedByteType;
    tex.wrapS       = THREE.RepeatWrapping;
    tex.wrapT       = THREE.RepeatWrapping;
    tex.minFilter   = THREE.LinearFilter;
    tex.magFilter   = THREE.LinearFilter;
    tex.needsUpdate = true;

    return { texture: tex, hasTex, layerIndex, layerCount };
}

// ---- OBJ loader -------------------------------------------------------------

const mtlLoader = new MTLLoader();
mtlLoader.setPath('/assets/models/wolf/');
mtlLoader.load('Wolf_One_obj.mtl', (materials) => {
    materials.preload();

    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);
    objLoader.load(
        '/assets/models/wolf/Wolf_One_obj.obj',
        (object) => {
            // Step 1: extract raw triangle data from the scene graph
            const { rawPositions, rawNormals, rawUVs, rawMatIndices, materials } = flattenScene(object);

            // Step 2: build the BVH and get the reordered triangle index array
            const { nodes, orderedTris } = buildBVH(rawPositions);

            // Step 3: reorder position and normal arrays to match BVH leaf order
            const {
                rawPositions:  rPos,
                rawNormals:    rNorm,
                rawUVs:        rUV,
                rawMatIndices: rMat,
            } = reorderTris(rawPositions, rawNormals, rawUVs, rawMatIndices, orderedTris);

            // Step 4: pack reordered data into GPU textures
            const { positionTexture, normalTexture, uvTexture, triCount, texWidth } = packTextures(rPos, rNorm, rUV, rMat);

            // Step 5: pack BVH nodes into a GPU texture
            const { bvhTexture, nodeCount, texWidth: bvhTexWidth } = packBVH(nodes);

            material.uniforms.uPositions.value     = positionTexture;
            material.uniforms.uNormals.value       = normalTexture;
            material.uniforms.uUVs.value           = uvTexture;
            material.uniforms.uTriangleCount.value = triCount;
            material.uniforms.uTexWidth.value      = texWidth;
            material.uniforms.uBVH.value           = bvhTexture;
            material.uniforms.uBVHNodeCount.value  = nodeCount;
            material.uniforms.uBVHTexWidth.value   = bvhTexWidth;
            material.uniforms.uFOV.value           = 75.0;

            for (let i = 0; i < materials.length && i < 16; i++) {
                material.uniforms.uMatAlbedo.value[i].set(
                    materials[i].albedo[0],
                    materials[i].albedo[1],
                    materials[i].albedo[2],
                );
            }
            material.uniforms.uMatCount.value = materials.length;

            console.log(`Scene loaded: ${triCount} triangles, ${nodeCount} BVH nodes, ${materials.length} materials`);

            loadMaterialTextures(materials, '/assets/models/wolf/').then(({ texture, hasTex, layerIndex }) => {
                material.uniforms.uMatTextures.value = texture;
                material.uniforms.uMatHasTex.value   = hasTex;
                material.uniforms.uMatLayer.value    = layerIndex;
            });
        },
        (xhr) => {
            if (xhr.total) {
                console.log(`Loading: ${(xhr.loaded / xhr.total * 100).toFixed(1)}%`);
            }
        },
        (error) => console.error('OBJLoader error:', error)
    );
}, undefined, (error) => console.error('MTLLoader error:', error));

// ---- Resize handler ---------------------------------------------------------
const renderscale=0.5;
window.addEventListener('resize', () => {

    renderer.setSize(window.innerWidth*renderscale, window.innerHeight*renderscale);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    material.uniforms.uResolution.value.set(window.innerWidth *renderscale, window.innerHeight*renderscale);
});

// ---- Render loop ------------------------------------------------------------
renderer.setSize(window.innerWidth*renderscale, window.innerHeight*renderscale);
material.uniforms.uResolution.value.set(window.innerWidth *renderscale, window.innerHeight*renderscale);
const clock = new THREE.Timer();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    clock.update();
    rayCamera.update(delta);
    rayCamera.applyToUniforms(material.uniforms);
    material.uniforms.uFOV.value = rayCamera.FOV;
    renderer.render(scene, camera);
}
animate();