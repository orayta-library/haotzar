# תיקון ניווט ו-Breadcrumbs באוצריא

## הבעיות שתוקנו

### 1. שמות תיקיות מוזרים ❌
**לפני:** `cat-1184`, `virtual-otzaria`  
**אחרי:** שמות קטגוריות אמיתיים (תנ"ך, משנה, תלמוד וכו')

### 2. לא ניתן לחזור לרמה קודמת ❌
**לפני:** לחיצה על breadcrumb לא עבדה  
**אחרי:** ניתן לנווט חזרה לכל רמה בהיררכיה

### 3. Breadcrumbs לא מציגים נתיב מלא ❌
**לפני:** רק שם התיקייה הנוכחית  
**אחרי:** נתיב מלא: ספרייה > אוצריא > תנ"ך > תורה

---

## השינויים שבוצעו

### 1. `src/utils/otzariaIntegration.js`

#### שינוי בניית נתיבים
```javascript
// לפני:
path: `virtual-otzaria/cat-${category.id}`

// אחרי:
const currentPath = `${parentPath}/${category.title}`;
path: currentPath
```

**תוצאה:** נתיבים קריאים כמו `virtual-otzaria/תנ"ך/תורה`

#### הוספת פונקציות חדשות
```javascript
// קבלת תיקיית אוצריא הראשית
export function getOtzariaRootFolder()

// קבלת קטגוריה לפי ID
export function getOtzariaCategoryById(categoryId)

// קבלת קטגוריה לפי נתיב
export function getOtzariaCategoryByPath(path)
```

**תוצאה:** ניווט מהיר ויעיל ללא בניית עץ מחדש

---

### 2. `src/components/FolderPreview.jsx`

#### שיפור בניית Breadcrumbs
```javascript
// תמיכה בתיקיות אוצריא
if (folder.isVirtual && folder.virtualType === 'otzaria-category') {
  // בנה breadcrumb מהנתיב המלא
  const pathParts = folder.path.replace('virtual-otzaria/', '').split('/');
  // הוסף כל חלק בנתיב
}
```

**תוצאה:** breadcrumb מלא עם כל הקטגוריות בנתיב

#### שיפור ניווט
```javascript
const navigateToFolder = (breadcrumbItem) => {
  // טיפול מיוחד בתיקיות אוצריא
  if (breadcrumbItem.folder?.virtualType === 'otzaria-root') {
    const otzariaTree = getOtzariaRootFolder();
    onFolderClick(otzariaTree);
  }
  
  if (breadcrumbItem.folder?.virtualType === 'otzaria-category') {
    const category = getOtzariaCategoryByPath(breadcrumbItem.path);
    onFolderClick(category);
  }
}
```

**תוצאה:** ניווט חלק וללא עיכובים

---

## איך זה עובד עכשיו?

### מבנה הנתיבים
```
ספרייה
└── אוצריא (virtual-otzaria)
    ├── תנ"ך (virtual-otzaria/תנ"ך)
    │   ├── תורה (virtual-otzaria/תנ"ך/תורה)
    │   └── נביאים (virtual-otzaria/תנ"ך/נביאים)
    ├── משנה (virtual-otzaria/משנה)
    └── תלמוד (virtual-otzaria/תלמוד)
```

### Breadcrumbs
```
ספרייה > אוצריא > תנ"ך > תורה
  ↑        ↑        ↑      ↑
לחיץ   לחיץ    לחיץ   נוכחי
```

### Cache
- עץ אוצריא נבנה פעם אחת ונשמר ב-cache
- ניווט משתמש ב-cache (מהיר!)
- לא צריך לבנות מחדש בכל פעם

---

## בדיקה

1. פתח את האפליקציה
2. לחץ על תיקיית "אוצריא" בספרייה
3. נווט לתוך קטגוריה (למשל: תנ"ך)
4. בדוק את ה-breadcrumbs למעלה:
   - ✅ שמות קריאים (לא `cat-1184`)
   - ✅ נתיב מלא (ספרייה > אוצריא > תנ"ך)
5. לחץ על "אוצריא" ב-breadcrumb
   - ✅ חוזר לתיקייה הראשית של אוצריא
6. לחץ על "ספרייה" ב-breadcrumb
   - ✅ חוזר לספרייה הראשית

---

## ביצועים

- ⚡ ניווט מהיר - משתמש ב-cache
- ⚡ אין בניית עץ מחדש
- ⚡ חיפוש מהיר לפי נתיב

---

תאריך: 18 פברואר 2026
