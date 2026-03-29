const fs = require("fs/promises");
const zlib = require("zlib");
const { promisify } = require("util");

const gunzip = promisify(zlib.gunzip);

/**
 * Reads a base64-encoded, gzip-compressed file
 * and returns parsed JSON
 */
async function readBase64GzipFile(filePath) {
    try {
        // Step 1: Read Base64 text
        const base64Data = await fs.readFile(filePath, "utf-8");

        // Step 2: Decode Base64 → Buffer
        const compressedBuffer = Buffer.from(base64Data, "base64");

        // Step 3: Decompress gzip
        const decompressedBuffer = await gunzip(compressedBuffer);

        // Step 4: Parse JSON
        return JSON.parse(decompressedBuffer.toString("utf-8"));
    } catch (err) {
        throw err;
    }
}

module.exports = readBase64GzipFile;