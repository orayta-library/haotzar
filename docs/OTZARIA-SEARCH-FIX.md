# תיקון חיפוש ספרי אוצריא בהדר

## הבעיה
תיבת החיפוש בהדר האפליקציה (סרגל העליון) לא כללה את ספרי אוצריא בתוצאות החיפוש.

המשתמש יכול היה לחפש רק קבצים פיזיים (PDF/TXT) אבל לא ספרים מתוך מסד הנתונים של אוצריא.

---

## הפתרון

### 1. הוספת חיפוש באוצריא ב-`App.jsx`

#### ייבוא הפונקציה
```javascript
import { buildOtzariaVirtualTree, searchOtzariaBooks } from './utils/otzariaIntegration';
```

#### חיפוש רגיל (ללא ":")
```javascript
// חיפוש בספרי אוצריא
if (otzariaDB.db) {
  console.log('📖 מחפש גם בספרי אוצריא...');
  try {
    const otzariaResults = searchOtzariaBooks(headerSearchQuery);
    console.log(`   נמצאו ${otzariaResults.length} ספרי אוצריא`);
    
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
      }
    });
  } catch (error) {
    console.error('❌ שגיאה בחיפוש אוצריא:', error);
  }
}
```

#### חיפוש עם "ספר:כותרת"
```javascript
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
```

---

### 2. שיפור תצוגה ב-`SearchAutocomplete.jsx`

#### הוספת אייקון ספר
```javascript
import { BookRegular } from '@fluentui/react-icons';

// בתוך הרינדור:
{file.type === 'otzaria' ? (
  <BookRegular />
) : file.type === 'pdf' ? (
  <DocumentRegular />
) : (
  <DocumentTextRegular />
)}
```

#### הצגת מידע נוסף על ספרי אוצריא
```javascript
{file.type === 'otzaria' && file.categoryTitle && (
  <div className="autocomplete-meta">
    <span className="autocomplete-category">
      📚 {file.categoryTitle}
    </span>
  </div>
)}

{file.type === 'otzaria' && file.heShortDesc && (
  <div className="autocomplete-meta">
    <span className="autocomplete-desc">
      {file.heShortDesc}
    </span>
  </div>
)}
```

---

## איך זה עובד?

### תהליך החיפוש

1. **המשתמש מקליד בתיבת החיפוש** (לפחות 2 תווים)
2. **Debounce של 500ms** - ממתין שהמשתמש יסיים להקליד
3. **חיפוש בקבצים פיזיים** (PDF/TXT) - כמו קודם
4. **חיפוש בספרי אוצריא** - חדש! 🎉
   - קריאה ל-`searchOtzariaBooks(query)`
   - המרת התוצאות לפורמט של file
   - הוספה לרשימת התוצאות
5. **מיון לפי ציון התאמה** - כל התוצאות ביחד
6. **הצגה ב-autocomplete** - עד 50 תוצאות

### דוגמאות חיפוש

#### חיפוש פשוט
```
משתמש מקליד: "רמבם"
תוצאות:
  📄 רמבם - משנה תורה.pdf
  📖 משנה תורה - ספר המדע (אוצריא)
  📖 משנה תורה - ספר אהבה (אוצריא)
  📄 פירוש הרמבם למשנה.pdf
```

#### חיפוש עם קטגוריה
```
משתמש מקליד: "תלמוד"
תוצאות:
  📖 תלמוד בבלי - ברכות (אוצריא)
  📖 תלמוד בבלי - שבת (אוצריא)
  📄 תלמוד בבלי - גיטין.pdf
```

---

## תכונות

✅ **חיפוש מאוחד** - קבצים פיזיים וספרי אוצריא ביחד  
✅ **מיון חכם** - לפי דיוק התאמה  
✅ **Cache** - תוצאות חיפוש נשמרות (עד 100 חיפושים)  
✅ **אייקון מיוחד** - 📖 לספרי אוצריא  
✅ **מידע נוסף** - קטגוריה ותיאור קצר  
✅ **פתיחה חלקה** - לחיצה פותחת את הספר ב-TextViewer  

---

## ביצועים

- ⚡ **Debounce 500ms** - מפחית עומס על DB
- ⚡ **Cache חיפוש** - תוצאות נשמרות בזיכרון
- ⚡ **Prepared statements** - שאילתות SQL מהירות
- ⚡ **הגבלת תוצאות** - עד 50 תוצאות בכל חיפוש

---

## בדיקה

1. פתח את האפליקציה
2. לחץ על תיבת החיפוש בהדר
3. הקלד שם ספר מאוצריא (למשל: "משנה", "תלמוד", "רמבם")
4. בדוק שמופיעים ספרי אוצריא בתוצאות:
   - ✅ אייקון ספר (📖)
   - ✅ שם הספר
   - ✅ קטגוריה (אם יש)
   - ✅ תיאור קצר (אם יש)
5. לחץ על ספר אוצריא
   - ✅ הספר נפתח ב-TextViewer
   - ✅ התוכן מוצג נכון

---

## קבצים ששונו

1. `src/App.jsx` - הוספת חיפוש באוצריא
2. `src/components/SearchAutocomplete.jsx` - שיפור תצוגה

---

תאריך: 18 פברואר 2026
