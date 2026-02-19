const fs = require('fs');
const path = require('path');

// Create a simple PNG icon using raw PNG format
// This creates a 256x256 blue square with white Hebrew letter א

function createPNG(width, height, pixels) {
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type (RGBA)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace
  
  const ihdrChunk = createChunk('IHDR', ihdr);
  
  // IDAT chunk (image data)
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + width * 4)] = 0; // filter type
    for (let x = 0; x < width; x++) {
      const idx = y * (1 + width * 4) + 1 + x * 4;
      const pixel = pixels(x, y);
      scanlines[idx] = pixel.r;
      scanlines[idx + 1] = pixel.g;
      scanlines[idx + 2] = pixel.b;
      scanlines[idx + 3] = pixel.a;
    }
  }
  
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(scanlines);
  const idatChunk = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([PNG_SIGNATURE, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = require('zlib').crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// Create a simple blue gradient icon with white text
const size = 256;
const iconPNG = createPNG(size, size, (x, y) => {
  // Create gradient from light blue to dark blue
  const gradient = y / size;
  const r = Math.floor(74 + (53 - 74) * gradient);
  const g = Math.floor(144 + (122 - 144) * gradient);
  const b = Math.floor(226 + (189 - 226) * gradient);
  
  // Simple white border
  if (x < 4 || x >= size - 4 || y < 4 || y >= size - 4) {
    return { r: 255, g: 255, b: 255, a: 255 };
  }
  
  // Draw a simple white shape in the center (representing א)
  const cx = size / 2;
  const cy = size / 2;
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  
  // Simple geometric shape
  const isShape = (
    (dx < 20 && dy < 80) || // vertical line
    (dy < 20 && dx < 40 && y < cy) || // top horizontal
    (dy < 20 && dx < 30 && y > cy) // bottom horizontal
  );
  
  if (isShape) {
    return { r: 255, g: 255, b: 255, a: 255 };
  }
  
  return { r, g, b, a: 255 };
});

// Save the base icon
const baseIconPath = 'src-tauri/base-icon.png';
fs.writeFileSync(baseIconPath, iconPNG);
console.log(`✓ Created base icon: ${baseIconPath}`);
console.log('  Size: 256x256 pixels');
console.log('  Format: PNG with RGBA');
