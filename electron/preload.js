const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// משתנה גלובלי לשמירת חיבור ל-DB של אוצריא
let otzariaDB = null;
// Cache של prepared statements לביצועים טובים יותר
const preparedStatementsCache = new Map();

// חשיפת API בטוח לדף
contextBridge.exposeInMainWorld('electron', {
  // פעולות חלון
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  
  // קריאת קובץ
  readFile: (filePath) => {
    return fs.readFileSync(filePath, 'utf8');
  },
  
  // קריאת קובץ כ-ArrayBuffer (לשימוש עם PDF)
  readFileAsBuffer: (filePath) => {
    const buffer = fs.readFileSync(filePath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  },
  
  // כתיבת קובץ
  writeFile: (filePath, data) => {
    fs.writeFileSync(filePath, data, 'utf8');
  },
  
  // בדיקה אם קובץ קיים
  fileExists: (filePath) => {
    return fs.existsSync(filePath);
  },
  
  // מחיקת קובץ
  deleteFile: (filePath) => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  },
  
  // קבלת נתיב userData - דרך IPC
  getUserDataPath: () => {
    return ipcRenderer.sendSync('get-user-data-path');
  },
  
  // יצירת נתיב מלא
  joinPath: (...paths) => {
    return path.join(...paths);
  },
  
  // יצירת תיקייה
  createDir: (dirPath) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  },
  
  // העתקת קובץ
  copyFile: (source, destination) => {
    fs.copyFileSync(source, destination);
  },
  
  // קבלת נתיב האפליקציה - דרך IPC
  getAppPath: () => {
    return ipcRenderer.sendSync('get-app-path');
  },
  
  // סריקת קבצים בתיקיות
  // חשוב: פונקציה זו רק אוספת נתיבי קבצים (strings)
  // היא לא קוראת את תוכן הקבצים לזיכרון!
  // הקבצים נטענים רק כשהמשתמש פותח אותם, בצורה streaming דרך PDF.js
  scanBooksInPaths: (paths) => {
    const allFiles = [];
    
    function scanDirectory(dir) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // סרוק רקורסיבית
            scanDirectory(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext === '.pdf' || ext === '.txt') {
              // שמור רק את הנתיב - לא קורא את הקובץ!
              allFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning ${dir}:`, error.message);
      }
    }
    
    // סרוק כל תיקייה
    console.log('🔍 Starting scan of', paths.length, 'paths');
    for (const dirPath of paths) {
      if (fs.existsSync(dirPath)) {
        console.log('✅ Scanning:', dirPath);
        scanDirectory(dirPath);
      } else {
        console.warn('⚠️ Path does not exist:', dirPath);
      }
    }
    
    console.log('📚 Scan complete. Found', allFiles.length, 'files');
    return allFiles;
  },
  
  // קבלת נתיב תיקיית books
  getBooksPath: () => {
    const appPath = ipcRenderer.sendSync('get-app-path');
    return path.join(appPath, 'books');
  },
  
  // בחירת תיקייה דרך dialog
  selectFolder: async () => {
    return ipcRenderer.invoke('select-folder');
  },
  
  // חיפוש גימטריה
  searchGematria: async (options) => {
    return ipcRenderer.invoke('search-gematria', options);
  },
  
  // הרצת סקריפט Node.js
  runScript: async (scriptName) => {
    return ipcRenderer.invoke('run-script', scriptName);
  },
  
  // פתיחת מסד נתונים של אוצריא
  openOtzariaDB: async (dbPath) => {
    try {
      const Database = require('better-sqlite3');
      otzariaDB = new Database(dbPath, { readonly: true });
      return { success: true };
    } catch (error) {
      console.error('Error opening Otzaria DB:', error);
      
      // בדיקה אם זו שגיאת NODE_MODULE_VERSION
      if (error.message && error.message.includes('NODE_MODULE_VERSION')) {
        return { 
          success: false, 
          error: error.message,
          needsRebuild: true,
          solution: 'Run: npm rebuild better-sqlite3'
        };
      }
      
      return { success: false, error: error.message };
    }
  },
  
  // שאילתה למסד נתונים אוצריא (עם cache של prepared statements)
  queryOtzariaDB: (sql, params = []) => {
    if (!otzariaDB) {
      throw new Error('Otzaria DB is not open');
    }
    try {
      // בדוק אם יש prepared statement ב-cache
      let stmt = preparedStatementsCache.get(sql);
      
      if (!stmt) {
        // צור prepared statement חדש ושמור ב-cache
        stmt = otzariaDB.prepare(sql);
        preparedStatementsCache.set(sql, stmt);
        console.log('📝 Created and cached prepared statement for:', sql.substring(0, 50) + '...');
      }
      
      return stmt.all(...params);
    } catch (error) {
      console.error('Error querying Otzaria DB:', error);
      throw error;
    }
  },
  
  // סגירת מסד נתונים אוצריא
  closeOtzariaDB: () => {
    if (otzariaDB) {
      // נקה את cache של prepared statements
      preparedStatementsCache.clear();
      otzariaDB.close();
      otzariaDB = null;
      console.log('✅ Otzaria DB closed and cache cleared');
    }
  }
});
