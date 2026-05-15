import * as THREE from 'three';

// RayCamera
// A self-contained first-person camera controller that operates independently
// of the Three.js scene graph. The Three.js camera is kept frozen at the origin
// so the full-screen quad always fills the screen correctly. All movement and
// rotation is tracked here and pushed to shader uniforms each frame.

export class RayCamera {
    constructor(canvas, initialPosition = new THREE.Vector3(0, 0, 5)) {
        this.position = initialPosition.clone();
        this.yaw      = 0; // left/right (radians)
        this.pitch    = 0; // up/down (radians)
        this.speed    = 5.0;
        this.sensitivity = 0.002;

        this._keys = {};
        this._matrix = new THREE.Matrix4();

        this._bindEvents(canvas);
    }

    // ---- Event binding -------------------------------------------------------

    _bindEvents(canvas) {
        // Pointer lock on click for mouse look
        canvas.addEventListener('click', () => canvas.requestPointerLock());

        window.addEventListener('mousemove', e => {
            if (document.pointerLockElement !== canvas) return;
            this.yaw   -= e.movementX * this.sensitivity;
            this.pitch -= e.movementY * this.sensitivity;
            // Clamp pitch so you can't flip upside down
            this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
        });

        // Store what keys are currently held
        // Use e.code instead of e.keys so we are layout independent
        window.addEventListener('keydown', e => this._keys[e.code] = true);
        window.addEventListener('keyup',   e => this._keys[e.code] = false);
    }

    // ---- Per-frame update ----------------------------------------------------

    update(delta) {
        // Build forward and right vectors from current yaw/pitch
        const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');

        const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        const right   = new THREE.Vector3(1, 0,  0).applyEuler(new THREE.Euler(0         , this.yaw, 0, 'YXZ'));

        const s = this.speed * delta;

        // modify position based on inputs and direction
        if (this._keys['KeyW'])      this.position.addScaledVector(forward,  s);
        if (this._keys['KeyS'])      this.position.addScaledVector(forward, -s);
        if (this._keys['KeyA'])      this.position.addScaledVector(right,   -s);
        if (this._keys['KeyD'])      this.position.addScaledVector(right,    s);
        if (this._keys['Space'])     this.position.y += s;
        if (this._keys['ShiftLeft']) this.position.y -= s;
    }

    // ---- Shader uniform helpers ----------------------------------------------

    // Returns the rotation matrix to pass as uCameraMatrix
    getMatrix() {
        this._matrix.makeRotationFromEuler(
            new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')
        );
        return this._matrix;
    }

    // Pushes position and matrix into a RawShaderMaterial's uniforms
    applyToUniforms(uniforms) {
        uniforms.uCameraPos.value.copy(this.position);
        uniforms.uCameraMatrix.value.copy(this.getMatrix());
    }
}