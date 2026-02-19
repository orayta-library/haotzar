# תיקון: כפתור תוכן עניינים נעלם אחרי טעינת תצלומי דפים

## הבעיות שתוקנו 🐛

### בעיה 1: הכפתור נעלם
אחרי טעינת התצלומים, הכפתור של תוכן העניינים נעשה disabled.

### בעיה 2: התוכן נעלם
גם אם הכפתור נשאר, **התוכן** של תוכן העניינים (הרשימה עצמה) נמחק.

## הסיבות 🔍

### למה הכפתור נעלם?
PDF.js מריץ פונקציה `onTreeLoaded` שבודקת כמה פריטים יש ב-outline:
```javascript
button.disabled = !count;  // אם אין פריטים, משבית את הכפתור
```

### למה התוכן נעלם?
PDF.js קורא שוב ל-`pdfOutlineViewer.render()` עם outline ריק (null), מה שמוחק את התוכן שיצרנו.

## הפתרון 🔧

השתמשנו בשלוש שיטות:

### 1. שמירת תוכן העניינים
```javascript
window._syntheticOutline = syntheticOutline;
window._syntheticPdfDocument = pdfDocument;
```
שומרים את תוכן העניינים שיצרנו כדי שנוכל לשחזר אותו.

### 2. MutationObserver על הכפתור
```javascript
const observer = new MutationObserver((mutations) => {
  if (viewOutlineButton.disabled) {
    viewOutlineButton.disabled = false;
  }
});
```
עוקב אחרי ניסיונות להשבית את הכפתור ומונע אותם.

### 3. MutationObserver על התוכן
```javascript
const contentObserver = new MutationObserver((mutations) => {
  const hasContent = outlineView.querySelector('.treeItem');
  if (!hasContent && window._syntheticOutline) {
    // שחזר את התוכן!
    PDFViewerApplication.pdfOutlineViewer.render({
      outline: window._syntheticOutline,
      pdfDocument: window._syntheticPdfDocument
    });
  }
});
```
עוקב אחרי שינויים ב-DOM של `outlineView`, וברגע שהתוכן נמחק - משחזר אותו!

### 4. בדיקות מרובות
```javascript
setTimeout(checkOutlineContent, 100);
setTimeout(checkOutlineContent, 500);
setTimeout(checkOutlineContent, 1000);
setTimeout(checkOutlineContent, 2000);
setTimeout(checkOutlineContent, 3000);
```
בודק מספר פעמים אם התוכן קיים, ומשחזר אותו אם נמחק.

## תוצאה ✅

עכשיו תוכן העניינים האוטומטי:
- ✅ מוצג בטאב נפרד מתצלומי הדפים
- ✅ הכפתור נשאר מופעל גם אחרי טעינת התצלומים
- ✅ **התוכן נשאר** גם אחרי טעינת התצלומים
- ✅ אם התוכן נמחק - הוא משוחזר אוטומטית
- ✅ אפשר לעבור בין תצלומים לתוכן עניינים בחופשיות

## איך לבדוק 🧪

1. פתח PDF ללא תוכן עניינים מקורי
2. המתן שהתצלומים ייטענו (כמה שניות)
3. בדוק שכפתור תוכן העניינים (📑) עדיין פעיל
4. לחץ עליו - תוכן העניינים אמור להופיע עם כל העמודים
5. בדוק ב-Console את ההודעות:
   - `✅ Generated outline with X pages`
   - `👁️ Watching outline button for changes`
   - `👁️ Watching outline content for changes`
   - `🔓 Outline button re-enabled` (אם PDF.js ניסה להשבית)
   - `⚠️ Outline content was removed, restoring...` (אם התוכן נמחק)

## קבצים ששונו 📝

- `public/pdfjs/web/viewer.html` - הוספת MutationObserver לתוכן ושמירת outline
- `docs/OUTLINE-VISIBILITY-FIX.md` - מסמך זה

## תאריך
4 בפברואר 2026
