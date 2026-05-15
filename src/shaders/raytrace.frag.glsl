
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
precision highp sampler2D;

uniform vec2 uResolution;
uniform vec3 uCameraPos;
uniform mat4 uCameraMatrix;
uniform vec3 uLightPos;
uniform sampler2D uPositions;
uniform sampler2D uNormals;
uniform int uTriangleCount;
uniform int uTexWidth;


// The return type for all intersection functions.
struct HitInfo {
    bool hit;
    float t;      // distance along the ray to the hit point
    vec3 normal;  // surface normal at the hit point
};

// ---- Texture fetch helper -------------------------------------------------
// Converts a flat texel index to 2D coordinates and fetches the value.

vec3 fetchTexel(sampler2D tex, int flatIndex) {
    int col = flatIndex - (flatIndex / uTexWidth) * uTexWidth;
    int row = flatIndex / uTexWidth;
    return texelFetch(tex, ivec2(col, row), 0).xyz;
}

// ---- Object ---------------------------------------------------------------
// Represents any primitive in the scene.

// All primitive types
const int TYPE_SPHERE   = 0;
const int TYPE_TRIANGLE = 1;

struct Object {
    int type;

    // TYPE_SPHERE   — data0 = center, data1.x = radius
    // TYPE_TRIANGLE — data0 = v0, data1 = v1, data2 = v2
    vec3 data0;
    vec3 data1;
    vec3 data2;
};
// ---------------------------------------------------------------------------


// ---- Intersection functions -----------------------------------------------

HitInfo intersectSphere(Object obj, vec3 ro, vec3 rd) {
    HitInfo h;
    h.hit = false;

    vec3  center = obj.data0;
    float radius = obj.data1.x;
    vec3  oc     = ro - center; // origin to center

    // Solve intersection quad: |ro + t*rd - center|^2 - radius^2 = 0
    float b    = dot(oc, rd);
    float c    = dot(oc, oc) - radius * radius;
    float disc = b * b - c;

    if (disc < 0.0) return h; // ray misses sphere

    float t = -b - sqrt(disc); // nearest intersection
    if (t < 0.001) return h;   // hit is behind the ray origin

    h.hit    = true;
    h.t      = t;
    h.normal = normalize((ro + rd * t) - center);
    return h;
}

// Moller-Trumbore triangle intersection
// https://www.scratchapixel.com/lessons/3d-basic-rendering/ray-tracing-rendering-a-triangle/moller-trumbore-ray-triangle-intersection.html
// data0 = v0, data1 = v1, data2 = v2
// TODO: understand this algorithm a bit better...
HitInfo intersectTriangle(Object obj, vec3 ro, vec3 rd) {
    HitInfo h;
    h.hit = false;

    vec3 v0 = obj.data0;
    vec3 v1 = obj.data1;
    vec3 v2 = obj.data2;

    // Edge vectors from v0
    vec3 e1 = v1 - v0;
    vec3 e2 = v2 - v0;

    // Begin computing determinant
    vec3  pvec = cross(rd, e2);
    float det  = dot(e1, pvec);

    // If det is near zero, ray is parallel to triangle
    if (abs(det) < 0.000001) return h;

    float invDet = 1.0 / det;

    // Distance from v0 to ray origin
    vec3 tvec = ro - v0;

    // u barycentric coordinate
    float u = dot(tvec, pvec) * invDet;
    if (u < 0.0 || u > 1.0) return h;

    // v barycentric coordinate
    vec3  qvec = cross(tvec, e1);
    float v    = dot(rd, qvec) * invDet;
    if (v < 0.0 || u + v > 1.0) return h;

    // t - distance along ray to hit point
    float t = dot(e2, qvec) * invDet;
    if (t < 0.001) return h;

    h.hit    = true;
    h.t      = t;
    h.normal = normalize(cross(e1, e2));
    return h;
}

// ---------------------------------------------------------------------------


// ---- intersect ------------------------------------------------------------

HitInfo intersect(Object obj, vec3 ro, vec3 rd) {
    if (obj.type == TYPE_SPHERE)   return intersectSphere(obj, ro, rd);
    if (obj.type == TYPE_TRIANGLE) return intersectTriangle(obj, ro, rd);

    // Add branches for new primitive types here

    // Fallback
    HitInfo miss;
    miss.hit = false;
    return miss;
}
// ---------------------------------------------------------------------------


// ---- Scene ----------------------------------------------------------------
// TODO: once BVH is added, replace the linear loop with BVH traversal.

HitInfo intersectScene(vec3 ro, vec3 rd) {
    HitInfo closest;
    closest.hit = false;
    closest.t   = 1.0e30; // effectively infinity

    for (int i = 0; i < uTriangleCount; i++) {
        // Each triangle occupies 3 consecutive texels (one per vertex)
        int base = i * 3;

        Object tri;
        tri.type  = TYPE_TRIANGLE;
        tri.data0 = fetchTexel(uPositions, base + 0); // v0
        tri.data1 = fetchTexel(uPositions, base + 1); // v1
        tri.data2 = fetchTexel(uPositions, base + 2); // v2

        HitInfo h = intersect(tri, ro, rd);

        // Keep the nearest hit
        if (h.hit && h.t < closest.t) {
            closest = h;

            // Average the three vertex normals from the normal texture
            // TODO: interpolate using barycentric coordinates for smooth shading
            //       once u,v are stored in HitInfo
            closest.normal = normalize(
                fetchTexel(uNormals, base + 0) +
                fetchTexel(uNormals, base + 1) +
                fetchTexel(uNormals, base + 2)
            );
        }
    }

    return closest;
}

// ---------------------------------------------------------------------------

out vec4 fragColor;


void main() {
 
    // Reconstruct ray direction from this pixel's screen coordinate
    vec2 uv = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y; // correct for aspect ratio
 
    // Fan rays out correctly based on field of view
    float tanHalfFov = tan(radians(75.0) * 0.5);
    vec3 rayDirCamera = normalize(vec3(uv * tanHalfFov, -1.0));
 
    // Rotate ray into world space using camera orientation
    vec3 rd = normalize(mat3(uCameraMatrix) * rayDirCamera);
    vec3 ro = uCameraPos;
 
    // Cast primary ray into the scene
    HitInfo h = intersectScene(ro, rd);
 
    if (!h.hit) {
        // Background — TODO: replace with skybox or gradient
        fragColor = vec4(0.1, 0.1, 0.15, 1.0);
        return;
    }
 
    // Basic diffuse shading using the surface normal and light position
    // TODO: expand into a full material system
    vec3 hitPoint = ro + rd * h.t;
    vec3 toLight  = normalize(uLightPos - hitPoint);
    float diffuse = max(dot(h.normal, toLight), 0.0);
 
    // TODO: add shadow rays
 
    vec3 color = vec3(0.8, 0.8, 0.8) * diffuse;
    fragColor = vec4(color, 1.0);
}
 
