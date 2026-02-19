# שיפור הדגשת תוצאות חיפוש

## הבעיה
כאשר Meilisearch מחזיר תוצאות עם שגיאות הקלדה או וריאציות של מילת החיפוש, המילה המדויקת שנמצאה לא הייתה מודגשת בתוצאות. זה יצר בלבול למשתמש - הוא רואה תוצאה אבל לא מבין למה היא רלוונטית.

בנוסף, כשמחפשים שתי מילים או יותר (למשל: "הלכות שבת"), רק המילה הראשונה הייתה מודגשת.

### דוגמאות לבעיות:
1. **חיפוש:** "שבת" → **נמצא:** "שבתות" → **תוצאה לפני:** ללא הדגשה
2. **חיפוש:** "הלכות שבת" → **תוצאה לפני:** רק "הלכות" מודגש
3. **חיפוש:** "שבת" → **נמצא:** "בשבת" → **תוצאה לפני:** ללא הדגשה

## הפתרון

### 1. שיפור extractContext ב-meilisearchEngine.js

#### תמיכה במילים מרובות
```javascript
// חפש את כל תגי ההדגשה של Meilisearch
const highlightedWords = [];
let searchFrom = 0;

while (searchFrom < text.length) {
  const markIndex = text.indexOf('<mark>', searchFrom);
  if (markIndex === -1) break;
  
  const markEndIndex = text.indexOf('</mark>', markIndex);
  const highlightedWord = text.substring(markIndex + 6, markEndIndex);
  highlightedWords.push({ word: highlightedWord, ... });
  
  searchFrom = markEndIndex + 7;
}

// החזר את כל המילים המודגשות
return {
  text: cleanText,
  highlightedWords: highlightedWords.map(h => h.word) // 🆕 מערך של מילים!
};
```

#### חיפוש כל מילה בשאילתה
```javascript
// פצל את השאילתה למילים
const queryWords = query.trim().split(/\s+/);

// חפש כל מילה בטקסט
for (const queryWord of queryWords) {
  // מצא את המילה בטקסט...
  foundWords.push({ word: matchedWord, start, end });
}

return {
  highlightedWords: foundWords.map(w => w.word) // כל המילים שנמצאו
};
```

### 2. שיפור highlightSearchTerm ב-SearchResultsNew.jsx

#### הדגשת כל המילים
```javascript
const highlightSearchTerm = (text, context) => {
  const highlights = [];
  
  // שלב 1: הוסף את כל המילים מההקשר
  if (context && context.highlightedWords && Array.isArray(context.highlightedWords)) {
    for (const word of context.highlightedWords) {
      // מצא את כל המופעים של המילה בטקסט
      let searchFrom = 0;
      while (searchFrom < text.length) {
        const index = textLower.indexOf(wordLower, searchFrom);
        if (index === -1) break;
        
        highlights.push({ start: index, end: index + word.length });
        searchFrom = index + word.length;
      }
    }
  }
  
  // שלב 2: חפש כל מילה מהשאילתה
  const queryWords = searchQuery.trim().split(/\s+/);
  for (const queryWord of queryWords) {
    // מצא את המילה בטקסט...
  }
  
  // מיזוג הדגשות חופפות
  // בניית הטקסט המודגש
  return <>{parts}</>;
};
```

### 3. הגדלת מספר התוצאות

```javascript
// ב-meilisearchEngine.js
const searchResults = await this.index.search(query, {
  limit: 1000, // 🆕 הגדלנו מ-200 ל-1000!
  // ...
});

// סינון ל-200 הטובות ביותר
const { maxResults = 200 } = options;
```

**הגיון:**
- מבקש 1000 תוצאות מ-Meilisearch
- מסנן לפי ציון (MIN_SCORE = 0.5)
- ממיין לפי איכות
- מחזיר את 200 הטובות ביותר

## דוגמאות לתוצאות

### דוגמה 1: חיפוש עם סיומת
```
חיפוש: "שבת"
נמצא: "...והלכות שבתות ומועדים..."
תוצאה: "...והלכות <mark>שבתות</mark> ומועדים..."
```

### דוגמה 2: חיפוש שתי מילים
```
חיפוש: "הלכות שבת"
נמצא: "...בספר הלכות שבת מבואר..."
תוצאה: "...בספר <mark>הלכות</mark> <mark>שבת</mark> מבואר..."
```

### דוגמה 3: חיפוש עם קידומת
```
חיפוש: "שבת"
נמצא: "...ובשבת אסור..."
תוצאה: "...ו<mark>בשבת</mark> אסור..."
```

### דוגמה 4: חיפוש עם וריאציות
```
חיפוש: "ברכה תפילה"
נמצא: "...ברכות התפילה והמועדים..."
תוצאה: "...<mark>ברכות</mark> ה<mark>תפילה</mark> והמועדים..."
```

## אלגוריתם Levenshtein Distance

מודד את מספר השינויים המינימלי הנדרש להפוך מחרוזת אחת לשנייה:

```javascript
levenshteinDistance("שבת", "שבתות") = 2  // הוספת "ו" ו-"ת"
levenshteinDistance("שבת", "שבתי") = 1   // החלפת "ת" ב-"י"
levenshteinDistance("שבת", "בשבת") = 1   // הוספת "ב"
```

**סף שלנו:** distance <= 1 (שגיאה אחת מותרת)

## מיזוג הדגשות חופפות

כשיש מילים קרובות או חופפות, הקוד ממזג אותן להדגשה אחת:

```javascript
// לפני מיזוג:
highlights = [
  { start: 10, end: 15, word: "הלכות" },
  { start: 16, end: 20, word: "שבת" }
]

// אחרי מיזוג (אם חופפות):
merged = [
  { start: 10, end: 20, word: "הלכות שבת" }
]
```

## ביצועים

### לפני השיפור:
- מבקש: 200 תוצאות
- מציג: עד 100 תוצאות
- הדגשה: מילה אחת בלבד

### אחרי השיפור:
- מבקש: 2000 תוצאות 🆕
- מסנן: לפי ציון > 0.5
- ממיין: לפי איכות
- מציג: עד 200 הטובות ביותר 🆕
- הדגשה: כל המילים הרלוונטיות 🆕

## בדיקות

### מקרי בדיקה:
1. ✅ חיפוש מדויק: "שבת" → "שבת"
2. ✅ עם סיומת: "שבת" → "שבתות"
3. ✅ עם קידומת: "שבת" → "בשבת"
4. ✅ עם גרשיים: "שבת" → "שבת'"
5. ✅ עם פיסוק: "שבת" → "שבת,"
6. ✅ שגיאת הקלדה: "שבת" → "שבתי" (distance=1)
7. ✅ כתיב חסר: "שלום" → "שלם"
8. ✅ שתי מילים: "הלכות שבת" → שתיהן מודגשות
9. ✅ שלוש מילים: "הלכות שבת ומועדים" → כולן מודגשות
10. ✅ מילים לא רצופות: "שבת...הלכות" → שתיהן מודגשות

### מקרים שלא נתמכים (במכוון):
- ❌ שגיאות גדולות: "שבת" → "שבוע" (distance=2)
- ❌ מילים שונות לגמרי: "שבת" → "יום"

## קוד לדוגמה

### שימוש ב-extractContext:
```javascript
const context = meilisearchEngine.extractContext(
  "...בספר הלכות שבתות ומועדים...",
  "הלכות שבת"
);

console.log(context);
// {
//   text: "...בספר הלכות שבתות ומועדים...",
//   matchIndex: 7,
//   matchLength: 5,
//   highlightedWords: ["הלכות", "שבתות"] // 🆕 מערך!
// }
```

### שימוש ב-highlightSearchTerm:
```javascript
<div className="result-snippet">
  {highlightSearchTerm(context.text, context)}
</div>

// תוצאה:
// "...בספר <mark>הלכות</mark> <mark>שבתות</mark> ומועדים..."
```

## סיכום

השיפורים מבטיחים:
1. ✅ **הדגשה מלאה** - כל המילים הרלוונטיות מודגשות
2. ✅ **תמיכה במילים מרובות** - "הלכות שבת" מדגיש את שתיהן
3. ✅ **תמיכה בוריאציות** - סיומות, קידומות, שגיאות הקלדה
4. ✅ **יותר תוצאות** - 1000 במקום 200, מסונן ל-200 הטובות ביותר
5. ✅ **חוויית משתמש טובה יותר** - ברור למה כל תוצאה רלוונטית
