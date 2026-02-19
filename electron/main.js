const { app, BrowserWindow, shell, ipcMain, protocol } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let meilisearchProcess = null;

// הגדרת custom protocol לטעינת קבצים מקומיים
// Protocol זה מאפשר ל-PDF.js לקרוא קבצים ישירות מהדיסק בצורה streaming
// ללא טעינת כל הקובץ לזיכרון - חשוב מאוד לביצועים!
function setupCustomProtocol() {
  protocol.registerFileProtocol('local-file', (request, callback) => {
    let url = request.url.replace('local-file://', '');
    
    // הסר slashes מיותרים בהתחלה
    url = url.replace(/^\/+/, '');
    
    const decodedPath = decodeURIComponent(url);
    
    console.log('📄 Custom protocol request:', request.url);
    console.log('📄 Decoded path:', decodedPath);
    
    try {
      // וודא שהקובץ קיים
      if (fs.existsSync(decodedPath)) {
        console.log('✅ File found, serving via streaming:', decodedPath);
        // callback מחזיר את הנתיב - Electron יטפל ב-streaming
        callback({ path: decodedPath });
      } else {
        console.error('❌ File not found:', decodedPath);
        callback({ error: -6 }); // FILE_NOT_FOUND
      }
    } catch (error) {
      console.error('❌ Error loading file:', error);
      callback({ error: -2 }); // FAILED
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'האויצר',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // מאפשר טעינת קבצים מקומיים דרך custom protocol
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false // חשוב! מאפשר ל-preload להשתמש ב-Node modules
    },
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    frame: false, // הסרת ה-frame המקורי של Windows
    titleBarStyle: 'hidden', // הסתרת title bar
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#2a1810',
      height: 32
    }
  });

  // בסביבת פיתוח - טען מהשרת המקומי
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // בסביבת ייצור - טען מקבצים סטטיים
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // כפיית פתיחת קישורים חיצוניים ב-Edge במקום בדפדפן ברירת המחדל
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // פתיחה ב-Edge במקום בדפדפן ברירת המחדל
    openInEdge(url);
    return { action: 'deny' };
  });

  // טיפול בקישורים שנפתחים דרך navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // אם זה לא ה-URL של האפליקציה עצמה, פתח ב-Edge
    if (!url.startsWith('http://localhost:5173') && 
        !url.startsWith('file://')) {
      event.preventDefault();
      openInEdge(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// פונקציה לפתיחת URL ב-Edge
function openInEdge(url) {
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  let edgePath = edgePaths[0];
  
  // בדיקה איזה נתיב קיים
  const fs = require('fs');
  for (const path of edgePaths) {
    if (fs.existsSync(path)) {
      edgePath = path;
      break;
    }
  }

  exec(`"${edgePath}" "${url}"`, (error) => {
    if (error) {
      console.error('שגיאה בפתיחת Edge:', error);
      // אם נכשל, השתמש בדפדפן ברירת המחדל
      shell.openExternal(url);
    }
  });
}

// יצירת חלון כשהאפליקציה מוכנה
app.whenReady().then(() => {
  // הגדר custom protocol - חשוב לעשות זאת לפני יצירת החלון!
  setupCustomProtocol();
  
  // העתק Meilisearch binary אם צריך
  setupMeilisearch();
  
  // הגדר IPC handlers
  setupIpcHandlers();
  
  createWindow();
});

// רישום protocol schemes לפני שהאפליקציה מוכנה
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('local-file', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('local-file');
}

// הגדרת Meilisearch
function setupMeilisearch() {
  try {
    const userDataPath = app.getPath('userData');
    const meilisearchDir = path.join(userDataPath, 'meilisearch');
    const meilisearchExe = path.join(meilisearchDir, 'meilisearch.exe');
    
    // בדוק אם Meilisearch כבר קיים
    if (fs.existsSync(meilisearchExe)) {
      console.log('✅ Meilisearch כבר מותקן ב:', meilisearchExe);
      return;
    }
    
    // צור תיקייה
    if (!fs.existsSync(meilisearchDir)) {
      fs.mkdirSync(meilisearchDir, { recursive: true });
    }
    
    // נסה מספר נתיבים אפשריים
    let sourcePath = null;
    
    // במצב production
    if (process.resourcesPath) {
      sourcePath = path.join(process.resourcesPath, 'resources', 'meilisearch', 'meilisearch.exe');
    }
    
    // במצב development - נסה נתיבים שונים
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      const devPaths = [
        path.join(__dirname, '..', 'resources', 'meilisearch', 'meilisearch.exe'),
        path.join(process.cwd(), 'resources', 'meilisearch', 'meilisearch.exe'),
        path.join(__dirname, '..', '..', 'resources', 'meilisearch', 'meilisearch.exe')
      ];
      
      for (const devPath of devPaths) {
        console.log('מחפש ב:', devPath);
        if (fs.existsSync(devPath)) {
          sourcePath = devPath;
          break;
        }
      }
    }
    
    if (sourcePath && fs.existsSync(sourcePath)) {
      console.log('📦 מעתיק Meilisearch מ:', sourcePath);
      fs.copyFileSync(sourcePath, meilisearchExe);
      console.log('✅ Meilisearch הועתק בהצלחה ל:', meilisearchExe);
    } else {
      console.warn('⚠️ Meilisearch לא נמצא. חיפשתי ב:');
      console.warn('  - process.resourcesPath:', process.resourcesPath);
      console.warn('  - __dirname:', __dirname);
      console.warn('  - process.cwd():', process.cwd());
      console.warn('הורד את Meilisearch ידנית מ: https://github.com/meilisearch/meilisearch/releases');
      console.warn('והעתק ל:', meilisearchExe);
    }
  } catch (error) {
    console.error('❌ שגיאה בהגדרת Meilisearch:', error);
  }
}

// הגדרת IPC handlers
function setupIpcHandlers() {
  // פעולות חלון
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });
  
  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });
  
  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });
  
  ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });
  
  // קבלת נתיב userData
  ipcMain.on('get-user-data-path', (event) => {
    event.returnValue = app.getPath('userData');
  });
  
  // קבלת נתיב האפליקציה
  ipcMain.on('get-app-path', (event) => {
    event.returnValue = app.getAppPath();
  });
  
  // בחירת תיקייה
  ipcMain.handle('select-folder', async () => {
    try {
      console.log('📁 Opening folder selection dialog...');
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'בחר תיקיית ספרים'
      });
      
      console.log('📁 Dialog result:', result);
      
      if (!result.canceled && result.filePaths.length > 0) {
        console.log('✅ Folder selected:', result.filePaths[0]);
        return { success: true, path: result.filePaths[0] };
      }
      console.log('❌ Dialog canceled');
      return { success: false };
    } catch (error) {
      console.error('❌ Error in select-folder:', error);
      return { success: false, error: error.message };
    }
  });
  
  // הפעלת Meilisearch
  ipcMain.handle('start-meilisearch', async (event, config) => {
    try {
      if (meilisearchProcess) {
        console.log('⚠️ Meilisearch כבר רץ');
        return { success: true, message: 'Already running' };
      }
      
      const userDataPath = app.getPath('userData');
      const meilisearchExe = path.join(userDataPath, 'meilisearch', 'meilisearch.exe');
      
      if (!fs.existsSync(meilisearchExe)) {
        return { success: false, error: 'Meilisearch not found' };
      }
      
      const dbPath = path.join(userDataPath, 'meilisearch-data');
      if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
      }
      
      const args = [
        '--db-path', dbPath,
        '--http-addr', `127.0.0.1:${config.port || 7700}`,
        '--no-analytics'
      ];
      
      // הוסף master key רק אם סופק
      if (config.masterKey) {
        args.push('--master-key', config.masterKey);
      }
      
      console.log('🚀 מפעיל Meilisearch:', meilisearchExe, args);
      
      meilisearchProcess = spawn(meilisearchExe, args, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      meilisearchProcess.stdout.on('data', (data) => {
        console.log(`Meilisearch: ${data}`);
      });
      
      meilisearchProcess.stderr.on('data', (data) => {
        console.error(`Meilisearch Error: ${data}`);
      });
      
      meilisearchProcess.on('error', (error) => {
        console.error('❌ שגיאה בהפעלת Meilisearch:', error);
        meilisearchProcess = null;
      });
      
      meilisearchProcess.on('exit', (code) => {
        console.log(`Meilisearch נסגר עם קוד: ${code}`);
        meilisearchProcess = null;
      });
      
      // המתן שהשרת יעלה
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return { success: true, message: 'Started successfully' };
    } catch (error) {
      console.error('❌ שגיאה בהפעלת Meilisearch:', error);
      return { success: false, error: error.message };
    }
  });
  
  // עצירת Meilisearch
  ipcMain.handle('stop-meilisearch', async () => {
    try {
      if (meilisearchProcess) {
        meilisearchProcess.kill();
        meilisearchProcess = null;
        console.log('🛑 Meilisearch נסגר');
        return { success: true };
      }
      return { success: true, message: 'Not running' };
    } catch (error) {
      console.error('❌ שגיאה בעצירת Meilisearch:', error);
      return { success: false, error: error.message };
    }
  });
  
  // חיפוש גימטריה
  ipcMain.handle('search-gematria', async (event, options) => {
    try {
      const { searchGematriaInFiles } = require(path.join(__dirname, '../src/utils/gematriaSearchEngine.js'));
      const booksPath = path.join(app.getAppPath(), 'books');
      
      console.log('🔍 מחפש גימטריה:', options);
      console.log('📚 בתיקייה:', booksPath);
      
      const results = await searchGematriaInFiles(booksPath, options.targetValue, {
        method: options.method || 'regular',
        useKolel: options.useKolel || false,
        wholeVerseOnly: options.wholeVerseOnly || false,
        maxPhraseWords: options.maxPhraseWords || 8,
        fileLimit: 500
      });
      
      console.log('✅ נמצאו', results.length, 'תוצאות');
      
      return { success: true, results };
    } catch (error) {
      console.error('❌ שגיאה בחיפוש גימטריה:', error);
      return { success: false, error: error.message, results: [] };
    }
  });
  
  // הרצת סקריפט Node.js
  ipcMain.handle('run-script', async (event, scriptName) => {
    try {
      const scriptPath = path.join(app.getAppPath(), 'scripts', scriptName);
      
      if (!fs.existsSync(scriptPath)) {
        return { success: false, error: `הסקריפט ${scriptName} לא נמצא` };
      }
      
      console.log('🚀 מריץ סקריפט:', scriptPath);
      
      return new Promise((resolve) => {
        const child = spawn('node', [scriptPath], {
          cwd: app.getAppPath(),
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let output = '';
        let errorOutput = '';
        
        child.stdout.on('data', (data) => {
          const text = data.toString();
          output += text;
          console.log(text);
        });
        
        child.stderr.on('data', (data) => {
          const text = data.toString();
          errorOutput += text;
          console.error(text);
        });
        
        child.on('close', (code) => {
          if (code === 0) {
            console.log('✅ הסקריפט הסתיים בהצלחה');
            resolve({ success: true, output, code });
          } else {
            console.error('❌ הסקריפט נכשל עם קוד:', code);
            resolve({ success: false, error: errorOutput || 'הסקריפט נכשל', code, output });
          }
        });
        
        child.on('error', (error) => {
          console.error('❌ שגיאה בהרצת הסקריפט:', error);
          resolve({ success: false, error: error.message });
        });
      });
    } catch (error) {
      console.error('❌ שגיאה בהרצת סקריפט:', error);
      return { success: false, error: error.message };
    }
  });
}

// סגירת האפליקציה כשכל החלונות נסגרים (למעט macOS)
app.on('window-all-closed', () => {
  // סגור Meilisearch
  if (meilisearchProcess) {
    meilisearchProcess.kill();
    meilisearchProcess = null;
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// יצירת חלון חדש כשהאפליקציה מופעלת מחדש (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
