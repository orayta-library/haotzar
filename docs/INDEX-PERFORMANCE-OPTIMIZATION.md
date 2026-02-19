# אופטימיזציה של בניית האינדקס

## בעיות ביצועים שזוהו

### 1. צריכת זיכרון גבוהה
הסקריפט `build-index-optimized.js` צורך הרבה זיכרון (RAM) במהלך בניית האינדקס:

- **קובץ SQLite**: 1.28 GB - גדול מאוד!
- **200 קבצי PDF** מעובדים
- הזיכרון מצטבר במהלך הריצה

### 2. סיבות לצריכת זיכרון גבוהה

#### א. טעינת PDF מלאה לזיכרון
```javascript
// בעיה: כל PDF נטען במלואו
dataBuffer = fs.readFileSync(filePath);
const uint8Array = new Uint8Array(dataBuffer);
```

#### ב. Postings Map גדול
```javascript
// בעיה: כל המילים והמיקומים נשמרים בזיכרון
const postingsMap = {};
// מצטבר עד ל-flush
```

#### ג. Chunks Array מצטבר
```javascript
// בעיה: כל ה-chunks נשמרים לאורך כל הריצה
const allChunks = [];
allChunks.push(...chunks); // מצטבר ללא הגבלה
```

#### ד. Flush לא תכוף מספיק
```javascript
// בעיה: flush רק כל 5 קבצים
if (processedFiles % flushEvery === 0) {
  flushPostings(db, postingsMap);
}
```

## פתרונות מומלצים

### 1. הגדלת תדירות ה-Flush
שנה את ברירת המחדל מ-5 ל-2 או 3:

```bash
node --expose-gc scripts/build-index-optimized.js --flushEvery 2 --meili
```

### 2. הגבלת גודל Chunks Array
במקום לשמור הכל בזיכרון, שמור ישירות לקובץ:

```javascript
// במקום:
allChunks.push(...chunks);

// עשה:
fs.appendFileSync(tempChunksPath, JSON.stringify(chunks) + '\n');
```

### 3. שחרור זיכרון אחרי כל PDF
הקוד כבר עושה זאת, אבל אפשר לשפר:

```javascript
// שחרר מיד אחרי שימוש
content = null;
pages = null;
dataBuffer = null;

// הפעל GC יותר תכוף
if (i % 2 === 0 && global.gc) {
  global.gc();
}
```

### 4. הרץ עם יותר זיכרון
אם יש לך מספיק RAM, הגדל את הגבול:

```bash
node --expose-gc --max-old-space-size=8192 scripts/build-index-optimized.js --meili
```

### 5. עבד קבצים בקבוצות קטנות
במקום לעבד הכל בבת אחת:

```bash
# עבד רק 50 קבצים בכל פעם
node --expose-gc scripts/build-index-optimized.js --maxFiles 50 --meili

# אחר כך המשך עם --reset=false
node --expose-gc scripts/build-index-optimized.js --meili
```

## שימוש מומלץ

### לבניית אינדקס מלא (מאגר גדול):
```bash
node --expose-gc --max-old-space-size=8192 scripts/build-index-optimized.js --flushEvery 2 --meili
```

### לבדיקה מהירה (מספר קבצים מוגבל):
```bash
node --expose-gc scripts/build-index-optimized.js --maxFiles 10 --skipPdf --meili
```

### להמשך אחרי הפסקה:
```bash
# הסקריפט ימשיך אוטומטית מה-checkpoint
node --expose-gc scripts/build-index-optimized.js --meili
```

### לבניה מחדש מאפס:
```bash
node --expose-gc scripts/build-index-optimized.js --reset --meili
```

## מדדי ביצועים

### מצב נוכחי (200 קבצים):
- **זמן עיבוד**: תלוי בגודל הקבצים
- **זיכרון SQLite**: 1.28 GB
- **זיכרון Meilisearch**: 86.7 MB
- **RAM בשימוש**: יכול להגיע ל-4-6 GB

### אופטימלי (עם השיפורים):
- **RAM בשימוש**: 2-3 GB
- **זמן עיבוד**: דומה או מעט יותר איטי
- **יציבות**: משופרת משמעותית

## טיפים נוספים

1. **סגור תוכנות אחרות** בזמן בניית האינדקס
2. **השתמש ב-SSD** לביצועים טובים יותר
3. **עקוב אחרי התקדמות** עם Task Manager / Resource Monitor
4. **שמור checkpoint** באמצע (Ctrl+C) אם הזיכרון מתמלא
5. **נקה קבצי temp** לפני בנייה חדשה עם `--reset`

## שאלות נפוצות

### Q: למה ה-SQLite כל כך גדול?
A: הוא מכיל את כל המילים והמיקומים שלהן בכל הקבצים. זה נורמלי למאגר גדול.

### Q: האם אפשר לדחוס את ה-SQLite?
A: הקוד כבר משתמש ב-gzip compression. אפשר לשפר עם VACUUM:
```javascript
db.exec('VACUUM');
```

### Q: כמה זמן לוקח לבנות אינדקס?
A: תלוי בגודל הקבצים ובמהירות המחשב. בערך 1-5 דקות ל-200 קבצים.

### Q: האם צריך לבנות מחדש כל פעם?
A: לא! השתמש ב-checkpoint כדי להמשיך מאיפה שעצרת.
