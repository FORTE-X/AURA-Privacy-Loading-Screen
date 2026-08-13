import fs from "node:fs";
import path from "node:path";

const [, , sourcePath, destinationPath] = process.argv;

if (!sourcePath || !destinationPath) {
    throw new Error(
        "Usage: node scripts/strip-glb-textures.mjs <source.glb> <destination.glb>"
    );
}

const source = fs.readFileSync(sourcePath);
const { json, binary } = parseGlb(source);
const imageBufferViews = new Set(
    (json.images ?? [])
        .map((image) => image.bufferView)
        .filter(Number.isInteger)
);
const retainedViews = [];
const bufferViewMap = new Map();

json.bufferViews.forEach((view, index) => {
    if (imageBufferViews.has(index)) return;

    const byteOffset = view.byteOffset ?? 0;
    const bytes = binary.subarray(byteOffset, byteOffset + view.byteLength);

    bufferViewMap.set(index, retainedViews.length);
    retainedViews.push({
        ...view,
        byteOffset: 0,
        bytes
    });
});

json.accessors?.forEach((accessor) => {
    if (Number.isInteger(accessor.bufferView)) {
        accessor.bufferView = requireMappedView(accessor.bufferView);
    }

    if (Number.isInteger(accessor.sparse?.indices?.bufferView)) {
        accessor.sparse.indices.bufferView = requireMappedView(
            accessor.sparse.indices.bufferView
        );
    }

    if (Number.isInteger(accessor.sparse?.values?.bufferView)) {
        accessor.sparse.values.bufferView = requireMappedView(
            accessor.sparse.values.bufferView
        );
    }
});

json.meshes?.forEach((mesh) => {
    mesh.primitives?.forEach((primitive) => {
        primitive.material = 0;
    });
});

json.materials = [{
    name: "Front Floral Gradient Placeholder",
    doubleSided: true,
    pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 1
    }
}];
delete json.images;
delete json.textures;
delete json.samplers;
delete json.animations;

const binaryChunks = [];
let binaryLength = 0;

retainedViews.forEach((view) => {
    const alignedOffset = alignToFour(binaryLength);

    if (alignedOffset > binaryLength) {
        binaryChunks.push(Buffer.alloc(alignedOffset - binaryLength));
        binaryLength = alignedOffset;
    }

    view.byteOffset = binaryLength;
    binaryChunks.push(view.bytes);
    binaryLength += view.bytes.length;
    delete view.bytes;
});

const binaryPadding = alignToFour(binaryLength) - binaryLength;

if (binaryPadding > 0) binaryChunks.push(Buffer.alloc(binaryPadding));

const optimizedBinary = Buffer.concat(binaryChunks);

json.bufferViews = retainedViews;
json.buffers = [{ byteLength: optimizedBinary.length }];

const jsonBuffer = padBuffer(
    Buffer.from(JSON.stringify(json)),
    0x20
);
const binBuffer = padBuffer(optimizedBinary, 0x00);
const totalLength = 12 + 8 + jsonBuffer.length + 8 + binBuffer.length;
const output = Buffer.alloc(totalLength);
let offset = 0;

output.writeUInt32LE(0x46546c67, offset); // glTF
offset += 4;
output.writeUInt32LE(2, offset);
offset += 4;
output.writeUInt32LE(totalLength, offset);
offset += 4;
output.writeUInt32LE(jsonBuffer.length, offset);
offset += 4;
output.writeUInt32LE(0x4e4f534a, offset); // JSON
offset += 4;
jsonBuffer.copy(output, offset);
offset += jsonBuffer.length;
output.writeUInt32LE(binBuffer.length, offset);
offset += 4;
output.writeUInt32LE(0x004e4942, offset); // BIN
offset += 4;
binBuffer.copy(output, offset);

fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
fs.writeFileSync(destinationPath, output);

console.log(`${path.basename(sourcePath)}: ${source.length} -> ${output.length} bytes`);

function parseGlb(buffer) {
    if (buffer.readUInt32LE(0) !== 0x46546c67 || buffer.readUInt32LE(4) !== 2) {
        throw new Error(`${sourcePath} is not a valid GLB 2.0 file.`);
    }

    const jsonLength = buffer.readUInt32LE(12);
    const jsonType = buffer.readUInt32LE(16);

    if (jsonType !== 0x4e4f534a) {
        throw new Error(`${sourcePath} has no JSON chunk.`);
    }

    const jsonStart = 20;
    const jsonEnd = jsonStart + jsonLength;
    const binaryHeader = jsonEnd;
    const binaryLength = buffer.readUInt32LE(binaryHeader);
    const binaryType = buffer.readUInt32LE(binaryHeader + 4);

    if (binaryType !== 0x004e4942) {
        throw new Error(`${sourcePath} has no binary chunk.`);
    }

    return {
        json: JSON.parse(buffer.subarray(jsonStart, jsonEnd).toString("utf8")),
        binary: buffer.subarray(binaryHeader + 8, binaryHeader + 8 + binaryLength)
    };
}

function requireMappedView(index) {
    const mapped = bufferViewMap.get(index);

    if (!Number.isInteger(mapped)) {
        throw new Error(`Geometry references removed buffer view ${index}.`);
    }

    return mapped;
}

function alignToFour(value) {
    return Math.ceil(value / 4) * 4;
}

function padBuffer(buffer, fill) {
    const paddedLength = alignToFour(buffer.length);

    if (paddedLength === buffer.length) return buffer;

    return Buffer.concat([
        buffer,
        Buffer.alloc(paddedLength - buffer.length, fill)
    ]);
}
