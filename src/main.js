import * as THREE from 'three';
import vertSrc from './shaders/raytrace.vert.glsl?raw';
import fragSrc from './shaders/raytrace.frag.glsl?raw';
import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
// Camera used only for ray generation and controls.
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('app') });
renderer.setSize(window.innerWidth, window.innerHeight);
let controls = new FlyControls(camera,renderer.domElement);
controls.dragToLook=true;
controls.rollSpeed=0.75;    
controls.movementSpeed=10;     
const loader = new THREE.ObjectLoader();
//const obj = await loader.loadAsync('json file'); use parseAsync(object) for already existing object
//scene.add(obj)
/*loader.load('path to file', function(object) {scene.add(object);},   function ( xhr ) {
                    console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
                },
                function ( error ) {
                    console.log( 'An error happened' );
                });*/
// Full-screen raytracing pass. Render it with a fixed orthographic camera so it
// stays on screen while the controlled camera moves through the raytraced scene.
const screenScene = new THREE.Scene();
const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
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
screenScene.add(quad);

// Resize handler
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Timer();

function animate() {
    requestAnimationFrame(animate);

    controls.update(0.01)
    // Keep camera matrix uniform in sync each frame
    // TODO: hook up WASD + mouse look controls here once we build the camera controller: Done
    camera.updateMatrixWorld();
    

    renderer.render(screenScene, screenCamera);
}
animate();
