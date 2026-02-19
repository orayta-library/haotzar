#!/usr/bin/env node
// סקריפט לבדיקת קיום ומצב האינדקס
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

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   🔍 בדיקת אינדקס חיפוש - האויצר     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  
  const appDataPath = getAppLocalDataPath();
  const indexPath = path.join(appDataPath, 'search-index.json');
  
  console.log('📁 נתיב אינדקס:', indexPath);
  console.log('');
  
  // בדוק אם התיקייה קיימת
  if (!fs.existsSync(appDataPath)) {
    console.log('❌ תיקיית AppData לא קיימת');
    console.log('💡 הרץ את האפליקציה פעם אחת כדי ליצור את התיקייה');
    process.exit(1);
  }
  
  console.log('✅ תיקיית AppData קיימת');
  
  // בדוק אם האינדקס קיים
  if (!fs.existsSync(indexPath)) {
    console.log('❌ קובץ אינדקס לא נמצא');
    console.log('');
    console.log('💡 לבניית אינדקס, הרץ:');
    console.log('   npm run build:index:ui');
    console.log('   או');
    console.log('   npm run build:index');
    process.exit(1);
  }
  
  console.log('✅ קובץ אינדקס קיים');
  console.log('');
  
  // קרא את האינדקס
  try {
    const stats = fs.statSync(indexPath);
    const content = fs.readFileSync(indexPath, 'utf8');
    const indexData = JSON.parse(content);
    
    console.log('📊 פרטי אינדקס:');
    console.log('─────────────────────────────────────────');
    console.log(`  גודל קובץ: ${formatBytes(stats.size)}`);
    console.log(`  תאריך יצירה: ${stats.birthtime.toLocaleString('he-IL')}`);
    console.log(`  תאריך עדכון: ${stats.mtime.toLocaleString('he-IL')}`);
    console.log('');
    
    if (indexData.stats) {
      console.log('📈 סטטיסטיקות:');
      console.log('─────────────────────────────────────────');
      console.log(`  קבצים באינדקס: ${indexData.stats.totalFiles || 0}`);
      console.log(`  מילים ייחודיות: ${(indexData.stats.totalWords || 0).toLocaleString('he-IL')}`);
      if (indexData.stats.buildTime) {
        console.log(`  זמן בנייה: ${indexData.stats.buildTime}`);
      }
      console.log('');
    }
    
    if (indexData.filesMetadata) {
      const fileCount = Object.keys(indexData.filesMetadata).length;
      console.log(`📚 קבצים: ${fileCount}`);
      
      if (fileCount > 0) {
        console.log('');
        console.log('רשימת קבצים:');
        Object.values(indexData.filesMetadata).slice(0, 10).forEach((file, i) => {
          console.log(`  ${i + 1}. ${file.name} (${file.type})`);
        });
        
        if (fileCount > 10) {
          console.log(`  ... ועוד ${fileCount - 10} קבצים`);
        }
      }
    }
    
    console.log('');
    console.log('✅ האינדקס תקין ומוכן לשימוש!');
    
  } catch (error) {
    console.log('❌ שגיאה בקריאת האינדקס:', error.message);
    console.log('');
    console.log('💡 האינדקס עשוי להיות פגום. נסה לבנות מחדש:');
    console.log('   npm run build:index');
    process.exit(1);
  }
}

main();
