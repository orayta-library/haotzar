# תיקון בעיית better-sqlite3

## הבעיה

אם אתה רואה שגיאה כזו:

```
The module was compiled against a different Node.js version using
NODE_MODULE_VERSION 141. This version of Node.js requires
NODE_MODULE_VERSION 143.
```

זה אומר ש-`better-sqlite3` קומפל לגרסת Node.js אחרת.

## הפתרון

### אופציה 1: Rebuild (מומלץ)

פתח טרמינל ב-PowerShell או CMD והרץ:

```bash
npm rebuild better-sqlite3
```

### אופציה 2: התקנה מחדש

```bash
npm install --force better-sqlite3
```

### אופציה 3: נקה והתקן מחדש

```bash
rmdir /s /q node_modules\better-sqlite3
npm install better-sqlite3
```

## אחרי התיקון

1. סגור את האפליקציה
2. הרץ שוב:
   ```bash
   npm run electron:dev
   ```
3. תיקיית "אוצריא" אמורה להופיע בספרייה!

## עדיין לא עובד?

וודא ש:
- יש לך את הקובץ `books/אוצריא/seforim.db`
- הקובץ לא פגום (גודל > 6GB)
- יש לך הרשאות קריאה לקובץ

## צריך עזרה?

פתח issue ב-GitHub או צור קשר עם התמיכה.
