// raytrace.frag
// Ray Tracing pipeline
//
// Each fragment invocation handles one pixel.
// Supports three unrolled ray bounces across three material types:
//   MAT_DIFFUSE     - Lambertian shading with shadow rays
//   MAT_REFLECTIVE  - Mirror reflection with specular highlight
//   MAT_TRANSPARENT - Glass refraction (Snell's law) with TIR fallback

precision highp float;
precision highp sampler2D;

uniform vec2  uResolution;
uniform vec3  uCameraPos;
uniform mat4  uCameraMatrix;
uniform vec3  uLightPos;
uniform sampler2D uPositions;
uniform sampler2D uNormals;
uniform int uTriangleCount;
uniform int uTexWidth;
uniform sampler2D uBVH;
uniform int uBVHNodeCount;
uniform int uBVHTexWidth;

out vec4 fragColor;

// ---- Material types -------------------------------------------------------

const int MAT_DIFFUSE     = 0;
const int MAT_REFLECTIVE  = 1;
const int MAT_TRANSPARENT = 2;

struct Material {
    int   type;
    vec3  albedo;
    float ior;
};

// ---- HitRecord ------------------------------------------------------------
// Returned by all intersection functions.
// Carries geometry AND material data so shading needs no extra lookups.

struct HitRecord {
    bool  hit;
    float t;
    vec3  pos;
    vec3  normal;
    int   matType;
    vec3  albedo;
    float ior;
};

// ---- Texture fetch helpers ------------------------------------------------
// Each uses its own tex width uniform since position/normal and BVH textures
// may have different dimensions.

vec3 fetchTexel(sampler2D tex, int flatIndex) {
    int col = flatIndex - (flatIndex / uTexWidth) * uTexWidth;
    int row = flatIndex / uTexWidth;
    return texelFetch(tex, ivec2(col, row), 0).xyz;
}

vec4 fetchBVHTexel(int flatIndex) {
    int col = flatIndex - (flatIndex / uBVHTexWidth) * uBVHTexWidth;
    int row = flatIndex / uBVHTexWidth;
    return texelFetch(uBVH, ivec2(col, row), 0);
}

// ---- Object ---------------------------------------------------------------
// A tagged union representing any primitive in the scene.
// To add a new primitive type:
//   1. Add a new TYPE_ constant
//   2. Pack its data into data0/data1/data2 (document what each field means)
//   3. Add a new branch in intersect()

const int TYPE_SPHERE   = 0;
const int TYPE_TRIANGLE = 1;
const int TYPE_PLANE    = 2;
// TODO: add TYPE_BOX etc. as needed

struct Object {
    int      type;
    Material mat;

    // TYPE_SPHERE   — data0 = center, data1.x = radius
    // TYPE_TRIANGLE — data0 = v0, data1 = v1, data2 = v2
    // TYPE_PLANE    — data0 = point on plane, data1 = normal
    vec3 data0;
    vec3 data1;
    vec3 data2;
};

// ---- Intersection functions -----------------------------------------------

HitRecord intersectSphere(Object obj, vec3 ro, vec3 rd) {
    HitRecord h;
    h.hit     = false;
    h.t       = 1e10;
    h.pos     = vec3(0.0);
    h.normal  = vec3(0.0, 1.0, 0.0);
    h.matType = obj.mat.type;
    h.albedo  = obj.mat.albedo;
    h.ior     = obj.mat.ior;

    vec3  center = obj.data0;
    float radius = obj.data1.x;
    vec3  oc     = ro - center;

    float b        = dot(oc, rd);
    float c        = dot(oc, oc) - radius * radius;
    float disc     = b * b - c;
    if (disc < 0.0) return h;

    float sqrtDisc = sqrt(disc);
    float t        = -b - sqrtDisc;
    if (t < 0.0001) {
        if (c >= 0.0) return h;
        t = -b + sqrtDisc;
        if (t < 0.0001) return h;
    }

    h.hit    = true;
    h.t      = t;
    h.pos    = ro + rd * t;
    h.normal = normalize(h.pos - center);
    return h;
}

// Moller-Trumbore triangle intersection
// data0 = v0, data1 = v1, data2 = v2
HitRecord intersectTriangle(Object obj, vec3 ro, vec3 rd) {
    HitRecord h;
    h.hit     = false;
    h.t       = 1e10;
    h.pos     = vec3(0.0);
    h.normal  = vec3(0.0);
    h.matType = obj.mat.type;
    h.albedo  = obj.mat.albedo;
    h.ior     = obj.mat.ior;

    vec3 v0 = obj.data0;
    vec3 v1 = obj.data1;
    vec3 v2 = obj.data2;

    vec3 e1 = v1 - v0;
    vec3 e2 = v2 - v0;

    vec3  pvec = cross(rd, e2);
    float det  = dot(e1, pvec);
    if (abs(det) < 0.000001) return h;

    float invDet = 1.0 / det;
    vec3  tvec   = ro - v0;

    float u = dot(tvec, pvec) * invDet;
    if (u < 0.0 || u > 1.0) return h;

    vec3  qvec = cross(tvec, e1);
    float v    = dot(rd, qvec) * invDet;
    if (v < 0.0 || u + v > 1.0) return h;

    float t = dot(e2, qvec) * invDet;
    if (t < 0.0001) return h;

    h.hit    = true;
    h.t      = t;
    h.pos    = ro + rd * t;
    h.normal = normalize(cross(e1, e2));
    return h;
}

// Infinite plane intersection with checkerboard pattern
// data0 = point on plane, data1 = normal
HitRecord intersectPlane(Object obj, vec3 ro, vec3 rd) {
    HitRecord h;
    h.hit     = false;
    h.t       = 1e10;
    h.pos     = vec3(0.0);
    h.matType = obj.mat.type;
    h.albedo  = obj.mat.albedo;
    h.ior     = obj.mat.ior;

    vec3 point  = obj.data0;
    vec3 normal = obj.data1;
    h.normal    = normal;

    float denom = dot(rd, normal);
    if (abs(denom) < 0.0001) return h;

    float t = dot(point - ro, normal) / denom;
    if (t < 0.0001) return h;

    h.hit = true;
    h.t   = t;
    h.pos = ro + rd * t;

    float check = mod(floor(h.pos.x * 0.5) + floor(h.pos.z * 0.5), 2.0);
    h.albedo = (check < 0.5) ? vec3(0.9) : vec3(0.15);
    return h;
}

// ---- intersect ------------------------------------------------------------

HitRecord intersect(Object obj, vec3 ro, vec3 rd) {
    if (obj.type == TYPE_SPHERE)   return intersectSphere(obj, ro, rd);
    if (obj.type == TYPE_TRIANGLE) return intersectTriangle(obj, ro, rd);
    if (obj.type == TYPE_PLANE)    return intersectPlane(obj, ro, rd);

    HitRecord miss;
    miss.hit = false;
    return miss;
}

// ---- AABB ray test --------------------------------------------------------
// https://en.wikipedia.org/wiki/Slab_method 
// Slab method: for each axis compute the interval where the ray is inside
// that axis's slab, then intersect all three intervals.
// Returns true if the ray hits the box closer than maxT.

bool hitAABB(vec3 boxMin, vec3 boxMax, vec3 ro, vec3 rd, float maxT) {
    // Compute per-axis intersection intervals
    vec3 invRd = 1.0 / rd;
    vec3 t0    = (boxMin - ro) * invRd; // entry distances per axis
    vec3 t1    = (boxMax - ro) * invRd; // exit  distances per axis

    // Sort so tMin < tMax on each axis
    vec3 tMin = min(t0, t1);
    vec3 tMax = max(t0, t1);

    // The ray is inside the box on the interval [max(tMin), min(tMax)]
    float tEnter = max(max(tMin.x, tMin.y), tMin.z);
    float tExit  = min(min(tMax.x, tMax.y), tMax.z);

    return tExit >= max(tEnter, 0.0) && tEnter < maxT;
}

// ---- BVH traversal --------------------------------------------------------
// Reads a node from the BVH texture.
// Node i occupies texels [i*3, i*3+1, i*3+2]:
//   texel 0: [ box.min.xyz, isLeaf        ]
//   texel 1: [ box.max.xyz, unused        ]
//   texel 2: [ data0,       data1, unused ]
//     interior: data0 = leftIndex,  data1 = rightIndex
//     leaf:     data0 = triStart,   data1 = triCount

const int BVH_STACK_SIZE = 64;

HitRecord intersectBVH(vec3 ro, vec3 rd) {
    HitRecord closest;
    closest.hit     = false;
    closest.t       = 1e10;
    closest.pos     = vec3(0.0);
    closest.normal  = vec3(0.0, 1.0, 0.0);
    closest.matType = MAT_DIFFUSE;
    closest.albedo  = vec3(0.8);
    closest.ior     = 1.0;

    // Iterative stack-based traversal — GLSL has no recursion
    int stack[BVH_STACK_SIZE];
    int stackPtr = 0;
    stack[stackPtr++] = 0; // push root node

    while (stackPtr > 0) {
        int nodeIndex = stack[--stackPtr]; // pop

        // Read node from BVH texture
        int   base   = nodeIndex * 3;
        vec4  t0     = fetchBVHTexel(base + 0);
        vec4  t1     = fetchBVHTexel(base + 1);
        vec4  t2     = fetchBVHTexel(base + 2);

        vec3  boxMin = t0.xyz;
        vec3  boxMax = t1.xyz;
        bool  isLeaf = t0.w > 0.5;

        // Skip this node if the ray misses its bounding box
        if (!hitAABB(boxMin, boxMax, ro, rd, closest.t)) continue;

        if (isLeaf) {
            // Test all triangles in this leaf
            int triStart = int(t2.x);
            int triCount = int(t2.y);

            for (int i = triStart; i < triStart + triCount; i++) {
                int base3 = i * 3;

                Object tri;
                tri.type       = TYPE_TRIANGLE;
                tri.mat.type   = MAT_DIFFUSE;
                tri.mat.albedo = vec3(0.8);
                tri.mat.ior    = 1.0;
                tri.data0 = fetchTexel(uPositions, base3 + 0);
                tri.data1 = fetchTexel(uPositions, base3 + 1);
                tri.data2 = fetchTexel(uPositions, base3 + 2);

                HitRecord h = intersect(tri, ro, rd);

                if (h.hit && h.t < closest.t) {
                    closest = h;
                    closest.normal = normalize(
                        fetchTexel(uNormals, base3 + 0) +
                        fetchTexel(uNormals, base3 + 1) +
                        fetchTexel(uNormals, base3 + 2)
                    );
                }
            }
        } else {
            // Push both children onto the stack
            // Right is pushed first so left is processed first (LIFO)
            int leftIndex  = int(t2.x);
            int rightIndex = int(t2.y);

            if (stackPtr < BVH_STACK_SIZE - 1) {
                stack[stackPtr++] = rightIndex;
                stack[stackPtr++] = leftIndex;
            }
        }
    }

    return closest;
}

// ---- Scene ----------------------------------------------------------------

HitRecord intersectScene(vec3 ro, vec3 rd) {
    HitRecord closest;
    closest.hit     = false;
    closest.t       = 1e10;
    closest.pos     = vec3(0.0);
    closest.normal  = vec3(0.0, 1.0, 0.0);
    closest.matType = MAT_DIFFUSE;
    closest.albedo  = vec3(0.0);
    closest.ior     = 1.0;

    HitRecord h;

    // ---- Hardcoded objects ------------------------------------------------
    // TODO: replace with a uniform buffer once the scene is dynamic

    Object s0;
    s0.type       = TYPE_SPHERE;
    s0.data0      = vec3(-2.5, 0.0, -5.0);
    s0.data1      = vec3(1.0, 0.0, 0.0);
    s0.mat.type   = MAT_DIFFUSE;
    s0.mat.albedo = vec3(0.85, 0.25, 0.15);
    s0.mat.ior    = 1.0;
    h = intersect(s0, ro, rd);
    if (h.hit && h.t < closest.t) closest = h;

    Object s1;
    s1.type       = TYPE_SPHERE;
    s1.data0      = vec3(0.0, 0.0, -5.0);
    s1.data1      = vec3(1.0, 0.0, 0.0);
    s1.mat.type   = MAT_REFLECTIVE;
    s1.mat.albedo = vec3(0.92, 0.92, 0.92);
    s1.mat.ior    = 1.0;
    h = intersect(s1, ro, rd);
    if (h.hit && h.t < closest.t) closest = h;

    Object s2;
    s2.type       = TYPE_SPHERE;
    s2.data0      = vec3(2.5, 0.0, -5.0);
    s2.data1      = vec3(1.0, 0.0, 0.0);
    s2.mat.type   = MAT_TRANSPARENT;
    s2.mat.albedo = vec3(0.96, 0.98, 1.0);
    s2.mat.ior    = 1.5;
    h = intersect(s2, ro, rd);
    if (h.hit && h.t < closest.t) closest = h;

    Object p0;
    p0.type       = TYPE_PLANE;
    p0.data0      = vec3(0.0, -1.2, 0.0);
    p0.data1      = vec3(0.0,  1.0, 0.0);
    p0.mat.type   = MAT_DIFFUSE;
    p0.mat.albedo = vec3(0.8);
    p0.mat.ior    = 1.0;
    h = intersect(p0, ro, rd);
    if (h.hit && h.t < closest.t) closest = h;

    // ---- BVH triangle traversal -------------------------------------------
    // Replaces the old brute force loop — only tests triangles the BVH
    // directs us to rather than all uTriangleCount triangles.

    if (uBVHNodeCount > 0) {
        h = intersectBVH(ro, rd);
        if (h.hit && h.t < closest.t) closest = h;
    }

    return closest;
}

// ---- Shadow ray ------------------------------------------------------------

bool inShadow(vec3 pos) {
    vec3  toLight   = uLightPos - pos;
    float lightDist = length(toLight);
    vec3  srd       = toLight / lightDist;
    vec3  sro       = pos + srd * 0.002;

    HitRecord h = intersectScene(sro, srd);
    return h.hit && h.t < lightDist;
}

// ---- Helpers ---------------------------------------------------------------

vec3 skyColor(vec3 rd) {
    float t = 0.5 * (normalize(rd).y + 1.0);
    return mix(vec3(1.0), vec3(0.45, 0.65, 1.0), t);
}

vec3 shadeDiffuse(HitRecord h) {
    vec3  toLight = normalize(uLightPos - h.pos);
    float shadow  = inShadow(h.pos) ? 0.1 : 1.0;
    float diff    = max(dot(h.normal, toLight), 0.0) * shadow;
    return h.albedo * (diff + 0.15);
}

// ---- Bounce helper ---------------------------------------------------------

vec3 bounceDir(HitRecord h, vec3 rd) {
    if (h.matType == MAT_REFLECTIVE) {
        return reflect(rd, h.normal);
    }

    bool  entering = dot(rd, h.normal) < 0.0;
    vec3  n        = entering ? h.normal : -h.normal;
    float eta      = entering ? (1.0 / h.ior) : h.ior;
    vec3  refDir   = refract(rd, n, eta);
    if (dot(refDir, refDir) < 0.001) refDir = reflect(rd, n);
    return refDir;
}

// ---- traceRay --------------------------------------------------------------
// Traces a single ray through the scene with up to three bounces.

vec3 traceRay(vec3 ro, vec3 rd) {
    HitRecord h0 = intersectScene(ro, rd);

    if (!h0.hit) return skyColor(rd);
    if (h0.matType == MAT_DIFFUSE) return shadeDiffuse(h0);

    vec3 color0 = vec3(0.0);
    if (h0.matType == MAT_REFLECTIVE) {
        vec3  toLight = normalize(uLightPos - h0.pos);
        float spec    = pow(max(dot(reflect(-toLight, h0.normal), -rd), 0.0), 128.0);
        color0 = h0.albedo * spec * 0.6;
    }

    vec3 tp0 = h0.albedo;
    rd = bounceDir(h0, rd);
    ro = h0.pos + rd * 0.002;

    HitRecord h1 = intersectScene(ro, rd);

    if (!h1.hit) return color0 + tp0 * skyColor(rd);
    if (h1.matType == MAT_DIFFUSE) return color0 + tp0 * shadeDiffuse(h1);

    vec3 color1 = color0;
    if (h1.matType == MAT_REFLECTIVE) {
        vec3  toLight = normalize(uLightPos - h1.pos);
        float spec    = pow(max(dot(reflect(-toLight, h1.normal), -rd), 0.0), 128.0);
        color1 += tp0 * h1.albedo * spec * 0.6;
    }

    vec3 tp1 = tp0 * h1.albedo;
    rd = bounceDir(h1, rd);
    ro = h1.pos + rd * 0.002;

    HitRecord h2 = intersectScene(ro, rd);
    return color1 + tp1 * (h2.hit ? shadeDiffuse(h2) : skyColor(rd));
}

// ---- Main ------------------------------------------------------------------
// Shoots SAMPLE_GRID x SAMPLE_GRID rays per pixel and averages the results.

const int SAMPLE_GRID = 1;

void main() {
    float tanHalfFov = tan(radians(75.0) * 0.5);
    vec3  totalColor = vec3(0.0);

    for (int sy = 0; sy < SAMPLE_GRID; sy++) {
        for (int sx = 0; sx < SAMPLE_GRID; sx++) {
            vec2 offset = (vec2(float(sx), float(sy)) + 0.5) / float(SAMPLE_GRID);
            vec2 uv = ((gl_FragCoord.xy + offset) / uResolution) * 2.0 - 1.0;
            uv.x   *= uResolution.x / uResolution.y;

            vec3 rd = normalize(mat3(uCameraMatrix) * vec3(uv * tanHalfFov, -1.0));
            vec3 ro = uCameraPos;

            totalColor += traceRay(ro, rd);
        }
    }

    fragColor = vec4(totalColor / float(SAMPLE_GRID * SAMPLE_GRID), 1.0);
}