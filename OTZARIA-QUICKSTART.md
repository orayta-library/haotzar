# התחלה מהירה - אינדקס אוצריא

## מה זה?

סקריפט שבונה אינדקס חיפוש מהיר מספרי אוצריא (seforim.db).

## שלבים

### 1️⃣ הורד את מסד הנתונים

```bash
curl -L -o seforim.zip https://github.com/Otzaria/otzaria-library/releases/download/library-db-1/seforim.zip
unzip seforim.zip -d books/אוצריא/
```

### 2️⃣ התקן תלויות

```bash
npm install better-sqlite3 minimist
```

### 3️⃣ בנה את האינדקס

```bash
# בניה מלאה (לוקח ~30-60 דקות)
npm run build:otzaria

# או בדיקה מהירה עם 10 ספרים בלבד
npm run build:otzaria:test
```

### 4️⃣ התוצאות

האינדקס נשמר ב-`index-otzaria/`:
- ✅ `meili-docs.json` - מסמכים לחיפוש
- ✅ `posmap.sqlite` - מיפוי מילים

## אופציה: הורד אינדקס מוכן

במקום לבנות בעצמך, הורד אינדקס מוכן מ-GitHub Actions:

1. לך ל-[Actions](../../actions)
2. בחר "Build Otzaria Index"
3. הורד את ה-artifact "otzaria-index"
4. חלץ:
   ```bash
   tar -xzf otzaria-index.tar.gz -C index-otzaria/
   ```

## פרמטרים נוספים

```bash
# בניה מותאמת אישית
node --expose-gc scripts/build-otzaria-index.js \
  --db=books/אוצריא/seforim.db \
  --outDir=index-otzaria \
  --chunkSize=2000 \
  --maxBooks=100 \
  --flushEvery=10
```

## פתרון בעיות

### ❌ "better-sqlite3" לא עובד

```bash
npm rebuild better-sqlite3
```

### ❌ שגיאת זיכרון

```bash
node --expose-gc --max-old-space-size=4096 scripts/build-otzaria-index.js
```

### ❌ seforim.db לא נמצא

ודא שהקובץ קיים:
```bash
ls -lh books/אוצריא/seforim.db
```

## מידע נוסף

📖 [מדריך מלא](docs/OTZARIA-INDEX-BUILD.md)
