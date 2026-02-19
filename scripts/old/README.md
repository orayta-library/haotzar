# 📁 Scripts - סקריפטים עזר

תיקייה זו מכילה סקריפטים שונים לניהול האפליקציה.

## 🔨 בניית אינדקס חיפוש

### קבצים רלוונטיים:
- `build-index.js` - הסקריפט המרכזי לבניית האינדקס
- `index-builder-ui.html` - ממשק גרפי לבניית האינדקס
- `run-index-builder.js` - שרת מקומי להרצת הממשק
- `README-INDEX-BUILDER.md` - תיעוד מפורט
- `QUICK-START.md` - מדריך התחלה מהירה

### שימוש מהיר:

```bash
# עם ממשק גרפי (מומלץ)
npm run build:index:ui

# משורת הפקודה
npm run build:index
```

**חשוב**: התקן `pdf-parse` לפני הרצה:
```bash
npm install pdf-parse
```

## 📦 סקריפטים נוספים

### `copy-pdf-worker.js`
מעתיק את ה-worker של PDF.js לתיקיית public.

### `download-meilisearch.js`
מוריד את Meilisearch (מנוע חיפוש) לשימוש באפליקציה.

### `setup-books.js`
מעתיק ספרים לתיקיית AppData לאחר בנייה.

## 🎯 תרחישי שימוש נפוצים

### לפני הפצת האפליקציה
1. הוסף ספרים לתיקייה `books/`
2. הרץ `npm run build:index:ui`
3. המתן לסיום הבנייה
4. בנה את האפליקציה: `npm run tauri:build`

### אחרי הוספת ספרים חדשים
1. הרץ `npm run build:index`
2. הפעל מחדש את האפליקציה

### בעיות בחיפוש
1. מחק את האינדקס הקיים
2. הרץ `npm run build:index:ui`
3. בדוק שהאינדקס נוצר בהצלחה

## 📚 תיעוד נוסף

- [מדריך מפורט לבניית אינדקס](README-INDEX-BUILDER.md)
- [התחלה מהירה](QUICK-START.md)
