const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

async function generateIcons() {
  const targetDir = 'src-tauri/icons';
  
  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Create a simple colored square as icon
  const sizes = [32, 128, 256];
  
  for (const size of sizes) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Create a gradient background
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#4A90E2');
    gradient.addColorStop(1, '#357ABD');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Add a border
    ctx.strokeStyle = '#2C5F8D';
    ctx.lineWidth = Math.max(2, size / 32);
    ctx.strokeRect(0, 0, size, size);
    
    // Add Hebrew letter א in the center
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('א', size / 2, size / 2);
    
    // Save PNG files
    const buffer = canvas.toBuffer('image/png');
    if (size === 32) {
      fs.writeFileSync(path.join(targetDir, '32x32.png'), buffer);
      console.log('✓ Created 32x32.png');
    } else if (size === 128) {
      fs.writeFileSync(path.join(targetDir, '128x128.png'), buffer);
      console.log('✓ Created 128x128.png');
    } else if (size === 256) {
      fs.writeFileSync(path.join(targetDir, '128x128@2x.png'), buffer);
      console.log('✓ Created 128x128@2x.png');
    }
  }
  
  // Copy 128x128 as icon.png
  fs.copyFileSync(
    path.join(targetDir, '128x128.png'),
    path.join(targetDir, 'icon.png')
  );
  console.log('✓ Created icon.png');
  
  console.log('\n⚠️  Note: ICO and ICNS files need to be created with specialized tools.');
  console.log('Please install @tauri-apps/cli and run: npm run tauri icon src-tauri/icons/128x128.png');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
