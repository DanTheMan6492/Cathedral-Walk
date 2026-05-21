// BVH.js
// Builds a Bounding Volume Hierarchy over the scene's triangle data,
// then packs it into a DataTexture the fragment shader can traverse.
//
// The BVH is built once at load time and stays static until geometry changes.
// TODO: rebuild the BVH when dynamic objects are added or moved.

import * as THREE from 'three';

// ---- AABB -----------------------------------------------------------------
// An axis-aligned bounding box defined by its min and max corners.
// All BVH operations are in terms of AABBs.

function makeAABB() {
    return {
        min: new THREE.Vector3( Infinity,  Infinity,  Infinity),
        max: new THREE.Vector3(-Infinity, -Infinity, -Infinity),
    };
}

// Expand an AABB to include a point
function expandByPoint(box, point) {
    box.min.min(point);
    box.max.max(point);
}

// Expand an AABB to include another AABB
function expandByBox(box, other) {
    box.min.min(other.min);
    box.max.max(other.max);
}

// Surface area of an AABB — used by SAH cost function
function surfaceArea(box) {
    const d = new THREE.Vector3().subVectors(box.max, box.min);
    return 2.0 * (d.x * d.y + d.y * d.z + d.z * d.x);
}

// ---- Triangle data --------------------------------------------------------
// Before building the tree we precompute two things per triangle:
//   - its AABB (used to build node bounds)
//   - its centroid (used to choose and evaluate splits)
//
// The centroid is the average of the three vertices — the "center of mass"
// of the triangle. SAH uses centroids rather than vertex positions when
// deciding which side of a split a triangle belongs to. This prevents
// degenerate cases where a triangle straddles a split plane but its centroid
// clearly belongs on one side.

function computeTriangleData(positions) {
    // positions is the flat Float32Array from flattenScene
    // layout: [x0,y0,z0,0, x1,y1,z1,0, x2,y2,z2,0, ...] (4 floats per vertex due to RGBA padding)
    const triCount  = positions.length / 12; // 3 vertices * 4 floats per triangle
    const triangles = [];

    for (let i = 0; i < triCount; i++) {
        const base = i * 12;

        const v0 = new THREE.Vector3(positions[base + 0], positions[base + 1], positions[base + 2]);
        const v1 = new THREE.Vector3(positions[base + 4], positions[base + 5], positions[base + 6]);
        const v2 = new THREE.Vector3(positions[base + 8], positions[base + 9], positions[base + 10]);

        const box = makeAABB();
        expandByPoint(box, v0);
        expandByPoint(box, v1);
        expandByPoint(box, v2);

        const centroid = new THREE.Vector3()
            .addVectors(v0, v1)
            .add(v2)
            .multiplyScalar(1.0 / 3.0);

        triangles.push({ index: i, box, centroid });
    }

    return triangles;
}

// ---- SAH cost function ----------------------------------------------------
// Given a list of triangles split into two groups at a candidate split,
// returns the expected cost of traversing the resulting node.
//
// SAH cost = (leftCount * SA(leftBox) + rightCount * SA(rightBox)) / SA(parentBox)
//
// Lower cost = better split. We multiply by triangle count because more
// triangles in a box means more intersection tests if a ray enters it.

function sahCost(leftTris, rightTris, parentBox) {
    if (leftTris.length === 0 || rightTris.length === 0) return Infinity;

    const leftBox  = makeAABB();
    const rightBox = makeAABB();

    for (const tri of leftTris)  expandByBox(leftBox,  tri.box);
    for (const tri of rightTris) expandByBox(rightBox, tri.box);

    const parentSA = surfaceArea(parentBox);
    if (parentSA === 0) return Infinity;

    return (leftTris.length  * surfaceArea(leftBox) +
            rightTris.length * surfaceArea(rightBox)) / parentSA;
}

// ---- Find best split ------------------------------------------------------
// Tries splitting along each axis (X, Y, Z) at a fixed number of candidate
// positions, evaluating the SAH cost at each one.
// Returns the axis and position of the cheapest split found.
//
// We use a fixed number of buckets (candidate positions) rather than testing
// every triangle centroid as a split point. This is faster and in practice
// gives results very close to the optimal split.

// We divide each axis into 12 buckets and test a split along each segment
// min.x ---|---|---|---|---|---|---|---|---|---|---|--- max.x
//          1   2   3   4   5   6   7   8   9  10  11

const BUCKET_COUNT = 12;

function findBestSplit(triangles, nodeBox) {
    let bestCost = Infinity;
    let bestAxis = 0;
    let bestPos  = 0;

    for (let axis = 0; axis < 3; axis++) {
        const min = nodeBox.min.getComponent(axis);
        const max = nodeBox.max.getComponent(axis);
        if (max - min < 0.0001) continue; // flat on this axis, skip

        for (let b = 1; b < BUCKET_COUNT; b++) {
            const pos = min + (max - min) * (b / BUCKET_COUNT);

            const left  = triangles.filter(t => t.centroid.getComponent(axis) <  pos);
            const right = triangles.filter(t => t.centroid.getComponent(axis) >= pos);

            const cost = sahCost(left, right, nodeBox);
            if (cost < bestCost) {
                bestCost = cost;
                bestAxis = axis;
                bestPos  = pos;
            }
        }
    }

    return { bestAxis, bestPos, bestCost };
}

// ---- BVH node -------------------------------------------------------------
// Each node in the tree is either an interior node or a leaf.
//
// Interior node:
//   - box: AABB containing all triangles in its subtree
//   - left, right: child nodes
//   - isLeaf: false
//
// Leaf node:
//   - box: AABB containing its triangles
//   - triStart, triCount: range into the reordered triangle index array
//   - isLeaf: true
//
// The tree is built recursively then flattened into a linear array for
// upload to the GPU.

const MAX_LEAF_TRIS = 4; // stop splitting when a node has this few triangles

function buildNode(triangles, nodeBox) {
    // Base case — make a leaf if we have few enough triangles
    if (triangles.length <= MAX_LEAF_TRIS) {
        return { isLeaf: true, box: nodeBox, triangles };
    }

    const { bestAxis, bestPos, bestCost } = findBestSplit(triangles, nodeBox);

    if (bestCost === Infinity) {
        return { isLeaf: true, box: nodeBox, triangles };
    }

    const left  = triangles.filter(t => t.centroid.getComponent(bestAxis) <  bestPos);
    const right = triangles.filter(t => t.centroid.getComponent(bestAxis) >= bestPos);

    // If the split didn't actually separate anything, make a leaf
    // This can happen when all centroids are at the same position
    if (left.length === 0 || right.length === 0) {
        return { isLeaf: true, box: nodeBox, triangles };
    }

    const leftBox  = makeAABB();
    const rightBox = makeAABB();
    for (const tri of left)  expandByBox(leftBox,  tri.box);
    for (const tri of right) expandByBox(rightBox, tri.box);

    return {
        isLeaf: false,
        box:    nodeBox,
        left:   buildNode(left,  leftBox),
        right:  buildNode(right, rightBox),
    };
}

// ---- Flatten BVH ----------------------------------------------------------
// Converts the recursive JS object tree into two parallel flat arrays:
//   nodes       — linear array of BVH nodes for the GPU texture
//   orderedTris — triangle indices reordered so each leaf's tris are contiguous
//
// Both are built in a single depth-first traversal.
// Leaf nodes record triStart/triCount into orderedTris as they are visited.

function flattenBVH(root) {
    const nodes       = [];
    const orderedTris = [];
    const state       = { nextTri: 0 };

    function flattenNode(node) {
        const nodeIndex = nodes.length;
        nodes.push(null); // reserve slot, fill in after children are processed

        if (node.isLeaf) {
            const triStart = state.nextTri;
            for (const tri of node.triangles) {
                orderedTris.push(tri.index);
                state.nextTri++;
            }

            nodes[nodeIndex] = {
                isLeaf:   true,
                box:      node.box,
                triStart,
                triCount: node.triangles.length,
            };
        } else {
            // Recurse into children first so we know their indices
            const leftIndex  = flattenNode(node.left);
            const rightIndex = flattenNode(node.right);

            nodes[nodeIndex] = {
                isLeaf:     false,
                box:        node.box,
                leftIndex,
                rightIndex,
            };
        }

        return nodeIndex;
    }

    flattenNode(root);
    return { nodes, orderedTris };
}

// ---- buildBVH -------------------------------------------------------------
// Top-level pipeline function. Takes the raw position array from flattenScene
// and runs the full BVH construction pipeline:
//
//   computeTriangleData → buildNode → flattenBVH
//
// Returns:
//   nodes       — flat array of BVH nodes ready to be packed into a texture
//   orderedTris — triangle index array for reorderTris in ScenePacker

export function buildBVH(rawPositions) {
    console.log('Building BVH...');

    const triangles = computeTriangleData(rawPositions);

    const rootBox = makeAABB();
    for (const tri of triangles) expandByBox(rootBox, tri.box);
    const root = buildNode(triangles, rootBox);

    const { nodes, orderedTris } = flattenBVH(root);

    console.log(`BVH built: ${nodes.length} nodes, ${orderedTris.length} triangles`);

    return { nodes, orderedTris };
}