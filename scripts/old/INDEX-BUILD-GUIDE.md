# מדריך בניית אינדקס חיפוש

## סקריפטים זמינים

### 1. `build-index.cmd` - בניית אינדקס
בונה את אינדקס החיפוש לכל הספרים במאגר.

**תכונות:**
- ✅ שומר התקדמות כל 5 ספרים
- ✅ ניתן להפסיק בכל רגע עם Ctrl+C
- ✅ ממשיך אוטומטית מהנקודה שבה עצרת
- ✅ מעלה אוטומטית ל-Meilisearch

**שימוש:**
```cmd
scripts\build-index.cmd
```

או ישירות:
```cmd
node --expose-gc scripts\build-index-optimized.js --meili
```

### 2. `reset-index.cmd` - איפוס אינדקס
מוחק את כל קבצי ה-checkpoint ומתחיל מחדש.

**שימוש:**
```cmd
scripts\reset-index.cmd
```

## תהליך העבודה

### בניית אינדקס לראשונה
1. הרץ `scripts\build-index.cmd`
2. המתן לתהליך להסתיים (יכול לקחת זמן רב)
3. אם צריך להפסיק - לחץ Ctrl+C
4. כדי להמשיך - הרץ שוב את אותו הסקריפט

### המשך בניית אינדקס
אם הפסקת את התהליך:
1. פשוט הרץ שוב `scripts\build-index.cmd`
2. הסקריפט יזהה את ה-checkpoint וימשיך מהנקודה שבה עצרת

### התחלה מחדש
אם רוצה להתחיל מאפס:
1. הרץ `scripts\reset-index.cmd`
2. אשר את המחיקה
3. הרץ `scripts\build-index.cmd`

## קבצים שנוצרים

כל הקבצים נשמרים בתיקיית `index/`:

- `checkpoint.json` - נקודת השמירה האחרונה
- `meili-docs.temp.json` - chunks זמניים (נמחק בסיום)
- `meili-docs.json` - הקובץ הסופי לאחר סיום
- `posmap.sqlite` - מסד נתונים של מיקומי מילים
- `posmap.sqlite-journal` - קובץ עזר של SQLite

## פרמטרים נוספים

```cmd
node --expose-gc scripts\build-index-optimized.js [options]

Options:
  --meili              Upload to Meilisearch after building
  --skipPdf            Skip PDF files (text only)
  --chunkSize=N        Chunk size (default: 2000)
  --flushEvery=N       Save every N files (default: 5)
  --maxFiles=N         Limit to first N files (for testing)
  --booksPath=PATH     Custom books directory
  --outDir=PATH        Custom output directory
  --meiliHost=URL      Meilisearch host (default: http://127.0.0.1:7700)
  --meiliIndex=NAME    Meilisearch index name (default: books)
```

## דוגמאות

### בניית אינדקס רק ל-10 ספרים ראשונים (לבדיקה)
```cmd
node --expose-gc scripts\build-index-optimized.js --maxFiles=10 --meili
```

### בניית אינדקס ללא PDF (רק TXT)
```cmd
node --expose-gc scripts\build-index-optimized.js --skipPdf --meili
```

### בניית אינדקס עם שמירה כל 10 ספרים
```cmd
node --expose-gc scripts\build-index-optimized.js --flushEvery=10 --meili
```

## טיפים

1. **זיכרון** - הסקריפט משתמש ב-`--expose-gc` לניהול זיכרון טוב יותר
2. **זמן** - בניית אינדקס מלא יכולה לקחת מספר שעות (תלוי בכמות הספרים)
3. **שמירה אוטומטית** - התהליך שומר אוטומטית כל 5 ספרים
4. **המשך עבודה** - אפשר להפסיק ולהמשיך בכל זמן
5. **Meilisearch** - וודא ש-Meilisearch רץ לפני הרצת הסקריפט

## פתרון בעיות

### "Cannot find module"
וודא שאתה מריץ את הסקריפט מתיקיית הפרויקט הראשית.

### "Meilisearch connection failed"
וודא ש-Meilisearch רץ על http://127.0.0.1:7700

### זיכרון אוזל
הגדל את `--flushEvery` לערך נמוך יותר (למשל 3 במקום 5)

### התהליך איטי מדי
- השתמש ב-`--skipPdf` אם אין צורך ב-PDF
- הגדל את `--chunkSize` ל-3000 או 4000
