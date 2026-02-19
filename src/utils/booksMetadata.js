// מנהל מטא-דאטה של ספרים
class BooksMetadataManager {
  constructor() {
    this.metadata = null;
    this.booksByFileName = new Map();
    this.booksByCategory = new Map();
  }

  // טעינת מטא-דאטה של ספרים
  async loadMetadata() {
    try {
      console.log('📚 מנסה לטעון מטא-דאטה מ-/books-metadata.json');
      const response = await fetch('/books-metadata.json');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.metadata = data.books;
      
      // בניית אינדקסים
      this.buildIndexes();
      
      console.log(`✅ נטענו ${this.metadata.length} ספרים עם מטא-דאטה`);
      console.log('📖 ספרים:', this.metadata.map(b => b.title));
      return true;
    } catch (error) {
      console.error('❌ שגיאה בטעינת מטא-דאטה:', error);
      this.metadata = [];
      return false;
    }
  }

  // בניית אינדקסים למהירות
  buildIndexes() {
    this.booksByFileName.clear();
    this.booksByCategory.clear();

    this.metadata.forEach(book => {
      // אינדקס לפי שם קובץ
      this.booksByFileName.set(book.fileName, book);

      // אינדקס לפי קטגוריה
      book.categories.forEach(category => {
        if (!this.booksByCategory.has(category)) {
          this.booksByCategory.set(category, []);
        }
        this.booksByCategory.get(category).push(book);
      });
    });
  }

  // קבלת מטא-דאטה של ספר לפי שם קובץ
  getBookByFileName(fileName) {
    if (!this.metadata || this.metadata.length === 0) {
      return null;
    }
    return this.booksByFileName.get(fileName) || null;
  }

  // קבלת כל הספרים בקטגוריה
  getBooksByCategory(category) {
    return this.booksByCategory.get(category) || [];
  }

  // חיפוש ספר לפי שם או כינוי
  searchBook(query) {
    // אם המטא-דאטה עדיין לא נטענה, החזר מערך רק
    if (!this.metadata || this.metadata.length === 0) {
      return [];
    }
    
    const normalizedQuery = this.normalizeText(query);
    
    return this.metadata.filter(book => {
      // חיפוש בשם
      if (this.normalizeText(book.title).includes(normalizedQuery)) {
        return true;
      }
      
      // חיפוש בכינויים
      if (book.aliases.some(alias => 
        this.normalizeText(alias).includes(normalizedQuery)
      )) {
        return true;
      }
      
      // חיפוש במחבר
      if (this.normalizeText(book.author).includes(normalizedQuery)) {
        return true;
      }
      
      return false;
    });
  }

  // חיפוש בתוכן עניינים
  searchTableOfContents(fileName, query) {
    const book = this.getBookByFileName(fileName);
    if (!book || !book.tableOfContents) return null;

    const normalizedQuery = this.normalizeText(query);

    for (const entry of book.tableOfContents) {
      // חיפוש בתווית
      if (this.normalizeText(entry.label).includes(normalizedQuery)) {
        return entry;
      }

      // חיפוש במילות מפתח
      if (entry.keywords.some(keyword => 
        this.normalizeText(keyword).includes(normalizedQuery)
      )) {
        return entry;
      }
    }

    return null;
  }

  // נרמול טקסט לחיפוש
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/['"״׳''""]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // קבלת כל הספרים
  getAllBooks() {
    return this.metadata || [];
  }

  // קבלת כל הקטגוריות
  getAllCategories() {
    return Array.from(this.booksByCategory.keys());
  }

  // העשרת תוצאות חיפוש עם מטא-דאטה
  enrichSearchResults(results) {
    return results.map(result => {
      const metadata = this.getBookByFileName(result.file.name);
      return {
        ...result,
        metadata: metadata || null
      };
    });
  }

  // קבלת מידע מלא על ספר
  getBookInfo(fileName) {
    const book = this.getBookByFileName(fileName);
    if (!book) return null;

    return {
      ...book,
      categoryNames: this.getCategoryNames(book.categories)
    };
  }

  // המרת קודי קטגוריות לשמות
  getCategoryNames(categoryCodes) {
    const categoryMap = {
      'all': 'הכל',
      'tanach': 'תנ"ך',
      'shas': 'ש"ס',
      'halacha': 'הלכה',
      'shut': 'שו"ת',
      'machshava': 'מחשבה ומוסר',
      'contemporary': 'מחברי זמננו',
      'chassidut': 'חסידות',
      'kabbalah': 'קבלה',
      'journals': 'כתבי עת',
      'favorites': 'מועדפים',
      'prayers': 'תפלות',
      'reference': 'ספרות עזר'
    };

    return categoryCodes.map(code => categoryMap[code] || code);
  }
}

// יצירת instance יחיד
const booksMetadata = new BooksMetadataManager();

export default booksMetadata;
