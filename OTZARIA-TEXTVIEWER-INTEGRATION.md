# אינטגרציה של ספרי אוצריא ב-TextViewer

## סיכום השינויים

### מה נעשה?
שילבנו את ספרי אוצריא לתוך מציג הטקסט הקיים (`TextViewer`) במקום ליצור מציג נפרד.

### קבצים ששונו:

1. **src/TextViewer.jsx**
   - הוספנו תמיכה בפרמטרים `bookId` ו-`bookType`
   - כאשר `bookType === 'otzaria'`, הקומפוננטה טוענת את הספר מ-DB של אוצריא
   - משתמשת ב-`convertOtzariaBookToText()` להמרת הספר לפורמט HTML
   - הטקסט מוצג באותו פורמט כמו קבצי טקסט רגילים (עם הפניות מודגשות)

2. **src/App.jsx**
   - הוסרה ייבוא של `OtzariaViewer`
   - כל המקומות שבהם נעשה שימוש ב-`OtzariaViewer` הוחלפו ב-`TextViewer`
   - מועברים הפרמטרים: `bookId={tab.bookId}` ו-`bookType="otzaria"`
   - עובד בכל המצבים: כרטיסייה רגילה, split view (שמאל), split view (ימין)

3. **קבצים שנמחקו:**
   - `src/components/OtzariaViewer.jsx` - לא נחוץ יותר
   - `src/components/OtzariaViewer.css` - לא נחוץ יותר

### איך זה עובד?

1. כאשר משתמש לוחץ על ספר אוצריא בספרייה, נפתחת כרטיסייה עם `type: 'otzaria'`
2. ה-`App.jsx` מזהה שזה ספר אוצריא ומעביר ל-`TextViewer`:
   ```jsx
   <TextViewer
     bookId={tab.bookId}
     bookType="otzaria"
     searchContext={tab.searchContext}
   />
   ```
3. ה-`TextViewer` מזהה ש-`bookType === 'otzaria'` וטוען את הספר מה-DB:
   ```javascript
   const bookData = convertOtzariaBookToText(bookId);
   setBookName(bookData.title);
   htmlText = bookData.content;
   ```
4. הטקסט מוצג עם אותו עיצוב כמו קבצי טקסט רגילים

### יתרונות:

✅ אין צורך בקומפוננטה נפרדת  
✅ ספרי אוצריא נראים ומתנהגים בדיוק כמו קבצי טקסט  
✅ כל התכונות של TextViewer זמינות (חיפוש, תוכן עניינים, פונטים, עמודות)  
✅ קוד פשוט יותר ונקי יותר  
✅ תחזוקה קלה יותר - רק קומפוננטה אחת לטקסט  

### בדיקה:

הפעל את האפליקציה ובדוק:
1. פתח ספר מתיקיית אוצריא בספרייה
2. ודא שהספר נפתח ב-TextViewer הרגיל
3. בדוק שההפניות (heRef) מודגשות בבולד
4. בדוק שכל התכונות עובדות: זום, עמודות, תוכן עניינים

---

תאריך: 18 פברואר 2026
