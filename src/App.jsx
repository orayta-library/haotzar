
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Button,
  Text,
  MenuDivider,
  Card,
} from '@fluentui/react-components';
import {
  DocumentRegular,
  DocumentTextRegular,
  SettingsRegular,
  SearchRegular,
  CopyRegular,
  ArrowDownloadRegular,
  PrintRegular,
  DeleteRegular,
  HomeRegular,
  BookRegular,
  BookOpenRegular,
  CalendarRegular,
  WrenchRegular,
  DismissRegular,
  LibraryRegular,
  PinRegular,
  PinOffRegular,
  SubtractRegular,
  SquareRegular,
  SquareMultipleRegular,
  ArrowClockwiseRegular,
  ChevronDownRegular,
} from '@fluentui/react-icons';
import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import TextViewer from './TextViewer';
import PDFViewer from './PDFViewer';
import Settings from './Settings';
import SearchResults from './SearchResults';
import SearchPage from './SearchPage';
import LibraryHome from './components/LibraryHome';
import SearchAutocomplete from './components/SearchAutocomplete';
import MetadataTableEditor from './components/MetadataTableEditor';
import ToolsPage from './components/ToolsPage';
import LibrarySidebar from './components/LibrarySidebar';
import FileTree from './components/FileTree';
import BookPreview from './components/BookPreview';
import FolderPreview from './components/FolderPreview';
import { loadSettings, saveSettings, updateSetting, getSetting } from './utils/settingsManager';
import otzariaDB from './utils/otzariaDB';
import { buildOtzariaVirtualTree, searchOtzariaBooks } from './utils/otzariaIntegration';
import searchEngine from './utils/searchEngine';
import meilisearchEngine from './utils/meilisearchEngine';
import booksMetadata from './utils/booksMetadata';
import { autoConvertSearch } from './utils/hebrewConverter';
import './utils/meilisearchTest'; // טוען פונקציות בדיקה ל-window.testMeilisearch
import './App.css';

// ערכת צבעים מותאמת אישית - חום-שחור
const customLightTheme = {
  ...webLightTheme,
  colorBrandBackground: "#5c3d2e",
  colorBrandBackgroundHover: "#4a3124",
  colorBrandBackgroundPressed: "#3d2817",
  colorBrandBackgroundSelected: "#5c3d2e",
  colorBrandForeground1: "#5c3d2e",
  colorBrandForeground2: "#4a3124",
  colorBrandStroke1: "#5c3d2e",
  colorBrandStroke2: "#8b6f47",
};

const customDarkTheme = {
  ...webDarkTheme,
  colorBrandBackground: "#8b6f47",
  colorBrandBackgroundHover: "#a68a5c",
  colorBrandBackgroundPressed: "#c4a574",
  colorBrandBackgroundSelected: "#8b6f47",
  colorBrandForeground1: "#c4a574",
  colorBrandForeground2: "#a68a5c",
  colorBrandStroke1: "#8b6f47",
  colorBrandStroke2: "#a68a5c",
};

function App() {
  const [isDark, setIsDark] = useState(() => getSetting('theme', 'light') === 'dark');
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [allFiles, setAllFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState(''); // חיפוש בדף החיפוש
  const [headerSearchQuery, setHeaderSearchQuery] = useState(''); // חיפוש בסרגל העליון
  const [showHeaderAutocomplete, setShowHeaderAutocomplete] = useState(false);
  const [headerSuggestions, setHeaderSuggestions] = useState([]);
  const isTypingRef = useRef(false); // עוקב אחרי האם המשתמש מקליד
  const abbrDictionaryRef = useRef(null);
  const [abbrDictionaryReady, setAbbrDictionaryReady] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [contextMenuTarget, setContextMenuTarget] = useState(null);
  const [currentView, setCurrentView] = useState(() => {
    // תמיד התחל בתצוגת ספרים - אם אין כרטיסיות, נפתח כרטיסיית חיפוש
    return 'books';
  }); // 'books', 'home', 'tools', 'settings', 'metadata'
  const [selectedTool, setSelectedTool] = useState('calendar'); // הכלי שנבחר בדף הכלים
  const [recentBooks, setRecentBooks] = useState(() => getSetting('recentBooks', []));
  const [customBooksPath, setCustomBooksPath] = useState(() => getSetting('customBooksPath', null));
  
  // מצב גרירת כרטיסיות
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverTab, setDragOverTab] = useState(null);
  
  // שולחנות עבודה
  const [workspaces, setWorkspaces] = useState(() => getSetting('workspaces', [
    { id: 'default', name: 'ברירת מחדל', tabs: [] }
  ]));
  const [currentWorkspace, setCurrentWorkspace] = useState(() => getSetting('currentWorkspace', 'default'));
  
  // מצבי חיפוש מתקדם
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  
  // מצב סיידבר ספרייה - סגור כברירת מחדל
  const [isLibrarySidebarOpen, setIsLibrarySidebarOpen] = useState(false);
  
  // תצוגה מקדימה של תיקייה
  const [folderPreview, setFolderPreview] = useState(null);
  
  // דיאלוג ספרייה ב-empty state
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  
  // דיאלוג כרטיסיות פתוחות
  const [showTabsDialog, setShowTabsDialog] = useState(false);
  
  // Split View - תצוגה מפוצלת
  const [isSelectingSecondTab, setIsSelectingSecondTab] = useState(false);
  const [splitViewFirstTab, setSplitViewFirstTab] = useState(null);
  
  const toggleLibrary = () => {
    setShowLibraryDialog(!showLibraryDialog);
  };
  
  // ספרים מוצמדים
  const [pinnedBooks, setPinnedBooks] = useState(() => getSetting('pinnedBooks', []));

  // הגדרת data-theme ראשונית
  useEffect(() => {
    const initialTheme = getSetting('theme', 'light');
    document.documentElement.setAttribute('data-theme', initialTheme);
    
    // טעינת צבע הבסיס השמור
    const savedColor = getSetting('accentColor', '#5c3d2e');
    const root = document.documentElement;
    root.style.setProperty('--colorBrandBackground', savedColor);
    root.style.setProperty('--colorBrandBackgroundHover', savedColor);
    root.style.setProperty('--colorBrandBackgroundPressed', savedColor);
    root.style.setProperty('--colorBrandBackgroundSelected', savedColor);
    root.style.setProperty('--colorBrandForeground1', savedColor);
    root.style.setProperty('--colorBrandForeground2', savedColor);
    root.style.setProperty('--colorBrandStroke1', savedColor);
    root.style.setProperty('--colorBrandStroke2', savedColor);
    
    // טעינת הגדרות רקע
    const savedBackgroundMode = getSetting('backgroundMode', 'with-image');
    if (savedBackgroundMode === 'none') {
      root.style.setProperty('--show-background-image', 'none');
      root.style.setProperty('--appBackgroundColor', '#ffffff');
      root.style.setProperty('--appBackgroundColorSecondary', '#f5f5f5');
      document.body.classList.remove('with-background');
    } else {
      root.style.setProperty('--show-background-image', 'block');
      root.style.setProperty('--appBackgroundColor', '#f7ead8');
      root.style.setProperty('--appBackgroundColorSecondary', '#f0e3d0');
      document.body.classList.add('with-background');
    }
  }, []);

  // שמירת ערכת הצבעים
  useEffect(() => {
    updateSetting('theme', isDark ? 'dark' : 'light');
    // הוספת data-theme לגוף המסמך
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // הסרת מסך טעינה כשהאפליקציה מוכנה
  useEffect(() => {
    if (allFiles.length > 0 || openTabs.length > 0) {
      // המתן רגע קצר כדי לוודא שהכל נטען
      const timer = setTimeout(() => {
        document.body.classList.add('loaded');
        // הסר את מסך הטעינה לגמרי אחרי האנימציה
        setTimeout(() => {
          const loadingScreen = document.getElementById('loading-screen');
          if (loadingScreen) {
            loadingScreen.remove();
          }
        }, 300);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [allFiles, openTabs]);

  // שמירת מצב הכרטיסיות לשולחן העבודה הנוכחי
  const saveTabsState = (tabs, activeId) => {
    try {
      // בדיקת תקינות
      if (!tabs || !Array.isArray(tabs)) {
        console.warn('saveTabsState: tabs is not an array', tabs);
        return;
      }
      
      if (!workspaces || !Array.isArray(workspaces)) {
        console.warn('saveTabsState: workspaces is not an array', workspaces);
        return;
      }
      
      if (!currentWorkspace) {
        console.warn('saveTabsState: currentWorkspace is not defined');
        return;
      }
      
      // עדכן את שולחן העבודה הנוכחי
      const updated = workspaces.map(w => 
        w.id === currentWorkspace ? { ...w, tabs } : w
      );
      setWorkspaces(updated);
      updateSetting('workspaces', updated);
      
      // שמור גם את הכרטיסייה הפעילה
      updateSetting('activeTabId', activeId);
    } catch (error) {
      console.error('Error in saveTabsState:', error);
    }
  };

  // טעינת מצב הכרטיסיות משולחן העבודה הנוכחי
  const loadTabsState = () => {
    const workspace = workspaces.find(w => w.id === currentWorkspace);
    if (workspace && workspace.tabs && workspace.tabs.length > 0) {
      return {
        openTabs: workspace.tabs,
        activeTabId: getSetting('activeTabId', null),
      };
    }
    return null;
  };

  // טעינת קבצים מתיקיית books (PDF וטקסט)
  useEffect(() => {
    const loadFiles = async () => {
      try {
        // טעינת מטא-דאטה של ספרים
        console.log('📚 טוען מטא-דאטה של ספרים...');
        await booksMetadata.loadMetadata();
        
        // בדיקה אם אנחנו ב-Electron או Tauri
        const isElectron = window.electron !== undefined;
        const isTauri = window.__TAURI__ !== undefined;
        const isDesktop = isElectron || isTauri;
        
        // פתיחת מסד נתונים של אוצריא (אם קיים)
        if (isElectron || isTauri) {
          try {
            console.log('📖 מנסה לפתוח מסד נתונים של אוצריא...');
            const otzariaPath = isElectron 
              ? window.electron.joinPath(window.electron.getAppPath(), 'books', 'אוצריא', 'seforim.db')
              : await invoke('get_otzaria_db_path');
            
            console.log('📍 נתיב אוצריא:', otzariaPath);
            
            if (isElectron) {
              const exists = window.electron.fileExists(otzariaPath);
              console.log('🔍 הקובץ קיים?', exists);
              
              if (exists) {
                console.log('✅ קובץ נמצא, פותח...');
                const opened = await otzariaDB.open(otzariaPath);
                if (opened) {
                  const stats = otzariaDB.getStats();
                  console.log('✅ מסד נתונים אוצריא נפתח:', stats);
                } else {
                  console.error('❌ נכשל לפתוח את מסד הנתונים');
                  console.error('');
                  console.error('🔧 פתרון: הרץ את הפקודה הבאה בטרמינל:');
                  console.error('   npm rebuild better-sqlite3');
                  console.error('');
                  console.error('או:');
                  console.error('   npm install --force better-sqlite3');
                  console.error('');
                  
                  // הצג התראה למשתמש
                  setTimeout(() => {
                    if (window.confirm(
                      '⚠️ שגיאה בפתיחת מסד נתונים אוצריא\n\n' +
                      'better-sqlite3 צריך rebuild.\n\n' +
                      'הרץ בטרמינל:\n' +
                      'npm rebuild better-sqlite3\n\n' +
                      'האם לפתוח את התיעוד?'
                    )) {
                      window.open('https://github.com/WiseLibs/better-sqlite3#installation', '_blank');
                    }
                  }, 2000);
                }
              } else {
                console.warn('⚠️ קובץ seforim.db לא נמצא ב:', otzariaPath);
                console.warn('💡 הנח את הקובץ ב: books/אוצריא/seforim.db');
              }
            } else if (isTauri) {
              // ננסה לפתוח ב-Tauri
              const opened = await otzariaDB.open(otzariaPath);
              if (opened) {
                console.log('✅ מסד נתונים אוצריא נפתח (Tauri)');
              }
            }
          } catch (error) {
            console.error('❌ שגיאה בפתיחת מסד נתונים אוצריא:', error);
            console.error('📋 פרטי שגיאה:', error.message);
          }
        }
        
        // בחר מנוע חיפוש
        const activeEngine = isDesktop ? meilisearchEngine : searchEngine;
        
        console.log('🔍 מזהה סביבה:', isElectron ? 'Electron' : isTauri ? 'Tauri' : 'Browser');
        console.log('🔧 מנוע חיפוש:', isDesktop ? 'Meilisearch' : 'FlexSearch');
        
        // הפעל Meilisearch באפליקציה דסקטופ
        if (isDesktop) {
          console.log('🚀 מפעיל Meilisearch...');
          const started = await meilisearchEngine.startServer();
          if (!started) {
            console.warn('⚠️ לא ניתן להפעיל Meilisearch, חוזר ל-FlexSearch');
            // fallback ל-FlexSearch אם Meilisearch נכשל
          } else {
            console.log('✅ Meilisearch הופעל בהצלחה!');
          }
        }
        
        // טעינת קבצים דרך Tauri או Electron
        if (isTauri) {
          // טעינת קבצים דרך Rust commands (עוקף בעיות scope)
          
          try {
            console.log('📚 מנסה לטעון ספרים דרך Rust API...');
            
            // קבל את רשימת התיקיות מההגדרות
            const libraryFoldersSetting = getSetting('libraryFolders', ['books']);
            console.log('📚 Library folders from settings:', libraryFoldersSetting);
            
            // בנה רשימת נתיבים לסריקה
            const scanPaths = [];
            
            for (const folder of libraryFoldersSetting) {
              if (folder === 'books') {
                // תיקיית books ברירת המחדל - קבל את הנתיב המלא
                try {
                  const booksPath = await invoke('get_books_path');
                  scanPaths.push(booksPath);
                  console.log('📁 תיקיית books:', booksPath);
                } catch (error) {
                  console.error('שגיאה בקבלת נתיב books:', error);
                }
              } else {
                // תיקייה מותאמת אישית - השתמש בנתיב כמו שהוא
                scanPaths.push(folder);
                console.log('📁 תיקייה מותאמת:', folder);
              }
            }

            console.log('📁 Total scan paths:', scanPaths);

            if (scanPaths.length === 0) {
              console.warn('⚠️ אין תיקיות מוגדרות לסריקה');
              alert('אין תיקיות ספרייה מוגדרות.\n\nעבור להגדרות > ניהול נתונים > תיקיות ספרייה\nוהוסף תיקייה עם ספרים.');
              setAllFiles([]);
              return;
            }

            console.log('📁 סורק תיקיות:', scanPaths);
            const bookFiles = await invoke('scan_books_in_paths', { paths: scanPaths });
            console.log(`✅ נמצאו ${bookFiles.length} קבצים`);
            console.log('📋 First 5 files:', bookFiles.slice(0, 5));
            
            if (bookFiles.length === 0) {
              console.warn('⚠️ לא נמצאו ספרים');

              const primaryPath = scanPaths[0];
              const openFolder = window.confirm(
                `📚 לא נמצאו ספרים!\n\n` +
                `תיקיות שנסרקו:\n${scanPaths.join('\n')}\n\n` +
                `הוסף קבצי PDF או TXT לתיקיות אלו.\n\n` +
                `האם לפתוח את תיקיית הספרים עכשיו?`
              );
              
              if (openFolder) {
                try {
                  await invoke('open_books_folder', { path: primaryPath });
                } catch (error) {
                  console.error('שגיאה בפתיחת תיקייה:', error);
                  alert(`לא ניתן לפתוח את התיקייה אוטומטית.\n\nפתח ידנית את:\n${primaryPath}`);
                }
              }
              
              // אל תחזור - תן למשתמש לגשת להגדרות
              setAllFiles([]);
              // המשך לטעון את האפליקציה גם בלי ספרים
            }
            
            const pdfFiles = [];
            const textFiles = [];
            
            bookFiles.forEach((filePath, index) => {
              const fileName = filePath.split(/[/\\]/).pop();
              const lowerName = fileName.toLowerCase();
              
              if (lowerName.endsWith('.pdf')) {
                pdfFiles.push({
                  id: `pdf-${index}`,
                  name: fileName.replace(/\.pdf$/i, ''),
                  path: filePath,
                  type: 'pdf',
                });
              } else if (lowerName.endsWith('.txt')) {
                textFiles.push({
                  id: `txt-${index}`,
                  name: fileName.replace(/\.txt$/i, ''),
                  path: filePath,
                  type: 'text',
                });
              }
            });
            
            console.log('📊 PDF:', pdfFiles.length, 'TXT:', textFiles.length);
            
            if (pdfFiles.length === 0 && textFiles.length === 0) {
              console.warn('⚠️ לא נמצאו קבצי PDF או TXT');
              setAllFiles([]);
              // המשך לטעון את האפליקציה - תן למשתמש לגשת להגדרות
            } else {
              const allFiles = [...pdfFiles, ...textFiles];
              allFiles.sort((a, b) => a.name.localeCompare(b.name, 'he'));
              console.log('📚 Total files after processing:', allFiles.length);
              console.log('📚 Sample files:', allFiles.slice(0, 3).map(f => ({ name: f.name, path: f.path })));
              setAllFiles(allFiles);
            }
            console.log('✅ setAllFiles called with', allFiles.length, 'files');
            
            // טעינת אינדקס קיים (האינדקס נבנה מראש) - רק אם צריך
            console.log('📋 בודק אם יש אינדקס חיפוש...');
            const activeEngine = isElectron && meilisearchEngine.isReady() 
              ? meilisearchEngine 
              : searchEngine;
            
            if (isElectron && meilisearchEngine.isReady()) {
              console.log('✅ Meilisearch מוכן לשימוש');
            } else {
              // טען אינדקס רק אם המשתמש מחפש
              console.log('ℹ️ אינדקס חיפוש יטען בעת הצורך');
            }
            
            if (allFiles.length > 0) {
              const savedState = loadTabsState();
              if (savedState && savedState.openTabs.length > 0) {
                const validTabs = savedState.openTabs.filter(savedTab =>
                  allFiles.some(file => file.id === savedTab.id)
                );
                if (validTabs.length > 0) {
                  setOpenTabs(validTabs);
                  const activeTabExists = validTabs.some(tab => tab.id === savedState.activeTabId);
                  setActiveTabId(activeTabExists ? savedState.activeTabId : validTabs[0].id);
                  return;
                }
              }
              // אם אין כרטיסיות שמורות, אל תפתח כלום - תן למשתמש לבחור
              setOpenTabs([]);
              setActiveTabId(null);
              setCurrentView('books');
            } else {
              console.warn('לא נמצאו קבצי PDF או TXT');
            }
          } catch (error) {
            console.error('שגיאה בטעינת קבצים מ-AppData:', error);
            console.error('פרטי השגיאה:', error.message);
            // אם אין תיקיית books, הצג הודעה למשתמש
            setAllFiles([]);
          }
        } else if (isElectron) {
          // Electron - טען מתיקיות מוגדרות
          try {
            console.log('📚 טוען ספרים ב-Electron...');
            
            // קבל את רשימת התיקיות מההגדרות
            const libraryFoldersSetting = getSetting('libraryFolders', ['books']);
            console.log('📚 Library folders from settings:', libraryFoldersSetting);
            
            // בנה רשימת נתיבים לסריקה
            const scanPaths = [];
            
            for (const folder of libraryFoldersSetting) {
              if (folder === 'books') {
                // תיקיית books ברירת המחדל - קבל את הנתיב המלא
                const booksPath = window.electron.getBooksPath();
                scanPaths.push(booksPath);
                console.log('📁 תיקיית books:', booksPath);
              } else {
                // תיקייה מותאמת אישית - השתמש בנתיב כמו שהוא
                scanPaths.push(folder);
                console.log('📁 תיקייה מותאמת:', folder);
              }
            }

            console.log('📁 Total scan paths:', scanPaths);

            if (scanPaths.length === 0) {
              console.warn('⚠️ אין תיקיות מוגדרות לסריקה');
              alert('אין תיקיות ספרייה מוגדרות.\n\nעבור להגדרות > ניהול נתונים > תיקיות ספרייה\nוהוסף תיקייה עם ספרים.');
              setAllFiles([]);
              return;
            }

            console.log('📁 סורק תיקיות:', scanPaths);
            const bookFiles = window.electron.scanBooksInPaths(scanPaths);
            console.log(`✅ נמצאו ${bookFiles.length} קבצים`);
            
            if (bookFiles.length > 0) {
              console.log('📋 First 10 files:', bookFiles.slice(0, 10));
              console.log('📋 Last 5 files:', bookFiles.slice(-5));
            }
            
            if (bookFiles.length === 0) {
              console.warn('⚠️ לא נמצאו ספרים');
              alert(`📚 לא נמצאו ספרים!\n\nתיקיות שנסרקו:\n${scanPaths.join('\n')}\n\nהוסף קבצי PDF או TXT לתיקיות אלו.`);
              setAllFiles([]);
              return;
            }
            
            const pdfFiles = [];
            const textFiles = [];
            
            bookFiles.forEach((filePath, index) => {
              const fileName = filePath.split(/[/\\]/).pop();
              const lowerName = fileName.toLowerCase();
              
              if (lowerName.endsWith('.pdf')) {
                pdfFiles.push({
                  id: `pdf-${index}`,
                  name: fileName.replace(/\.pdf$/i, ''),
                  path: filePath,
                  type: 'pdf',
                });
              } else if (lowerName.endsWith('.txt')) {
                textFiles.push({
                  id: `txt-${index}`,
                  name: fileName.replace(/\.txt$/i, ''),
                  path: filePath,
                  type: 'text',
                });
              }
            });
            
            console.log('📊 PDF:', pdfFiles.length, 'TXT:', textFiles.length);
            
            if (pdfFiles.length === 0 && textFiles.length === 0) {
              console.error('❌ לא נמצאו קבצי PDF או TXT!');
              alert('לא נמצאו ספרים!\n\nהאפליקציה לא מצאה קבצי PDF או TXT.');
              setAllFiles([]);
              return;
            }
            
            const allFiles = [...pdfFiles, ...textFiles];
            allFiles.sort((a, b) => a.name.localeCompare(b.name, 'he'));
            console.log('📚 Total files after processing:', allFiles.length);
            console.log('📚 Sample files:', allFiles.slice(0, 3).map(f => ({ name: f.name, path: f.path })));
            setAllFiles(allFiles);
            console.log('✅ setAllFiles called with', allFiles.length, 'files');
            
            // טעינת אינדקס קיים - רק אם צריך
            console.log('📋 בודק אם יש אינדקס חיפוש...');
            if (meilisearchEngine.isReady()) {
              console.log('✅ Meilisearch מוכן לשימוש');
            } else {
              // טען אינדקס רק אם המשתמש מחפש
              console.log('ℹ️ אינדקס חיפוש יטען בעת הצורך');
            }
            
            if (allFiles.length > 0) {
              const savedState = loadTabsState();
              if (savedState && savedState.openTabs.length > 0) {
                const validTabs = savedState.openTabs.filter(savedTab =>
                  allFiles.some(file => file.id === savedTab.id)
                );
                if (validTabs.length > 0) {
                  setOpenTabs(validTabs);
                  const activeTabExists = validTabs.some(tab => tab.id === savedState.activeTabId);
                  setActiveTabId(activeTabExists ? savedState.activeTabId : validTabs[0].id);
                  return;
                }
              }
              // אם אין כרטיסיות שמורות, אל תפתח כלום - תן למשתמש לבחור
              setOpenTabs([]);
              setActiveTabId(null);
              setCurrentView('books');
            }
          } catch (error) {
            console.error('שגיאה בטעינת קבצים ב-Electron:', error);
            setAllFiles([]);
          }
        } else {
          // במצב פיתוח - טען מתיקיית books הרגילה
          const pdfModules = import.meta.glob('/books/**/*.pdf', { eager: false });
          const pdfFiles = Object.keys(pdfModules).map((path, index) => {
            const fileName = path.split('/').pop();
            const nameWithoutExt = fileName.replace('.pdf', '');

            return {
              id: `pdf-${index}`,
              name: nameWithoutExt,
              path: path,
              type: 'pdf',
            };
          });

          const textModules = import.meta.glob('/books/**/*.txt', { eager: false });
          const textFiles = Object.keys(textModules).map((path, index) => {
            const fileName = path.split('/').pop();
            const nameWithoutExt = fileName.replace('.txt', '');

            return {
              id: `txt-${index}`,
              name: nameWithoutExt,
              path: path,
              type: 'text',
            };
          });

          const allFiles = [...pdfFiles, ...textFiles];
          allFiles.sort((a, b) => a.name.localeCompare(b.name, 'he'));

          setAllFiles(allFiles);

          // טעינת אינדקס קיים (האינדקס נבנה מראש) - רק אם צריך
          console.log('📋 בודק אם יש אינדקס חיפוש...');
          const activeEngine = isElectron && meilisearchEngine.isReady() 
            ? meilisearchEngine 
            : searchEngine;
          
          if (isElectron && meilisearchEngine.isReady()) {
            console.log('✅ Meilisearch מוכן לשימוש');
          } else {
            // טען אינדקס רק אם המשתמש מחפש
            console.log('ℹ️ אינדקס חיפוש יטען בעת הצורך');
          }

          const savedState = loadTabsState();
          if (savedState && savedState.openTabs.length > 0) {
            const validTabs = savedState.openTabs.filter(savedTab =>
              allFiles.some(file => file.id === savedTab.id)
            );

            if (validTabs.length > 0) {
              setOpenTabs(validTabs);
              const activeTabExists = validTabs.some(tab => tab.id === savedState.activeTabId);
              setActiveTabId(activeTabExists ? savedState.activeTabId : validTabs[0].id);
              return;
            }
          }

          // אם אין כרטיסיות שמורות, אל תפתח כלום - תן למשתמש לבחור
          setOpenTabs([]);
          setActiveTabId(null);
          setCurrentView('books');
        }
      } catch (error) {
        console.error('שגיאה בטעינת קבצים:', error);
      }
    };

    loadFiles();
  }, []);

  const handleFileClick = (file, searchContext = null) => {
    console.log('🔍 handleFileClick:', { fileName: file.name, hasContext: !!searchContext });

    // סגור תצוגה מקדימה של תיקייה כשפותחים ספר/כרטיסייה
    if (folderPreview) {
      closeFolderPreview();
    }
    
    // עבור לתצוגת ספרים
    setCurrentView('books');
    
    // בדוק אם הכרטיסייה כבר פתוחה
    const existingTab = openTabs.find((tab) => tab.id === file.id);

    if (existingTab) {
      console.log('📑 Tab exists, checking if context changed...');
      // אם כבר פתוחה, עדכן את ההקשר רק אם יש context חדש ושונה
      if (searchContext) {
        // בדוק אם ה-context באמת השתנה
        const contextChanged = 
          !existingTab.searchContext ||
          existingTab.searchContext.searchQuery !== searchContext.searchQuery ||
          existingTab.searchContext.context?.pageNum !== searchContext.context?.pageNum ||
          existingTab.searchContext.context?.chunkId !== searchContext.context?.chunkId;
        
        console.log('📑 Context changed:', contextChanged);
        
        if (contextChanged) {
          const updatedTabs = openTabs.map(tab => 
            tab.id === file.id 
              ? { ...tab, searchContext, _updateKey: Date.now() } // עדכן רק אם השתנה
              : tab
          );
          setOpenTabs(updatedTabs);
          saveTabsState(updatedTabs, file.id);
        }
      }
      setActiveTabId(file.id);
    } else {
      console.log('📑 Opening new tab');
      let newTabs;
      
      // צור כרטיסייה חדשה עם הקשר החיפוש
      const newTab = searchContext 
        ? { ...file, searchContext, _updateKey: Date.now() }
        : file;
      
      // אם צריך להחליף כרטיסיית חיפוש
      if (searchContext && searchContext.replaceSearchTab) {
        const searchTabIndex = openTabs.findIndex(tab => tab.type === 'search');
        if (searchTabIndex !== -1) {
          // החלף את כרטיסיית החיפוש
          newTabs = [...openTabs];
          newTabs[searchTabIndex] = newTab;
        } else {
          // אם אין כרטיסיית חיפוש, פשוט הוסף
          newTabs = [...openTabs, newTab];
        }
      } else {
        // אם לא, פתח כרטיסייה חדשה
        newTabs = [...openTabs, newTab];
      }
      
      setOpenTabs(newTabs);
      setActiveTabId(file.id);
      saveTabsState(newTabs, file.id);
    }

    // עדכן רשימת ספרים אחרונים
    updateRecentBooks(file);
  };

  // פתיחת כרטיסיית חיפוש חדשה
  const handleNewSearchTab = () => {
    // סגור תצוגה מקדימה של תיקייה כשפותחים כרטיסייה חדשה
    if (folderPreview) {
      closeFolderPreview();
    }

    // צור ID ייחודי לכל כרטיסיית חיפוש
    const searchTabId = `search-tab-${Date.now()}`;
    const searchTab = {
      id: searchTabId,
      name: 'חיפוש',
      type: 'search',
      searchQuery: '', // כל כרטיסייה עם query משלה
      searchResults: [] // כל כרטיסייה עם תוצאות משלה
    };
    
    // תמיד צור כרטיסייה חדשה
    const newTabs = [...openTabs, searchTab];
    setOpenTabs(newTabs);
    setActiveTabId(searchTabId);
    saveTabsState(newTabs, searchTabId);
  };

  // עדכון רשימת ספרים שנפתחו לאחרונה
  const updateRecentBooks = (file) => {
    const recent = [...recentBooks];
    // הסר את הספר אם הוא כבר ברשימה
    const filtered = recent.filter(book => book.id !== file.id);
    // הוסף את הספר בתחילת הרשימה
    const updated = [file, ...filtered].slice(0, 5); // שמור רק 5 ספרים אחרונים
    setRecentBooks(updated);
    updateSetting('recentBooks', updated);
  };

  // ניהול שולחנות עבודה
  const createWorkspace = (name) => {
    const newWorkspace = {
      id: `workspace-${Date.now()}`,
      name,
      tabs: []
    };
    const updated = [...workspaces, newWorkspace];
    setWorkspaces(updated);
    updateSetting('workspaces', updated);
    return newWorkspace.id;
  };

  const deleteWorkspace = (id) => {
    if (id === 'default') return; // לא למחוק את ברירת המחדל
    const updated = workspaces.filter(w => w.id !== id);
    setWorkspaces(updated);
    updateSetting('workspaces', updated);
    
    // אם מחקנו את שולחן העבודה הנוכחי, עבור לברירת מחדל
    if (currentWorkspace === id) {
      setCurrentWorkspace('default');
      updateSetting('currentWorkspace', 'default');
      // טען את הכרטיסיות של ברירת המחדל
      const defaultWorkspace = updated.find(w => w.id === 'default');
      if (defaultWorkspace) {
        setOpenTabs(defaultWorkspace.tabs);
        setActiveTabId(defaultWorkspace.tabs.length > 0 ? defaultWorkspace.tabs[0].id : null);
      }
    }
  };

  const renameWorkspace = (id, newName) => {
    const updated = workspaces.map(w => 
      w.id === id ? { ...w, name: newName } : w
    );
    setWorkspaces(updated);
    updateSetting('workspaces', updated);
  };

  const selectWorkspace = (id) => {
    // שמור את הכרטיסיות הנוכחיות בשולחן העבודה הנוכחי
    const updated = workspaces.map(w => 
      w.id === currentWorkspace ? { ...w, tabs: openTabs } : w
    );
    setWorkspaces(updated);
    updateSetting('workspaces', updated);
    
    // עבור לשולחן העבודה החדש
    setCurrentWorkspace(id);
    updateSetting('currentWorkspace', id);
    
    // טען את הכרטיסיות של שולחן העבודה החדש
    const workspace = updated.find(w => w.id === id);
    if (workspace) {
      setOpenTabs(workspace.tabs);
      setActiveTabId(workspace.tabs.length > 0 ? workspace.tabs[0].id : null);
    }
  };

  // פתיחת דף הכלים עם כלי ספציפי
  const handleOpenTool = (toolName) => {
    setSelectedTool(toolName);
    setCurrentView('tools');
  };

  const handleCloseTab = (tabId, e) => {
    e.stopPropagation();
    const newTabs = openTabs.filter((tab) => tab.id !== tabId);
    setOpenTabs(newTabs);

    // אם סגרנו את הכרטיסייה הפעילה, עבור לכרטיסייה הקודמת
    let newActiveTabId = activeTabId;
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        newActiveTabId = newTabs[newTabs.length - 1].id;
        setActiveTabId(newActiveTabId);
      } else {
        newActiveTabId = null;
        setActiveTabId(null);
      }
    }

    // שמירת המצב החדש
    saveTabsState(newTabs, newActiveTabId);
  };

  // פונקציות גרירת כרטיסיות
  const handleDragStart = (e, tab) => {
    setDraggedTab(tab);
    e.dataTransfer.effectAllowed = 'move';
    // הוספת סגנון חזותי לכרטיסייה הנגררת
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedTab(null);
    setDragOverTab(null);
  };

  const handleDragOver = (e, tab) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedTab && draggedTab.id !== tab.id) {
      setDragOverTab(tab);
    }
  };

  const handleDragLeave = (e) => {
    // בדוק אם עזבנו את האלמנט לגמרי (לא רק עברנו לילד שלו)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverTab(null);
    }
  };

  const handleDrop = (e, targetTab) => {
    e.preventDefault();
    
    if (!draggedTab || draggedTab.id === targetTab.id) {
      return;
    }

    // מצא את האינדקסים
    const draggedIndex = openTabs.findIndex(tab => tab.id === draggedTab.id);
    const targetIndex = openTabs.findIndex(tab => tab.id === targetTab.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      return;
    }

    // צור מערך חדש עם הסדר המעודכן
    const newTabs = [...openTabs];
    const [removed] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, removed);

    setOpenTabs(newTabs);
    saveTabsState(newTabs, activeTabId);
    setDragOverTab(null);
  };

  // פונקציה לנרמול טקסט - הסרת גרשיים, סימני ציטוט ואותיות שימוש
  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .replace(/['"״׳''""]/g, '')
      // הסרת אותיות שימוש בתחילת מילים (ה, ו, ב, כ, ל, מ, ש)
      // משתמש ב-lookahead ו-lookbehind כדי לתפוס אותיות בתחילת מילה
      .replace(/(^|[\s])([הוכלמשב])(?=[א-ת])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizeAbbrKey = (text) => {
    return normalizeText(text).replace(/\s/g, '');
  };

  const getAbbreviationExpansions = (rawInput) => {
    const dict = abbrDictionaryRef.current;
    if (!dict || !rawInput) return [];

    const key = normalizeAbbrKey(rawInput);
    const expansions = dict[key];
    if (!expansions || expansions.length === 0) return [];

    return expansions.slice(0, 8);
  };

  // טעינת מילון ראשי תיבות (טעינה עצלה מה-public)
  useEffect(() => {
    let cancelled = false;

    const loadAbbrDictionary = async () => {
      try {
        const res = await fetch('/abbr_merged.json');
        if (!res.ok) throw new Error(`Failed to load abbr_merged.json (${res.status})`);
        const raw = await res.json();

        const normalizedDict = {};
        Object.entries(raw || {}).forEach(([abbr, expansions]) => {
          const normKey = normalizeAbbrKey(abbr);
          if (!normKey) return;
          if (!normalizedDict[normKey]) normalizedDict[normKey] = [];

          (Array.isArray(expansions) ? expansions : []).forEach((exp) => {
            if (typeof exp === 'string' && exp.trim().length > 0) {
              normalizedDict[normKey].push(exp);
            }
          });
        });

        if (!cancelled) {
          abbrDictionaryRef.current = normalizedDict;
          setAbbrDictionaryReady(true);
        }
      } catch (e) {
        console.warn('⚠️ Failed to load abbreviation dictionary:', e);
        if (!cancelled) {
          abbrDictionaryRef.current = null;
          setAbbrDictionaryReady(false);
        }
      }
    };

    loadAbbrDictionary();

    return () => {
      cancelled = true;
    };
  }, []);

  // פונקציה לבדיקת התאמה לראשי תיבות
  const matchesAcronym = (text, acronym) => {
    const words = normalizeText(text).split(' ');
    const acronymChars = normalizeText(acronym).replace(/\s/g, '').split('');
    
    // אם יש יותר אותיות בראשי תיבות מאשר מילים, לא יכול להתאים
    if (acronymChars.length > words.length) {
      return false;
    }
    
    // בדוק אם כל אות בראשי תיבות מתאימה לתחילת מילה
    let wordIndex = 0;
    for (let i = 0; i < acronymChars.length; i++) {
      const char = acronymChars[i];
      let found = false;
      
      // חפש מילה שמתחילה באות הזו
      while (wordIndex < words.length) {
        if (words[wordIndex].startsWith(char)) {
          found = true;
          wordIndex++;
          break;
        }
        wordIndex++;
      }
      
      if (!found) {
        return false;
      }
    }
    
    return true;
  };

  // פונקציה לחישוב ציון התאמה לחיפוש
  const calculateMatchScore = (fileName, query) => {
    const normalizedFile = normalizeText(fileName);
    const normalizedQuery = normalizeText(query);
    
    // פיצול לפי רווחים
    const fileWords = normalizedFile.split(' ');
    const queryWords = normalizedQuery.split(' ');
    
    let score = 0;
    
    // 1. התאמה מדויקת מלאה (ציון גבוה מאוד)
    if (normalizedFile === normalizedQuery) {
      score += 1000;
    }
    
    // 2. התאמה מדויקת בתחילת השם
    if (normalizedFile.startsWith(normalizedQuery)) {
      score += 500;
    }
    
    // 3. התאמה מדויקת של מילה שלמה
    if (fileWords.includes(normalizedQuery)) {
      score += 300;
    }
    
    // 4. התאמה של כל מילות החיפוש (חיפוש חלקי)
    const allWordsMatch = queryWords.every(qWord => 
      fileWords.some(fWord => fWord.includes(qWord))
    );
    if (allWordsMatch) {
      score += 200;
      
      // בונוס אם המילים מופיעות ברצף
      const queryInFile = normalizedFile.includes(normalizedQuery);
      if (queryInFile) {
        score += 100;
      }
    }
    
    // 5. התאמה חלקית - כמה מילים מתאימות
    const matchingWords = queryWords.filter(qWord => 
      fileWords.some(fWord => fWord.includes(qWord))
    ).length;
    score += matchingWords * 50;
    
    // 6. בונוס למילה שמתחילה בחיפוש
    queryWords.forEach(qWord => {
      if (fileWords.some(fWord => fWord.startsWith(qWord))) {
        score += 30;
      }
    });
    
    // 7. התאמה לראשי תיבות (אם אין רווחים בחיפוש)
    if (!normalizedQuery.includes(' ') && normalizedQuery.length >= 2) {
      if (matchesAcronym(fileName, normalizedQuery)) {
        score += 150; // ציון בינוני - נמוך מהתאמה מדויקת אבל גבוה מחיפוש חלקי
      }
    }
    
    // 8. קנס על אורך השם (העדפה לשמות קצרים יותר)
    score -= normalizedFile.length * 0.5;
    
    return score;
  };

  // חיפוש בשמות קבצים להשלמה אוטומטית בסרגל העליון
  useEffect(() => {
    // הוסף debounce כדי למנוע חיפושים מיותרים
    const timeoutId = setTimeout(() => {
      if (headerSearchQuery && headerSearchQuery.length >= 2) {
        // בדוק אם יש פורמט של "ספר:כותרת"
        const colonIndex = headerSearchQuery.indexOf(':');
        
        if (colonIndex > 0) {
          // פורמט של "ספר:כותרת"
          const bookPart = headerSearchQuery.substring(0, colonIndex).trim();
          const titlePart = headerSearchQuery.substring(colonIndex + 1).trim();
          
          console.log('🔍 חיפוש ספר+כותרת:', { book: bookPart, title: titlePart });
          
          // חפש את הספר
          const { converted: convertedBook } = autoConvertSearch(bookPart);
          const baseBookQuery = convertedBook;
          const normalizedBook = normalizeText(baseBookQuery);
          const bookExpansions = abbrDictionaryReady ? getAbbreviationExpansions(bookPart) : [];
          const bookQueries = [baseBookQuery, ...bookExpansions];
          const normalizedBookQueries = bookQueries
            .map((q) => normalizeText(q))
            .filter((q) => q && q.length > 0);
          
          const matchedBooks = allFiles.filter(file => {
            const normalizedFileName = normalizeText(file.name);
            return normalizedBookQueries.some((q) => normalizedFileName.includes(q));
          });
          
          // חפש גם בספרי אוצריא
          if (otzariaDB.db) {
            try {
              const otzariaResults = searchOtzariaBooks(bookPart);
              otzariaResults.forEach(book => {
                matchedBooks.push({
                  id: `otzaria-${book.id}`,
                  name: book.title + (book.volume ? ` - ${book.volume}` : ''),
                  path: `virtual-otzaria/book-${book.id}`,
                  type: 'otzaria',
                  bookId: book.id,
                  totalLines: book.totalLines,
                  heShortDesc: book.heShortDesc,
                  categoryTitle: book.categoryTitle
                });
              });
            } catch (error) {
              console.error('❌ שגיאה בחיפוש אוצריא:', error);
            }
          }
          
          // מיין את הספרים לפי דיוק התאמה
          matchedBooks.sort((a, b) => {
            const normalizedA = normalizeText(a.name);
            const normalizedB = normalizeText(b.name);
            
            // התאמה מדויקת
            const exactMatchA = normalizedA === normalizedBook;
            const exactMatchB = normalizedB === normalizedBook;
            
            if (exactMatchA && !exactMatchB) return -1;
            if (!exactMatchA && exactMatchB) return 1;
            
            // מתחיל בשאילתה
            const startsWithA = normalizedA.startsWith(normalizedBook);
            const startsWithB = normalizedB.startsWith(normalizedBook);
            
            if (startsWithA && !startsWithB) return -1;
            if (!startsWithA && startsWithB) return 1;
            
            // אחרת, מיון אלפביתי
            return a.name.localeCompare(b.name, 'he');
          });
          
          console.log('📚 ספרים שנמצאו (ממוינים):', matchedBooks.map(b => b.name));
          
          // אם יש כותרת, חפש בתוכן העניינים
          if (titlePart.length >= 1 && matchedBooks.length > 0) {
            const results = [];
            
            // נרמול שאילתת הכותרת
            const normalizedTitleQuery = normalizeText(titlePart);
            
            matchedBooks.forEach(book => {
              // חפש בתוכן העניינים של הספר
              const tocEntry = booksMetadata.searchTableOfContents(book.name, titlePart);
              
              if (tocEntry) {
                // חשב ציון התאמה
                const normalizedLabel = normalizeText(tocEntry.label);
                let matchScore = 1000;
                
                // התאמה מדויקת = ציון הכי גבוה
                if (normalizedLabel === normalizedTitleQuery) {
                  matchScore = 10000;
                } 
                // התאמה שמתחילה בשאילתה = ציון גבוה
                else if (normalizedLabel.startsWith(normalizedTitleQuery)) {
                  matchScore = 5000;
                }
                // התאמה שמכילה את השאילתה = ציון בינוני
                else if (normalizedLabel.includes(normalizedTitleQuery)) {
                  matchScore = 2000;
                }
                
                console.log('✅ נמצא בתוכן עניינים:', book.name, '->', tocEntry.label, 'ציון:', matchScore);
                results.push({
                  ...book,
                  matchType: 'book-with-title',
                  tocEntry: tocEntry,
                  displayName: `${book.name} → ${tocEntry.label}`,
                  matchScore: matchScore
                });
              } else {
                // אם לא נמצא בתוכן עניינים, הצע את הספר בלבד
                results.push({
                  ...book,
                  matchType: 'book-only',
                  searchTitle: titlePart,
                  displayName: `${book.name} (חיפוש: ${titlePart})`,
                  matchScore: 500
                });
              }
            });
            
            // מיין לפי ציון התאמה (גבוה לנמוך)
            results.sort((a, b) => b.matchScore - a.matchScore);
            
            setHeaderSuggestions(results);
            setShowHeaderAutocomplete(results.length > 0);
            return;
          } else if (matchedBooks.length > 0) {
            // אם אין כותרת עדיין, הצג את הספרים שנמצאו
            const results = matchedBooks.map(book => ({
              ...book,
              matchType: 'book-only',
              displayName: `${book.name} (הוסף : לחיפוש כותרת)`,
              matchScore: 100
            }));
            
            setHeaderSuggestions(results);
            setShowHeaderAutocomplete(results.length > 0);
            return;
          }
        }
        
        // חיפוש רגיל (ללא ":")
        const { converted, shouldConvert } = autoConvertSearch(headerSearchQuery);
        const effectiveQuery = converted;
        const expansions = abbrDictionaryReady ? getAbbreviationExpansions(headerSearchQuery) : [];
        const queryVariants = [effectiveQuery, ...expansions];
        
        const normalizedQueries = queryVariants
          .map((q) => normalizeText(q))
          .filter((q) => q && q.length > 0);
        const queryWordsList = normalizedQueries.map((q) => q.split(' '));
        const matchedFiles = new Set();
        const results = [];
        
        console.log('🔍 חיפוש בסרגל עליון:', headerSearchQuery, shouldConvert ? `(הומר ל: ${converted})` : '');
        console.log('   שאילתות מנורמלות:', normalizedQueries);
        console.log('   מספר קבצים לבדיקה:', allFiles.length);
        
        // חיפוש במטא-דאטה
        queryVariants.forEach((variant) => {
          const metadataMatches = booksMetadata.searchBook(variant);
          metadataMatches.forEach(bookMeta => {
            const file = allFiles.find(f => f.name === bookMeta.fileName);
            if (file && !matchedFiles.has(file.id)) {
              matchedFiles.add(file.id);
              const score = calculateMatchScore(file.name, variant);
              results.push({
                ...file,
                matchType: 'metadata',
                metadata: bookMeta,
                matchScore: score
              });
            }
          });
        });
        
        // חיפוש בשמות קבצים - חיפוש חכם יותר
        let filesChecked = 0;
        let filesMatched = 0;
        
        allFiles.forEach(file => {
          // וודא שכל ספר מופיע רק פעם אחת
          if (!matchedFiles.has(file.id)) {
            filesChecked++;
            const normalizedFileName = normalizeText(file.name);
            const fileWords = normalizedFileName.split(' ');

            const anyVariantMatches = normalizedQueries.some((normalizedQuery, idx) => {
              const queryWords = queryWordsList[idx] || [];

              // בדוק אם כל מילות החיפוש מופיעות בשם הקובץ (לא בהכרח ברצף)
              const allWordsMatch = queryWords.every(qWord => 
                fileWords.some(fWord => fWord.includes(qWord))
              );
              
              // או בדוק אם יש התאמה רציפה
              const hasSequentialMatch = normalizedFileName.includes(normalizedQuery);
              
              // או בדוק אם זה ראשי תיבות (אם אין רווחים בחיפוש)
              const isAcronymMatch = !normalizedQuery.includes(' ') && 
                                     normalizedQuery.length >= 2 && 
                                     matchesAcronym(file.name, normalizedQuery);

              return allWordsMatch || hasSequentialMatch || isAcronymMatch;
            });
            
            // לוג לדיבוג - בדוק קבצים ספציפיים
            if (file.name.includes('רשבא') && file.name.includes('גיטין')) {
              console.log('🔍 מצאתי קובץ רלוונטי:', file.name);
              console.log('   שאילתה מקורית:', headerSearchQuery);
              console.log('   קובץ מנורמל:', normalizedFileName);
              console.log('   מילות קובץ:', fileWords);
            }
            
            if (anyVariantMatches) {
              filesMatched++;
              matchedFiles.add(file.id);
              const score = Math.max(...queryVariants.map((variant) => calculateMatchScore(file.name, variant)));
              results.push({
                ...file,
                matchType: 'filename',
                matchScore: score
              });
            }
          }
        });
        
        console.log(`   נבדקו ${filesChecked} קבצים, נמצאו ${filesMatched} התאמות`);
        
        // חיפוש בספרי אוצריא
        if (otzariaDB.db) {
          console.log('📖 מחפש גם בספרי אוצריא...');
          console.log('   שאילתה:', headerSearchQuery);
          try {
            const otzariaResults = searchOtzariaBooks(headerSearchQuery);
            console.log(`   ✅ נמצאו ${otzariaResults.length} ספרי אוצריא`);
            
            if (otzariaResults.length > 0) {
              console.log('   📚 דוגמאות לתוצאות אוצריא:');
              otzariaResults.slice(0, 5).forEach((book, idx) => {
                console.log(`      ${idx + 1}. ${book.title}${book.volume ? ` - ${book.volume}` : ''}`);
              });
            } else {
              console.log('   ⚠️ לא נמצאו תוצאות באוצריא');
            }
            
            otzariaResults.forEach(book => {
              // המר לפורמט של file
              const otzariaFile = {
                id: `otzaria-${book.id}`,
                name: book.title + (book.volume ? ` - ${book.volume}` : ''),
                path: `virtual-otzaria/book-${book.id}`,
                type: 'otzaria',
                bookId: book.id,
                totalLines: book.totalLines,
                heShortDesc: book.heShortDesc,
                categoryTitle: book.categoryTitle,
                matchType: 'otzaria',
                matchScore: calculateMatchScore(book.title, headerSearchQuery)
              };
              
              // הוסף רק אם עדיין לא נמצא
              if (!matchedFiles.has(otzariaFile.id)) {
                matchedFiles.add(otzariaFile.id);
                results.push(otzariaFile);
                console.log(`      ➕ הוסף: ${otzariaFile.name} (ציון: ${otzariaFile.matchScore})`);
              }
            });
          } catch (error) {
            console.error('❌ שגיאה בחיפוש אוצריא:', error);
          }
        } else {
          console.log('⚠️ אוצריא DB לא זמין');
        }
        
        // מיון לפי ציון התאמה (גבוה לנמוך)
        results.sort((a, b) => b.matchScore - a.matchScore);
        
        // הגבל ל-50 תוצאות (יותר תוצאות לגלילה)
        const limitedResults = results.slice(0, 50);
        setHeaderSuggestions(limitedResults);
        setShowHeaderAutocomplete(limitedResults.length > 0);
      } else if (!headerSearchQuery || headerSearchQuery.length === 0) {
        // אם אין טקסט חיפוש, הכן ספרים אחרונים
        const recentWithMetadata = recentBooks.map(book => {
          const metadata = booksMetadata.getBookByFileName(book.name);
          return {
            ...book,
            matchType: 'recent',
            metadata: metadata
          };
        });
        setHeaderSuggestions(recentWithMetadata);
        // שמור את המצב הנוכחי של ההשלמה - לא לסגור אוטומטית
      } else {
        // פחות מ-2 תווים - שמור את הספרים האחרונים אבל לא לסגור
        const recentWithMetadata = recentBooks.map(book => {
          const metadata = booksMetadata.getBookByFileName(book.name);
          return {
            ...book,
            matchType: 'recent',
            metadata: metadata
          };
        });
        setHeaderSuggestions(recentWithMetadata);
        // לא לסגור את ההשלמה אם היא פתוחה
      }
    }, 500); // debounce של 500ms - מפחית עומס על DB

    return () => clearTimeout(timeoutId);
  }, [headerSearchQuery, allFiles, recentBooks]);

  // סגירת השלמה אוטומטית בלחיצה מחוץ לתיבה
  useEffect(() => {
    const handleClickOutside = (e) => {
      // בדוק אם הלחיצה הייתה על תיבת החיפוש או על ההשלמה האוטומטית
      if (!e.target.closest('.header-search-container') && 
          !e.target.closest('.header-autocomplete-dropdown')) {
        setShowHeaderAutocomplete(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // פונקציה לסגירת ההשלמה האוטומטית מבחוץ
  const closeHeaderAutocomplete = () => {
    setShowHeaderAutocomplete(false);
  };

  const handleHeaderFileSelect = (file) => {
    setShowHeaderAutocomplete(false);
    setHeaderSearchQuery('');
    
    // בדוק אם יש כותרת לחיפוש
    if (file.matchType === 'book-with-title' && file.tocEntry) {
      // פתח את הספר עם המיקום המדויק מתוכן העניינים
      console.log('📖 פותח ספר עם כותרת:', file.name, '->', file.tocEntry.label);
      handleFileClick(file, {
        context: { pageNum: file.tocEntry.page },
        outlineSearch: file.tocEntry.label
      });
    } else if (file.matchType === 'book-only' && file.searchTitle) {
      // פתח את הספר עם חיפוש בתוכן העניינים של PDF
      console.log('📖 פותח ספר עם חיפוש בתוכן עניינים:', file.name, '->', file.searchTitle);
      handleFileClick(file, {
        outlineSearch: file.searchTitle
      });
    } else {
      // פתיחה רגילה
      handleFileClick(file);
    }
  };

  const handleHeaderKeyDown = (e) => {
    if (e.key === 'Enter' && showHeaderAutocomplete && headerSuggestions.length > 0) {
      handleHeaderFileSelect(headerSuggestions[0]);
    }
  };

  // סינון קבצים לפי חיפוש בדף החיפוש (לפי שם)
  const searchPageFilteredFiles = allFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // חיפוש בתוכן הקבצים
  const handleContentSearch = async (query, advancedOptions = {}) => {
    // אם לא קיבלנו query, השתמש ב-searchQuery מה-state
    const effectiveQuery = query || searchQuery;
    
    console.log('🔍 handleContentSearch called with:', { query: effectiveQuery, advancedOptions });
    
    if (!effectiveQuery || effectiveQuery.trim().length === 0) {
      console.log('⚠️ Empty search query');
      return [];
    }
    
    try {
      // בחר מנוע חיפוש
      const isElectron = window.electron !== undefined;
      console.log('🔧 Environment:', { isElectron, meilisearchReady: meilisearchEngine.isReady() });
      
      const activeEngine = isElectron && meilisearchEngine.isReady() 
        ? meilisearchEngine 
        : searchEngine;
      
      console.log('🔧 Using engine:', activeEngine === meilisearchEngine ? 'Meilisearch' : 'FlexSearch');
      
      // טען אינדקס אם צריך (טעינה עצלה)
      if (activeEngine === searchEngine && !searchEngine.isReady()) {
        console.log('📋 טוען אינדקס FlexSearch...');
        const loaded = await searchEngine.loadIndexFromFile();
        if (!loaded) {
          console.warn('⚠️ לא נמצא אינדקס חיפוש - צריך לבנות אינדקס');
          setSearchResults([]);
          setIsSearching(false);
          return;
        }
        console.log('✅ אינדקס FlexSearch נטען');
      }
      
      // מיזוג אופציות ברירת מחדל עם אופציות מתקדמות
      const searchOptions = {
        maxResults: 500, // הגדלנו מ-100 ל-500 ספרים
        contextLength: 150,
        fullSpelling: advancedOptions.fullSpelling || false,
        partialWord: advancedOptions.partialWord || false,
        suffixes: advancedOptions.suffixes || false,
        prefixes: advancedOptions.prefixes || false,
        accuracy: advancedOptions.accuracy !== undefined ? advancedOptions.accuracy : 50, // רמת דיוק (0-100)
        specificBook: advancedOptions.specificBook || '', // חיפוש בספר ספציפי
        matchingStrategy: advancedOptions.matchingStrategy || 'last', // אסטרטגיית התאמה
        cropLength: advancedOptions.cropLength || 200 // אורך הקשר
      };
      
      console.log('📡 Calling search with:', { query: effectiveQuery, options: searchOptions });
      const results = await activeEngine.search(effectiveQuery, searchOptions);
      
      console.log(`✅ Got ${results.length} results from engine`);
      
      // תקן את התוצאות - מצא את הקבצים המקוריים מתוך allFiles
      const fixedResults = results.map(result => {
        const originalFile = allFiles.find(f => 
          f.name === result.file.name || 
          f.name === result.file.id ||
          f.id === result.file.id
        );
        
        if (originalFile) {
          return {
            ...result,
            file: originalFile
          };
        }
        
        console.warn('⚠️ Could not find original file for:', result.file.name);
        return result;
      });
      
      console.log(`נמצאו ${fixedResults.length} קבצים עם התאמות`);
      return fixedResults;
    } catch (error) {
      console.error('❌ שגיאה בחיפוש:', error);
      return [];
    }
  };

  // חיפוש אוטומטי כשמשנים את השאילתה (חיפוש מאוחד) - הוסר!
  // החיפוש יתבצע רק בלחיצה על Enter

  // פתיחת תפריט הקשר
  const handleContextMenu = (e, target) => {
    e.preventDefault();
    
    // גודל התפריט (בערך)
    const menuWidth = 220;
    const menuHeight = 300; // גובה משוער
    
    // מיקום התפריט
    let x = e.clientX;
    let y = e.clientY;
    
    // בדיקה אם התפריט יוצא מהמסך מימין
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10; // 10px מרווח מהקצה
    }
    
    // בדיקה אם התפריט יוצא מהמסך משמאל
    if (x < 10) {
      x = 10;
    }
    
    // בדיקה אם התפריט יוצא מהמסך מלמטה
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }
    
    // בדיקה אם התפריט יוצא מהמסך מלמעלה
    if (y < 10) {
      y = 10;
    }
    
    setContextMenu({ x, y });
    setContextMenuTarget(target);
  };

  // סגירת תפריט הקשר
  const closeContextMenu = () => {
    setContextMenu(null);
    setContextMenuTarget(null);
  };

  // פעולות תפריט הקשר
  const handleCopyFileName = () => {
    if (contextMenuTarget) {
      navigator.clipboard.writeText(contextMenuTarget.name);
    }
    closeContextMenu();
  };

  const handleDownloadFile = () => {
    if (contextMenuTarget) {
      const link = document.createElement('a');
      link.href = contextMenuTarget.path;
      link.download = contextMenuTarget.name + '.pdf';
      link.click();
    }
    closeContextMenu();
  };

  const handlePrintFile = () => {
    if (contextMenuTarget) {
      window.open(contextMenuTarget.path, '_blank');
    }
    closeContextMenu();
  };

  const handleCloseTabFromMenu = () => {
    if (contextMenuTarget) {
      handleCloseTab(contextMenuTarget.id, new Event('click'));
    }
    closeContextMenu();
  };

  // שכפול כרטיסייה
  const handleDuplicateTab = () => {
    if (contextMenuTarget) {
      const newTab = {
        ...contextMenuTarget,
        id: `${contextMenuTarget.type}-${Date.now()}`,
      };
      const newTabs = [...openTabs, newTab];
      setOpenTabs(newTabs);
      setActiveTabId(newTab.id);
      saveTabsState(newTabs, newTab.id);
    }
    closeContextMenu();
  };

  // סגירת כרטיסיות אחרות
  const handleCloseOtherTabs = () => {
    if (contextMenuTarget) {
      const newTabs = [contextMenuTarget];
      setOpenTabs(newTabs);
      setActiveTabId(contextMenuTarget.id);
      saveTabsState(newTabs, contextMenuTarget.id);
    }
    closeContextMenu();
  };

  // סגירת כרטיסיות מימין (לפני הכרטיסייה הנוכחית)
  const handleCloseTabsToRight = () => {
    if (contextMenuTarget) {
      const targetIndex = openTabs.findIndex(tab => tab.id === contextMenuTarget.id);
      if (targetIndex !== -1) {
        const newTabs = openTabs.slice(targetIndex);
        setOpenTabs(newTabs);
        const newActiveTabId = newTabs.find(tab => tab.id === activeTabId) 
          ? activeTabId 
          : contextMenuTarget.id;
        setActiveTabId(newActiveTabId);
        saveTabsState(newTabs, newActiveTabId);
      }
    }
    closeContextMenu();
  };

  // סגירת כרטיסיות משמאל (אחרי הכרטיסייה הנוכחית)
  const handleCloseTabsToLeft = () => {
    if (contextMenuTarget) {
      const targetIndex = openTabs.findIndex(tab => tab.id === contextMenuTarget.id);
      if (targetIndex !== -1) {
        const newTabs = openTabs.slice(0, targetIndex + 1);
        setOpenTabs(newTabs);
        const newActiveTabId = newTabs.find(tab => tab.id === activeTabId) 
          ? activeTabId 
          : contextMenuTarget.id;
        setActiveTabId(newActiveTabId);
        saveTabsState(newTabs, newActiveTabId);
      }
    }
    closeContextMenu();
  };

  // טעינה מחדש של כרטיסייה
  const handleReloadTab = () => {
    if (contextMenuTarget) {
      // כפה רענון על ידי עדכון מצב
      const updatedTabs = openTabs.map(tab => 
        tab.id === contextMenuTarget.id 
          ? { ...tab, lastReloaded: Date.now() }
          : tab
      );
      setOpenTabs(updatedTabs);
    }
    closeContextMenu();
  };

  // Split View - הוספת כרטיסייה לתצוגה מפוצלת
  const handleAddToSplitView = () => {
    if (contextMenuTarget) {
      // יצירת כרטיסייה מפוצלת מיד עם הספר הראשון
      const newSplitTab = {
        id: `split-${Date.now()}`,
        name: `בחר ספר... | ${contextMenuTarget.name}`,
        type: 'split',
        leftTab: null, // עדיין לא נבחר
        rightTab: contextMenuTarget,
        splitRatio: 50,
        isSelectingLeft: true // דגל שמציין שצריך להציג דיאלוג בחירה בצד שמאל
      };

      // הוספת הכרטיסייה החדשה
      const newTabs = [...openTabs, newSplitTab];
      setOpenTabs(newTabs);
      setActiveTabId(newSplitTab.id);
      saveTabsState(newTabs, newSplitTab.id);
    }
    closeContextMenu();
  };

  // בחירת הכרטיסייה השנייה לתצוגה מפוצלת - עדכון הטאב הקיים
  const handleSelectSecondTab = (secondTab) => {
    // מצא את הכרטיסייה המפוצלת שממתינה לבחירה
    const splitTab = openTabs.find(tab => tab.type === 'split' && tab.isSelectingLeft);
    
    if (splitTab && secondTab.id !== splitTab.rightTab.id) {
      // עדכן את הכרטיסייה המפוצלת עם הבחירה השנייה
      const updatedTabs = openTabs.map(tab => {
        if (tab.id === splitTab.id) {
          return {
            ...tab,
            name: `${secondTab.name} | ${tab.rightTab.name}`,
            leftTab: secondTab,
            isSelectingLeft: false // סיימנו את הבחירה
          };
        }
        return tab;
      });

      setOpenTabs(updatedTabs);
      saveTabsState(updatedTabs, splitTab.id);
    }
  };

  // ביטול בחירת כרטיסייה שנייה - סגירת הכרטיסייה המפוצלת
  const handleCancelSelectSecondTab = () => {
    // מצא ומחק את הכרטיסייה המפוצלת שממתינה לבחירה
    const splitTab = openTabs.find(tab => tab.type === 'split' && tab.isSelectingLeft);
    
    if (splitTab) {
      const newTabs = openTabs.filter(tab => tab.id !== splitTab.id);
      setOpenTabs(newTabs);
      
      // חזור לכרטיסייה הקודמת
      if (newTabs.length > 0) {
        const newActiveId = newTabs[newTabs.length - 1].id;
        setActiveTabId(newActiveId);
        saveTabsState(newTabs, newActiveId);
      }
    }
  };

  // החלפת צדדים בתצוגה מפוצלת
  const handleReverseSplitView = () => {
    if (contextMenuTarget && contextMenuTarget.type === 'split') {
      const updatedTabs = openTabs.map(tab => 
        tab.id === contextMenuTarget.id 
          ? {
              ...tab,
              leftTab: tab.rightTab,
              rightTab: tab.leftTab,
              name: `${tab.rightTab.name} | ${tab.leftTab.name}`
            }
          : tab
      );
      setOpenTabs(updatedTabs);
      saveTabsState(updatedTabs, activeTabId);
    }
    closeContextMenu();
  };

  // סגירת צד שמאל - המרת הטאב לטאב רגיל
  const handleCloseLeftView = () => {
    if (contextMenuTarget && contextMenuTarget.type === 'split') {
      const updatedTabs = openTabs.map(tab => 
        tab.id === contextMenuTarget.id 
          ? { ...tab.rightTab }
          : tab
      );
      setOpenTabs(updatedTabs);
      saveTabsState(updatedTabs, activeTabId);
    }
    closeContextMenu();
  };

  // סגירת צד ימין - המרת הטאב לטאב רגיל
  const handleCloseRightView = () => {
    if (contextMenuTarget && contextMenuTarget.type === 'split') {
      const updatedTabs = openTabs.map(tab => 
        tab.id === contextMenuTarget.id 
          ? { ...tab.leftTab }
          : tab
      );
      setOpenTabs(updatedTabs);
      saveTabsState(updatedTabs, activeTabId);
    }
    closeContextMenu();
  };

  // הפרדת התצוגות - יצירת שני טאבים נפרדים
  const handleSeparateViews = () => {
    if (contextMenuTarget && contextMenuTarget.type === 'split') {
      const splitTabIndex = openTabs.findIndex(tab => tab.id === contextMenuTarget.id);
      if (splitTabIndex !== -1) {
        const newTabs = [
          ...openTabs.slice(0, splitTabIndex),
          contextMenuTarget.leftTab,
          contextMenuTarget.rightTab,
          ...openTabs.slice(splitTabIndex + 1)
        ];
        setOpenTabs(newTabs);
        setActiveTabId(contextMenuTarget.leftTab.id);
        saveTabsState(newTabs, contextMenuTarget.leftTab.id);
      }
    }
    closeContextMenu();
  };

  // עדכון יחס הפיצול בטאב
  const updateSplitRatio = (tabId, newRatio) => {
    const updatedTabs = openTabs.map(tab => 
      tab.id === tabId && tab.type === 'split'
        ? { ...tab, splitRatio: newRatio }
        : tab
    );
    setOpenTabs(updatedTabs);
  };
  
  // הצמדת ספר לראש הרשימה
  const handlePinBook = () => {
    if (contextMenuTarget) {
      // בדוק אם הספר כבר מוצמד
      const isAlreadyPinned = pinnedBooks.some(book => book.id === contextMenuTarget.id);
      
      if (isAlreadyPinned) {
        // אם מוצמד, בטל הצמדה
        handleUnpinBook(contextMenuTarget.id);
      } else {
        // אם לא מוצמד, הוסף את הספר לתחילת הרשימה
        const updatedPinned = [contextMenuTarget, ...pinnedBooks];
        setPinnedBooks(updatedPinned);
        updateSetting('pinnedBooks', updatedPinned);
      }
    }
    closeContextMenu();
  };
  
  // ביטול הצמדת ספר
  const handleUnpinBook = (bookId) => {
    const updatedPinned = pinnedBooks.filter(book => book.id !== bookId);
    setPinnedBooks(updatedPinned);
    updateSetting('pinnedBooks', updatedPinned);
  };

  // פתיחת תצוגה מקדימה של תיקייה
  const handleFolderClick = (folder) => {
    setFolderPreview(folder);
  };

  // סגירת תצוגה מקדימה של תיקייה
  const closeFolderPreview = () => {
    setFolderPreview(null);
  };

  // סגור תצוגה מקדימה כשעוברים לדף אחר
  useEffect(() => {
    if (currentView !== 'books' && folderPreview) {
      closeFolderPreview();
    }
  }, [currentView]);

  // סגירת תפריט בלחיצה מחוץ לו
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  return (
    <FluentProvider theme={isDark ? customDarkTheme : customLightTheme}>
      <div className="app-layout">
        {/* Custom Title Bar */}
        {window.electron && (
          <div className="custom-title-bar">
            <div className="title-bar-drag-region">
              <img src="/icon.png" alt="האויצר" className="title-bar-icon" />
              <span className="title-bar-title">האויצר</span>
            </div>
            <div className="title-bar-controls">
              <button 
                className="title-bar-button minimize"
                onClick={() => window.electron.windowMinimize()}
                aria-label="מזער"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M0 5h10" stroke="currentColor" strokeWidth="1"/>
                </svg>
              </button>
              <button 
                className="title-bar-button maximize"
                onClick={() => window.electron.windowMaximize()}
                aria-label="מקסם/שחזר"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="0" y="0" width="10" height="10" stroke="currentColor" strokeWidth="1" fill="none"/>
                </svg>
              </button>
              <button 
                className="title-bar-button close"
                onClick={() => window.electron.windowClose()}
                aria-label="סגור"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M0 0L10 10M10 0L0 10" stroke="currentColor" strokeWidth="1"/>
                </svg>
              </button>
            </div>
          </div>
        )}
        
        {/* Overlay גלובלי שמכסה הכל כשההשלמה פתוחה */}
        {isAutocompleteOpen && (
          <div 
            className="global-autocomplete-overlay"
            onClick={() => setIsAutocompleteOpen(false)}
          />
        )}
        
        {/* Header */}
        <div className="app-header">
          {/* קבוצת כפתורים מימין - בית, כלים, הגדרות */}
          <div className="header-actions header-actions-right">
            <Button
              appearance="subtle"
              icon={<SettingsRegular />}
              onClick={() => setCurrentView('settings')}
              aria-label="הגדרות"
              data-active={currentView === 'settings'}
            />
            <Button
              appearance="subtle"
              icon={<WrenchRegular />}
              onClick={() => setCurrentView('tools')}
              aria-label="כלים"
              data-active={currentView === 'tools'}
            />
            <Button
              appearance="subtle"
              icon={<HomeRegular />}
              onClick={() => setCurrentView('home')}
              aria-label="בית"
              data-active={currentView === 'home'}
            />
          </div>
          
          {/* שורת חיפוש מרכזית */}
          <div className="header-search-container">
            <div className="header-search-wrapper">
              {headerSearchQuery && (
                <button
                  className="header-clear-search"
                  onClick={() => {
                    setHeaderSearchQuery('');
                    setShowHeaderAutocomplete(false);
                  }}
                >
                  ×
                </button>
              )}
              <input
                type="text"
                placeholder="חפש ספר לפי שם או מחבר..."
                className="header-search-input"
                value={headerSearchQuery}
                onChange={(e) => {
                  isTypingRef.current = true;
                  setHeaderSearchQuery(e.target.value);
                  // אפס את הדגל אחרי זמן קצר
                  setTimeout(() => {
                    isTypingRef.current = false;
                  }, 100);
                }}
                onKeyDown={handleHeaderKeyDown}
                onClick={() => {
                  // לחיצת עכבר - toggle של ההשלמה האוטומטית
                  // רק אם לא מקלידים כרגע
                  if (!isTypingRef.current && headerSuggestions.length > 0) {
                    setShowHeaderAutocomplete(!showHeaderAutocomplete);
                  }
                }}
              />
              <SearchRegular className="header-search-icon" />
            </div>
            
            {/* השלמה אוטומטית */}
            {showHeaderAutocomplete && (
              <div className="header-autocomplete-dropdown">
                <SearchAutocomplete
                  suggestions={headerSuggestions}
                  onSelect={handleHeaderFileSelect}
                  searchQuery={headerSearchQuery}
                />
              </div>
            )}
          </div>
          
          {/* קבוצת כפתורים משמאל - ספרייה, חיפוש, כרטיסיות */}
          <div className="header-actions header-actions-left">
            <Button
              appearance="subtle"
              icon={<BookOpenRegular />}
              onClick={() => setCurrentView('books')}
              aria-label="כרטיסיות פתוחות"
              data-active={currentView === 'books'}
            />
            <Button
              appearance="subtle"
              icon={<SearchRegular />}
              onClick={() => {
                setCurrentView('books');
                handleNewSearchTab();
              }}
              aria-label="חיפוש חדש"
            />
            <Button
              appearance="subtle"
              icon={<LibraryRegular />}
              onClick={() => {
                setCurrentView('books');
                setIsLibrarySidebarOpen(true);
              }}
              aria-label="ספרייה"
              data-active={isLibrarySidebarOpen}
            />
          </div>
        </div>

        <div className="app-body">
          {/* Main Content */}
          <div className="main-content">
            {/* מיכל התוכן המרכזי */}
            <div className="main-content-center">
              {/* תצוגה מקדימה של תיקייה - מעל הכל */}
              {folderPreview && (
                <FolderPreview
                  folder={folderPreview}
                  onClose={closeFolderPreview}
                  onFileClick={(file) => {
                    handleFileClick(file);
                    closeFolderPreview();
                  }}
                  onFolderClick={handleFolderClick}
                  allFiles={allFiles}
                />
              )}

              {/* כרטיסיות - מוצגות רק בתצוגת ספרים */}
              {openTabs.length > 0 && currentView === 'books' && (
                <div className="tabs-container">
                {/* כפתור רשימת כרטיסיות */}
                <button
                  className="search-tabs-btn"
                  onClick={() => setShowTabsDialog(!showTabsDialog)}
                  title="רשימת כרטיסיות (Ctrl+Shift+A)"
                  aria-label="רשימת כרטיסיות"
                >
                  <ChevronDownRegular />
                </button>
                {openTabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`tab-item ${activeTabId === tab.id ? 'active' : ''} ${dragOverTab?.id === tab.id ? 'drag-over' : ''}`}
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, tab)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, tab)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, tab)}
                    onClick={() => {
                      setActiveTabId(tab.id);
                      saveTabsState(openTabs, tab.id);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, tab)}
                    title={tab.name}
                  >
                    {tab.type === 'split' ? (
                      <SquareMultipleRegular className="tab-icon" />
                    ) : tab.type === 'search' ? (
                      <SearchRegular className="tab-icon" />
                    ) : tab.type === 'pdf' ? (
                      <DocumentRegular className="tab-icon" />
                    ) : tab.type === 'otzaria' ? (
                      <BookRegular className="tab-icon" />
                    ) : (
                      <DocumentTextRegular className="tab-icon" />
                    )}
                    <span className="tab-item-content">{tab.name}</span>
                    <button
                      className="tab-close-btn"
                      onClick={(e) => handleCloseTab(tab.id, e)}
                      aria-label="סגור"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {/* כפתור + לכרטיסייה חדשה */}
                <button
                  className="new-tab-btn"
                  onClick={handleNewSearchTab}
                  title="כרטיסיית חיפוש חדשה"
                  aria-label="כרטיסייה חדשה"
                >
                  +
                </button>
              </div>
              )}

              {/* תפריט כרטיסיות פתוחות - מחוץ ל-container */}
              {showTabsDialog && openTabs.length > 0 && currentView === 'books' && (
                <>
                  <div className="tabs-dropdown-overlay" onClick={() => setShowTabsDialog(false)} />
                  <div className="tabs-dropdown">
                    <div className="tabs-dropdown-header">
                      <span>כרטיסיות פתוחות</span>
                      <span className="tabs-dropdown-count">{openTabs.length}</span>
                    </div>
                    <div className="tabs-dropdown-list">
                      {openTabs.map((tab) => (
                        <div
                          key={tab.id}
                          className={`tabs-dropdown-item ${activeTabId === tab.id ? 'active' : ''}`}
                          onClick={() => {
                            setActiveTabId(tab.id);
                            saveTabsState(openTabs, tab.id);
                            setShowTabsDialog(false);
                          }}
                        >
                          <div className="tabs-dropdown-item-icon">
                            {tab.type === 'split' ? (
                              <SquareMultipleRegular />
                            ) : tab.type === 'search' ? (
                              <SearchRegular />
                            ) : tab.type === 'pdf' ? (
                              <DocumentRegular />
                            ) : tab.type === 'otzaria' ? (
                              <BookRegular />
                            ) : (
                              <DocumentTextRegular />
                            )}
                          </div>
                          <div className="tabs-dropdown-item-content">
                            <div className="tabs-dropdown-item-title">{tab.name}</div>
                          </div>
                          <button
                            className="tabs-dropdown-item-close"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloseTab(tab.id, e);
                              if (openTabs.length === 1) {
                                setShowTabsDialog(false);
                              }
                            }}
                            aria-label="סגור"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* מציג קבצים - תמיד ב-DOM אבל מוסתר בתצוגות אחרות */}
              <div className="file-viewer" style={{ 
                display: currentView === 'books' ? 'block' : 'none'
              }}>
                {/* תצוגת כרטיסיות */}
                <div style={{ 
                  width: '100%', 
                  height: '100%'
                }}>
                  {openTabs.length > 0 ? (
                      openTabs.map((tab) => (
                        <div
                          key={tab.id}
                          style={{
                            width: '100%',
                            height: '100%',
                            display: activeTabId === tab.id ? 'flex' : 'none',
                            flexDirection: tab.type === 'split' ? 'row' : 'column'
                          }}
                        >
                          {tab.type === 'split' ? (
                            /* תצוגה מפוצלת */
                            <>
                              {/* צד שמאל */}
                              <div 
                                className="split-view-pane split-view-left"
                                style={{ width: `${tab.splitRatio}%`, position: 'relative' }}
                              >
                                {tab.isSelectingLeft || !tab.leftTab ? (
                                  /* דיאלוג בחירת כרטיסייה שנייה */
                                  <div className="split-view-selector-in-pane">
                                    <div className="split-view-selector">
                                      <div className="split-view-selector-header">
                                        <h3>בחר כרטיסייה להוספה</h3>
                                        <button onClick={handleCancelSelectSecondTab}>✕</button>
                                      </div>
                                      <div className="split-view-selector-tabs">
                                        {openTabs
                                          .filter(t => t.id !== tab.id && t.id !== tab.rightTab.id && t.type !== 'split')
                                          .map(t => (
                                            <div
                                              key={t.id}
                                              className="split-view-selector-tab"
                                              onClick={() => handleSelectSecondTab(t)}
                                            >
                                              {t.type === 'search' ? <SearchRegular /> : t.type === 'pdf' ? <DocumentRegular /> : <DocumentTextRegular />}
                                              <span>{t.name}</span>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  </div>
                                ) : tab.leftTab.type === 'search' ? (
                                  <SearchPage
                                    searchQuery={tab.leftTab.searchQuery || ''}
                                    setSearchQuery={(query) => {
                                      const updatedTabs = openTabs.map(t => 
                                        t.id === tab.id ? { ...t, leftTab: { ...t.leftTab, searchQuery: query } } : t
                                      );
                                      setOpenTabs(updatedTabs);
                                    }}
                                    isSearching={isSearching}
                                    searchResults={tab.leftTab.searchResults || []}
                                    setSearchResults={(results) => {
                                      const updatedTabs = openTabs.map(t => 
                                        t.id === tab.id ? { ...t, leftTab: { ...t.leftTab, searchResults: results } } : t
                                      );
                                      setOpenTabs(updatedTabs);
                                    }}
                                    handleFileClick={handleFileClick}
                                    allFiles={allFiles}
                                    onSearch={async (query, advancedOptions) => {
                                      setIsSearching(true);
                                      try {
                                        const results = await handleContentSearch(query, advancedOptions);
                                        const updatedTabs = openTabs.map(t => 
                                          t.id === tab.id ? { ...t, leftTab: { ...t.leftTab, searchQuery: query, searchResults: results || [] } } : t
                                        );
                                        setOpenTabs(updatedTabs);
                                      } finally {
                                        setIsSearching(false);
                                      }
                                    }}
                                    recentBooks={recentBooks}
                                    isActive={activeTabId === tab.id}
                                    onAutocompleteChange={setIsAutocompleteOpen}
                                  />
                                ) : tab.leftTab.type === 'pdf' ? (
                                  <PDFViewer 
                                    key={`${tab.leftTab.id}-${tab.leftTab._updateKey || 0}`}
                                    pdfPath={tab.leftTab.path} 
                                    title={tab.leftTab.name}
                                    searchContext={tab.leftTab.searchContext}
                                    onLocateBook={setHeaderSearchQuery}
                                    onPdfClick={closeHeaderAutocomplete}
                                  />
                                ) : tab.leftTab.type === 'otzaria' ? (
                                  <TextViewer
                                    key={`${tab.leftTab.id}-${tab.leftTab._updateKey || 0}`}
                                    bookId={tab.leftTab.bookId}
                                    bookType="otzaria"
                                    searchContext={tab.leftTab.searchContext}
                                  />
                                ) : (
                                  <TextViewer 
                                    key={`${tab.leftTab.id}-${tab.leftTab._updateKey || 0}`}
                                    textPath={tab.leftTab.path} 
                                    title={tab.leftTab.name}
                                    searchContext={tab.leftTab.searchContext}
                                  />
                                )}
                              </div>

                              {/* קו מפריד */}
                              <div 
                                className="split-view-divider"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  const startX = e.clientX;
                                  const startRatio = tab.splitRatio;
                                  
                                  const handleMouseMove = (e) => {
                                    const deltaX = e.clientX - startX;
                                    const containerWidth = e.target.parentElement.offsetWidth;
                                    const deltaPercent = (deltaX / containerWidth) * 100;
                                    const newRatio = Math.min(Math.max(startRatio + deltaPercent, 20), 80);
                                    updateSplitRatio(tab.id, newRatio);
                                  };
                                  
                                  const handleMouseUp = () => {
                                    document.removeEventListener('mousemove', handleMouseMove);
                                    document.removeEventListener('mouseup', handleMouseUp);
                                  };
                                  
                                  document.addEventListener('mousemove', handleMouseMove);
                                  document.addEventListener('mouseup', handleMouseUp);
                                }}
                              />

                              {/* צד ימין */}
                              <div 
                                className="split-view-pane split-view-right"
                                style={{ width: `${100 - tab.splitRatio}%` }}
                              >
                                {tab.rightTab.type === 'search' ? (
                                  <SearchPage
                                    searchQuery={tab.rightTab.searchQuery || ''}
                                    setSearchQuery={(query) => {
                                      const updatedTabs = openTabs.map(t => 
                                        t.id === tab.id ? { ...t, rightTab: { ...t.rightTab, searchQuery: query } } : t
                                      );
                                      setOpenTabs(updatedTabs);
                                    }}
                                    isSearching={isSearching}
                                    searchResults={tab.rightTab.searchResults || []}
                                    setSearchResults={(results) => {
                                      const updatedTabs = openTabs.map(t => 
                                        t.id === tab.id ? { ...t, rightTab: { ...t.rightTab, searchResults: results } } : t
                                      );
                                      setOpenTabs(updatedTabs);
                                    }}
                                    handleFileClick={handleFileClick}
                                    allFiles={allFiles}
                                    onSearch={async (query, advancedOptions) => {
                                      setIsSearching(true);
                                      try {
                                        const results = await handleContentSearch(query, advancedOptions);
                                        const updatedTabs = openTabs.map(t => 
                                          t.id === tab.id ? { ...t, rightTab: { ...t.rightTab, searchQuery: query, searchResults: results || [] } } : t
                                        );
                                        setOpenTabs(updatedTabs);
                                      } finally {
                                        setIsSearching(false);
                                      }
                                    }}
                                    recentBooks={recentBooks}
                                    isActive={activeTabId === tab.id}
                                    onAutocompleteChange={setIsAutocompleteOpen}
                                  />
                                ) : tab.rightTab.type === 'pdf' ? (
                                  <PDFViewer 
                                    key={`${tab.rightTab.id}-${tab.rightTab._updateKey || 0}`}
                                    pdfPath={tab.rightTab.path} 
                                    title={tab.rightTab.name}
                                    searchContext={tab.rightTab.searchContext}
                                    onLocateBook={setHeaderSearchQuery}
                                    onPdfClick={closeHeaderAutocomplete}
                                  />
                                ) : tab.rightTab.type === 'otzaria' ? (
                                  <TextViewer
                                    key={`${tab.rightTab.id}-${tab.rightTab._updateKey || 0}`}
                                    bookId={tab.rightTab.bookId}
                                    bookType="otzaria"
                                    searchContext={tab.rightTab.searchContext}
                                  />
                                ) : (
                                  <TextViewer 
                                    key={`${tab.rightTab.id}-${tab.rightTab._updateKey || 0}`}
                                    textPath={tab.rightTab.path} 
                                    title={tab.rightTab.name}
                                    searchContext={tab.rightTab.searchContext}
                                  />
                                )}
                              </div>
                            </>
                          ) : tab.type === 'search' ? (
                            <SearchPage
                              searchQuery={tab.searchQuery || ''}
                              setSearchQuery={(query) => {
                                const updatedTabs = openTabs.map(t => 
                                  t.id === tab.id ? { ...t, searchQuery: query } : t
                                );
                                setOpenTabs(updatedTabs);
                              }}
                              isSearching={isSearching}
                              searchResults={tab.searchResults || []}
                              setSearchResults={(results) => {
                                const updatedTabs = openTabs.map(t => 
                                  t.id === tab.id ? { ...t, searchResults: results } : t
                                );
                                setOpenTabs(updatedTabs);
                              }}
                              handleFileClick={handleFileClick}
                              allFiles={allFiles}
                              onSearch={async (query, advancedOptions) => {
                                // wrapper שמעדכן את התוצאות של הכרטיסייה הספציפית
                                setIsSearching(true);
                                try {
                                  const results = await handleContentSearch(query, advancedOptions);
                                  const updatedTabs = openTabs.map(t => 
                                    t.id === tab.id ? { ...t, searchQuery: query, searchResults: results || [] } : t
                                  );
                                  setOpenTabs(updatedTabs);
                                } finally {
                                  setIsSearching(false);
                                }
                              }}
                              recentBooks={recentBooks}
                              isActive={activeTabId === tab.id}
                              onAutocompleteChange={setIsAutocompleteOpen}
                            />
                          ) : tab.type === 'pdf' ? (
                            <PDFViewer 
                              key={`${tab.id}-${tab._updateKey || 0}`}
                              pdfPath={tab.path} 
                              title={tab.name}
                              searchContext={tab.searchContext}
                              onLocateBook={setHeaderSearchQuery}
                              onPdfClick={closeHeaderAutocomplete}
                            />
                          ) : tab.type === 'otzaria' ? (
                            <TextViewer
                              key={`${tab.id}-${tab._updateKey || 0}`}
                              bookId={tab.bookId}
                              bookType="otzaria"
                              searchContext={tab.searchContext}
                            />
                          ) : (
                            <TextViewer 
                              key={`${tab.id}-${tab._updateKey || 0}`}
                              textPath={tab.path} 
                              title={tab.name}
                              searchContext={tab.searchContext}
                            />
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <div className="empty-state-cards">
                          <div 
                            className="empty-state-card"
                            onClick={handleNewSearchTab}
                            title="פתח חיפוש"
                          >
                            <SearchRegular className="empty-state-card-icon" />
                            <span className="empty-state-card-title">חיפוש</span>
                          </div>
                          <div 
                            className="empty-state-card"
                            onClick={toggleLibrary}
                            title="פתח ספרייה"
                          >
                            <LibraryRegular className="empty-state-card-icon" />
                            <span className="empty-state-card-title">ספרייה</span>
                          </div>
                        </div>
                        <Text size={500} style={{ marginTop: '32px', opacity: 0.7 }}>
                          לחץ על הספרייה לבחירת ספר או על החיפוש לחיפוש בתוכן
                        </Text>
                      </div>
                    )}
                  </div>
                </div>

              {/* תצוגות אחרות - מוצגות במקום נפרד */}
              <div style={{ 
                display: currentView !== 'books' ? 'block' : 'none',
                width: '100%',
                height: '100%'
              }}>
                {currentView === 'home' && (
                  <LibraryHome 
                    recentBooks={recentBooks} 
                    allFiles={allFiles} 
                    onBookClick={handleFileClick}
                    workspaces={workspaces}
                    currentWorkspace={currentWorkspace}
                    onSelectWorkspace={selectWorkspace}
                    onCreateWorkspace={createWorkspace}
                    onDeleteWorkspace={deleteWorkspace}
                    onRenameWorkspace={renameWorkspace}
                    onOpenCalendar={() => handleOpenTool('calendar')}
                    onOpenParasha={() => handleOpenTool('parasha')}
                  />
                )}
                
                {currentView === 'tools' && (
                  <ToolsPage initialTool={selectedTool} />
                )}
                
                {currentView === 'settings' && (
                  <Settings 
                    isDark={isDark} 
                    setIsDark={setIsDark}
                    onNavigateToMetadata={() => setCurrentView('metadata')}
                  />
                )}
                
                {currentView === 'metadata' && (
                  <MetadataTableEditor onBack={() => setCurrentView('settings')} />
                )}
              </div>
            </div>
            
            {/* סיידבר ספרייה - מימין */}
            {currentView === 'books' && (
              <LibrarySidebar
                allFiles={allFiles}
                pinnedBooks={pinnedBooks}
                recentBooks={recentBooks}
                onFileClick={(file) => {
                  handleFileClick(file);
                }}
                onUnpinBook={handleUnpinBook}
                onFolderClick={handleFolderClick}
                onClose={() => setIsLibrarySidebarOpen(false)}
                isOpen={isLibrarySidebarOpen}
              />
            )}
          </div>
        </div>

        {/* תפריט הקשר מותאם - בסגנון Chrome */}
        {contextMenu && (
          <div
            className="context-menu"
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 1000,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenuTarget && (
              <>
                {/* טעינה מחדש */}
                <div className="context-menu-item" onClick={handleReloadTab}>
                  <ArrowClockwiseRegular />
                  <span>טעינה מחדש</span>
                  <span className="context-menu-shortcut">Ctrl+R</span>
                </div>

                {/* שכפול */}
                <div className="context-menu-item" onClick={handleDuplicateTab}>
                  <CopyRegular />
                  <span>שכפול</span>
                </div>

                {/* הצמדה - רק לכרטיסיות רגילות */}
                {contextMenuTarget.type !== 'split' && (
                  <div className="context-menu-item" onClick={handlePinBook}>
                    {pinnedBooks.some(book => book.id === contextMenuTarget.id) ? (
                      <>
                        <PinOffRegular />
                        <span>בטל הצמדה מספרייה</span>
                      </>
                    ) : (
                      <>
                        <PinRegular />
                        <span>הצמד לספרייה</span>
                      </>
                    )}
                  </div>
                )}

                <div className="context-menu-divider"></div>

                {/* Split View - רק לכרטיסיות רגילות */}
                {contextMenuTarget.type !== 'split' && openTabs.length > 1 && (
                  <>
                    <div className="context-menu-item" onClick={handleAddToSplitView}>
                      <SquareMultipleRegular />
                      <span>הוסף לתצוגה מפוצלת</span>
                    </div>
                    <div className="context-menu-divider"></div>
                  </>
                )}

                {/* אופציות Split View - רק לכרטיסיות מפוצלות */}
                {contextMenuTarget.type === 'split' && (
                  <>
                    <div className="context-menu-item" onClick={handleReverseSplitView}>
                      <ArrowClockwiseRegular />
                      <span>החלף צדדים</span>
                    </div>
                    <div className="context-menu-item" onClick={handleCloseLeftView}>
                      <span>סגור צד שמאל</span>
                    </div>
                    <div className="context-menu-item" onClick={handleCloseRightView}>
                      <span>סגור צד ימין</span>
                    </div>
                    <div className="context-menu-item" onClick={handleSeparateViews}>
                      <span>הפרד תצוגות</span>
                    </div>
                    <div className="context-menu-divider"></div>
                  </>
                )}

                {/* סגירה */}
                <div className="context-menu-item" onClick={handleCloseTabFromMenu}>
                  <DeleteRegular />
                  <span>סגירה</span>
                  <span className="context-menu-shortcut">Ctrl+W</span>
                </div>

                {/* סגירת כרטיסיות אחרות */}
                <div 
                  className={`context-menu-item ${openTabs.length <= 1 ? 'context-menu-item-disabled' : ''}`}
                  onClick={openTabs.length > 1 ? handleCloseOtherTabs : closeContextMenu}
                >
                  <span>סגירת כרטיסיות אחרות</span>
                </div>

                {/* סגירת כרטיסיות מימין (לפני הכרטיסייה הנוכחית) */}
                <div 
                  className={`context-menu-item ${
                    openTabs.findIndex(tab => tab.id === contextMenuTarget.id) === 0 
                      ? 'context-menu-item-disabled' 
                      : ''
                  }`}
                  onClick={
                    openTabs.findIndex(tab => tab.id === contextMenuTarget.id) > 0 
                      ? handleCloseTabsToRight 
                      : closeContextMenu
                  }
                >
                  <span>סגירת כרטיסיות מימין</span>
                </div>

                {/* סגירת כרטיסיות משמאל (אחרי הכרטיסייה הנוכחית) */}
                <div 
                  className={`context-menu-item ${
                    openTabs.findIndex(tab => tab.id === contextMenuTarget.id) === openTabs.length - 1 
                      ? 'context-menu-item-disabled' 
                      : ''
                  }`}
                  onClick={
                    openTabs.findIndex(tab => tab.id === contextMenuTarget.id) < openTabs.length - 1 
                      ? handleCloseTabsToLeft 
                      : closeContextMenu
                  }
                >
                  <span>סגירת כרטיסיות משמאל</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* דיאלוג ספרייה ב-empty state */}
        {showLibraryDialog && (
          <div className="library-dialog-overlay" onClick={toggleLibrary}>
            <div className="library-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="library-dialog-header">
                <h2>ספרייה</h2>
                <button className="library-dialog-close" onClick={toggleLibrary}>
                  ✕
                </button>
              </div>
              <div className="library-dialog-content">
                <FileTree 
                  files={allFiles}
                  onFileClick={(file) => {
                    handleFileClick(file);
                    toggleLibrary();
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </FluentProvider>
  );
}

export default App;
