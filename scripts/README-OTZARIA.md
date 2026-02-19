# סקריפטים לאינדקס אוצריא

## שימוש מהיר

### 1. הורדת מסד הנתונים

```bash
# הורד seforim.zip
curl -L -o seforim.zip https://github.com/Otzaria/otzaria-library/releases/download/library-db-1/seforim.zip

# חלץ
unzip seforim.zip -d books/אוצריא/
```

### 2. בניית אינדקס

```bash
# בניה מלאה
npm run build:otzaria

# בדיקה עם 10 ספרים בלבד
npm run build:otzaria:test
```

### 3. תוצאות

האינדקס נשמר ב-`index-otzaria/`:
- `meili-docs.json` - מסמכים ל-Meilisearch
- `posmap.sqlite` - מיפוי מילים למיקומים

## פרמטרים נוספים

```bash
# בניה עם הגדרות מותאמות
node --expose-gc scripts/build-otzaria-index.js \
  --db=books/אוצריא/seforim.db \
  --outDir=index-otzaria \
  --chunkSize=2000 \
  --maxBooks=100 \
  --flushEvery=10
```

## GitHub Actions

הזרימה ב-`.github/workflows/build-otzaria-index.yml` בונה את האינדקס אוטומטית:

1. מורידה את seforim.db
2. בונה את האינדקס
3. מעלה כ-artifact

להפעלה ידנית: Actions → Build Otzaria Index → Run workflow

## מידע נוסף

ראה: `docs/OTZARIA-INDEX-BUILD.md`
