const fs = require('fs');
const path = require('path');

// Create minimal placeholder icons for CI/CD builds
const targetDir = 'src-tauri/icons';

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Create a minimal 1x1 PNG (base64 encoded)
const minimalPNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Create PNG files
const pngFiles = ['32x32.png', '128x128.png', '128x128@2x.png', 'icon.png'];
pngFiles.forEach(filename => {
  fs.writeFileSync(path.join(targetDir, filename), minimalPNG);
  console.log(`✓ Created ${filename}`);
});

// Create a minimal ICO file (16x16, 1-bit color)
const minimalICO = Buffer.from([
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x10, 0x10, 0x00, 0x00, 0x01, 0x00,
  0x01, 0x00, 0x30, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00, 0x28, 0x00,
  0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x01, 0x00,
  0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x00
]);

fs.writeFileSync(path.join(targetDir, 'icon.ico'), minimalICO);
console.log('✓ Created icon.ico');

// Create a dummy ICNS file for macOS
fs.writeFileSync(path.join(targetDir, 'icon.icns'), Buffer.alloc(0));
console.log('✓ Created icon.icns');

console.log('\n✅ All placeholder icons generated successfully!');
console.log('⚠️  Note: These are minimal placeholders. Replace with actual icons for production.');
