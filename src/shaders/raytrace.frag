// raytrace.frag
// Ray Tracing pipeline

// Each fragment invocation handles one pixel.

// - Reconstructing a ray direction
// - Traversing the BVH texture to find the nearest triangle intersection
// - Applying bump map perturbations to the surface normal at hit points
// - Writing the final color for the pixel

// Requires:
// camera position, camera world matrix, BVH texture, 
// triangle data texture, normal map textures, light positions/colors
