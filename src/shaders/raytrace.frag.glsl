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

// ---- Texture fetch helper -------------------------------------------------
// Converts a flat texel index to 2D coordinates and fetches the value.

vec3 fetchTexel(sampler2D tex, int flatIndex) {
    int col = flatIndex - (flatIndex / uTexWidth) * uTexWidth;
    int row = flatIndex / uTexWidth;
    return texelFetch(tex, ivec2(col, row), 0).xyz;
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
        // Only take the far intersection when the ray starts inside the sphere
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
// TODO: understand this algorithm a bit better...
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

    h.normal = normal; // now safe to assign since normal is defined

    float denom = dot(rd, normal);
    if (abs(denom) < 0.0001) return h;

    float t = dot(point - ro, normal) / denom;
    if (t < 0.0001) return h;

    h.hit = true;
    h.t   = t;
    h.pos = ro + rd * t;

    // Checkerboard pattern overwrites albedo at hit point
    float check = mod(floor(h.pos.x * 0.5) + floor(h.pos.z * 0.5), 2.0);
    h.albedo = (check < 0.5) ? vec3(0.9) : vec3(0.15);
    return h;
}

// TODO: add intersectBox() etc. here as new primitives are added
// ---------------------------------------------------------------------------


// ---- intersect ------------------------------------------------------------
// The polymorphic dispatch point.
// Material is already baked into HitRecord by each intersection function.

HitRecord intersect(Object obj, vec3 ro, vec3 rd) {
    if (obj.type == TYPE_SPHERE)   return intersectSphere(obj, ro, rd);
    if (obj.type == TYPE_TRIANGLE) return intersectTriangle(obj, ro, rd);
    if (obj.type == TYPE_PLANE)    return intersectPlane(obj, ro, rd);

    // TODO: add branches for new primitive types here

    HitRecord miss;
    miss.hit = false;
    return miss;
}
// ---------------------------------------------------------------------------


// ---- Scene ----------------------------------------------------------------
// TODO: once BVH is added, replace the linear loop with BVH traversal.
//       The fetchTexel calls and HitRecord logic stay identical.

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
    p0.data0      = vec3(0.0, -1.2, 0.0); // point on plane
    p0.data1      = vec3(0.0,  1.0, 0.0); // normal (pointing up)
    p0.mat.type   = MAT_DIFFUSE;
    p0.mat.albedo = vec3(0.8); // overwritten by checkerboard in intersectPlane
    p0.mat.ior    = 1.0;
    h = intersect(p0, ro, rd);
    if (h.hit && h.t < closest.t) closest = h;

    // -----------------------------------------------------------------------

    // ---- Triangle texture (cathedral geometry) ----------------------------
    // TODO: once BVH is added, replace the linear loop with BVH traversal.

    for (int i = 0; i < uTriangleCount; i++) {
        int base = i * 3;

        Object tri;
        tri.type       = TYPE_TRIANGLE;
        tri.mat.type   = MAT_DIFFUSE;
        tri.mat.albedo = vec3(0.8);
        tri.mat.ior    = 1.0;
        tri.data0 = fetchTexel(uPositions, base + 0); // v0
        tri.data1 = fetchTexel(uPositions, base + 1); // v1
        tri.data2 = fetchTexel(uPositions, base + 2); // v2

        h = intersect(tri, ro, rd);

        if (h.hit && h.t < closest.t) {
            closest = h;
            // Average vertex normals from the normal texture
            // TODO: interpolate using barycentric coordinates for smooth shading
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


// ---- Shadow ray ------------------------------------------------------------

bool inShadow(vec3 pos) {
    vec3  toLight   = uLightPos - pos;
    float lightDist = length(toLight);
    vec3  srd       = toLight / lightDist;
    vec3  sro       = pos + srd * 0.002;

    // Cast shadow ray against the full scene
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
// Given an incident ray hitting a reflective or transparent surface,
// return the new ray direction after the bounce.

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

// ---- Main ------------------------------------------------------------------
// Fully unrolled: no loops, guaranteed output at every path.
// Three bounces cover diffuse, mirror, and glass enter/exit paths.

void main() {
    vec2 uv = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
    uv.x   *= uResolution.x / uResolution.y;

    // FOV-correct ray reconstruction — must match Three.js camera (75 degrees)
    float tanHalfFov = tan(radians(75.0) * 0.5);
    vec3 rd = normalize(mat3(uCameraMatrix) * vec3(uv * tanHalfFov, -1.0));
    vec3 ro = uCameraPos;

    // ---- Bounce 0 ----------------------------------------------------------
    HitRecord h0 = intersectScene(ro, rd);

    if (!h0.hit) {
        fragColor = vec4(skyColor(rd), 1.0);
        return;
    }

    if (h0.matType == MAT_DIFFUSE) {
        fragColor = vec4(shadeDiffuse(h0), 1.0);
        return;
    }

    vec3 color0 = vec3(0.0);
    if (h0.matType == MAT_REFLECTIVE) {
        vec3  toLight = normalize(uLightPos - h0.pos);
        float spec    = pow(max(dot(reflect(-toLight, h0.normal), -rd), 0.0), 128.0);
        color0 = h0.albedo * spec * 0.6;
    }

    vec3 tp0 = h0.albedo;
    rd = bounceDir(h0, rd);
    ro = h0.pos + rd * 0.002;

    // ---- Bounce 1 ----------------------------------------------------------
    HitRecord h1 = intersectScene(ro, rd);

    if (!h1.hit) {
        fragColor = vec4(color0 + tp0 * skyColor(rd), 1.0);
        return;
    }

    if (h1.matType == MAT_DIFFUSE) {
        fragColor = vec4(color0 + tp0 * shadeDiffuse(h1), 1.0);
        return;
    }

    vec3 color1 = color0;
    if (h1.matType == MAT_REFLECTIVE) {
        vec3  toLight = normalize(uLightPos - h1.pos);
        float spec    = pow(max(dot(reflect(-toLight, h1.normal), -rd), 0.0), 128.0);
        color1 += tp0 * h1.albedo * spec * 0.6;
    }

    vec3 tp1 = tp0 * h1.albedo;
    rd = bounceDir(h1, rd);
    ro = h1.pos + rd * 0.002;

    // ---- Bounce 2 (final) --------------------------------------------------
    HitRecord h2 = intersectScene(ro, rd);

    vec3 finalColor = h2.hit ? shadeDiffuse(h2) : skyColor(rd);
    fragColor = vec4(color1 + tp1 * finalColor, 1.0);
}