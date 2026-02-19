/**
 * אינטגרציה של אוצריא עם הספרייה הקיימת
 * יוצר "קבצים וירטואליים" מספרי אוצריא שנראים כמו קבצים רגילים
 */

import otzariaDB from './otzariaDB';

// Cache לעץ האוצריא - נבנה פעם אחת בלבד
let cachedOtzariaTree = null;
let isBuildingTree = false;

/**
 * בדיקה אם קטגוריה היא חיצונית (HebrewBooks או אוצר החכמה)
 * משמש רק להסתרת שם הקטגוריה בתצוגה, לא לסינון
 */
function isExternalCategory(categoryTitle) {
  if (!categoryTitle) return false;
  
  const title = categoryTitle.toLowerCase();
  return title.includes('hebrewbooks') || 
         title.includes('hebrew books') ||
         title.includes('היברו-בוקס') ||
         title.includes('היברו בוקס') ||
         title.includes('היברובוקס') ||
         title.includes('אוצר החכמה') ||
         title.includes('אוצר חכמה');
}

/**
 * קבלת קטגוריה לפי נתיב
 */
export function getOtzariaCategoryByPath(path) {
  if (!cachedOtzariaTree) {
    console.warn('⚠️ אין cache של עץ אוצריא');
    return null;
  }
  
  // חיפוש רקורסיבי בעץ לפי נתיב
  const findByPath = (node) => {
    if (node.path === path) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = findByPath(child);
        if (found) return found;
      }
    }
    
    return null;
  };
  
  return findByPath(cachedOtzariaTree);
}

/**
 * קבלת תיקיית אוצריא הראשית (מה-cache)
 */
export function getOtzariaRootFolder() {
  return cachedOtzariaTree;
}

/**
 * קבלת קטגוריה ספציפית לפי ID
 */
export function getOtzariaCategoryById(categoryId) {
  if (!cachedOtzariaTree) {
    console.warn('⚠️ אין cache של עץ אוצריא');
    return null;
  }
  
  // חיפוש רקורסיבי בעץ
  const findCategory = (node) => {
    if (node.virtualType === 'otzaria-category' && node.categoryId === categoryId) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = findCategory(child);
        if (found) return found;
      }
    }
    
    return null;
  };
  
  return findCategory(cachedOtzariaTree);
}

/**
 * בניית עץ קבצים וירטואלי מקטגוריות וספרים של אוצריא
 * משתמש ב-cache כדי לא לבנות מחדש בכל פעם
 */
export function buildOtzariaVirtualTree() {
  console.log('🌳 buildOtzariaVirtualTree called');
  
  // אם יש cache, החזר אותו מיד
  if (cachedOtzariaTree) {
    console.log('⚡ מחזיר עץ אוצריא מ-cache');
    return cachedOtzariaTree;
  }
  
  // אם כבר בתהליך בניה, החזר null
  if (isBuildingTree) {
    console.log('⏳ עץ אוצריא כבר בתהליך בניה...');
    return null;
  }
  
  console.log('🔍 otzariaDB.db:', otzariaDB.db);
  
  if (!otzariaDB.db) {
    console.warn('⚠️ אין חיבור ל-DB של אוצריא');
    return null;
  }
  
  isBuildingTree = true;

  try {
    console.log('📖 מתחיל לבנות עץ אוצריא...');
    
    // בניית תיקייה ראשית של אוצריא
    const otzariaRoot = {
      name: 'אוצריא',
      type: 'folder',
      path: 'virtual-otzaria',
      isVirtual: true,
      virtualType: 'otzaria',
      children: []
    };

    // קבלת כל הקטגוריות הראשיות
    console.log('📚 קורא קטגוריות ראשיות...');
    const rootCategories = otzariaDB.getRootCategories();
    console.log(`✅ נמצאו ${rootCategories.length} קטגוריות ראשיות:`, rootCategories.map(c => c.title));

    // סנן קטגוריות חיצוניות מהעץ (לא יופיעו בספרייה)
    const filteredCategories = rootCategories.filter(category => {
      const isExternal = isExternalCategory(category.title);
      
      if (isExternal) {
        console.log(`🚫 מסנן קטגוריה חיצונית מהעץ: ${category.title}`);
      }
      
      return !isExternal;
    });
    
    console.log(`✅ נותרו ${filteredCategories.length} קטגוריות אחרי סינון`);

    // בניית עץ לכל קטגוריה
    filteredCategories.forEach(category => {
      console.log(`📂 בונה קטגוריה: ${category.title}`);
      const categoryNode = buildCategoryNode(category);
      if (categoryNode) {
        otzariaRoot.children.push(categoryNode);
        console.log(`  ✅ נוספה קטגוריה: ${category.title} עם ${categoryNode.children.length} ילדים`);
      }
    });

    console.log(`🎉 עץ אוצריא נבנה בהצלחה עם ${otzariaRoot.children.length} קטגוריות`);
    
    // שמור ב-cache
    cachedOtzariaTree = otzariaRoot;
    isBuildingTree = false;
    
    return otzariaRoot;
  } catch (error) {
    console.error('❌ שגיאה בבניית עץ אוצריא:', error);
    isBuildingTree = false;
    return null;
  }
}

/**
 * ניקוי cache של עץ האוצריא (למקרה שצריך לרענן)
 */
export function clearOtzariaTreeCache() {
  console.log('🗑️ מנקה cache של עץ אוצריא');
  cachedOtzariaTree = null;
  isBuildingTree = false;
}

/**
 * בניית צומת קטגוריה (רקורסיבי)
 * @param {boolean} shallow - אם true, לא בונה תת-קטגוריות וספרים (רק placeholder)
 * @param {string} parentPath - הנתיב של ההורה (לבניית breadcrumb)
 */
function buildCategoryNode(category, depth = 0, shallow = false, parentPath = 'virtual-otzaria') {
  const indent = '  '.repeat(depth);
  console.log(`${indent}📁 buildCategoryNode: ${category.title} (id: ${category.id})${shallow ? ' [shallow]' : ''}`);
  
  const currentPath = `${parentPath}/${category.title}`;
  
  const node = {
    name: category.title,
    type: 'folder',
    path: currentPath,
    isVirtual: true,
    virtualType: 'otzaria-category',
    categoryId: category.id,
    categoryTitle: category.title,
    children: []
  };

  if (shallow) {
    // במצב shallow, רק מסמן שיש ילדים אבל לא בונה אותם
    const subCategoriesCount = otzariaDB.getSubCategories(category.id).length;
    const booksCount = otzariaDB.getBooksInCategory(category.id).length;
    
    if (subCategoriesCount > 0 || booksCount > 0) {
      // הוסף placeholder שיטען לפי דרישה
      node.children.push({
        name: '...',
        type: 'placeholder',
        path: `virtual-otzaria/placeholder-${category.id}`,
        isVirtual: true,
        virtualType: 'otzaria-placeholder',
        categoryId: category.id
      });
    }
    
    console.log(`${indent}  ⚡ Shallow: ${subCategoriesCount} קטגוריות, ${booksCount} ספרים`);
    return node;
  }

  // הוסף תת-קטגוריות (shallow אם עומק > 1)
  const subCategories = otzariaDB.getSubCategories(category.id);
  console.log(`${indent}  📂 תת-קטגוריות: ${subCategories.length}`);
  subCategories.forEach(subCat => {
    const subNode = buildCategoryNode(subCat, depth + 1, depth >= 1, currentPath); // shallow מעומק 2, העבר את הנתיב הנוכחי
    if (subNode) {
      node.children.push(subNode);
    }
  });

  // הוסף ספרים בקטגוריה זו (רק אם לא shallow)
  const books = otzariaDB.getBooksInCategory(category.id);
  console.log(`${indent}  📚 ספרים: ${books.length}`);
  books.forEach(book => {
    const bookName = book.title + (book.volume ? ` - ${book.volume}` : '');
    const bookNode = {
      name: bookName,
      type: 'file',
      path: `${currentPath}/${bookName}`,
      isVirtual: true,
      virtualType: 'otzaria-book',
      fullData: {
        id: `otzaria-${book.id}`,
        name: book.title,
        path: `${currentPath}/${bookName}`,
        type: 'otzaria',
        bookId: book.id,
        totalLines: book.totalLines,
        heShortDesc: book.heShortDesc,
        hasNekudot: book.hasNekudot,
        hasTeamim: book.hasTeamim,
        volume: book.volume
      }
    };
    node.children.push(bookNode);
  });

  console.log(`${indent}  ✅ סה"כ ילדים: ${node.children.length}`);
  return node;
}

/**
 * בדיקה אם קובץ הוא ספר אוצריא
 */
export function isOtzariaBook(file) {
  return file && file.type === 'otzaria';
}

/**
 * המרת ספר אוצריא לפורמט טקסט HTML
 */
export function convertOtzariaBookToText(bookId) {
  if (!otzariaDB.db) return null;
  
  try {
    const bookInfo = otzariaDB.getBookInfo(bookId);
    if (!bookInfo) return null;
    
    // קבל את כל השורות
    const lines = otzariaDB.getAllBookLines(bookId);
    
    // המר לפורמט HTML - ללא heRef (שם הספר ומספר)
    let html = '';
    lines.forEach(line => {
      // הסר את heRef - זה שם הספר ומספר שחוזר בכל שורה
      // רק תוכן השורה עצמה
      html += line.content + '<br>\n';
    });
    
    return {
      title: bookInfo.title,
      content: html,
      totalLines: bookInfo.totalLines
    };
  } catch (error) {
    console.error('שגיאה בהמרת ספר אוצריא:', error);
    return null;
  }
}

/**
 * קבלת תוכן ספר אוצריא כטקסט
 */
export function getOtzariaBookContent(bookId) {
  return convertOtzariaBookToText(bookId);
}

/**
 * חיפוש ספרים באוצריא
 * משתמש ב-cache פשוט לתוצאות חיפוש
 */
const searchCache = new Map();
const CACHE_SIZE_LIMIT = 100; // מקסימום 100 חיפושים ב-cache

export function searchOtzariaBooks(query) {
  if (!otzariaDB.db || !query) return [];
  
  // בדוק אם יש ב-cache
  const cacheKey = query.toLowerCase().trim();
  if (searchCache.has(cacheKey)) {
    console.log('⚡ מחזיר תוצאות חיפוש מ-cache:', cacheKey);
    return searchCache.get(cacheKey);
  }
  
  console.log('🔍 מבצע חיפוש חדש באוצריא:', query);
  
  // בצע חיפוש
  const results = otzariaDB.searchBooks(query);
  
  console.log(`   📊 התקבלו ${results.length} תוצאות מ-otzariaDB.searchBooks`);
  
  // שמור ב-cache (עם הגבלת גודל)
  if (searchCache.size >= CACHE_SIZE_LIMIT) {
    // מחק את הערך הראשון (הישן ביותר)
    const firstKey = searchCache.keys().next().value;
    searchCache.delete(firstKey);
  }
  searchCache.set(cacheKey, results);
  
  return results;
}

/**
 * ניקוי cache של חיפוש
 */
export function clearSearchCache() {
  searchCache.clear();
}

export default {
  buildOtzariaVirtualTree,
  clearOtzariaTreeCache,
  isOtzariaBook,
  convertOtzariaBookToText,
  getOtzariaBookContent,
  searchOtzariaBooks,
  clearSearchCache,
  getOtzariaRootFolder,
  getOtzariaCategoryById,
  getOtzariaCategoryByPath
};
