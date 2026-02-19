# בניית אינדקס לספרית אוצריא

מדריך לבניית אינדקס Meilisearch מספרי אוצריא.

## סקירה כללית

ספרית אוצריא מכילה אלפי ספרים במסד נתונים SQLite (`seforim.db`). כדי לאפשר חיפוש מהיר, אנחנו בונים אינדקס Meilisearch מהספרים.

## מבנה מסד הנתונים

```
seforim.db
├── category      - קטגוריות היררכיות
├── book          - ספרים (title, volume, totalLines)
├── line          - שורות טקסט (content, heRef, lineIndex)
└── tocEntry      - תוכן עניינים
```

## בניית אינדקס מקומית

### דרישות מוקדמות

```bash
npm install better-sqlite3 minimist
```

### הורדת מסד הנתונים

```bash
# הורד את seforim.zip
curl -L -o seforim.zip https://github.com/Otzaria/otzaria-library/releases/download/library-db-1/seforim.zip

# חלץ לתיקייה
unzip seforim.zip -d books/אוצריא/
```

### הרצת הסקריפט

```bash
# בניה מלאה
node --expose-gc scripts/build-otzaria-index.js

# בניה עם הגבלת ספרים (לבדיקה)
node --expose-gc scripts/build-otzaria-index.js --maxBooks=10

# בניה עם הגדרות מותאמות
node --expose-gc scripts/build-otzaria-index.js \
  --db=books/אוצריא/seforim.db \
  --outDir=index-otzaria \
  --chunkSize=2000 \
  --flushEvery=10
```

### פרמטרים

- `--db` - נתיב למסד הנתונים (ברירת מחדל: `books/אוצריא/seforim.db`)
- `--outDir` - תיקיית פלט (ברירת מחדל: `index-otzaria`)
- `--chunkSize` - גודל chunk בתווים (ברירת מחדל: 2000)
- `--maxBooks` - הגבלת מספר ספרים (לבדיקה)
- `--flushEvery` - שמירה כל X ספרים (ברירת מחדל: 10)

## בניה אוטומטית ב-GitHub Actions

### הפעלה ידנית

1. עבור ל-Actions tab בריפו
2. בחר "Build Otzaria Index"
3. לחץ "Run workflow"

### הפעלה אוטומטית

הזרימה רצה אוטומטית כל יום ראשון בחצות (ניתן לשנות ב-`.github/workflows/build-otzaria-index.yml`).

### הורדת האינדקס המוכן

1. עבור ל-Actions tab
2. בחר את הריצה האחרונה של "Build Otzaria Index"
3. הורד את ה-artifact "otzaria-index"
4. חלץ לתיקייה `index-otzaria/`

```bash
# חילוץ
tar -xzf otzaria-index.tar.gz -C index-otzaria/
```

## פורמט האינדקס

### מסמך ב-Meilisearch

```json
{
  "id": "b3R6YXJpYS0xMjM_0",
  "fileId": "otzaria-123",
  "safeFileId": "b3R6YXJpYS0xMjM_",
  "chunkId": 0,
  "chunkStart": 0,
  "pageNum": 1,
  "heRef": "שם הספר א",
  "text": "תוכן של 200 תווים ראשונים..."
}
```

### קבצי פלט

```
index-otzaria/
├── meili-docs.json    - מסמכים ל-Meilisearch (JSON)
└── posmap.sqlite      - מיפוי מילים למיקומים (SQLite)
```

## העלאה ל-Meilisearch

לאחר בניית האינדקס, ניתן להעלות אותו ל-Meilisearch:

```javascript
const { MeiliSearch } = require('meilisearch');
const fs = require('fs');

const client = new MeiliSearch({ host: 'http://127.0.0.1:7700' });
const index = client.index('books');

// טען מסמכים
const docs = JSON.parse(fs.readFileSync('index-otzaria/meili-docs.json', 'utf8'));

// העלה בקבוצות
const batchSize = 500;
for (let i = 0; i < docs.length; i += batchSize) {
  const batch = docs.slice(i, i + batchSize);
  await index.addDocuments(batch);
  console.log(`Uploaded ${i + batchSize}/${docs.length}`);
}
```

## סינון קטגוריות חיצוניות

הסקריפט מסנן אוטומטית קטגוריות חיצוניות:
- HebrewBooks / היברו-בוקס
- אוצר החכמה

רק ספרים מקטגוריות פנימיות של אוצריא נכללים באינדקס.

## ביצועים

- **זמן בניה**: ~30-60 דקות (תלוי במספר הספרים)
- **גודל אינדקס**: ~100-500 MB (דחוס)
- **זיכרון נדרש**: ~2-4 GB RAM
- **ספרים**: ~3,000-5,000 ספרים

## פתרון בעיות

### שגיאת "better-sqlite3"

```bash
npm rebuild better-sqlite3
```

### שגיאת זיכרון

הגדל את הזיכרון הזמין ל-Node.js:

```bash
node --expose-gc --max-old-space-size=4096 scripts/build-otzaria-index.js
```

### קובץ seforim.db לא נמצא

ודא שהורדת והוצאת את הקובץ:

```bash
ls -lh books/אוצריא/seforim.db
```

## קישורים

- [Otzaria Library Releases](https://github.com/Otzaria/otzaria-library/releases)
- [Meilisearch Documentation](https://docs.meilisearch.com/)
