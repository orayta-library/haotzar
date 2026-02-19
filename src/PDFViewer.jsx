import { useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import PDFNotesPanel from './components/PDFNotesPanel';
import PDFToolbar from './components/PDFToolbar';
import PDFTopBar from './components/PDFTopBar';
import PDFContextMenu from './components/PDFContextMenu';
import './PDFViewer.css';

const PDFViewer = ({ pdfPath, title, searchContext, isPreviewMode = false, onLocateBook, onPdfClick }) => {
  const iframeRef = useRef(null);
  const [viewerUrl, setViewerUrl] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [bookName, setBookName] = useState('');
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [noteInitialContent, setNoteInitialContent] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  
  // Extract book name from path or title
  useEffect(() => {
    if (title) {
      setBookName(title);
    } else if (pdfPath) {
      // Extract filename from path
      const filename = pdfPath.split(/[/\\]/).pop().replace('.pdf', '');
      setBookName(filename);
    }
  }, [pdfPath, title]);
  
  // בניית URL עם PDF.js viewer
  useEffect(() => {
    console.log('🔄 PDFViewer useEffect triggered', {
      pdfPath,
      hasSearchContext: !!searchContext,
      searchQuery: searchContext?.searchQuery,
      pageNum: searchContext?.context?.pageNum
    });
    
    const loadPdf = async () => {
      // בדוק אם זה נתיב מוחלט (תיקייה חיצונית)
      const isAbsolutePath = pdfPath.match(/^[A-Za-z]:\\/) || pdfPath.startsWith('/');
      
      let fileUrl;
      
      const isTauri = window.__TAURI__ !== undefined;
      const isElectron = window.electron !== undefined;
      
      if (isAbsolutePath && (isTauri || isElectron)) {
        // נתיב מוחלט - צריך להמיר לפורמט מתאים
        console.log('📄 Loading external PDF:', pdfPath);
        
        // בדוק אם הקובץ קיים (רק ב-Electron)
        if (isElectron && !window.electron.fileExists(pdfPath)) {
          console.error('❌ File does not exist:', pdfPath);
          return;
        }
        
        if (isTauri) {
          // ב-Tauri, קרא את הקובץ ישירות
          try {
            const { readBinaryFile } = await import('@tauri-apps/api/fs');
            const fileData = await readBinaryFile(pdfPath);
            const blob = new Blob([fileData], { type: 'application/pdf' });
            fileUrl = URL.createObjectURL(blob);
            console.log('✅ Created Blob URL for PDF in Tauri');
          } catch (error) {
            console.error('❌ Error reading PDF file in Tauri:', error);
            return;
          }
        } else if (isElectron) {
          // ב-Electron, קרא את הקובץ כ-Blob
          try {
            const arrayBuffer = window.electron.readFileAsBuffer(pdfPath);
            const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
            fileUrl = URL.createObjectURL(blob);
            console.log('✅ Created Blob URL for PDF');
          } catch (error) {
            console.error('❌ Error reading PDF file:', error);
            return;
          }
        }
      } else {
        // נתיב יחסי - השתמש כרגיל
        fileUrl = pdfPath;
      }
      
      let url = `/pdfjs/web/viewer.html?file=${encodeURIComponent(fileUrl)}`;
      
      // במצב תצוגה מקדימה, הוסף פרמטר מיוחד
      if (isPreviewMode) {
        url += '&previewMode=true';
      }
      
      console.log('📄 PDF path:', pdfPath);
      console.log('📄 Is absolute:', isAbsolutePath);
      console.log('📄 File URL:', fileUrl);
      
      // אם יש הקשר חיפוש, הוסף את השאילתה
      if (searchContext && searchContext.searchQuery) {
        url += `&search=${encodeURIComponent(searchContext.searchQuery)}`;
        
        // אם יש מיקום ספציפי, חשב את העמוד
        if (searchContext.context) {
          let estimatedPage = 1;
          
          // אם יש pageNum מדויק, השתמש בו!
          if (searchContext.context.pageNum !== undefined) {
            estimatedPage = searchContext.context.pageNum;
            console.log('📄 Using exact page number:', estimatedPage);
          }
          // אחרת, אם יש chunkId, השתמש בו (כל chunk = 2000 תווים)
          else if (searchContext.context.chunkId !== undefined) {
            // נניח בממוצע 1500 תווים לעמוד PDF (כולל רווחים)
            const charsPerPage = 1500;
            const chunkSize = 2000;
            estimatedPage = Math.floor((searchContext.context.chunkId * chunkSize) / charsPerPage) + 1;
            console.log('📄 Estimated page from chunkId:', estimatedPage);
          } 
          // אחרת, השתמש ב-chunkStart
          else if (searchContext.context.chunkStart !== undefined) {
            const charsPerPage = 1500;
            estimatedPage = Math.floor(searchContext.context.chunkStart / charsPerPage) + 1;
            console.log('📄 Estimated page from chunkStart:', estimatedPage);
          }
          
          // וודא שהעמוד לא שלילי או 0
          estimatedPage = Math.max(1, estimatedPage);
          
          url += `&page=${estimatedPage}`;
          console.log('📄 Opening PDF at page:', estimatedPage);
        }
      }
      
      console.log('📄 PDFViewer URL:', url);
      setViewerUrl(url);
    };
    
    loadPdf();
    
    // ניקוי - שחרר Blob URLs
    return () => {
      if (viewerUrl && viewerUrl.startsWith('blob:')) {
        URL.revokeObjectURL(viewerUrl);
      }
    };
  }, [pdfPath, searchContext]);

  // כשה-iframe נטען, נפעיל את החיפוש ונקפוץ לעמוד
  useEffect(() => {
    if (!viewerUrl) return;
    
    const iframe = iframeRef.current;
    if (!iframe) return;
    
    // המתן לטעינת ה-iframe
    const handleLoad = () => {
      try {
        // גישה ל-PDFViewerApplication דרך ה-iframe
        const pdfWindow = iframe.contentWindow;
        if (pdfWindow && pdfWindow.PDFViewerApplication) {
          
          // אם זה מצב תצוגה מקדימה - הסתר כלים והצג רק עמוד ראשון
          if (isPreviewMode) {
            const setupPreviewMode = () => {
              try {
                const doc = pdfWindow.document;
                
                console.log('🎨 Setting up preview mode...');
                
                // סגור את הסיידבר מיד
                if (pdfWindow.PDFViewerApplication && pdfWindow.PDFViewerApplication.pdfSidebar) {
                  pdfWindow.PDFViewerApplication.pdfSidebar.close();
                  console.log('✅ Closed sidebar');
                }
                
                // הוסף CSS גלובלי למצב תצוגה מקדימה מיד
                const style = doc.createElement('style');
                style.id = 'preview-mode-style';
                style.textContent = `
                  /* הסתר את כל הכלים והסיידבר */
                  #toolbarContainer,
                  #secondaryToolbarContainer,
                  #sidebarContainer,
                  #findbar,
                  #outerContainer.sidebarOpen #sidebarContainer {
                    display: none !important;
                  }
                  
                  /* הגדרות outerContainer - ללא סיידבר */
                  #outerContainer {
                    left: 0 !important;
                  }
                  
                  /* הגדרות viewer container - תופס את כל הרוחב */
                  #viewerContainer {
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    overflow: hidden !important;
                  }
                  
                  /* הגדרות viewer - מרכז את התוכן */
                  #viewer {
                    overflow: hidden !important;
                    display: flex !important;
                    justify-content: center !important;
                    align-items: flex-start !important;
                    padding: 20px !important;
                  }
                  
                  /* הצג רק את העמוד הראשון */
                  .page:not(:first-child) {
                    display: none !important;
                  }
                  
                  /* מרכז את העמוד הראשון */
                  .page:first-child {
                    margin: 0 auto !important;
                    display: block !important;
                  }
                  
                  /* הסתר spread layers */
                  .spreadLayer {
                    display: none !important;
                  }
                  
                  /* הסתר scroll indicators */
                  .scrollbar {
                    display: none !important;
                  }
                  
                  /* הסתר annotationLayer של עמודים אחרים */
                  .page:not(:first-child) .annotationLayer {
                    display: none !important;
                  }
                  
                  /* הסתר textLayer של עמודים אחרים */
                  .page:not(:first-child) .textLayer {
                    display: none !important;
                  }
                `;
                doc.head.appendChild(style);
                console.log('✅ Preview mode CSS added');
                
                // המתן לטעינת ה-PDF ואז הגדר תצוגת עמוד בודד
                const checkPdfLoaded = setInterval(() => {
                  if (pdfWindow.PDFViewerApplication.pdfDocument) {
                    clearInterval(checkPdfLoaded);
                    console.log('📄 PDF loaded in preview mode');
                    
                    // סגור את הסיידבר שוב (למקרה שנפתח)
                    if (pdfWindow.PDFViewerApplication.pdfSidebar) {
                      pdfWindow.PDFViewerApplication.pdfSidebar.close();
                    }
                    
                    // הגדר תצוגת עמוד בודד
                    if (pdfWindow.PDFViewerApplication.pdfViewer) {
                      // הגדר spreadMode ל-0 (NO_SPREAD)
                      if (pdfWindow.PDFViewerApplication.pdfViewer.spreadMode !== undefined) {
                        pdfWindow.PDFViewerApplication.pdfViewer.spreadMode = 0;
                        console.log('✅ Set spreadMode to 0');
                      }
                      
                      // עבור לעמוד הראשון
                      pdfWindow.PDFViewerApplication.pdfViewer.currentPageNumber = 1;
                      
                      // האזן לאירוע pagesloaded כדי להסתיר עמודים נוספים
                      pdfWindow.PDFViewerApplication.eventBus.on('pagesloaded', () => {
                        console.log('📄 Pages loaded, hiding extra pages...');
                        setTimeout(() => {
                          const pages = doc.querySelectorAll('.page');
                          console.log(`📄 Found ${pages.length} pages, hiding all except first`);
                          pages.forEach((page, index) => {
                            if (index > 0) {
                              page.style.display = 'none';
                            }
                          });
                        }, 100);
                      });
                      
                      // כפה רינדור מחדש
                      setTimeout(() => {
                        pdfWindow.PDFViewerApplication.pdfViewer.update();
                        console.log('✅ Preview mode setup complete');
                      }, 100);
                    }
                  }
                }, 50);
                
                // timeout אחרי 5 שניות
                setTimeout(() => clearInterval(checkPdfLoaded), 5000);
                
              } catch (e) {
                console.error('❌ Could not setup preview mode:', e);
              }
            };
            
            // הפעל את מצב התצוגה המקדימה
            setTimeout(setupPreviewMode, 50);
          } else {
            // במצב רגיל - הסתר את הסרגל העליון לחלוטין
            const hideDefaultToolbar = () => {
              try {
                const doc = pdfWindow.document;
                
                console.log('🔧 Configuring PDF.js sidebar...');
                
                // הסתר את כל ה-toolbar container
                const toolbarContainer = doc.getElementById('toolbarContainer');
                if (toolbarContainer) {
                  toolbarContainer.style.display = 'none';
                }
                
                // הסתר את הסרגל המשני
                const secondaryToolbar = doc.getElementById('secondaryToolbarContainer');
                if (secondaryToolbar) {
                  secondaryToolbar.style.display = 'none';
                }
                
                // הסתר את ה-viewer header (הפס האפור)
                const viewerHeader = doc.querySelector('.toolbar');
                if (viewerHeader) {
                  viewerHeader.style.display = 'none';
                }
                
                // התאם את ה-viewer container להתחיל מלמעלה
                const viewerContainer = doc.getElementById('viewerContainer');
                if (viewerContainer) {
                  viewerContainer.style.top = '0';
                }
                
                // התאם את ה-findbar להיות בראש
                const findbar = doc.getElementById('findbar');
                if (findbar) {
                  findbar.style.top = '0';
                }
                
                // בדוק את מצב הסיידבר והטאבים
                const thumbnailButton = doc.getElementById('viewThumbnail');
                const outlineButton = doc.getElementById('viewOutline');
                const attachmentsButton = doc.getElementById('viewAttachments');
                const layersButton = doc.getElementById('viewLayers');
                
                const thumbnailView = doc.getElementById('thumbnailView');
                const outlineView = doc.getElementById('outlineView');
                const attachmentsView = doc.getElementById('attachmentsView');
                const layersView = doc.getElementById('layersView');
                
                console.log('📋 Sidebar buttons found:', {
                  thumbnailButton: !!thumbnailButton,
                  outlineButton: !!outlineButton,
                  attachmentsButton: !!attachmentsButton,
                  layersButton: !!layersButton
                });
                
                console.log('📋 Sidebar views found:', {
                  thumbnailView: !!thumbnailView,
                  outlineView: !!outlineView,
                  attachmentsView: !!attachmentsView,
                  layersView: !!layersView
                });
                
                // בדוק מה מוצג כרגע
                if (thumbnailView) {
                  console.log('🖼️ Thumbnail view display:', window.getComputedStyle(thumbnailView).display);
                  console.log('🖼️ Thumbnail view children:', thumbnailView.children.length);
                }
                
                if (outlineView) {
                  console.log('📖 Outline view display:', window.getComputedStyle(outlineView).display);
                  console.log('📖 Outline view children:', outlineView.children.length);
                }
                
                // אל תכפה מעבר כאן - זה כבר נעשה ב-custom-search.js
                // כדי למנוע מעבר נראה לעין
                
                // בדוק שוב אחרי הלחיצה
                if (thumbnailView) {
                  console.log('🖼️ Thumbnail view display:', window.getComputedStyle(thumbnailView).display);
                  console.log('🖼️ Thumbnail view has content:', thumbnailView.children.length > 0);
                }
                if (outlineView) {
                  console.log('📖 Outline view display:', window.getComputedStyle(outlineView).display);
                  console.log('📖 Outline view has content:', outlineView.children.length > 0);
                }
                
                // הוסף CSS כללי להסתרת הסרגל
                const style = doc.createElement('style');
                style.textContent = `
                  #toolbarContainer,
                  .toolbar,
                  #toolbarViewer {
                    display: none !important;
                  }
                  #viewerContainer {
                    top: 0 !important;
                  }
                  #findbar {
                    top: 0 !important;
                  }
                `;
                doc.head.appendChild(style);
                
                console.log('✅ PDF.js sidebar configuration complete');
              } catch (e) {
                console.error('❌ Could not hide default toolbar:', e);
              }
            };
            
            setTimeout(hideDefaultToolbar, 50);
          }
          
          // המתן שה-PDF ייטען
          const checkReady = setInterval(() => {
            if (pdfWindow.PDFViewerApplication.pdfDocument) {
              clearInterval(checkReady);
              
              // Track page changes
              pdfWindow.PDFViewerApplication.eventBus.on('pagechanging', (evt) => {
                setCurrentPage(evt.pageNumber);
              });
              
              // Get total pages
              if (pdfWindow.PDFViewerApplication.pdfDocument) {
                setTotalPages(pdfWindow.PDFViewerApplication.pdfDocument.numPages);
              }
              
              // Set initial page
              setCurrentPage(pdfWindow.PDFViewerApplication.page || 1);
              
              // אם יש חיפוש בתוכן עניינים, נסה למצוא את העמוד
              if (searchContext && searchContext.outlineSearch) {
                console.log('🔍 Searching in PDF outline for:', searchContext.outlineSearch);
                
                // המתן שתוכן העניינים ייטען
                setTimeout(async () => {
                  try {
                    const outline = await pdfWindow.PDFViewerApplication.pdfDocument.getOutline();
                    if (outline) {
                      console.log('📖 PDF has outline with', outline.length, 'top-level items');
                      
                      // הצג את כל הכותרות ברמה הראשונה
                      console.log('📖 Top-level outline items:', outline.map(item => item.title));
                      
                      // פונקציה רקורסיבית להצגת כל תוכן העניינים
                      const logAllOutlineItems = (items, level = 0) => {
                        items.forEach(item => {
                          console.log('  '.repeat(level) + '📄', item.title);
                          if (item.items && item.items.length > 0) {
                            logAllOutlineItems(item.items, level + 1);
                          }
                        });
                      };
                      
                      console.log('📖 Full outline structure:');
                      logAllOutlineItems(outline);
                      
                      // חפש בתוכן העניינים
                      const searchInOutline = (items, query) => {
                        // נרמול השאילתה - הסרת "דף", גרשיים, פסיקים וכו'
                        const normalizedQuery = query
                          .toLowerCase()
                          .trim()
                          .replace(/דף\s*/g, '') // הסר "דף"
                          .replace(/[״׳''""]/g, '') // הסר גרשיים
                          .replace(/[,،]/g, '') // הסר פסיקים
                          .replace(/\s+/g, ' ') // נרמל רווחים
                          .trim();
                        
                        console.log('🔍 Normalized search query:', normalizedQuery);
                        
                        // נסה למצוא התאמה מדויקת תחילה
                        for (const item of items) {
                          const title = item.title
                            .toLowerCase()
                            .trim()
                            .replace(/[״׳''""]/g, '')
                            .replace(/[,،]/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                          
                          // בדוק אם הכותרת מכילה את החיפוש
                          if (title.includes(normalizedQuery)) {
                            console.log('✅ Exact match found:', item.title);
                            return item;
                          }
                          
                          // חפש רקורסיבית בפריטים מקוננים
                          if (item.items && item.items.length > 0) {
                            const found = searchInOutline(item.items, query);
                            if (found) return found;
                          }
                        }
                        
                        // אם לא נמצא התאמה מדויקת, נסה חיפוש גמיש יותר
                        // חלק את השאילתה למילים
                        const queryWords = normalizedQuery.split(/\s+/);
                        
                        console.log('🔍 Trying flexible search with words:', queryWords);
                        
                        for (const item of items) {
                          const title = item.title
                            .toLowerCase()
                            .trim()
                            .replace(/[״׳''""]/g, '')
                            .replace(/[,،]/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                          
                          // בדוק אם כל המילים מופיעות בכותרת (לא בהכרח ברצף)
                          const allWordsMatch = queryWords.every(word => title.includes(word));
                          if (allWordsMatch) {
                            console.log('✅ Flexible match found:', item.title);
                            return item;
                          }
                          
                          // חפש רקורסיבית בפריטים מקוננים
                          if (item.items && item.items.length > 0) {
                            const found = searchInOutline(item.items, query);
                            if (found) return found;
                          }
                        }
                        
                        console.log('❌ No match found in outline');
                        return null;
                      };
                      
                      const foundItem = searchInOutline(outline, searchContext.outlineSearch);
                      
                      if (foundItem && foundItem.dest) {
                        console.log('✅ Found in outline!');
                        console.log('   Title:', foundItem.title);
                        console.log('   Destination:', foundItem.dest);
                        
                        // קבל את מספר העמוד מה-destination
                        const getPageNumber = async (dest) => {
                          try {
                            // אם dest הוא מערך, האלמנט הראשון הוא ref לעמוד
                            if (Array.isArray(dest) && dest[0]) {
                              const pageRef = dest[0];
                              const pageIndex = await pdfWindow.PDFViewerApplication.pdfDocument.getPageIndex(pageRef);
                              return pageIndex + 1; // pageIndex מתחיל מ-0
                            }
                            // אם dest הוא מחרוזת, זה שם של destination
                            else if (typeof dest === 'string') {
                              const explicitDest = await pdfWindow.PDFViewerApplication.pdfDocument.getDestination(dest);
                              if (explicitDest && explicitDest[0]) {
                                const pageIndex = await pdfWindow.PDFViewerApplication.pdfDocument.getPageIndex(explicitDest[0]);
                                return pageIndex + 1;
                              }
                            }
                          } catch (error) {
                            console.error('Error getting page number:', error);
                          }
                          return null;
                        };
                        
                        getPageNumber(foundItem.dest).then(pageNum => {
                          if (pageNum) {
                            console.log('📄 Opening page:', pageNum);
                            
                            // פתח את העמוד בראש
                            pdfWindow.PDFViewerApplication.page = pageNum;
                            
                            // וודא שהעמוד נפתח בראש
                            setTimeout(() => {
                              pdfWindow.PDFViewerApplication.pdfViewer.currentScaleValue = 'page-width';
                              pdfWindow.PDFViewerApplication.pdfViewer.scrollPageIntoView({
                                pageNumber: pageNum,
                                destArray: [null, { name: 'FitH' }, null] // FitH = התאם לרוחב, בראש העמוד
                              });
                              console.log('✅ Opened page at top');
                            }, 100);
                          }
                        });
                        
                        return; // סיימנו - מצאנו בתוכן עניינים
                      } else {
                        console.log('❌ Not found in outline');
                        console.log('   Searched for:', searchContext.outlineSearch);
                        console.log('   Falling back to text search');
                      }
                    } else {
                      console.log('📖 PDF has no outline (table of contents)');
                    }
                  } catch (error) {
                    console.error('Error searching outline:', error);
                  }
                  
                  // אם לא מצאנו בתוכן עניינים, המשך לחיפוש טקסט רגיל
                  performTextSearch();
                }, 300);
              } else {
                // אם אין חיפוש בתוכן עניינים, עבור ישירות לחיפוש טקסט
                performTextSearch();
              }
              
              // פונקציה לביצוע חיפוש טקסט רגיל
              function performTextSearch() {
                // קפוץ לעמוד הנכון אם יש
                if (searchContext && searchContext.context) {
                  let targetPage = 1;
                  
                  if (searchContext.context.pageNum !== undefined) {
                    targetPage = searchContext.context.pageNum;
                  } else if (searchContext.context.chunkId !== undefined) {
                    const charsPerPage = 1500;
                    const chunkSize = 2000;
                    targetPage = Math.floor((searchContext.context.chunkId * chunkSize) / charsPerPage) + 1;
                  } else if (searchContext.context.chunkStart !== undefined) {
                    const charsPerPage = 1500;
                    targetPage = Math.floor(searchContext.context.chunkStart / charsPerPage) + 1;
                  }
                  
                  targetPage = Math.max(1, targetPage);
                  
                  // כפה קפיצה לעמוד
                  setTimeout(() => {
                    console.log('📄 Forcing jump to page:', targetPage);
                    pdfWindow.PDFViewerApplication.page = targetPage;
                    
                    // אחרי הקפיצה, בצע חיפוש והדגשה
                    if (searchContext && searchContext.searchQuery) {
                      setTimeout(() => {
                        console.log('🔍 Triggering search and highlight in PDF for:', searchContext.searchQuery);
                        
                        // השתמש ב-eventBus לשליחת אירוע חיפוש
                        const eventBus = pdfWindow.PDFViewerApplication.eventBus;
                        if (eventBus) {
                          eventBus.dispatch('find', {
                            source: window,
                            type: 'find',
                            query: searchContext.searchQuery,
                            caseSensitive: false,
                            entireWord: false,
                            highlightAll: true,
                            findPrevious: false,
                            phraseSearch: false
                          });
                        }
                      }, 150);
                    }
                  }, 50);
                } else if (searchContext && searchContext.searchQuery) {
                  // אם אין עמוד ספציפי, רק בצע חיפוש והדגשה
                  setTimeout(() => {
                    console.log('🔍 Triggering search and highlight in PDF for:', searchContext.searchQuery);
                    
                    // השתמש ב-eventBus לשליחת אירוע חיפוש
                    const eventBus = pdfWindow.PDFViewerApplication.eventBus;
                    if (eventBus) {
                      console.log('🔍 Using eventBus.dispatch');
                      eventBus.dispatch('find', {
                        source: window,
                        type: 'find',
                        query: searchContext.searchQuery,
                        caseSensitive: false,
                        entireWord: false,
                        highlightAll: true,
                        findPrevious: false,
                        phraseSearch: false
                      });
                      
                      // האזן לאירוע שמצא תוצאה ונווט אליה
                      eventBus.on('updatefindmatchescount', (evt) => {
                        if (evt.matchesCount && evt.matchesCount.total > 0) {
                          console.log('✅ Found matches:', evt.matchesCount.total);
                          // נווט לתוצאה הראשונה
                          setTimeout(() => {
                            eventBus.dispatch('again', {
                              source: window,
                              type: 'again',
                              query: searchContext.searchQuery,
                              caseSensitive: false,
                              entireWord: false,
                              highlightAll: true,
                              findPrevious: false,
                              phraseSearch: false
                            });
                          }, 100);
                        } else {
                          console.log('❌ No matches found for:', searchContext.searchQuery);
                        }
                      }, { once: true });
                    } else {
                      console.error('❌ eventBus not available');
                    }
                  }, 300);
                }
              }
            }
          }, 50);
          
          // timeout אחרי 5 שניות במקום 10
          setTimeout(() => clearInterval(checkReady), 5000);
        }
      } catch (error) {
        console.error('שגיאה בהפעלת חיפוש ב-PDF:', error);
      }
    };
    
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [searchContext, viewerUrl, isPreviewMode]);

  // טיפול בתפריט הקשר - useEffect רביעי
  useEffect(() => {
    if (!viewerUrl || isPreviewMode) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const setupContextMenu = () => {
      try {
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) return;

        const handleIframeContextMenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // חשב את המיקום יחסית לחלון הראשי
          const iframeRect = iframe.getBoundingClientRect();
          setContextMenu({
            x: iframeRect.left + e.clientX,
            y: iframeRect.top + e.clientY
          });
        };

        const handleIframeClick = (e) => {
          setContextMenu(null);
          
          // סגור את תיבת ההשלמה האוטומטית בהידר
          if (onPdfClick) {
            onPdfClick();
          }
          
          // סגור את ה-findbar אם הוא פתוח
          try {
            const pdfWindow = iframe.contentWindow;
            if (pdfWindow && pdfWindow.PDFViewerApplication) {
              const findbar = iframeDoc.getElementById('findbar');
              
              // בדוק אם דיאלוג החיפוש פתוח
              if (findbar && !findbar.classList.contains('hidden')) {
                // בדוק אם הלחיצה הייתה בתוך ה-findbar
                const isClickOnFindbar = e.target.closest('#findbar');
                
                // סגור את הדיאלוג רק אם הלחיצה לא הייתה על findbar
                if (!isClickOnFindbar) {
                  pdfWindow.PDFViewerApplication.findBar.close();
                }
              }
            }
          } catch (err) {
            console.log('Could not close findbar:', err);
          }
        };

        const handleIframeScroll = () => {
          setContextMenu(null);
        };

        // הוסף listeners ל-iframe document
        iframeDoc.addEventListener('contextmenu', handleIframeContextMenu);
        iframeDoc.addEventListener('click', handleIframeClick);
        iframeDoc.addEventListener('scroll', handleIframeScroll, true);

        // שמור את הפונקציות לניקוי
        return () => {
          iframeDoc.removeEventListener('contextmenu', handleIframeContextMenu);
          iframeDoc.removeEventListener('click', handleIframeClick);
          iframeDoc.removeEventListener('scroll', handleIframeScroll, true);
        };
      } catch (err) {
        console.log('Could not setup context menu in iframe:', err);
        return null;
      }
    };

    // נסה להגדיר עכשיו
    let cleanup = setupContextMenu();

    // אם ה-iframe עדיין לא נטען, חכה לאירוע load
    const handleLoad = () => {
      cleanup = setupContextMenu();
    };

    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      if (cleanup) cleanup();
    };
  }, [viewerUrl, isPreviewMode, onPdfClick]);

  if (!viewerUrl) {
    return <div className="pdf-viewer-container">טוען...</div>;
  }

  const handleNotesClick = (initialContent = '') => {
    setNoteInitialContent(initialContent);
    setShowNotesPanel(true);
  };

  const handleBookmarkClick = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const pdfWindow = iframeRef.current.contentWindow;
      if (pdfWindow.PDFViewerApplication) {
        // Toggle bookmark - this would require custom implementation
        console.log('Bookmark clicked for page:', currentPage);
      }
    }
  };

  const handleZoomIn = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const pdfWindow = iframeRef.current.contentWindow;
      if (pdfWindow.PDFViewerApplication) {
        pdfWindow.PDFViewerApplication.pdfViewer.increaseScale();
      }
    }
  };

  const handleZoomOut = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const pdfWindow = iframeRef.current.contentWindow;
      if (pdfWindow.PDFViewerApplication) {
        pdfWindow.PDFViewerApplication.pdfViewer.decreaseScale();
      }
    }
  };

  const handleNextPage = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const pdfWindow = iframeRef.current.contentWindow;
      if (pdfWindow.PDFViewerApplication) {
        pdfWindow.PDFViewerApplication.page = Math.min(currentPage + 1, totalPages);
      }
    }
  };

  const handlePrevPage = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const pdfWindow = iframeRef.current.contentWindow;
      if (pdfWindow.PDFViewerApplication) {
        pdfWindow.PDFViewerApplication.page = Math.max(currentPage - 1, 1);
      }
    }
  };

  const handlePageChange = (pageNum) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const pdfWindow = iframeRef.current.contentWindow;
      if (pdfWindow.PDFViewerApplication) {
        pdfWindow.PDFViewerApplication.page = pageNum;
      }
    }
  };

  return (
    <div className="pdf-viewer-container">
      {!isPreviewMode && bookName && (
        <>
          <PDFTopBar
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
            iframeRef={iframeRef}
            isToolbarCollapsed={isToolbarCollapsed}
            onToggleToolbar={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
          />
          <div className="pdf-viewer-content">
            <iframe
              ref={iframeRef}
              src={viewerUrl}
              className="pdf-viewer-iframe"
              title={title || 'PDF Viewer'}
            />
            {showNotesPanel && (
              <PDFNotesPanel 
                bookName={bookName}
                currentPage={currentPage}
                onClose={() => {
                  setShowNotesPanel(false);
                  setNoteInitialContent('');
                }}
                autoOpenCreate={true}
                initialContent={noteInitialContent}
              />
            )}
            <PDFToolbar
              onNotesClick={handleNotesClick}
              onBookmarkClick={handleBookmarkClick}
              onNextPage={handleNextPage}
              onPrevPage={handlePrevPage}
              currentPage={currentPage}
              totalPages={totalPages}
              isCollapsed={isToolbarCollapsed}
              iframeRef={iframeRef}
              bookName={bookName}
            />
          </div>
        </>
      )}
      {isPreviewMode && (
        <iframe
          ref={iframeRef}
          src={viewerUrl}
          className="pdf-viewer-iframe"
          title={title || 'PDF Viewer'}
        />
      )}
      {contextMenu && !isPreviewMode && (
        <PDFContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          iframeRef={iframeRef}
          currentPage={currentPage}
          bookName={bookName}
          onNotesClick={handleNotesClick}
          onLocateBook={onLocateBook}
        />
      )}
    </div>
  );
};

export default PDFViewer;
