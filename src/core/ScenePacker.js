// ScenePacker.js
// Extract geometry from the loaded OBJ and encode it into textures the fragment shader can read.

// - Walk the Three.js scene graph after the OBJ is loaded and pulling out all triangle data
// - Packing that data into textures for the raytracer can use
// - Handing the packed data off to BVH.js for tree construction