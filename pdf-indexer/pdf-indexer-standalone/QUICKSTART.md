# התחלה מהירה - PDF Indexer

## 🚀 התקנה מהירה (Windows)

### שלב 1: הורד Python
אם אין לך Python מותקן:
1. לך ל-https://www.python.org/downloads/
2. הורד Python 3.11 (או גרסה חדשה יותר)
3. התקן עם סימון "Add Python to PATH"

### שלב 2: התקן את הפרויקט

```bash
cd pdf-indexer
install.batב
```

זה יתקין:
- Virtual environment
- כל החבילות הנדרשות (PyMuPDF, Meilisearch, וכו')

### שלב 3: הרץ דוגמה

```bash
run_example.bat
```

זה יריץ את האינדקס על 10 קבצים ראשונים לבדיקה.

## 📖 שימוש בסיסי

### הפעל את ה-virtual environment

```bash
venv\Scripts\activate.bat
```

### בנה אינדקס מלא

```bash
python build_index.py --books-dir ..\books --output-dir .\index
```

### בנה אינדקס + העלה ל-Meilisearch

```bash
python build_index.py --books-dir ..\books --output-dir .\index --upload-meili
```

## 🎯 דוגמאות שימוש

### 1. בדיקה מהירה (10 קבצים)
```bash
python build_index.py --books-dir ..\books --max-files 10 --verbose
```

### 2. אינדקס מלא עם אופטימיזציה
```bash
python build_index.py ^
    --books-dir ..\books ^
    --output-dir .\index ^
    --flush-every 1 ^
    --upload-meili
```

### 3. המשך אחרי הפסקה
```bash
# עצור עם Ctrl+C
# המשך:
python build_index.py --books-dir ..\books --output-dir .\index
```

### 4. התחל מחדש
```bash
python build_index.py --books-dir ..\books --output-dir .\index --reset
```

## 📊 מה קורה בזמן הריצה?

```
🚀 PDF Indexer - Fast Hebrew Book Indexing
==================================================
📂 Books directory: ..\books
💾 Output directory: .\index
📏 Chunk size: 2000
💾 Flush every: 2 files
📄 Skip PDF: NO
🔄 Upload to Meili: YES

📋 Found 200 files

🔨 Processing files...

Processing: 100%|████████████| 200/200 [05:23<00:00,  1.62s/file]

💾 Final flush...
🗜️  Optimizing database...

==================================================
✅ Indexing completed!
==================================================
⏱️  Time: 323.5s (5.4 minutes)
📊 Files processed: 200
📦 Total chunks: 45231
📝 Unique words: 125847
💾 Database: .\index\posmap.db
📄 Chunks file: .\index\chunks.jsonl

📤 Uploading to Meilisearch...
✓ Meilisearch: 45231 documents

🎉 Done!
```

## 🔍 בדיקת התוצאות

### בדוק את הקבצים שנוצרו

```bash
dir index
```

אמור להראות:
- `posmap.db` - מסד נתונים SQLite עם המילים
- `chunks.jsonl` - קבצי ה-chunks
- `checkpoint.json` - נקודת ביקורת
- `indexer.log` - לוג

### חפש ב-Meilisearch

```python
from meilisearch import Client

client = Client('http://127.0.0.1:7700')
index = client.index('books')

# חיפוש
results = index.search('שבת', {'limit': 5})

for hit in results['hits']:
    print(f"{hit['fileId']} - עמוד {hit['pageNum']}")
    print(hit['text'][:100])
    print()
```

## ⚙️ הגדרות מתקדמות

ערוך את `config.py`:

```python
# מהירות מקסימלית
MAX_WORKERS = 8  # מספר ליבות CPU
FLUSH_EVERY = 1  # flush תכוף

# חיסכון בזיכרון
MAX_WORKERS = 2
FLUSH_EVERY = 1
CHUNK_SIZE = 1500

# איזון
MAX_WORKERS = 4
FLUSH_EVERY = 2
CHUNK_SIZE = 2000
```

## 🐛 פתרון בעיות

### שגיאה: "Python not found"
- התקן Python מ-https://www.python.org/
- ודא ש-"Add to PATH" מסומן

### שגיאה: "pip not found"
```bash
python -m ensurepip --upgrade
```

### שגיאה: "Failed to install dependencies"
```bash
pip install --upgrade pip
pip install -r requirements.txt --no-cache-dir
```

### שגיאה: "Meilisearch connection failed"
- ודא ש-Meilisearch רץ:
```bash
..\resources\meilisearch\meilisearch.exe
```

### זיכרון נגמר
```bash
# הקטן workers
python build_index.py --books-dir ..\books --flush-every 1
```

## 📈 השוואת ביצועים

| מדד | Node.js | Python |
|-----|---------|--------|
| זמן (200 קבצים) | 10-15 דקות | 3-5 דקות ✅ |
| זיכרון | 2-4 GB | 500 MB - 1 GB ✅ |
| CPU | Single core | Multi-core ✅ |

## 💡 טיפים

1. **SSD** - שים את הקבצים ב-SSD למהירות מקסימלית
2. **סגור תוכנות** - סגור תוכנות אחרות בזמן האינדקס
3. **Checkpoint** - השתמש ב-Ctrl+C לעצירה בטוחה
4. **Verbose** - השתמש ב-`--verbose` לראות מה קורה
5. **Max files** - התחל עם `--max-files 10` לבדיקה

## 📞 עזרה

יש בעיה? פתח issue או שלח הודעה!
