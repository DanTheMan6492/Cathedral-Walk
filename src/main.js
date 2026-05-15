import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import vertSrc from './shaders/raytrace.vert.glsl?raw';
import fragSrc from './shaders/raytrace.frag.glsl?raw';
import { packScene } from './core/ScenePacker.js';
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
        uTriangleCount: { value: 0 },
        uTexWidth:      { value: 0 },
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

// ---- OBJ loader -------------------------------------------------------------

const loader = new OBJLoader();
loader.load(
    '/assets/models/test_cube.obj',
    (object) => {
        const { positionTexture, normalTexture, triCount, texWidth } = packScene(object);

        material.uniforms.uPositions.value     = positionTexture;
        material.uniforms.uNormals.value       = normalTexture;
        material.uniforms.uTriangleCount.value = triCount;
        material.uniforms.uTexWidth.value      = texWidth;

        console.log(`Scene loaded: ${triCount} triangles`);
    },
    (xhr) => {
        if (xhr.total) {
            console.log(`Loading: ${(xhr.loaded / xhr.total * 100).toFixed(1)}%`);
        }
    },
    (error) => console.error('OBJLoader error:', error)
);

// ---- Resize handler ---------------------------------------------------------

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

// ---- Render loop ------------------------------------------------------------

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    rayCamera.update(delta);
    rayCamera.applyToUniforms(material.uniforms);

    renderer.render(scene, camera);
}
animate();