import * as THREE from 'three';

// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3;

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('app') });
renderer.setSize(window.innerWidth, window.innerHeight);

// Triangle
const geometry = new THREE.BufferGeometry();
const vertices = new Float32Array([
     0,  1, 0,  // top
    -1, -1, 0,  // bottom left
     1, -1, 0,  // bottom right
]);

geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
const triangle = new THREE.Mesh(geometry, material);
scene.add(triangle);

// Render loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();