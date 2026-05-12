import * as THREE from 'three';
import vertSrc from './shaders/raytrace.vert.glsl?raw';
import fragSrc from './shaders/raytrace.frag.glsl?raw';

// Scene + camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('app') });
renderer.setSize(window.innerWidth, window.innerHeight);

// Full-screen quad
const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.RawShaderMaterial({
    vertexShader: vertSrc,
    fragmentShader: fragSrc,
    uniforms: {
        uResolution:  { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uCameraPos:   { value: camera.position },
        uCameraMatrix:{ value: camera.matrixWorld },
        uLightPos:    { value: new THREE.Vector3(5, 5, 0) },
    },
    depthTest: false,
    depthWrite: false,
});

const quad = new THREE.Mesh(geometry, material);
scene.add(quad);

// Resize handler
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);

    // Keep camera matrix uniform in sync each frame
    // TODO: hook up WASD + mouse look controls here once we build the camera controller
    camera.updateMatrixWorld();

    renderer.render(scene, camera);
}
animate();