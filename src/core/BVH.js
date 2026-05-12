// BVH.js
// Builds and encodes a Bounding Volume Hierarchy over the scene geometry.

// - Take the triangle data from ScenePacker and building a binary tree of AABBs over it
// - Flatten the tree into a format that can be packed into a texture for the fragment shader to read
