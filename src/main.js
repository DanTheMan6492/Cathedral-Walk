import * as THREE from 'three';
import vertSrc from './shaders/raytrace.vert.glsl?raw';
import fragSrc from './shaders/raytrace.frag.glsl?raw';
import { flattenScene, reorderTris, packTextures, packBVH } from './core/ScenePacker.js';
import { buildBVH } from './core/BVH.js';
import { RayCamera } from './core/Raycamera.js';
import { buildCathedral } from './scene/cathedral.js';

const MATERIAL_LIMIT = 32;
const canvas = document.getElementById('app');
const viewport = document.getElementById('viewport');
const controls = {
    raytraceToggle: document.getElementById('raytrace-toggle'),
    resolutionScale: document.getElementById('resolution-scale'),
    resolutionOutput: document.getElementById('resolution-output'),
    fitToggle: document.getElementById('fit-toggle'),
    viewportWidth: document.getElementById('viewport-width'),
    viewportHeight: document.getElementById('viewport-height'),
    widthOutput: document.getElementById('width-output'),
    heightOutput: document.getElementById('height-output'),
};
const renderState = {
    raytracing: controls.raytraceToggle.checked,
    resolutionScale: Number(controls.resolutionScale.value),
    fitToWindow: controls.fitToggle.checked,
    viewportWidth: Number(controls.viewportWidth.value),
    viewportHeight: Number(controls.viewportHeight.value),
};

// ---- Three.js setup ---------------------------------------------------------
// The Three.js camera is frozen at the origin — it exists only to satisfy
// the renderer. All actual camera movement is handled by RayCamera.

const raytraceScene = new THREE.Scene();
const screenCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
screenCamera.position.set(0, 0, 0);
screenCamera.updateMatrixWorld();

const rasterScene = new THREE.Scene();
rasterScene.background = new THREE.Color(0x101315);
const rasterCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
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
raytraceScene.add(quad);

// ---- Ray camera -------------------------------------------------------------

const rayCamera = new RayCamera(
    canvas,
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
rasterScene.add(cathedral.group);
rasterScene.add(new THREE.AmbientLight(0xf2ead8, 0.42));
const rasterKeyLight = new THREE.DirectionalLight(0xfff3d0, 0.9);
rasterKeyLight.position.set(-12, 28, 18);
rasterScene.add(rasterKeyLight);

// ---- UI and resize handler --------------------------------------------------

function applyRenderSettings() {
    viewport.classList.toggle('manual-size', !renderState.fitToWindow);
    viewport.style.setProperty('--viewport-width', `${renderState.viewportWidth}px`);
    viewport.style.setProperty('--viewport-height', `${renderState.viewportHeight}px`);
    controls.viewportWidth.disabled = renderState.fitToWindow;
    controls.viewportHeight.disabled = renderState.fitToWindow;

    const rect = viewport.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));
    const renderWidth = Math.max(1, Math.round(cssWidth * renderState.resolutionScale));
    const renderHeight = Math.max(1, Math.round(cssHeight * renderState.resolutionScale));

    renderer.setSize(renderWidth, renderHeight, false);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    rasterCamera.aspect = renderWidth / renderHeight;
    rasterCamera.updateProjectionMatrix();
    material.uniforms.uResolution.value.set(renderWidth, renderHeight);

    controls.resolutionOutput.value = `${Math.round(renderState.resolutionScale * 100)}%`;
    controls.widthOutput.value = `${renderState.fitToWindow ? cssWidth : renderState.viewportWidth}px`;
    controls.heightOutput.value = `${renderState.fitToWindow ? cssHeight : renderState.viewportHeight}px`;
}

controls.raytraceToggle.addEventListener('change', () => {
    renderState.raytracing = controls.raytraceToggle.checked;
});

controls.resolutionScale.addEventListener('input', () => {
    renderState.resolutionScale = Number(controls.resolutionScale.value);
    applyRenderSettings();
});

controls.fitToggle.addEventListener('change', () => {
    renderState.fitToWindow = controls.fitToggle.checked;
    applyRenderSettings();
});

controls.viewportWidth.addEventListener('input', () => {
    renderState.viewportWidth = Number(controls.viewportWidth.value);
    applyRenderSettings();
});

controls.viewportHeight.addEventListener('input', () => {
    renderState.viewportHeight = Number(controls.viewportHeight.value);
    applyRenderSettings();
});

window.addEventListener('resize', applyRenderSettings);
applyRenderSettings();

// ---- Render loop ------------------------------------------------------------

function applyRayCameraToRasterCamera() {
    rasterCamera.position.copy(rayCamera.position);
    rasterCamera.quaternion.setFromRotationMatrix(rayCamera.getMatrix());
    rasterCamera.fov = rayCamera.FOV;
    rasterCamera.updateProjectionMatrix();
}

const clock = new THREE.Timer();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    clock.update();
    rayCamera.update(delta);
    rayCamera.applyToUniforms(material.uniforms);
    material.uniforms.uFOV.value = rayCamera.FOV;

    if (renderState.raytracing) {
        renderer.render(raytraceScene, screenCamera);
    } else {
        applyRayCameraToRasterCamera();
        renderer.render(rasterScene, rasterCamera);
    }
}
animate();
