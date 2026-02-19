import { DocumentRegular, DocumentTextRegular, SearchRegular, PersonRegular, BookRegular } from '@fluentui/react-icons';
import './SearchAutocomplete.css';

const SearchAutocomplete = ({ suggestions, onSelect, searchQuery }) => {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  // בדיקה אם קטגוריה היא חיצונית (לא להציג את שמה)
  const isExternalCategory = (categoryTitle) => {
    if (!categoryTitle) return false;
    const title = categoryTitle.toLowerCase();
    return title.includes('hebrewbooks') || 
           title.includes('hebrew books') ||
           title.includes('היברו-בוקס') ||
           title.includes('היברו בוקס') ||
           title.includes('היברובוקס') ||
           title.includes('אוצר החכמה') ||
           title.includes('אוצר חכמה');
  };

  // נרמול טקסט - הסרת גרשיים, סימני ציטוט ואותיות שימוש
  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .replace(/['"״׳''""]/g, '')
      // הסרת אותיות שימוש בתחילת מילים (ה, ו, ב, כ, ל, מ, ש)
      .replace(/(^|[\s])([הוכלמשב])(?=[א-ת])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // הדגשת טקסט החיפוש - חכם יותר
  const highlightMatch = (text, query) => {
    if (!query) return text;
    
    const normalizedText = normalizeText(text);
    const normalizedQuery = normalizeText(query);
    const queryWords = normalizedQuery.split(' ');
    
    // מצא את כל המיקומים של מילות החיפוש
    const highlights = [];
    
    // ראשית, נסה למצוא את כל הביטוי ברצף
    let index = normalizedText.indexOf(normalizedQuery);
    if (index !== -1) {
      highlights.push({ start: index, end: index + normalizedQuery.length });
    } else {
      // אם לא נמצא ברצף, חפש כל מילה בנפרד
      queryWords.forEach(word => {
        let pos = 0;
        while ((pos = normalizedText.indexOf(word, pos)) !== -1) {
          highlights.push({ start: pos, end: pos + word.length });
          pos += word.length;
        }
      });
    }
    
    if (highlights.length === 0) return text;
    
    // מיזוג הדגשות חופפות
    highlights.sort((a, b) => a.start - b.start);
    const merged = [];
    let current = highlights[0];
    
    for (let i = 1; i < highlights.length; i++) {
      if (highlights[i].start <= current.end) {
        current.end = Math.max(current.end, highlights[i].end);
      } else {
        merged.push(current);
        current = highlights[i];
      }
    }
    merged.push(current);
    
    // בנה את הטקסט המודגש
    const parts = [];
    let lastIndex = 0;
    
    merged.forEach(({ start, end }) => {
      if (start > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, start)}</span>);
      }
      parts.push(
        <strong key={`highlight-${start}`} className="match-highlight">
          {text.substring(start, end)}
        </strong>
      );
      lastIndex = end;
    });
    
    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
    }
    
    return <>{parts}</>;
  };

  return (
    <div className="search-autocomplete">
      {suggestions.map((file) => {
        // אם יש tocEntry, הצג את הכותרת
        const hasTitle = file.matchType === 'book-with-title' && file.tocEntry;
        
        return (
          <div
            key={file.id}
            className="autocomplete-item"
            onClick={() => onSelect(file)}
          >
            <div className="autocomplete-icon">
              {file.type === 'otzaria' ? (
                <BookRegular />
              ) : file.type === 'pdf' ? (
                <DocumentRegular />
              ) : (
                <DocumentTextRegular />
              )}
            </div>
            <div className="autocomplete-content">
              <div className="autocomplete-title">
                {hasTitle ? (
                  <>
                    {highlightMatch(file.name, searchQuery.split(':')[0])}
                    <span className="title-separator"> → </span>
                    <span className="title-name">{file.tocEntry.label}</span>
                  </>
                ) : (
                  highlightMatch(file.name, searchQuery)
                )}
              </div>
            </div>
            <SearchRegular className="autocomplete-arrow" />
          </div>
        );
      })}
    </div>
  );
};

export default SearchAutocomplete;
