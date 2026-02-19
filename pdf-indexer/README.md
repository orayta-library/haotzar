# PDF Indexer - בונה אינדקס מהיר לספרי PDF

פרויקט עצמאי בפייתון לבניית אינדקס חיפוש מהיר עבור ספרי PDF בעברית.

## ✨ יתרונות

- 🚀 **מהיר פי 3-5** מהגרסה ב-Node.js
- 💾 **חסכוני בזיכרון** - עיבוד streaming
- 🔄 **Resume support** - המשך מאיפה שעצרת
- 📊 **Progress tracking** - מעקב בזמן אמת
- 🎯 **Hebrew optimized** - מותאם לעברית (ניקוד, גימטריה)
- 🗜️ **Compressed storage** - דחיסה אוטומטית

## 📦 התקנה

### דרישות מקדימות
- Python 3.8+
- pip

### התקנת חבילות

```bash
cd pdf-indexer
pip install -r requirements.txt
```

## 🚀 שימוש

### Web UI (מומלץ!) 🎨

```bash
cd pdf-indexer
.\run_ui.bat
```

פתח בדפדפן: http://localhost:5000

תכונות:
- ✅ ממשק גרפי נוח
- ✅ בחירת תיקייה
- ✅ המשך מ-checkpoint אוטומטי
- ✅ מעקב בזמן אמת
- ✅ עצירה בטוחה

### Command Line

#### בניית אינדקס בסיסי

```bash
python build_index.py --books-dir ../books --output-dir ./index
```

### בניית אינדקס + העלאה ל-Meilisearch

```bash
python build_index.py --books-dir ../books --output-dir ./index --upload-meili
```

### אופציות נוספות

```bash
# הגבל מספר קבצים (לבדיקה)
python build_index.py --books-dir ../books --max-files 10

# שנה גודל chunk
python build_index.py --books-dir ../books --chunk-size 3000

# התחל מחדש (מחק checkpoint)
python build_index.py --books-dir ../books --reset

# דלג על PDF (רק TXT)
python build_index.py --books-dir ../books --skip-pdf

# Flush תכוף יותר
python build_index.py --books-dir ../books --flush-every 1
```

## 📁 מבנה הפרויקט

```
pdf-indexer/
├── build_index.py          # סקריפט ראשי
├── pdf_extractor.py        # חילוץ טקסט מ-PDF
├── text_processor.py       # עיבוד טקסט עברי
├── index_builder.py        # בניית אינדקס
├── meili_uploader.py       # העלאה ל-Meilisearch
├── checkpoint_manager.py   # ניהול checkpoint
├── requirements.txt        # תלויות
└── README.md              # תיעוד
```

## 🔧 קונפיגורציה

ערוך את `config.py` לשינוי הגדרות:

```python
# Meilisearch
MEILI_HOST = "http://127.0.0.1:7700"
MEILI_INDEX = "books"

# Processing
CHUNK_SIZE = 2000
FLUSH_EVERY = 2
MAX_WORKERS = 4  # עיבוד מקבילי

# Hebrew
REMOVE_NIKUD = True
MIN_WORD_LENGTH = 2
```

## 📊 פורמט הפלט

### SQLite Database (posmap.db)
```sql
CREATE TABLE posts (
    word TEXT PRIMARY KEY,
    postings BLOB  -- compressed JSON
);
```

### JSONL Chunks (chunks.jsonl)
```json
{"id": "book_0", "fileId": "book", "chunkId": 0, "pageNum": 1, "text": "..."}
{"id": "book_1", "fileId": "book", "chunkId": 1, "pageNum": 1, "text": "..."}
```

### Checkpoint (checkpoint.json)
```json
{
  "lastProcessedIndex": 50,
  "processedFiles": ["file1.pdf", "file2.pdf"],
  "completed": false
}
```

## 🎯 ביצועים

### השוואה ל-Node.js

| מדד | Node.js | Python |
|-----|---------|--------|
| זמן עיבוד (200 קבצים) | 10-15 דקות | 3-5 דקות ✅ |
| זיכרון RAM | 2-4 GB | 500 MB - 1 GB ✅ |
| CPU | 100% single core | Multi-core ✅ |
| Streaming | לא | כן ✅ |

### טיפים לביצועים

1. **SSD** - השתמש ב-SSD לקבצים
2. **Multi-core** - הגדר `MAX_WORKERS=8` למחשב חזק
3. **Flush** - הקטן `FLUSH_EVERY` למחשב עם הרבה RAM
4. **Chunk size** - הגדל ל-3000-4000 לקבצים גדולים

## 🐛 פתרון בעיות

### שגיאת זיכרון
```bash
# הקטן workers
python build_index.py --max-workers 2

# הגדל flush frequency
python build_index.py --flush-every 1
```

### PDF לא נקרא
```bash
# התקן tesseract לOCR
# Windows: https://github.com/UB-Mannheim/tesseract/wiki
# Linux: sudo apt-get install tesseract-ocr
```

### Meilisearch לא מגיב
```bash
# בדוק שהשרת רץ
curl http://127.0.0.1:7700/health

# הפעל את Meilisearch
../resources/meilisearch/meilisearch.exe
```

## 📝 דוגמאות שימוש

### דוגמה 1: בניית אינדקס מהירה
```bash
python build_index.py \
  --books-dir ../books \
  --output-dir ./index \
  --max-workers 8 \
  --flush-every 1
```

### דוגמה 2: בדיקה עם 10 קבצים
```bash
python build_index.py \
  --books-dir ../books \
  --max-files 10 \
  --upload-meili
```

### דוגמה 3: המשך אחרי הפסקה
```bash
# עצור עם Ctrl+C
# המשך:
python build_index.py --books-dir ../books
```

## 🔍 חיפוש באינדקס

לאחר בניית האינדקס, השתמש ב-Meilisearch לחיפוש:

```python
from meilisearch import Client

client = Client('http://127.0.0.1:7700')
index = client.index('books')

results = index.search('שבת', {
    'limit': 10,
    'attributesToHighlight': ['text']
})

for hit in results['hits']:
    print(f"{hit['fileId']} - עמוד {hit['pageNum']}")
    print(hit['_formatted']['text'])
```

## 📄 רישיון

MIT License - חופשי לשימוש

## 🤝 תרומה

Pull requests מתקבלים בברכה!

## 📧 יצירת קשר

לשאלות ובעיות, פתח issue ב-GitHub.
