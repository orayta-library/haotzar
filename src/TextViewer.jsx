import { useState, useEffect, useRef } from 'react';
import { Button, Text } from '@fluentui/react-components';
import TextViewerToolbar from './components/TextViewerToolbar';
import TextViewerTopBar from './components/TextViewerTopBar';
import { convertOtzariaBookToText } from './utils/otzariaIntegration';
import './TextViewer.css';

const TextViewer = ({ textPath, searchContext, isPreviewMode = false, bookId = null, bookType = null }) => {
    const [htmlContent, setHtmlContent] = useState('');
    const [pages, setPages] = useState([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [bookName, setBookName] = useState('');
    const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
    const [fontSize, setFontSize] = useState(24);
    const [columnCount, setColumnCount] = useState(1); // ברירת מחדל: טור אחד
    const [outline, setOutline] = useState([]);
    const [isOutlineOpen, setIsOutlineOpen] = useState(false);
    const [expandedItems, setExpandedItems] = useState(new Set()); // פריטים מורחבים
    const scrollContainerRef = useRef(null);
    const [displayedLines, setDisplayedLines] = useState(50); // מספר שורות מוצגות
    const [allLines, setAllLines] = useState([]); // כל השורות של הספר
    const [isWideView, setIsWideView] = useState(true); // מצב רווחים מורחבים - ברירת מחדל ללא רווח

    useEffect(() => {
        const loadTextFile = async () => {
            try {
                setLoading(true);
                
                let htmlText;
                let fileName;
                
                // בדיקה אם זה ספר אוצריא
                if (bookType === 'otzaria' && bookId) {
                    console.log('📖 טוען ספר אוצריא:', bookId);
                    const bookData = convertOtzariaBookToText(bookId);
                    
                    if (!bookData) {
                        console.error('❌ לא ניתן לטעון ספר אוצריא');
                        setLoading(false);
                        return;
                    }
                    
                    setBookName(bookData.title);
                    htmlText = bookData.content;
                    console.log('✅ ספר אוצריא נטען:', bookData.totalLines, 'שורות');
                } else if (textPath) {
                    // טעינת קובץ טקסט רגיל
                    // חילוץ שם הספר מהנתיב
                    fileName = textPath.split(/[/\\]/).pop(); // קבלת שם הקובץ
                    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, ''); // הסרת הסיומת
                    setBookName(nameWithoutExt);
                    
                    // בדיקה אם אנחנו ב-Electron
                    const isElectron = window.electron !== undefined;
                    
                    if (isElectron) {
                        // קריאת קובץ דרך Electron API
                        htmlText = window.electron.readFile(textPath);
                    } else {
                        // קריאת קובץ רגילה (development mode)
                        const response = await fetch(textPath);
                        htmlText = await response.text();
                    }
                    
                    // המר כל מעבר שורה ל-<br> כדי לשמור על מעברי השורות
                    htmlText = htmlText
                        .replace(/\r\n/g, '\n') // המרת Windows line endings
                        .replace(/\r/g, '\n')   // המרת Mac line endings
                        .replace(/\n/g, '<br>\n'); // המר כל מעבר שורה ל-<br>
                } else {
                    console.error('❌ לא סופק textPath או bookId');
                    setLoading(false);
                    return;
                }
                
                // אם יש חיפוש, הדגש את המילים
                if (searchContext && searchContext.searchQuery) {
                    const query = searchContext.searchQuery;
                    const regex = new RegExp(`(${query})`, 'gi');
                    htmlText = htmlText.replace(regex, '<mark class="search-highlight">$1</mark>');
                }
                
                setHtmlContent(htmlText);

                // חלוקה לשורות
                const lines = htmlText.split('<br>').filter(line => line.trim());
                setAllLines(lines);
                setPages([htmlText]); // שמירה על התוכן המלא לצורך תאימות
                
                // חילוץ תוכן עניינים מהטקסט
                extractOutline(htmlText);
                
                // אם יש מיקום ספציפי, נווט אליו
                if (searchContext && searchContext.context) {
                    // TODO: ניווט למיקום ספציפי בתצוגה הרציפה
                    console.log('📄 TextViewer: יש הקשר חיפוש');
                } else {
                    setCurrentPage(0);
                }

                console.log('סך כל השורות:', lines.length);
            } catch (error) {
                console.error('שגיאה בטעינת קובץ הטקסט:', error);
            } finally {
                setLoading(false);
            }
        };

        if (textPath || (bookType === 'otzaria' && bookId)) {
            loadTextFile();
        }
    }, [textPath, searchContext, bookId, bookType]);

    // פונקציה לטעינת שורות נוספות בגלילה
    const handleScroll = (e) => {
        const element = e.target;
        const scrollPercentage = (element.scrollTop + element.clientHeight) / element.scrollHeight;
        
        // כאשר מגיעים ל-80% מהגלילה, טען עוד 50 שורות
        if (scrollPercentage > 0.8 && displayedLines < allLines.length) {
            setDisplayedLines(prev => Math.min(prev + 50, allLines.length));
        }
    };

    // פונקציה לחילוץ תוכן עניינים מהטקסט
    const extractOutline = (htmlText) => {
        try {
            console.log('🔍 Starting outline extraction...');
            console.log('📄 Text length:', htmlText.length);
            
            const outlineItems = [];
            let itemId = 0;
            
            // חפש את כל תגיות הכותרת בטקסט המלא (לא רק בשורות)
            const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
            let match;
            let matchCount = 0;
            
            while ((match = headingRegex.exec(htmlText)) !== null) {
                matchCount++;
                const level = parseInt(match[1]);
                const title = match[2].replace(/<[^>]*>/g, '').trim();
                
                if (title.length > 0) {
                    // חשב באיזו שורה הכותרת נמצאת
                    const textBeforeHeading = htmlText.substring(0, match.index);
                    const lineIndex = (textBeforeHeading.match(/<br>/gi) || []).length;
                    
                    outlineItems.push({
                        id: itemId++,
                        title: title,
                        level: level,
                        lineIndex: lineIndex,
                        children: []
                    });
                }
            }
            
            console.log('📖 Found', matchCount, 'heading tags');
            console.log('📖 Valid headings:', outlineItems.length);
            
            // בנה היררכיה
            const buildHierarchy = (items) => {
                const root = [];
                const stack = [];
                
                items.forEach(item => {
                    // מצא את ההורה המתאים (הכותרת הקרובה ביותר ברמה נמוכה יותר)
                    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
                        stack.pop();
                    }
                    
                    if (stack.length === 0) {
                        // פריט ברמה הראשית
                        root.push(item);
                    } else {
                        // הוסף כילד להורה
                        stack[stack.length - 1].children.push(item);
                    }
                    
                    stack.push(item);
                });
                
                return root;
            };
            
            const hierarchicalOutline = buildHierarchy(outlineItems);
            setOutline(hierarchicalOutline);
            
            console.log('✅ Final outline with', outlineItems.length, 'items');
            if (outlineItems.length > 0) {
                console.log('📖 First 5 items:', outlineItems.slice(0, 5).map(item => `[${item.level}] ${item.title}`));
            } else {
                console.log('⚠️ No heading tags found in HTML');
            }
        } catch (error) {
            console.error('❌ Error extracting outline:', error);
            setOutline([]);
        }
    };

    // טיפול בהרחבה/צמצום של פריט
    const toggleExpand = (itemId) => {
        setExpandedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    // רנדור רקורסיבי של פריטי תוכן עניינים
    const renderOutlineItem = (item, depth = 0) => {
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedItems.has(item.id);
        
        return (
            <div key={item.id}>
                <div
                    className={`outline-item outline-level-${item.level}`}
                    style={{ paddingRight: `${depth * 12 + 8}px` }}
                >
                    {hasChildren && (
                        <button
                            className="outline-expand-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(item.id);
                            }}
                            title={isExpanded ? 'צמצם' : 'הרחב'}
                        >
                            {isExpanded ? '▼' : '◄'}
                        </button>
                    )}
                    <span
                        className="outline-item-text"
                        onClick={() => navigateToOutlineItem(item.lineIndex)}
                        title={item.title}
                        style={{ paddingRight: hasChildren ? '0' : '16px' }}
                    >
                        {item.title}
                    </span>
                </div>
                {hasChildren && isExpanded && (
                    <div className="outline-children">
                        {item.children.map(child => renderOutlineItem(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    // ניווט לשורה מתוכן העניינים
    const navigateToOutlineItem = (lineIndex) => {
        if (scrollContainerRef.current && allLines.length > 0) {
            // וודא שהשורה נטענה
            if (lineIndex >= displayedLines) {
                // טען עד השורה הנדרשת + 50 שורות נוספות
                setDisplayedLines(Math.min(lineIndex + 50, allLines.length));
                
                // המתן לרינדור ואז נווט
                setTimeout(() => {
                    const lineElement = document.getElementById(`line-${lineIndex}`);
                    if (lineElement) {
                        lineElement.scrollIntoView({ behavior: 'auto', block: 'start' });
                        console.log('📍 Navigated to line:', lineIndex);
                    }
                }, 100);
            } else {
                // השורה כבר נטענה, נווט ישירות
                const lineElement = document.getElementById(`line-${lineIndex}`);
                if (lineElement) {
                    lineElement.scrollIntoView({ behavior: 'auto', block: 'start' });
                    console.log('📍 Navigated to line:', lineIndex);
                } else {
                    console.warn('⚠️ Line element not found:', lineIndex);
                }
            }
        }
    };

    if (loading) {
        return (
            <div className="text-viewer-container">
                <div className="text-viewer-loading">
                    <Text size={400}>טוען קובץ טקסט...</Text>
                </div>
            </div>
        );
    }

    if (!pages.length) {
        return (
            <div className="text-viewer-container">
                <div className="text-viewer-empty">
                    <Text size={400}>לא ניתן לטעון את קובץ הטקסט</Text>
                </div>
            </div>
        );
    }

    const handleNotesClick = () => {
        console.log('Notes clicked for:', bookName);
        // TODO: Implement notes panel
    };

    const handleBookmarkClick = () => {
        console.log('Bookmark clicked');
        // TODO: Implement bookmark functionality
    };

    const handleFontSizeChange = (action) => {
        if (action === 'increase') {
            setFontSize(prev => Math.min(prev + 2, 36));
        } else if (action === 'decrease') {
            setFontSize(prev => Math.max(prev - 2, 16));
        }
    };

    const handleColumnChange = (columns) => {
        setColumnCount(columns);
    };

    const handleSearch = (query) => {
        console.log('Search for:', query);
        // TODO: Implement search functionality
    };

    const handleToggleWideView = (wideView) => {
        setIsWideView(wideView);
    };

    return (
        <div className="text-viewer-container">
            {!isPreviewMode && bookName && (
                <>
                    <TextViewerTopBar
                        currentPage={1}
                        totalPages={1}
                        onPageChange={() => {}}
                        onNextPage={() => {}}
                        onPrevPage={() => {}}
                        isToolbarCollapsed={isToolbarCollapsed}
                        onToggleToolbar={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
                        onZoomIn={() => handleFontSizeChange('increase')}
                        onZoomOut={() => handleFontSizeChange('decrease')}
                        onSearch={handleSearch}
                        onToggleOutline={() => setIsOutlineOpen(!isOutlineOpen)}
                        outlineCount={outline.length}
                    />
                    <div className="text-viewer-content">
                        <div className="text-viewer-layout">
                            {/* חלונית תוכן עניינים */}
                            {isOutlineOpen && (
                                <div className="text-outline-sidebar">
                                    <div className="outline-header">
                                        <button
                                            onClick={() => setIsOutlineOpen(false)}
                                            title="סגור"
                                            style={{ fontSize: '16px' }}
                                        >
                                            ☐
                                        </button>
                                        <button
                                            title="תפריט"
                                            style={{ fontSize: '16px' }}
                                        >
                                            ☰
                                        </button>
                                    </div>
                                    <div className="outline-content">
                                        {outline.length > 0 ? (
                                            outline.map(item => renderOutlineItem(item, 0))
                                        ) : (
                                            <div style={{ padding: '20px', textAlign: 'center' }}>
                                                <Text size={300}>לא נמצאו כותרות בקובץ זה</Text>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            <div className="text-viewer">
                                {/* תוכן הטקסט - תצוגה רציפה */}
                                <div 
                                    className={`text-content-scroll ${isWideView ? 'wide-view' : ''}`}
                                    ref={scrollContainerRef}
                                    onScroll={handleScroll}
                                >
                                    <div 
                                        className="continuous-text-container"
                                        style={{
                                            margin: isWideView ? '0' : '20px auto',
                                            maxWidth: isWideView ? '100%' : '900px'
                                        }}
                                    >
                                        <div 
                                            className="page-content"
                                        >
                                            {/* תוכן רציף */}
                                            <div
                                                className="text-content-continuous"
                                                style={{
                                                    fontSize: `${fontSize}px`
                                                }}
                                            >
                                                {allLines.slice(0, displayedLines).map((line, index) => (
                                                    <div 
                                                        key={index} 
                                                        id={`line-${index}`}
                                                        dangerouslySetInnerHTML={{ __html: line }}
                                                        style={{ 
                                                            minHeight: `${fontSize * 1.8}px`,
                                                            lineHeight: 1.8
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            {displayedLines < allLines.length && (
                                                <div className="loading-more">
                                                    טוען עוד תוכן...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <TextViewerToolbar
                                onNotesClick={handleNotesClick}
                                onBookmarkClick={handleBookmarkClick}
                                currentPage={1}
                                totalPages={1}
                                isCollapsed={isToolbarCollapsed}
                                bookName={bookName}
                                onFontSizeChange={handleFontSizeChange}
                                onColumnChange={handleColumnChange}
                                currentColumns={columnCount}
                                onToggleWideView={handleToggleWideView}
                            />
                        </div>
                    </div>
                </>
            )}
            {isPreviewMode && (
                <div className="text-viewer text-viewer-preview">
                    <div className="text-content-scroll" style={{ 
                        overflow: 'hidden',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-start'
                    }}>
                        <div className="page-container" style={{
                            maxWidth: '100%',
                            margin: '0 auto'
                        }}>
                            <div className="page-content">
                                <div
                                    className="text-content-columns"
                                    dangerouslySetInnerHTML={{ __html: pages[0] || '' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TextViewer;