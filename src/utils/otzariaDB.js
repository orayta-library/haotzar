/**
 * מודול לקריאה ממסד נתונים של אוצריא
 * מטפל בקריאת קטגוריות, ספרים ותוכן מקובץ seforim.db
 */

class OtzariaDB {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.isElectron = typeof window !== 'undefined' && window.electron !== undefined;
    this.isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;
  }

  /**
   * פתיחת חיבור למסד הנתונים
   */
  async open(dbPath) {
    console.log('🔓 otzariaDB.open called with path:', dbPath);
    console.log('🔍 Environment: isElectron:', this.isElectron, 'isTauri:', this.isTauri);
    
    try {
      this.dbPath = dbPath;
      
      if (this.isElectron) {
        console.log('💻 Opening via Electron...');
        // ב-Electron נשתמש ב-better-sqlite3 דרך preload
        // נשמור את הנתיב ונשתמש בו לקריאות
        if (!window.electron.fileExists(dbPath)) {
          console.warn('⚠️ קובץ מסד נתונים לא קיים:', dbPath);
          return false;
        }
        
        console.log('✅ File exists, opening DB...');
        // פתיחת ה-DB תעשה דרך IPC handler שנוסיף
        const result = await window.electron.openOtzariaDB(dbPath);
        console.log('📊 Open result:', result);
        
        if (result.success) {
          this.db = true; // סימן שיש חיבור
          console.log('✅ מסד נתונים אוצריא נפתח בהצלחה');
          return true;
        } else {
          console.error('❌ Failed to open DB:', result.error);
        }
        return false;
      } else if (this.isTauri) {
        console.log('🦀 Opening via Tauri...');
        // ב-Tauri נצטרך להוסיף פונקציה ב-Rust
        const { invoke } = window.__TAURI__.tauri;
        const result = await invoke('open_otzaria_db', { path: dbPath });
        if (result.success) {
          this.db = true;
          console.log('✅ מסד נתונים אוצריא נפתח בהצלחה (Tauri)');
          return true;
        }
        return false;
      }
      
      console.warn('⚠️ Not in Electron or Tauri environment');
      return false;
    } catch (error) {
      console.error('❌ שגיאה בפתיחת מסד נתונים אוצריא:', error);
      return false;
    }
  }

  /**
   * קבלת כל הקטגוריות הראשיות (ללא הורה)
   */
  getRootCategories() {
    console.log('📚 getRootCategories called, db:', !!this.db);
    if (!this.db) return [];
    
    try {
      if (this.isElectron) {
        console.log('🔍 Querying root categories via Electron...');
        const result = window.electron.queryOtzariaDB(
          'SELECT * FROM category WHERE parentId IS NULL ORDER BY orderIndex, title'
        );
        console.log('✅ Root categories result:', result.length, 'categories');
        return result;
      }
      return [];
    } catch (error) {
      console.error('❌ שגיאה בקריאת קטגוריות ראשיות:', error);
      return [];
    }
  }

  /**
   * קבלת תת-קטגוריות של קטגוריה מסוימת
   */
  getSubCategories(parentId) {
    if (!this.db) return [];
    
    try {
      if (this.isElectron) {
        return window.electron.queryOtzariaDB(
          'SELECT * FROM category WHERE parentId = ? ORDER BY orderIndex, title',
          [parentId]
        );
      }
      return [];
    } catch (error) {
      console.error('שגיאה בקריאת תת-קטגוריות:', error);
      return [];
    }
  }

  /**
   * קבלת ספרים בקטגוריה מסוימת
   */
  getBooksInCategory(categoryId) {
    if (!this.db) return [];
    
    try {
      if (this.isElectron) {
        return window.electron.queryOtzariaDB(
          `SELECT id, title, heShortDesc, totalLines, 
                  hasNekudot, hasTeamim, volume
           FROM book 
           WHERE categoryId = ? 
           ORDER BY orderIndex, title`,
          [categoryId]
        );
      }
      return [];
    } catch (error) {
      console.error('שגיאה בקריאת ספרים:', error);
      return [];
    }
  }

  /**
   * קבלת מידע על ספר לפי ID
   */
  getBookInfo(bookId) {
    if (!this.db) return null;
    
    try {
      if (this.isElectron) {
        const results = window.electron.queryOtzariaDB(
          'SELECT * FROM book WHERE id = ?',
          [bookId]
        );
        return results.length > 0 ? results[0] : null;
      }
      return null;
    } catch (error) {
      console.error('שגיאה בקריאת מידע ספר:', error);
      return null;
    }
  }

  /**
   * קבלת תוכן עניינים (TOC) של ספר
   */
  getBookTOC(bookId) {
    if (!this.db) return [];
    
    try {
      if (this.isElectron) {
        const toc = window.electron.queryOtzariaDB(
          `SELECT te.*, tt.text as title
           FROM tocEntry te
           JOIN tocText tt ON te.textId = tt.id
           WHERE te.bookId = ?
           ORDER BY te.lineIndex`,
          [bookId]
        );
        
        // בניית עץ היררכי
        return this.buildTOCTree(toc);
      }
      return [];
    } catch (error) {
      console.error('שגיאה בקריאת תוכן עניינים:', error);
      return [];
    }
  }

  /**
   * בניית עץ היררכי מרשימת TOC שטוחה
   */
  buildTOCTree(flatTOC) {
    const map = {};
    const roots = [];
    
    // יצירת מפה של כל הפריטים
    flatTOC.forEach(item => {
      map[item.id] = { ...item, children: [] };
    });
    
    // בניית העץ
    flatTOC.forEach(item => {
      if (item.parentId === null) {
        roots.push(map[item.id]);
      } else if (map[item.parentId]) {
        map[item.parentId].children.push(map[item.id]);
      }
    });
    
    return roots;
  }

  /**
   * קבלת שורות טקסט של ספר (עם פגינציה)
   */
  getBookLines(bookId, startLine = 0, limit = 100) {
    if (!this.db) return [];
    
    try {
      if (this.isElectron) {
        return window.electron.queryOtzariaDB(
          `SELECT id, lineIndex, content, heRef
           FROM line
           WHERE bookId = ?
           ORDER BY lineIndex
           LIMIT ? OFFSET ?`,
          [bookId, limit, startLine]
        );
      }
      return [];
    } catch (error) {
      console.error('שגיאה בקריאת שורות:', error);
      return [];
    }
  }

  /**
   * קבלת כל שורות הספר (זהירות - יכול להיות גדול!)
   */
  getAllBookLines(bookId) {
    if (!this.db) return [];
    
    try {
      if (this.isElectron) {
        return window.electron.queryOtzariaDB(
          `SELECT id, lineIndex, content, heRef
           FROM line
           WHERE bookId = ?
           ORDER BY lineIndex`,
          [bookId]
        );
      }
      return [];
    } catch (error) {
      console.error('שגיאה בקריאת כל השורות:', error);
      return [];
    }
  }

  /**
   * קבלת כל הספרים (ללא סינון)
   * שימושי לטעינה ראשונית של רשימת הספרים
   */
  getAllBooks() {
    if (!this.db) return [];
    
    try {
      if (this.isElectron) {
        const results = window.electron.queryOtzariaDB(
          `SELECT b.id, b.title, b.heShortDesc, b.totalLines, b.volume,
                  c.title as categoryTitle
           FROM book b
           JOIN category c ON b.categoryId = c.id
           ORDER BY b.title`
        );
        
        console.log(`📖 אוצריא: נטענו ${results.length} ספרים`);
        
        // סנן ספרים מקטגוריות חיצוניות
        const filtered = results.filter(book => {
          const category = book.categoryTitle?.toLowerCase() || '';
          const isExternal = category.includes('hebrewbooks') || 
                            category.includes('hebrew books') ||
                            category.includes('היברו-בוקס') ||
                            category.includes('היברו בוקס') ||
                            category.includes('היברובוקס') ||
                            category.includes('אוצר החכמה') ||
                            category.includes('אוצר חכמה');
          
          return !isExternal;
        });
        
        console.log(`✅ אוצריא: ${filtered.length} ספרים אחרי סינון קטגוריות חיצוניות`);
        return filtered;
      }
      return [];
    } catch (error) {
      console.error('שגיאה בקריאת כל הספרים:', error);
      return [];
    }
  }

  /**
   * חיפוש ספרים לפי שם
   * מחפש רק בקטגוריות פנימיות (לא חיצוניות)
   */
  searchBooks(query) {
    if (!this.db || !query) {
      console.log('⚠️ searchBooks: db או query לא זמינים', { db: !!this.db, query });
      return [];
    }
    
    try {
      if (this.isElectron) {
        console.log('🔍 searchBooks בוצע:', { query });
        
        // חיפוש עם סינון קטגוריות חיצוניות ישירות ב-SQL
        const sqlQuery = `
          SELECT b.id, b.title, b.heShortDesc, b.totalLines, b.volume,
                 c.title as categoryTitle
          FROM book b
          JOIN category c ON b.categoryId = c.id
          WHERE (b.title LIKE ? OR c.title LIKE ?)
            AND c.title NOT LIKE '%hebrewbooks%'
            AND c.title NOT LIKE '%hebrew books%'
            AND c.title NOT LIKE '%היברו-בוקס%'
            AND c.title NOT LIKE '%היברו בוקס%'
            AND c.title NOT LIKE '%היברובוקס%'
            AND c.title NOT LIKE '%אוצר החכמה%'
            AND c.title NOT LIKE '%אוצר חכמה%'
          ORDER BY b.title
          LIMIT 100
        `;
        
        const searchPattern = `%${query}%`;
        console.log('📊 SQL Query with filtering');
        console.log('📊 Search Pattern:', searchPattern);
        
        const results = window.electron.queryOtzariaDB(
          sqlQuery,
          [searchPattern, searchPattern]
        );
        
        console.log(`✅ אוצריא: נמצאו ${results.length} תוצאות (אחרי סינון ב-SQL) לשאילתה: "${query}"`);
        if (results.length > 0) {
          console.log('   דוגמאות:', results.slice(0, 5).map(b => `${b.title} (${b.categoryTitle})`));
        }
        
        return results;
      }
      return [];
    } catch (error) {
      console.error('❌ שגיאה בחיפוש ספרים:', error);
      return [];
    }
  }

  /**
   * חיפוש טקסט בתוך ספר
   */
  searchInBook(bookId, query) {
    if (!this.db || !query) return [];
    
    try {
      if (this.isElectron) {
        return window.electron.queryOtzariaDB(
          `SELECT id, lineIndex, content, heRef
           FROM line
           WHERE bookId = ? AND content LIKE ?
           ORDER BY lineIndex
           LIMIT 100`,
          [bookId, `%${query}%`]
        );
      }
      return [];
    } catch (error) {
      console.error('שגיאה בחיפוש בספר:', error);
      return [];
    }
  }

  /**
   * קבלת סטטיסטיקות על מסד הנתונים
   */
  getStats() {
    if (!this.db) return null;
    
    try {
      if (this.isElectron) {
        const categories = window.electron.queryOtzariaDB('SELECT COUNT(*) as count FROM category');
        const books = window.electron.queryOtzariaDB('SELECT COUNT(*) as count FROM book');
        const lines = window.electron.queryOtzariaDB('SELECT COUNT(*) as count FROM line');
        
        return {
          totalCategories: categories[0].count,
          totalBooks: books[0].count,
          totalLines: lines[0].count,
        };
      }
      return null;
    } catch (error) {
      console.error('שגיאה בקריאת סטטיסטיקות:', error);
      return null;
    }
  }

  /**
   * סגירת החיבור למסד הנתונים
   */
  close() {
    if (this.db) {
      try {
        if (this.isElectron) {
          window.electron.closeOtzariaDB();
        }
        this.db = null;
        console.log('✅ מסד נתונים אוצריא נסגר');
      } catch (error) {
        console.error('שגיאה בסגירת מסד הנתונים:', error);
      }
    }
  }
}

// יצירת instance יחיד (singleton)
const otzariaDB = new OtzariaDB();

export default otzariaDB;
