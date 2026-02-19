// סקריפט להעתקת ספרים למיקום AppLocalData
const fs = require('fs');
const path = require('path');
const os = require('os');

// קבל את נתיב AppLocalData
function getAppLocalDataPath() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  if (platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local'), 'com.haotzer.app');
  } else if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'com.haotzer.app');
  } else {
    return path.join(homeDir, '.local', 'share', 'com.haotzer.app');
  }
}

// העתק תיקייה רקורסיבית
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ הועתק: ${entry.name}`);
    }
  }
}

// הפעלה ראשית
function main() {
  const booksSource = path.join(__dirname, '..', 'books');
  const appDataPath = getAppLocalDataPath();
  const booksDest = path.join(appDataPath, 'books');
  
  console.log('📚 מעתיק ספרים...');
  console.log('מקור:', booksSource);
  console.log('יעד:', booksDest);
  
  if (!fs.existsSync(booksSource)) {
    console.error('❌ תיקיית books לא נמצאה!');
    process.exit(1);
  }
  
  try {
    copyDir(booksSource, booksDest);
    console.log('✅ כל הספרים הועתקו בהצלחה!');
    console.log('📁 מיקום הספרים:', booksDest);
  } catch (error) {
    console.error('❌ שגיאה בהעתקת ספרים:', error);
    process.exit(1);
  }
}

main();
