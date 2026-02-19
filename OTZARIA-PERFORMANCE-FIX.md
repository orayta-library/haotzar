# תיקון ביצועים - אוצריא

## הבעיה
חיפוש בהדר היה איטי מאוד - כל אות שהמשתמש מקליד לקחה כמה שניות.
הסיבה: בכל הקלדה, המערכת בנתה מחדש את כל עץ הקטגוריות מה-DB (6GB).

## הפתרונות שיושמו

### 1. Cache לעץ אוצריא (`src/utils/otzariaIntegration.js`)

**לפני:**
```javascript
export function buildOtzariaVirtualTree() {
  // בונה את העץ מחדש בכל פעם
  const otzariaRoot = { ... };
  // קריאות רבות ל-DB...
  return otzariaRoot;
}
```

**אחרי:**
```javascript
let cachedOtzariaTree = null;
let isBuildingTree = false;

export function buildOtzariaVirtualTree() {
  // אם יש cache, החזר אותו מיד
  if (cachedOtzariaTree) {
    return cachedOtzariaTree;
  }
  
  // בנה פעם אחת ושמור ב-cache
  const otzariaRoot = { ... };
  cachedOtzariaTree = otzariaRoot;
  return otzariaRoot;
}
```

**תוצאה:** העץ נבנה פעם אחת בלבד, לא בכל הקלדה.

---

### 2. Cache לחיפוש ספרים (`src/utils/otzariaIntegration.js`)

**הוספנו:**
```javascript
const searchCache = new Map();
const CACHE_SIZE_LIMIT = 100;

export function searchOtzariaBooks(query) {
  // בדוק אם יש ב-cache
  const cacheKey = query.toLowerCase().trim();
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }
  
  // בצע חיפוש ושמור ב-cache
  const results = otzariaDB.searchBooks(query);
  searchCache.set(cacheKey, results);
  return results;
}
```

**תוצאה:** חיפושים חוזרים מחזירים תוצאות מיידית מה-cache.

---

### 3. useMemo ב-LibrarySidebar (`src/components/LibrarySidebar.jsx`)

**לפני:**
```javascript
const tree = buildTree(allFiles);
const filteredTree = searchQuery ? filterTree(tree, searchQuery) : tree;
```

**אחרי:**
```javascript
const tree = useMemo(() => {
  return buildTree(allFiles);
}, [allFiles, recentBooks, pinnedBooks]);

const filteredTree = searchQuery ? filterTree(tree, searchQuery) : tree;
```

**תוצאה:** העץ נבנה רק כאשר הקבצים משתנים, לא בכל רינדור.

---

### 4. הגדלת Debounce בחיפוש (`src/App.jsx`)

**לפני:**
```javascript
}, 300); // debounce של 300ms
```

**אחרי:**
```javascript
}, 500); // debounce של 500ms - מפחית עומס על DB
```

**תוצאה:** פחות שאילתות ל-DB בזמן הקלדה מהירה.

---

### 5. Cache של Prepared Statements (`electron/preload.js`)

**לפני:**
```javascript
queryOtzariaDB: (sql, params = []) => {
  const stmt = otzariaDB.prepare(sql);
  return stmt.all(...params);
}
```

**אחרי:**
```javascript
const preparedStatementsCache = new Map();

queryOtzariaDB: (sql, params = []) => {
  let stmt = preparedStatementsCache.get(sql);
  
  if (!stmt) {
    stmt = otzariaDB.prepare(sql);
    preparedStatementsCache.set(sql, stmt);
  }
  
  return stmt.all(...params);
}
```

**תוצאה:** שאילתות חוזרות משתמשות ב-prepared statement קיים, מהיר יותר.

---

## סיכום השיפורים

| שיפור | השפעה | מיקום |
|-------|-------|-------|
| Cache עץ אוצריא | ⚡⚡⚡ גבוהה מאוד | `otzariaIntegration.js` |
| Cache חיפוש ספרים | ⚡⚡ בינונית-גבוהה | `otzariaIntegration.js` |
| useMemo לעץ | ⚡⚡ בינונית-גבוהה | `LibrarySidebar.jsx` |
| Debounce 500ms | ⚡ בינונית | `App.jsx` |
| Cache prepared statements | ⚡⚡ בינונית-גבוהה | `preload.js` |

---

## פונקציות עזר חדשות

### ניקוי Cache (במידת הצורך)

```javascript
import { clearOtzariaTreeCache, clearSearchCache } from './utils/otzariaIntegration';

// ניקוי cache של עץ אוצריא
clearOtzariaTreeCache();

// ניקוי cache של חיפוש
clearSearchCache();
```

---

## תוצאות צפויות

✅ חיפוש בהדר מהיר משמעותית  
✅ פתיחת ספרייה מהירה יותר  
✅ ניווט בעץ אוצריא חלק  
✅ פחות עומס על ה-DB  
✅ חוויית משתמש משופרת  

---

תאריך: 18 פברואר 2026
