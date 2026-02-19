const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  const targetDir = 'src-tauri/icons';
  
  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Create a simple SVG icon
  const svgIcon = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4A90E2;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#357ABD;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#grad)" rx="64"/>
      <text x="256" y="340" font-family="Arial" font-size="320" font-weight="bold" 
            fill="white" text-anchor="middle">א</text>
    </svg>
  `;

  const svgBuffer = Buffer.from(svgIcon);

  // Generate PNG files
  const sizes = [
    { size: 32, name: '32x32.png' },
    { size: 128, name: '128x128.png' },
    { size: 256, name: '128x128@2x.png' },
    { size: 128, name: 'icon.png' }
  ];

  for (const { size, name } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(targetDir, name));
    console.log(`✓ Created ${name}`);
  }

  // Create a valid ICO file with multiple sizes
  // ICO format requires specific structure, so we'll create a proper one
  const ico32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  const ico16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
  
  // Create ICO file header and directory
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type: 1 = ICO
  icoHeader.writeUInt16LE(2, 4); // Number of images
  
  // Create directory entries
  const dirEntry1 = Buffer.alloc(16);
  dirEntry1.writeUInt8(32, 0); // Width
  dirEntry1.writeUInt8(32, 1); // Height
  dirEntry1.writeUInt8(0, 2); // Color palette
  dirEntry1.writeUInt8(0, 3); // Reserved
  dirEntry1.writeUInt16LE(1, 4); // Color planes
  dirEntry1.writeUInt16LE(32, 6); // Bits per pixel
  dirEntry1.writeUInt32LE(ico32.length, 8); // Image size
  dirEntry1.writeUInt32LE(6 + 32, 12); // Image offset
  
  const dirEntry2 = Buffer.alloc(16);
  dirEntry2.writeUInt8(16, 0); // Width
  dirEntry2.writeUInt8(16, 1); // Height
  dirEntry2.writeUInt8(0, 2); // Color palette
  dirEntry2.writeUInt8(0, 3); // Reserved
  dirEntry2.writeUInt16LE(1, 4); // Color planes
  dirEntry2.writeUInt16LE(32, 6); // Bits per pixel
  dirEntry2.writeUInt32LE(ico16.length, 8); // Image size
  dirEntry2.writeUInt32LE(6 + 32 + ico32.length, 12); // Image offset
  
  // Combine all parts
  const icoFile = Buffer.concat([icoHeader, dirEntry1, dirEntry2, ico32, ico16]);
  fs.writeFileSync(path.join(targetDir, 'icon.ico'), icoFile);
  console.log('✓ Created icon.ico');
  
  // Create empty ICNS for macOS (will be ignored on Windows builds)
  fs.writeFileSync(path.join(targetDir, 'icon.icns'), Buffer.alloc(0));
  console.log('✓ Created icon.icns (placeholder)');
  
  console.log('\n✅ All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  console.error('\nFalling back to minimal icons...');
  
  // Fallback: create minimal valid PNG
  const minimalPNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  
  const targetDir = 'src-tauri/icons';
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  ['32x32.png', '128x128.png', '128x128@2x.png', 'icon.png'].forEach(name => {
    fs.writeFileSync(path.join(targetDir, name), minimalPNG);
  });
  
  fs.writeFileSync(path.join(targetDir, 'icon.ico'), minimalPNG);
  fs.writeFileSync(path.join(targetDir, 'icon.icns'), Buffer.alloc(0));
  
  console.log('✓ Created fallback icons');
  process.exit(1);
});
