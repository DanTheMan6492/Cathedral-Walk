import * as THREE from 'three';
import vertSrc from './shaders/raytrace.vert.glsl?raw';
import fragSrc from './shaders/raytrace.frag.glsl?raw';
import { flattenScene, reorderTris, packTextures, packBVH } from './core/ScenePacker.js';
import { buildBVH } from './core/BVH.js';
import { RayCamera } from './core/Raycamera.js';
import { buildCathedral } from './scene/cathedral.js';

const MATERIAL_LIMIT = 32;

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
        uMatAlbedo:     { value: Array.from({ length: MATERIAL_LIMIT }, () => new THREE.Vector3()) },
        uMatCount:      { value: 0 },
        uMatTextures:   { value: null },
        uMatHasTex:     { value: new Array(MATERIAL_LIMIT).fill(0) },
        uMatLayer:      { value: new Array(MATERIAL_LIMIT).fill(0) },
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

function uploadSceneToRaytracer(object) {
    const { rawPositions, rawNormals, rawUVs, rawMatIndices, materials } = flattenScene(object);
    const { nodes, orderedTris } = buildBVH(rawPositions);
    const {
        rawPositions:  rPos,
        rawNormals:    rNorm,
        rawUVs:        rUV,
        rawMatIndices: rMat,
    } = reorderTris(rawPositions, rawNormals, rawUVs, rawMatIndices, orderedTris);
    const { positionTexture, normalTexture, uvTexture, triCount, texWidth } = packTextures(rPos, rNorm, rUV, rMat);
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

    if (materials.length > MATERIAL_LIMIT) {
        console.warn(`Scene uses ${materials.length} materials; only ${MATERIAL_LIMIT} are available in the shader.`);
    }

    for (let i = 0; i < Math.min(materials.length, MATERIAL_LIMIT); i++) {
        material.uniforms.uMatAlbedo.value[i].set(
            materials[i].albedo[0],
            materials[i].albedo[1],
            materials[i].albedo[2],
        );
    }
    material.uniforms.uMatCount.value = Math.min(materials.length, MATERIAL_LIMIT);
    material.uniforms.uMatHasTex.value = new Array(MATERIAL_LIMIT).fill(0);
    material.uniforms.uMatLayer.value = new Array(MATERIAL_LIMIT).fill(0);

    console.log(`Scene loaded: ${triCount} triangles, ${nodeCount} BVH nodes, ${materials.length} materials`);
}

const cathedral = buildCathedral();
rayCamera.position.copy(cathedral.spawn.position);
rayCamera.yaw = cathedral.spawn.yaw;
rayCamera.pitch = cathedral.spawn.pitch;
material.uniforms.uLightPos.value.set(0, cathedral.bounds.height - 3, 0);
uploadSceneToRaytracer(cathedral.group);

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
