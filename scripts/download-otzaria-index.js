#!/usr/bin/env node
/**
 * סקריפט להורדת אינדקס אוצריא מוכן מ-GitHub Actions artifacts
 * חוסך זמן בניה ארוך - פשוט מוריד אינדקס מוכן
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GITHUB_REPO = 'YOUR_USERNAME/YOUR_REPO'; // עדכן את זה!
const ARTIFACT_NAME = 'otzaria-index';
const OUTPUT_DIR = path.join(__dirname, '..', 'index-otzaria');

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
        process.stdout.write(`\r📥 Downloading: ${percent}%`);
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('\n✅ Download complete');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('🚀 Otzaria Index Downloader\n');
  
  // בדוק אם יש GitHub token
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    console.error('💡 Create a token at: https://github.com/settings/tokens');
    console.error('💡 Then run: export GITHUB_TOKEN=your_token_here');
    process.exit(1);
  }
  
  console.log('📡 Fetching latest artifact from GitHub Actions...');
  
  // כאן תצטרך להוסיף קוד להורדה מ-GitHub API
  // לעת עתה, נניח שיש קישור ישיר
  
  console.log('⚠️  This script requires GitHub API integration');
  console.log('💡 For now, download manually from:');
  console.log(`   https://github.com/${GITHUB_REPO}/actions`);
  console.log('');
  console.log('📝 Steps:');
  console.log('   1. Go to Actions tab');
  console.log('   2. Find "Build Otzaria Index" workflow');
  console.log('   3. Download the "otzaria-index" artifact');
  console.log('   4. Extract to: index-otzaria/');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
