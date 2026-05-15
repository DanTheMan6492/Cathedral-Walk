// raytrace.frag
// Ray Tracing pipeline
//
// Each fragment invocation handles one pixel.
// Supports three unrolled ray bounces across three material types:
//   MAT_DIFFUSE     - Lambertian shading with shadow rays
//   MAT_REFLECTIVE  - Mirror reflection with specular highlight
//   MAT_TRANSPARENT - Glass refraction (Snell's law) with TIR fallback

precision highp float;

uniform vec2  uResolution;
uniform vec3  uCameraPos;
uniform mat4  uCameraMatrix;
uniform vec3  uLightPos;

const int MAT_DIFFUSE     = 0;
const int MAT_REFLECTIVE  = 1;
const int MAT_TRANSPARENT = 2;

struct HitRecord {
    bool  hit;
    float t;
    vec3  pos;
    vec3  normal;
    int   matType;
    vec3  albedo;
    float ior;
};

// ---- Sphere intersection ---------------------------------------------------

HitRecord hitSphere(vec3 center, float radius,
                    int matType, vec3 albedo, float ior,
                    vec3 ro, vec3 rd) {
    HitRecord h;
    h.hit     = false;
    h.t       = 1e10;
    h.pos     = vec3(0.0);
    h.normal  = vec3(0.0, 1.0, 0.0);
    h.matType = matType;
    h.albedo  = albedo;
    h.ior     = ior;

    vec3  oc       = ro - center;
    float b        = dot(oc, rd);
    float c        = dot(oc, oc) - radius * radius;
    float disc     = b * b - c;
    if (disc < 0.0) return h;

    float sqrtDisc = sqrt(disc);
    float t        = -b - sqrtDisc;
    if (t < 0.001) {
        // Only take the far intersection when the ray starts inside the sphere.
        if (c >= 0.0) return h;
        t = -b + sqrtDisc;
        if (t < 0.001) return h;
    }

    h.hit    = true;
    h.t      = t;
    h.pos    = ro + rd * t;
    h.normal = normalize(h.pos - center);
    return h;
}

// ---- Plane intersection (infinite, checkerboard diffuse) -------------------

HitRecord hitPlane(vec3 point, vec3 normal, vec3 ro, vec3 rd) {
    HitRecord h;
    h.hit     = false;
    h.t       = 1e10;
    h.pos     = vec3(0.0);
    h.normal  = normal;
    h.matType = MAT_DIFFUSE;
    h.albedo  = vec3(0.8);
    h.ior     = 1.0;

    float denom = dot(rd, normal);
    if (abs(denom) < 0.0001) return h;

    float t = dot(point - ro, normal) / denom;
    if (t < 0.001) return h;

    h.hit = true;
    h.t   = t;
    h.pos = ro + rd * t;

    float check = mod(floor(h.pos.x * 0.5) + floor(h.pos.z * 0.5), 2.0);
    h.albedo = (check < 0.5) ? vec3(0.9) : vec3(0.15);
    return h;
}

// ---- Scene: three spheres + ground plane -----------------------------------

HitRecord intersectScene(vec3 ro, vec3 rd) {
    HitRecord best;
    best.hit     = false;
    best.t       = 1e10;
    best.pos     = vec3(0.0);
    best.normal  = vec3(0.0, 1.0, 0.0);
    best.matType = MAT_DIFFUSE;
    best.albedo  = vec3(0.0);
    best.ior     = 1.0;

    HitRecord h;

    h = hitSphere(vec3(-2.5, 0.0, -5.0), 1.0,
                  MAT_DIFFUSE, vec3(0.85, 0.25, 0.15), 1.0, ro, rd);
    if (h.hit && h.t < best.t) best = h;

    h = hitSphere(vec3(0.0, 0.0, -5.0), 1.0,
                  MAT_REFLECTIVE, vec3(0.92, 0.92, 0.92), 1.0, ro, rd);
    if (h.hit && h.t < best.t) best = h;

    h = hitSphere(vec3(2.5, 0.0, -5.0), 1.0,
                  MAT_TRANSPARENT, vec3(0.96, 0.98, 1.0), 1.5, ro, rd);
    if (h.hit && h.t < best.t) best = h;

    h = hitPlane(vec3(0.0, -1.2, 0.0), vec3(0.0, 1.0, 0.0), ro, rd);
    if (h.hit && h.t < best.t) best = h;

    return best;
}

// ---- Shadow ray ------------------------------------------------------------

bool inShadow(vec3 pos) {
    vec3  toLight   = uLightPos - pos;
    float lightDist = length(toLight);
    vec3  srd       = toLight / lightDist;
    vec3  sro       = pos + srd * 0.002;

    HitRecord h;

    h = hitSphere(vec3(-2.5, 0.0, -5.0), 1.0,
                  MAT_DIFFUSE, vec3(0.0), 1.0, sro, srd);
    if (h.hit && h.t < lightDist) return true;

    h = hitSphere(vec3(0.0, 0.0, -5.0), 1.0,
                  MAT_REFLECTIVE, vec3(0.0), 1.0, sro, srd);
    if (h.hit && h.t < lightDist) return true;

    h = hitPlane(vec3(0.0, -1.2, 0.0), vec3(0.0, 1.0, 0.0), sro, srd);
    if (h.hit && h.t < lightDist) return true;

    return false;
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
// Given an incident ray hitting a reflective or transparent surface, return
// the new ray direction after the bounce.

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
// Fully unrolled: no loops, no break, guaranteed output at every path.
// Three bounces are enough for diffuse, mirror, and glass enter/exit paths.

void main() {
    vec2 uv = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
    uv.x   *= uResolution.x / uResolution.y;

    vec3 rd = normalize(mat3(uCameraMatrix) * vec3(uv, -1.0));
    vec3 ro = uCameraPos;

    // ---- Bounce 0 ----------------------------------------------------------
    HitRecord h0 = intersectScene(ro, rd);

    if (!h0.hit) {
        gl_FragColor = vec4(skyColor(rd), 1.0);
        return;
    }

    if (h0.matType == MAT_DIFFUSE) {
        gl_FragColor = vec4(shadeDiffuse(h0), 1.0);
        return;
    }

    // Reflective surfaces add a specular term; transparent surfaces only bend.
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
        gl_FragColor = vec4(color0 + tp0 * skyColor(rd), 1.0);
        return;
    }

    if (h1.matType == MAT_DIFFUSE) {
        gl_FragColor = vec4(color0 + tp0 * shadeDiffuse(h1), 1.0);
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
    gl_FragColor = vec4(color1 + tp1 * finalColor, 1.0);
}
