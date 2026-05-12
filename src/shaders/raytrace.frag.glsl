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
precision highp float;

uniform vec2 uResolution;
uniform vec3 uCameraPos;
uniform mat4 uCameraMatrix;
uniform vec3 uLightPos;


// The return type for all intersection functions.
struct HitInfo {
    bool hit;
    float t;      // distance along the ray to the hit point
    vec3 normal;  // surface normal at the hit point
};

// ---- Object ---------------------------------------------------------------
// represents any primitive in the scene.

// All primitive types
const int TYPE_SPHERE = 0;

struct Object {
    int type;
    vec3 position;

    // TYPE_SPHERE — data1.x = radius
    vec3 data1;
};
// ---------------------------------------------------------------------------


// ---- Intersection functions -----------------------------------------------
// One function per primitive type
// All take (Object, ray origin, ray direction) and return HitInfo

HitInfo intersectSphere(Object obj, vec3 ro, vec3 rd) {
    HitInfo h;
    h.hit = false;

    float radius = obj.data1.x;
    vec3 oc = ro - obj.position; //origin to center

    // solve intersection quad: |ro + t*rd - center|^2 - radius^2 = 0
    float b = dot(oc, rd);
    float c = dot(oc, oc) - radius * radius;
    float disc = b * b - c;

    if (disc < 0.0) return h; // ray misses sphere

    float t = -b - sqrt(disc); // nearest intersection
    if (t < 0.001) return h;   // hit is behind the ray origin

    h.hit = true;
    h.t = t;
    h.normal = normalize((ro + rd * t) - obj.position);
    return h;
}

// ---------------------------------------------------------------------------


// ---- intersect ------------------------------------------------------------

HitInfo intersect(Object obj, vec3 ro, vec3 rd) {
    if (obj.type == TYPE_SPHERE) return intersectSphere(obj, ro, rd);

    // add branches for new primitive types here

    // Fallback
    HitInfo miss;
    miss.hit = false;
    return miss;
}
// ---------------------------------------------------------------------------


// ---- Scene ----------------------------------------------------------------
// Hardcoded list of objects for now.
// TODO: replace with a texture-based scene buffer read from ScenePacker

HitInfo intersectScene(vec3 ro, vec3 rd) {
    Object sphere;
    sphere.type = TYPE_SPHERE;
    sphere.position = vec3(0.0, 0.0, -4.0);
    sphere.data1 = vec3(1.0, 0.0, 0.0); // radius = 1.0

    return intersect(sphere, ro, rd);
}
// ---------------------------------------------------------------------------


void main() {
    
    // Reconstruct ray direction from this pixel's screen coordinate
    vec2 uv = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y; // correct for aspect ratio

    vec3 rd = normalize(mat3(uCameraMatrix) * vec3(uv, -1.0));
    vec3 ro = uCameraPos;

    // Cast primary ray into the scene
    HitInfo h = intersectScene(ro, rd);

    if (!h.hit) {
        // Background — TODO: replace with skybox or gradient
        gl_FragColor = vec4(0.1, 0.1, 0.15, 1.0);
        return;
    }

    // Basic diffuse shading using the surface normal and light position
    // TODO: expand into a full material system
    vec3 hitPoint = ro + rd * h.t;
    vec3 toLight = normalize(uLightPos - hitPoint);
    float diffuse = max(dot(h.normal, toLight), 0.0);

    // TODO: add shadow rays
    
    vec3 color = vec3(0.8, 0.8, 0.8) * diffuse;
    gl_FragColor = vec4(color, 1.0);
}
