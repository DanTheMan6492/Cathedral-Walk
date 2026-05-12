// Renderer.js
// Will be the Central manager for switching between rendering modes (rasterized, live raytraced, baked).

// - Initialize the renderer and attaching it to the canvas
// - Swapping out the active shader/material when the user changes modes via the UI
// - Exposing a single render(scene, camera) call that main.js can call each frame