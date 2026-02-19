# הגנה ושחזור אינדקס

## תכונות הגנה חדשות

הוספנו מנגנון הגנה מלא למקרה שתהליך בניית האינדקס נעצר באמצע.

## מה קורה אם התהליך נעצר?

### ✅ הגנות אוטומטיות

1. **Checkpoint אחרי כל קובץ**
   - אחרי עיבוד כל קובץ, המערכת שומרת checkpoint
   - הקובץ: `index/checkpoint.json`
   - מכיל: רשימת קבצים שכבר עובדו

2. **שמירת chunks זמנית**
   - כל ה-chunks שנוצרו נשמרים ב-`index/meili-docs.temp.json`
   - מתעדכן אחרי כל קובץ

3. **Flush תקופתי ל-DB**
   - כל 50 קבצים, הנתונים נשמרים ל-SQLite
   - מונע אובדן נתונים במקרה של קריסה

4. **טיפול ב-Ctrl+C**
   - אם לוחצים Ctrl+C, המערכת:
     - שומרת את כל ההתקדמות
     - סוגרת את ה-DB בצורה נכונה
     - מציגה הודעה איפה המשיך

## איך להמשיך אחרי הפסקה?

### פשוט הרץ את הסקריפט שוב!

```bash
node scripts/build-index-optimized.js
```

המערכת תזהה אוטומטית שיש checkpoint ותמשיך מאיפה שעצרה:

```
📍 Found checkpoint: 150 files already processed
📦 Loaded 2500 existing chunks
[151/3975] ספר חדש.pdf
```

## דוגמאות שימוש

### תרחיש 1: הפסקה ידנית (Ctrl+C)

```bash
$ node scripts/build-index-optimized.js

[100/3975] ספר מאה.pdf
  ✓ 15 chunks, 1200 unique words
[101/3975] ספר מאה ואחד.pdf
^C
⏸️  Interrupted! Saving progress...
💾 Flushing 5000 words to DB...
✅ Progress saved!
📊 Processed 101 files, 1515 chunks

💡 Run the script again to resume from checkpoint
   Checkpoint: D:\haotzar\index\checkpoint.json
   Temp chunks: D:\haotzar\index\meili-docs.temp.json
```

### תרחיש 2: המשך אחרי הפסקה

```bash
$ node scripts/build-index-optimized.js

📍 Found checkpoint: 101 files already processed
📦 Loaded 1515 existing chunks

[102/3975] ספר מאה ושתיים.pdf - ⏭️  Already processed (skipping)
[103/3975] ספר מאה ושלוש.pdf
  ✓ 12 chunks, 980 unique words
...
```

### תרחיש 3: קריסה (שגיאה)

אם התהליך קורס בגלל שגיאה:
- כל הקבצים שעובדו עד השגיאה נשמרים
- הקובץ שגרם לשגיאה מדולג
- המשך מהקובץ הבא

## ניקוי ידני

אם אתה רוצה להתחיל מחדש לגמרי:

```bash
# מחק את קבצי ה-checkpoint
del index\checkpoint.json
del index\meili-docs.temp.json

# הרץ מחדש
node scripts/build-index-optimized.js
```

## קבצים שנוצרים

| קובץ | תיאור | מתי נמחק |
|------|-------|----------|
| `checkpoint.json` | רשימת קבצים שעובדו | בסיום מוצלח |
| `meili-docs.temp.json` | chunks זמניים | בסיום מוצלח |
| `posmap.sqlite` | מילון מילים | נשאר |
| `meili-docs.json` | chunks סופיים | נשאר |

## טיפים

### 1. עיבוד חלקי למבחן
```bash
# עבד רק 100 קבצים ראשונים
node scripts/build-index-optimized.js --maxFiles 100
```

### 2. דילוג על PDF (מהיר יותר)
```bash
# רק קבצי TXT
node scripts/build-index-optimized.js --skipPdf
```

### 3. שינוי תדירות Flush
```bash
# Flush כל 20 קבצים במקום 50
node scripts/build-index-optimized.js --flushEvery 20
```

### 4. בדיקת התקדמות
```bash
# בדוק כמה קבצים עובדו
cat index/checkpoint.json
```

## שאלות נפוצות

### Q: מה קורה אם המחשב נכבה באמצע?
**A:** כל הנתונים עד ה-flush האחרון נשמרים. תאבד רק את הקבצים שעובדו אחרי ה-flush האחרון (מקסימום 50 קבצים).

### Q: האם אפשר להריץ את הסקריפט במקביל?
**A:** לא מומלץ! זה יגרום לקונפליקטים ב-checkpoint ו-DB.

### Q: כמה זמן לוקח לעבד 3,975 קבצים?
**A:** תלוי במהירות המחשב:
- קבצי TXT: ~1-2 שניות לקובץ
- קבצי PDF: ~5-10 שניות לקובץ
- סה"כ: כ-5-8 שעות לכל המאגר

### Q: מה אם יש שגיאה בקובץ מסוים?
**A:** הסקריפט ידלג על הקובץ, ישמור את זה ב-checkpoint, וימשיך הלאה.

### Q: איך אני יודע שהכל הסתיים בהצלחה?
**A:** תראה:
```
✅ Index built in 18234.56s
📊 Stats:
   Files: 3975
   Chunks: 5101
   🗑️  Cleaned checkpoint file
   🗑️  Cleaned temp chunks file
```

## סיכום

המערכת עכשיו **עמידה לכשלים** (fault-tolerant):
- ✅ שמירה אוטומטית אחרי כל קובץ
- ✅ המשך אוטומטי מנקודת העצירה
- ✅ טיפול ב-Ctrl+C
- ✅ דילוג על קבצים בעייתיים
- ✅ ניקוי אוטומטי בסיום

**אתה יכול להפסיק ולהמשיך בכל שלב ללא חשש!** 🎉
