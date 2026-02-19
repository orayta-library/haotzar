const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MEILISEARCH_VERSION = 'v1.5.1';
const PLATFORM = process.platform === 'win32' ? 'windows' : process.platform;
const ARCH = process.arch === 'x64' ? 'amd64' : 'arm64';

const downloadUrl = `https://github.com/meilisearch/meilisearch/releases/download/${MEILISEARCH_VERSION}/meilisearch-${PLATFORM}-${ARCH}${PLATFORM === 'windows' ? '.exe' : ''}`;

const outputDir = path.join(__dirname, '..', 'resources', 'meilisearch');
const outputFile = path.join(outputDir, PLATFORM === 'windows' ? 'meilisearch.exe' : 'meilisearch');

console.log(`📥 מוריד Meilisearch ${MEILISEARCH_VERSION} עבור ${PLATFORM}-${ARCH}...`);
console.log(`URL: ${downloadUrl}`);

// צור תיקייה
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// הורד קובץ
const file = fs.createWriteStream(outputFile);

https.get(downloadUrl, (response) => {
  if (response.statusCode === 302 || response.statusCode === 301) {
    // עקוב אחרי redirect
    https.get(response.headers.location, (redirectResponse) => {
      const totalSize = parseInt(redirectResponse.headers['content-length'], 10);
      let downloaded = 0;

      redirectResponse.on('data', (chunk) => {
        downloaded += chunk.length;
        const percent = ((downloaded / totalSize) * 100).toFixed(1);
        process.stdout.write(`\r📥 הורדה: ${percent}%`);
      });

      redirectResponse.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('\n✅ Meilisearch הורד בהצלחה!');
        console.log(`📂 מיקום: ${outputFile}`);
        
        // הפוך לקובץ הפעלה (Linux/Mac)
        if (PLATFORM !== 'windows') {
          try {
            fs.chmodSync(outputFile, '755');
            console.log('✅ הרשאות הפעלה הוגדרו');
          } catch (error) {
            console.error('❌ שגיאה בהגדרת הרשאות:', error);
          }
        }
      });
    });
  } else {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('\n✅ Meilisearch הורד בהצלחה!');
    });
  }
}).on('error', (error) => {
  fs.unlink(outputFile, () => {});
  console.error('❌ שגיאה בהורדה:', error.message);
  process.exit(1);
});
