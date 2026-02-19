import { MeiliSearch } from 'meilisearch';
import { extractTextFromPDF } from './pdfExtractor';

// מנוע חיפוש מקצועי עם Meilisearch (Rust)
class MeilisearchEngine {
  constructor() {
    this.client = null;
    this.index = null;
    this.isIndexing = false;
    this.indexProgress = 0;
    this.serverProcess = null;
    this.serverPort = 7700;
    this.masterKey = null; // לא נשתמש ב-master key במצב development
    this.filesCount = 0;
  }

  // הפעלת שרת Meilisearch מקומי
  async startServer() {
    try {
      const isElectron = window.electron !== undefined;
      const isTauri = window.__TAURI__ !== undefined;
      
      if (!isElectron && !isTauri) {
        console.warn('⚠️ Meilisearch זמין רק באפליקציה דסקטופ');
        return false;
      }

      console.log('🚀 מתחיל הפעלת Meilisearch...', { isElectron, isTauri });

      if (isElectron) {
        console.log('📦 מפעיל Meilisearch דרך Electron...');
        
        // הפעל את השרת דרך IPC
        const result = await window.electron.startMeilisearch({
          port: this.serverPort,
          masterKey: this.masterKey
        });

        console.log('📡 תגובה מ-Electron:', result);

        if (!result.success) {
          console.error('❌ שגיאה בהפעלת Meilisearch:', result.error);
          return false;
        }
        
        console.log('✅ Meilisearch הופעל בהצלחה דרך Electron');
      } else if (isTauri) {
        console.log('📦 מפעיל Meilisearch דרך Tauri...');
        
        // הפעל את השרת דרך Tauri
        const { invoke } = await import('@tauri-apps/api/tauri');
        
        try {
          const result = await invoke('start_meilisearch', {
            port: this.serverPort
          });
          
          console.log('📡 תגובה מ-Tauri:', result);
          
          if (!result.success) {
            console.error('❌ שגיאה בהפעלת Meilisearch:', result.message || result.error);
            return false;
          }
          
          console.log('✅ Meilisearch הופעל בהצלחה דרך Tauri:', result.message);
        } catch (error) {
          console.error('❌ שגיאה בהפעלת Meilisearch דרך Tauri:', error);
          return false;
        }
      }

      // המתן שהשרת יעלה (2 שניות)
      console.log('⏳ ממתין שהשרת יעלה...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // התחבר לשרת
      console.log(`🔌 מתחבר לשרת Meilisearch ב-http://127.0.0.1:${this.serverPort}`);
      this.client = new MeiliSearch({
        host: `http://127.0.0.1:${this.serverPort}`
      });

      // בדוק חיבור לשרת
      try {
        const health = await this.client.health();
        console.log('💚 שרת Meilisearch פעיל:', health);
      } catch (error) {
        console.error('❌ לא ניתן להתחבר לשרת Meilisearch:', error.message);
        return false;
      }

      // התחבר לאינדקס
      try {
        this.index = this.client.index('books');
        
        // בדוק אם האינדקס קיים ויש בו מסמכים
        const stats = await this.index.getStats();
        this.filesCount = stats.numberOfDocuments;
        
        if (stats.numberOfDocuments > 0) {
          console.log(`✅ Meilisearch מחובר - ${stats.numberOfDocuments} מסמכים באינדקס`);
          console.log('✅ Meilisearch מוכן לשימוש!');
          return true;
        } else {
          console.log('⚠️ האינדקס ריק - צריך לבנות אינדקס');
          console.log('💡 הרץ: node scripts/tools.js index:build');
          return false;
        }
      } catch (error) {
        // אם האינדקס לא קיים, צור אותו
        console.log('⚠️ האינדקס לא קיים - יוצר אינדקס חדש');
        await this.client.createIndex('books', { primaryKey: 'id' });
        this.index = this.client.index('books');
        console.log('✅ אינדקס חדש נוצר (ריק)');
        console.log('💡 הרץ: node scripts/tools.js index:build');
        return false;
      }
    } catch (error) {
      console.error('❌ שגיאה בהפעלת Meilisearch:', error);
      return false;
    }
  }

  // בניית אינדקס
  async buildIndex(files, onProgress) {
    this.isIndexing = true;
    this.indexProgress = 0;

    const indexableFiles = files.filter(f => f.type === 'text' || f.type === 'pdf');
    this.filesCount = indexableFiles.length;
    
    console.log(`🚀 מתחיל אינדוקס ${indexableFiles.length} קבצים (טקסט + PDF) ב-Meilisearch...`);
    
    const startTime = Date.now();
    const documents = [];

    // שלב 1: טעינת קבצים
    for (let i = 0; i < indexableFiles.length; i++) {
      const file = indexableFiles[i];
      
      try {
        console.log(`📝 מעבד קובץ ${i + 1}/${indexableFiles.length}: ${file.name}`);
        
        let content = '';
        
        // טעינת תוכן לפי סוג הקובץ
        if (file.type === 'text') {
          content = await this.loadFileContent(file.path);
        } else if (file.type === 'pdf') {
          console.log(`📄 מחלץ טקסט מ-PDF: ${file.name}`);
          content = await extractTextFromPDF(file.path);
        }
        
        if (!content || content.length === 0) {
          console.warn(`⚠️ קובץ ריק או לא נמצא: ${file.name}`);
          continue;
        }

        // חלק לחלקים של 2000 תווים
        const chunks = this.splitIntoChunks(content, 2000);
        console.log(`  ✂️ חולק ל-${chunks.length} חלקים`);
        
        chunks.forEach((chunk, chunkIndex) => {
          documents.push({
            id: `${file.id}_${chunkIndex}`,
            fileId: file.id,
            fileName: file.name,
            filePath: file.path,
            chunkIndex,
            content: chunk
          });
        });

        this.indexProgress = ((i + 1) / indexableFiles.length) * 100;

        if (onProgress) {
          onProgress({
            progress: this.indexProgress,
            currentFile: file.name,
            filesProcessed: i + 1,
            totalFiles: indexableFiles.length
          });
        }

        if ((i + 1) % 5 === 0) {
          console.log(`📊 התקדמות: ${i + 1}/${indexableFiles.length} (${this.indexProgress.toFixed(1)}%)`);
        }
      } catch (error) {
        console.error(`❌ שגיאה בעיבוד ${file.name}:`, error);
      }
    }

    // שלב 2: העלאה ל-Meilisearch
    console.log(`📤 מעלה ${documents.length} מסמכים ל-Meilisearch...`);
    
    try {
      // הגדרות אינדקס
      await this.index.updateSettings({
        searchableAttributes: ['text', 'fileId'], // text קודם = חשוב יותר
        displayedAttributes: ['id', 'fileId', 'safeFileId', 'chunkId', 'chunkStart', 'pageNum', 'text'],
        filterableAttributes: ['fileId', 'safeFileId'],
        sortableAttributes: ['chunkStart', 'pageNum'],
        // הגדרות לנרמול טקסט - התעלם מגרשיים וסימני פיסוק
        separatorTokens: [
          '"', "'", '\u05F4', '\u05F3',  // גרשיים עבריים
          '\u2018', '\u2019', '\u201C', '\u201D',  // גרשיים אנגליים
          '(', ')', '[', ']', '{', '}',  // סוגריים
          ',', '.', '!', '?', ';', ':',  // סימני פיסוק
          '-', '–', '—',  // מקפים
          '/', '\\', '|'  // קווים
        ],
        nonSeparatorTokens: [],
        // כללי דירוג משופרים - התאמה מדויקת קודם!
        rankingRules: [
          'words',        // כמה מילות חיפוש נמצאו - הכי חשוב!
          'exactness',    // התאמה מדויקת = עדיפות גבוהה
          'typo',         // פחות שגיאות כתיב = טוב יותר
          'proximity',    // מילים קרובות יותר = טוב יותר
          'attribute',    // סדר השדות (text לפני fileId)
          'sort'          // מיון
        ],
        // הגדרות חיפוש עם סובלנות מתונה לטעויות הקלדה
        typoTolerance: {
          enabled: true,
          minWordSizeForTypos: {
            oneTypo: 5,   // מילים מעל 5 תווים - סובלנות לשגיאה אחת (הועלה מ-4)
            twoTypos: 8   // מילים מעל 8 תווים - סובלנות ל-2 שגיאות (הועלה מ-7)
          },
          disableOnWords: [], // אפשר טעויות בכל המילים
          disableOnAttributes: [] // אפשר טעויות בכל השדות
        }
      });

      // העלה מסמכים בקבוצות של 1000
      const batchSize = 1000;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        await this.index.addDocuments(batch);
        console.log(`📤 הועלו ${Math.min(i + batchSize, documents.length)}/${documents.length} מסמכים`);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ אינדקס הושלם ב-${duration} שניות`);
      
      this.isIndexing = false;
      return true;
    } catch (error) {
      console.error('❌ שגיאה בהעלאת מסמכים:', error);
      this.isIndexing = false;
      return false;
    }
  }

  // חיפוש עם סינון חכם לפי רלוונטיות
  // מחזיר רק תוצאות עם ציון מעל סף מינימלי (MIN_SCORE)
  // ממוין לפי איכות ההתאמה
  async search(query, options = {}) {
    const { 
      maxResults = 200, 
      accuracy = 50,
      specificBook = '',
      matchingStrategy = 'last',
      cropLength = 200,
      fullSpelling = false,
      partialWord = false,
      suffixes = false,
      prefixes = false
    } = options;

    console.log('🔍 Meilisearch search called with:', { query, options, hasIndex: !!this.index });

    if (!query || !this.index) {
      console.log('⚠️ No query or no index:', { query, hasIndex: !!this.index });
      return [];
    }

    try {
      // בדוק כמה מסמכים יש באינדקס
      const stats = await this.index.getStats();
      console.log(`� סטטיסטיקות אינדקס: ${stats.numberOfDocuments.toLocaleString()} מסמכים (chunks)`);
      console.log(`📊 האינדקס ${stats.isIndexing ? 'עדיין מתעדכן' : 'מוכן לחיפוש'}`);
      
      console.log('📡 Sending search request to Meilisearch...');
      console.log(`🔍 Query: "${query}"`);
      console.log(`🎯 Options:`, { specificBook, matchingStrategy, cropLength, fullSpelling, partialWord, suffixes, prefixes });
      
      // הכן את אפשרויות החיפוש
      const searchParams = {
        limit: 10000,
        attributesToSearchOn: ['text'], // חיפוש רק בתוכן
        attributesToHighlight: ['text'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
        showRankingScore: true,
        showMatchesPosition: true,
        matchingStrategy: matchingStrategy,
        cropLength: cropLength
      };

      const searchResults = await this.index.search(query, searchParams);

      console.log(`🔍 Meilisearch מצא ${searchResults.hits.length} תוצאות (chunks)`);
      console.log(`📊 סה"כ תוצאות זמינות: ${searchResults.estimatedTotalHits || searchResults.hits.length}`);
      
      // סינון לפי ספר ספציפי (client-side) - Meilisearch לא תומך ב-CONTAINS
      let filteredHits = searchResults.hits;
      if (specificBook && specificBook.trim().length > 0) {
        const bookFilter = specificBook.trim().toLowerCase();
        filteredHits = searchResults.hits.filter(hit => 
          hit.fileId && hit.fileId.toLowerCase().includes(bookFilter)
        );
        console.log(`📚 סינון לפי ספר "${specificBook}": ${searchResults.hits.length} -> ${filteredHits.length} תוצאות`);
      }
      
      // הצג דוגמה של תוצאות
      if (filteredHits.length > 0) {
        console.log(`📄 דוגמה לתוצאה ראשונה:`, {
          fileId: filteredHits[0].fileId,
          score: filteredHits[0]._rankingScore,
          textPreview: filteredHits[0].text?.substring(0, 100)
        });
      }

      // סינון תוצאות לפי ציון רלוונטיות
      // המרת accuracy (0-100) לסף ציון (0.3-0.9)
      // accuracy=0 (רחב) -> MIN_SCORE=0.3
      // accuracy=50 (בינוני) -> MIN_SCORE=0.6
      // accuracy=100 (מדויק) -> MIN_SCORE=0.9
      const MIN_SCORE = 0.3 + (accuracy / 100) * 0.6;
      
      console.log(`🎯 רמת דיוק: ${accuracy}% -> סף ציון: ${MIN_SCORE.toFixed(2)}`);
      
      const relevantHits = filteredHits.filter(hit => {
        const score = hit._rankingScore || 0;
        return score >= MIN_SCORE;
      });

      console.log(`🎯 ${relevantHits.length} תוצאות רלוונטיות (ציון מעל ${MIN_SCORE * 100}%)`);
      
      // לוג לדיבוג - הצג את טווח הציונים
      if (filteredHits.length > 0) {
        const scores = filteredHits.map(h => h._rankingScore || 0).sort((a, b) => b - a);
        console.log(`📊 טווח ציונים: ${scores[0].toFixed(3)} (גבוה) - ${scores[scores.length - 1].toFixed(3)} (נמוך)`);
        console.log(`📊 סונן ${filteredHits.length - relevantHits.length} תוצאות חלשות`);
      }
      // קיבוץ לפי קובץ
      const resultsMap = new Map();

      for (const hit of relevantHits) {
        const fileId = hit.fileId;
        const score = hit._rankingScore || 0;

        if (!resultsMap.has(fileId)) {
          resultsMap.set(fileId, {
            file: {
              id: fileId,
              name: hit.fileId || fileId,  // השם הוא ה-fileId
              path: hit.filePath || '',
              type: 'pdf'
            },
            matchCount: 0,
            contexts: [],
            maxScore: score, // שמור את הציון הגבוה ביותר לקובץ
            totalScore: 0
          });
        }

        const fileResult = resultsMap.get(fileId);
        
        // עדכן ציונים
        fileResult.maxScore = Math.max(fileResult.maxScore, score);
        fileResult.totalScore += score;
        
        // חלץ הקשר מההדגשה - השדה נקרא 'text' באינדקס
        const highlighted = hit._formatted?.text || hit.text;
        
        // לוג לבדיקה - רק פעם אחת
        if (resultsMap.size === 1 && fileResult.contexts.length === 0) {
          console.log('🔍 Sample hit:', {
            hasFormatted: !!hit._formatted,
            hasText: !!hit.text,
            highlightedPreview: highlighted?.substring(0, 200),
            hasMark: highlighted?.includes('<mark>')
          });
        }
        
        const context = this.extractContext(highlighted, query);
        
        if (context) {
          context.chunkStart = hit.chunkStart || 0;
          context.chunkId = hit.chunkId || 0;
          context.pageNum = hit.pageNum || 1;
          context.score = score; // הוסף ציון להקשר
          
          fileResult.contexts.push(context);
          fileResult.matchCount++;
        }
      }

      // המר למערך וממיין לפי רלוונטיות
      let results = Array.from(resultsMap.values())
        .sort((a, b) => {
          // מיון לפי: 1) ציון מקסימלי 2) ציון כולל 3) מספר התאמות
          if (Math.abs(b.maxScore - a.maxScore) > 0.01) {
            return b.maxScore - a.maxScore;
          }
          if (Math.abs(b.totalScore - a.totalScore) > 0.1) {
            return b.totalScore - a.totalScore;
          }
          return b.matchCount - a.matchCount;
        });
      
      // אם יש יותר מדי קבצים, הגבל לפי ציון
      if (results.length > maxResults) {
        // מצא את הציון של התוצאה ה-maxResults
        const cutoffScore = results[maxResults - 1].maxScore;
        // הגבל רק לתוצאות מעל הציון הזה
        results = results.filter(r => r.maxScore >= cutoffScore).slice(0, maxResults);
        console.log(`✂️ הגבלה ל-${maxResults} קבצים הטובים ביותר (ציון מעל ${cutoffScore.toFixed(3)})`);
      }
      
      results = results.map(result => ({
        file: result.file,
        matchCount: result.matchCount,
        contexts: result.contexts
          .sort((a, b) => (b.score || 0) - (a.score || 0)) // מיין הקשרים לפי ציון
          .slice(0, 3), // רק 3 הקשרים הטובים ביותר לקובץ
        score: result.maxScore // הוסף ציון לתוצאה
      }));

      console.log(`✅ מחזיר ${results.length} קבצים עם תוצאות (מתוך ${resultsMap.size} קבצים)`);
      if (results.length > 0) {
        console.log(`📊 ציון גבוה: ${results[0].score.toFixed(3)}, נמוך: ${results[results.length-1].score.toFixed(3)}`);
      }
      return results;
    } catch (error) {
      console.error('❌ שגיאה בחיפוש:', error);
      return [];
    }
  }

  // חילוץ הקשר עם הדגשה חכמה - תמיכה במילים מרובות
  extractContext(text, query) {
    // בדיקת תקינות
    if (!text || typeof text !== 'string') {
      console.warn('⚠️ extractContext: text is not a valid string', text);
      return null;
    }
    
    const contextLength = 200; // הגדלנו ל-200 תווים להקשר טוב יותר
    
    // שלב 1: חפש את כל תגי ההדגשה של Meilisearch
    const highlightedWords = [];
    let searchFrom = 0;
    
    while (searchFrom < text.length) {
      const markIndex = text.indexOf('<mark>', searchFrom);
      if (markIndex === -1) break;
      
      const markEndIndex = text.indexOf('</mark>', markIndex);
      if (markEndIndex === -1) break;
      
      const highlightedWord = text.substring(markIndex + 6, markEndIndex); // +6 for '<mark>'
      highlightedWords.push({
        word: highlightedWord,
        start: markIndex,
        end: markEndIndex + 7 // +7 for '</mark>'
      });
      
      searchFrom = markEndIndex + 7;
    }
    
    if (highlightedWords.length > 0) {
      // יש הדגשות - השתמש בהן
      const firstMark = highlightedWords[0];
      const lastMark = highlightedWords[highlightedWords.length - 1];
      
      const start = Math.max(0, firstMark.start - contextLength);
      const end = Math.min(text.length, lastMark.end + contextLength);

      let contextText = text.substring(start, end);
      
      if (start > 0) contextText = '...' + contextText;
      if (end < text.length) contextText = contextText + '...';

      // הסר תגי HTML
      const cleanText = contextText.replace(/<\/?mark>/g, '');
      
      // מצא את המיקום של המילה הראשונה המודגשת בטקסט הנקי
      const firstWord = highlightedWords[0].word;
      const firstWordLower = firstWord.toLowerCase();
      const cleanTextLower = cleanText.toLowerCase();
      const matchIndex = cleanTextLower.indexOf(firstWordLower);

      return {
        text: cleanText,
        matchIndex: matchIndex >= 0 ? matchIndex : 0,
        matchLength: firstWord.length,
        highlightedWords: highlightedWords.map(h => h.word) // כל המילים המודגשות
      };
    }
    
    // שלב 2: אין הדגשה - חפש את המילים ידנית עם נרמול
    const normalizeText = (str) => {
      return str
        .replace(/['"״׳''""]/g, '') // הסר גרשיים
        .replace(/[.,!?;:\-–—()[\]{}]/g, '') // הסר סימני פיסוק
        .toLowerCase()
        .trim();
    };
    
    // פצל את השאילתה למילים
    const queryWords = query.trim().split(/\s+/);
    const normalizedText = normalizeText(text);
    
    // מצא את כל המילים בטקסט
    const foundWords = [];
    
    for (const queryWord of queryWords) {
      const normalizedQuery = normalizeText(queryWord);
      if (!normalizedQuery || normalizedQuery.length < 2) continue;
      
      // חפש התאמה מדויקת
      let foundIndex = normalizedText.indexOf(normalizedQuery);
      
      // אם לא נמצא - נסה חיפוש חלקי (fuzzy)
      if (foundIndex === -1 && normalizedQuery.length >= 3) {
        foundIndex = this.findFuzzyMatch(normalizedText, normalizedQuery);
      }
      
      if (foundIndex !== -1) {
        // מצא את המיקום האמיתי בטקסט המקורי
        const realPosition = this.mapNormalizedToReal(text, foundIndex, normalizedQuery.length);
        const matchedWord = text.substring(realPosition.start, realPosition.end);
        
        foundWords.push({
          word: matchedWord,
          start: realPosition.start,
          end: realPosition.end
        });
      }
    }
    
    if (foundWords.length > 0) {
      // מיין לפי מיקום
      foundWords.sort((a, b) => a.start - b.start);
      
      const firstWord = foundWords[0];
      const lastWord = foundWords[foundWords.length - 1];
      
      const start = Math.max(0, firstWord.start - contextLength);
      const end = Math.min(text.length, lastWord.end + contextLength);

      let contextText = text.substring(start, end);
      
      if (start > 0) contextText = '...' + contextText;
      if (end < text.length) contextText = contextText + '...';

      return {
        text: contextText,
        matchIndex: firstWord.start - start + (start > 0 ? 3 : 0),
        matchLength: firstWord.word.length,
        highlightedWords: foundWords.map(w => w.word) // כל המילים שנמצאו
      };
    }
    
    // שלב 3: לא מצאנו כלום - החזר את ההתחלה של הטקסט
    console.warn('⚠️ לא נמצאה התאמה בטקסט:', { query, textPreview: text.substring(0, 100) });
    const contextText = text.substring(0, 300);
    return {
      text: contextText + (text.length > 300 ? '...' : ''),
      matchIndex: 0,
      matchLength: 0,
      highlightedWords: null
    };
  }

  // חיפוש fuzzy - מוצא מילים דומות עם שגיאה של תו אחד
  findFuzzyMatch(text, query) {
    const words = text.split(/\s+/);
    const queryLen = query.length;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // בדוק אם המילה דומה (Levenshtein distance <= 1)
      if (Math.abs(word.length - queryLen) <= 1) {
        const distance = this.levenshteinDistance(word, query);
        if (distance <= 1) {
          // מצא את המיקום של המילה בטקסט
          const wordIndex = text.indexOf(word);
          if (wordIndex !== -1) {
            return wordIndex;
          }
        }
      }
    }
    
    return -1;
  }

  // חישוב Levenshtein distance (מרחק עריכה)
  levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // החלפה
            matrix[i][j - 1] + 1,     // הוספה
            matrix[i - 1][j] + 1      // מחיקה
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  // מיפוי מיקום מטקסט מנורמל לטקסט מקורי
  mapNormalizedToReal(originalText, normalizedIndex, normalizedLength) {
    let realStart = 0;
    let normalizedCount = 0;
    
    // מצא את ההתחלה
    for (let i = 0; i < originalText.length && normalizedCount < normalizedIndex; i++) {
      const char = originalText[i];
      // דלג על תווים שהוסרו בנרמול
      if (!/['"״׳''"".,!?;:\-–—()[\]{}]/g.test(char) && char !== ' ') {
        normalizedCount++;
      }
      realStart = i + 1;
    }
    
    // מצא את הסוף
    let realEnd = realStart;
    normalizedCount = 0;
    
    for (let i = realStart; i < originalText.length && normalizedCount < normalizedLength; i++) {
      const char = originalText[i];
      if (!/['"״׳''"".,!?;:\-–—()[\]{}]/g.test(char) && char !== ' ') {
        normalizedCount++;
      }
      realEnd = i + 1;
    }
    
    return { start: realStart, end: realEnd };
  }

  // פונקציות עזר
  splitIntoChunks(text, size) {
    const chunks = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.substring(i, i + size));
    }
    return chunks;
  }

  async loadFileContent(path) {
    try {
      const isElectron = window.electron !== undefined;
      
      console.log('📖 מנסה לטעון קובץ:', path);
      
      if (isElectron) {
        // המר נתיב יחסי לנתיב מוחלט
        let fullPath = path;
        if (path.startsWith('/books/')) {
          // במצב development, הנתיב הוא יחסי לפרויקט
          const appPath = window.electron.getAppPath();
          fullPath = window.electron.joinPath(appPath, path.substring(1)); // הסר את ה-/ הראשון
        }
        
        console.log('📂 נתיב מלא:', fullPath);
        
        const content = await window.electron.readFile(fullPath);
        console.log('✅ קובץ נטען בהצלחה, אורך:', content.length);
        return content;
      } else {
        const response = await fetch(path);
        const content = await response.text();
        console.log('✅ קובץ נטען בהצלחה, אורך:', content.length);
        return content;
      }
    } catch (error) {
      console.error('❌ שגיאה בטעינת קובץ:', path, error.message);
      return '';
    }
  }

  // בדיקה אם מוכן
  isReady() {
    return !this.isIndexing && this.index !== null && this.filesCount > 0;
  }

  getProgress() {
    return this.indexProgress;
  }

  getFilesCount() {
    return this.filesCount;
  }

  // סגירת השרת
  async stopServer() {
    try {
      const isElectron = window.electron !== undefined;
      const isTauri = window.__TAURI__ !== undefined;
      
      if (isElectron) {
        await window.electron.stopMeilisearch();
        console.log('🛑 Meilisearch נסגר (Electron)');
      } else if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/tauri');
        await invoke('stop_meilisearch');
        console.log('🛑 Meilisearch נסגר (Tauri)');
      }
    } catch (error) {
      console.error('שגיאה בסגירת Meilisearch:', error);
    }
  }
}

// יצירת instance יחיד
const meilisearchEngine = new MeilisearchEngine();

export default meilisearchEngine;
