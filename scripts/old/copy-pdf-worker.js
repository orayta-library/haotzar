import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const source = join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const dest = join(__dirname, '../public/pdf.worker.min.mjs');

try {
  // וודא שתיקיית public קיימת
  const publicDir = dirname(dest);
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }

  // העתק את הקובץ
  copyFileSync(source, dest);
  console.log('✅ PDF.js worker הועתק בהצלחה ל-public/');
} catch (error) {
  console.error('❌ שגיאה בהעתקת PDF.js worker:', error);
  process.exit(1);
}
