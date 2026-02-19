import { useState, useEffect, useRef } from 'react';
import { 
  DocumentRegular,
  DismissRegular,
  ChevronRightRegular,
  FolderRegular,
  SearchRegular,
  HomeRegular,
  PanelRightRegular,
  EyeRegular,
} from '@fluentui/react-icons';
import PDFThumbnail from './PDFThumbnail';
import TextViewer from '../TextViewer';
import { getOtzariaRootFolder, getOtzariaCategoryById, getOtzariaCategoryByPath } from '../utils/otzariaIntegration';
import './FolderPreview.css';

const FolderPreview = ({ folder, onClose, onFileClick, onFolderClick, allFiles }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // המר קובץ PDF ל-Blob URL
  useEffect(() => {
    if (!previewFile || previewFile.type !== 'pdf') {
      setPreviewUrl('');
      return;
    }

    const loadUrl = async () => {
      try {
        const isElectron = window.electron !== undefined;
        if (isElectron) {
          const arrayBuffer = window.electron.readFileAsBuffer(previewFile.path);
          const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          setPreviewUrl(`/pdfjs/web/viewer.html?file=${encodeURIComponent(blobUrl)}&previewMode=true#zoom=page-fit`);
        } else {
          setPreviewUrl(`/pdfjs/web/viewer.html?file=${encodeURIComponent(previewFile.path)}&previewMode=true#zoom=page-fit`);
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };

    loadUrl();

    return () => {
      if (previewUrl && previewUrl.includes('blob:')) {
        const blobUrl = decodeURIComponent(previewUrl.split('file=')[1].split('&')[0]);
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [previewFile]);

  if (!folder) return null;

  // בניית breadcrumb מההירכיה האמיתית של התיקייה
  const buildBreadcrumb = () => {
    const breadcrumb = [{ name: 'ספרייה', path: 'root', folder: null }];
    
    if (!folder || !folder.path) return breadcrumb;
    
    // אם זו תיקייה וירטואלית של אוצריא, בנה breadcrumb מיוחד
    if (folder.isVirtual && folder.virtualType === 'otzaria') {
      breadcrumb.push({
        name: 'אוצריא',
        path: 'virtual-otzaria',
        folder: { path: 'virtual-otzaria', name: 'אוצריא', isVirtual: true, virtualType: 'otzaria-root' }
      });
      return breadcrumb;
    }
    
    if (folder.isVirtual && folder.virtualType === 'otzaria-category') {
      // בנה breadcrumb מהנתיב
      breadcrumb.push({
        name: 'אוצריא',
        path: 'virtual-otzaria',
        folder: { path: 'virtual-otzaria', name: 'אוצריא', isVirtual: true, virtualType: 'otzaria-root' }
      });
      
      // פרק את הנתיב לקטגוריות
      const pathParts = folder.path.replace('virtual-otzaria/', '').split('/').filter(p => p);
      
      // בנה breadcrumb לכל קטגוריה בנתיב
      let currentPath = 'virtual-otzaria';
      pathParts.forEach((categoryName, index) => {
        currentPath += '/' + categoryName;
        
        // אם זו הקטגוריה האחרונה, השתמש בתיקייה הנוכחית
        if (index === pathParts.length - 1) {
          breadcrumb.push({
            name: categoryName,
            path: currentPath,
            folder: folder
          });
        } else {
          // אחרת, צור placeholder לקטגוריה ביניים
          breadcrumb.push({
            name: categoryName,
            path: currentPath,
            folder: { 
              path: currentPath, 
              name: categoryName, 
              isVirtual: true, 
              virtualType: 'otzaria-category',
              // ננסה למצוא את ה-categoryId מה-cache
              categoryId: null
            }
          });
        }
      });
      
      return breadcrumb;
    }
    
    // פרק את הנתיב
    const pathParts = folder.path.split('/').filter(p => p && p !== 'root');
    
    // בנה את ה-breadcrumb מכל חלקי הנתיב
    let currentPath = 'root';
    pathParts.forEach((partName, index) => {
      currentPath += '/' + partName;
      breadcrumb.push({
        name: partName,
        path: currentPath,
        folder: index === pathParts.length - 1 ? folder : { path: currentPath, name: partName }
      });
    });
    
    return breadcrumb;
  };

  const breadcrumb = buildBreadcrumb();

  // ניווט לתיקייה ספציפית ב-breadcrumb - בנה מחדש את התיקייה מהעץ
  const navigateToFolder = (breadcrumbItem) => {
    console.log('🔍 Navigating to:', breadcrumbItem);
    
    // טיפול מיוחד בתיקיות אוצריא
    if (breadcrumbItem.folder?.isVirtual && breadcrumbItem.folder.virtualType === 'otzaria-root') {
      console.log('📖 Navigating to Otzaria root');
      const otzariaTree = getOtzariaRootFolder();
      if (otzariaTree) {
        onFolderClick(otzariaTree);
      }
      return;
    }
    
    // אם זו קטגוריית אוצריא, חפש לפי נתיב או ID
    if (breadcrumbItem.folder?.isVirtual && breadcrumbItem.folder.virtualType === 'otzaria-category') {
      console.log('📖 Navigating to Otzaria category:', breadcrumbItem.path);
      
      // נסה למצוא לפי נתיב
      let category = getOtzariaCategoryByPath(breadcrumbItem.path);
      
      // אם לא נמצא ויש categoryId, נסה לפי ID
      if (!category && breadcrumbItem.folder.categoryId) {
        category = getOtzariaCategoryById(breadcrumbItem.folder.categoryId);
      }
      
      if (category) {
        onFolderClick(category);
      } else {
        console.warn('⚠️ לא נמצאה קטגוריה:', breadcrumbItem.path);
      }
      return;
    }
    
    // בנה את העץ מחדש כדי למצוא את התיקייה המלאה עם כל הילדים
    if (!allFiles || allFiles.length === 0) {
      console.error('❌ No files available to build tree');
      return;
    }
    
    console.log('🌳 Building tree from', allFiles.length, 'files');
    
    // בנה עץ פשוט מהקבצים
    const buildSimpleTree = () => {
      const root = { name: 'ספרייה', type: 'folder', path: 'root', children: [] };
      
      allFiles.forEach(file => {
        const normalizedPath = file.path.replace(/\\/g, '/');
        let pathParts = [];
        
        const booksIndex = normalizedPath.indexOf('books/');
        if (booksIndex !== -1) {
          const afterBooks = normalizedPath.substring(booksIndex + 'books/'.length);
          pathParts = afterBooks.split('/').filter(p => p);
        } else {
          const allParts = normalizedPath.split('/').filter(p => p);
          let startIndex = 0;
          for (let i = 0; i < allParts.length - 1; i++) {
            const part = allParts[i].toLowerCase();
            if (part && part !== 'c:' && part !== 'd:' && part !== 'e:' && 
                part !== 'users' && part !== 'user' && 
                part !== 'documents' && part !== 'downloads' && part !== 'desktop' &&
                !part.includes('appdata') && !part.includes('program') && part !== '') {
              startIndex = i;
              break;
            }
          }
          pathParts = allParts.slice(startIndex);
        }
        
        let currentLevel = root.children;
        let currentPath = 'root';
        
        pathParts.forEach((part, index) => {
          currentPath += '/' + part;
          const isLastPart = index === pathParts.length - 1;
          
          if (isLastPart) {
            currentLevel.push({
              name: part,
              type: 'file',
              path: file.path,
              fullData: file
            });
          } else {
            let folder = currentLevel.find(item => item.name === part && item.type === 'folder');
            if (!folder) {
              folder = { name: part, type: 'folder', path: currentPath, children: [] };
              currentLevel.push(folder);
            }
            currentLevel = folder.children;
          }
        });
      });
      
      return root;
    };
    
    const tree = buildSimpleTree();
    console.log('🌳 Tree built:', tree);
    
    // אם זה השורש (ספרייה), הצג את כל התיקיות הראשיות
    if (!breadcrumbItem.folder || breadcrumbItem.path === 'root') {
      console.log('✅ Showing root with', tree.children?.length, 'children');
      onFolderClick(tree);
      return;
    }
    
    if (breadcrumbItem.folder === folder) {
      console.log('✅ Already in this folder');
      return; // כבר בתיקייה הזו
    }
    
    // מצא את התיקייה בעץ לפי הנתיב
    const findFolderByPath = (node, targetPath) => {
      if (node.path === targetPath) {
        return node;
      }
      
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'folder') {
            const found = findFolderByPath(child, targetPath);
            if (found) return found;
          }
        }
      }
      
      return null;
    };
    
    console.log('🔍 Looking for path:', breadcrumbItem.path);
    const fullFolder = findFolderByPath(tree, breadcrumbItem.path);
    
    if (fullFolder) {
      console.log('✅ Found folder with', fullFolder.children?.length, 'children');
      onFolderClick(fullFolder);
    } else {
      console.error('❌ Could not find folder:', breadcrumbItem.path);
    }
  };

  // סינון קבצים לפי חיפוש
  const filteredChildren = folder.children?.filter(child => 
    child.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // מיון - תיקיות קודם, אחר כך קבצים
  const sortedChildren = [...filteredChildren].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'he');
  });

  const handleItemClick = (item) => {
    if (item.type === 'folder') {
      // פתח תיקייה אחרת
      onFolderClick(item);
      setPreviewFile(null); // נקה תצוגה מקדימה
    } else {
      // אם יש תצוגה מקדימה - הצג בה
      if (showPreviewPanel) {
        setPreviewFile(item.fullData);
      } else {
        // אחרת פתח קובץ
        onFileClick(item.fullData);
      }
    }
  };

  // לחיצה על קובץ בתצוגה מקדימה
  const handlePreviewClick = (item) => {
    if (item.type === 'file') {
      setPreviewFile(item.fullData);
      if (!showPreviewPanel) {
        setShowPreviewPanel(true);
      }
    }
  };

  return (
    <div className="folder-preview-overlay">
      <div className={`folder-preview-container ${showPreviewPanel ? 'with-preview' : ''}`}>
        {/* כותרת - תמיד למעלה */}
        <div className="folder-preview-header">
          <button 
            className="folder-preview-close"
            onClick={onClose}
            aria-label="סגור"
          >
            <DismissRegular />
          </button>
          
          {/* Breadcrumbs */}
          <div className="folder-preview-breadcrumbs">
            {breadcrumb.map((item, index) => (
              <div key={item.path} className="folder-preview-breadcrumb">
                {index > 0 && (
                  <ChevronRightRegular className="folder-preview-breadcrumb-separator" />
                )}
                <button
                  className={`folder-preview-breadcrumb-btn ${index === breadcrumb.length - 1 ? 'active' : ''}`}
                  onClick={() => {
                    if (index < breadcrumb.length - 1) {
                      navigateToFolder(item);
                    }
                  }}
                  disabled={index === breadcrumb.length - 1}
                >
                  {index === 0 ? <HomeRegular /> : <FolderRegular />}
                  <span>{item.name}</span>
                </button>
              </div>
            ))}
          </div>
          
          <div className="folder-preview-actions">
            <div className="folder-preview-count">
              {folder.children?.length || 0} פריטים
            </div>
            
            {/* כפתור תצוגה מקדימה */}
            <button
              className={`preview-toggle-btn ${showPreviewPanel ? 'active' : ''}`}
              onClick={() => {
                setShowPreviewPanel(!showPreviewPanel);
                if (showPreviewPanel) {
                  setPreviewFile(null);
                }
              }}
              title={showPreviewPanel ? 'הסתר תצוגה מקדימה' : 'הצג תצוגה מקדימה'}
            >
              <PanelRightRegular />
            </button>
          </div>
        </div>

        {/* תוכן מתחת לכותרת */}
        <div className="folder-preview-body">
          {/* תוכן ראשי */}
          <div className="folder-preview-main">
            {/* חיפוש */}
            <div className="folder-preview-search">
              <SearchRegular className="folder-preview-search-icon" />
              <input
                type="text"
                placeholder="חפש בתיקייה..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="folder-preview-search-input"
              />
              {searchQuery && (
                <button
                  className="folder-preview-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="נקה"
                >
                  ×
                </button>
              )}
            </div>

            {/* רשימת פריטים */}
            <div className="folder-preview-content">
              {sortedChildren.length > 0 ? (
                <div className="folder-preview-grid">
                  {sortedChildren.map((item, index) => (
                    <div
                      key={`${item.path}-${index}`}
                      className={`folder-preview-item ${item.type === 'folder' ? 'is-folder' : 'is-file'} ${previewFile?.path === item.fullData?.path ? 'selected' : ''}`}
                      onClick={() => handleItemClick(item)}
                      onDoubleClick={() => {
                        if (item.type === 'file') {
                          onFileClick(item.fullData);
                        }
                      }}
                      title={item.name}
                    >
                      <div className="folder-preview-item-icon">
                        {item.type === 'folder' ? (
                          <FolderRegular />
                        ) : (
                          <DocumentRegular />
                        )}
                      </div>
                      <div className="folder-preview-item-name">
                        {item.name}
                      </div>
                      {item.type === 'folder' && (
                        <div className="folder-preview-item-arrow">
                          <ChevronRightRegular />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="folder-preview-empty">
                  {searchQuery ? 'לא נמצאו תוצאות' : 'התיקייה ריקה'}
                </div>
              )}
            </div>

            {/* מידע נוסף */}
            {folder.isVirtual && (
              <div className="folder-preview-footer">
                <span className="folder-preview-badge">
                  {folder.virtualType === 'history' ? 'תיקייה וירטואלית - היסטוריה' : 'תיקייה וירטואלית - מוצמדים'}
                </span>
              </div>
            )}
          </div>

          {/* פאנל תצוגה מקדימה */}
          {showPreviewPanel && (
            <div className="folder-preview-panel">
              {previewFile ? (
                <div className="folder-preview-panel-content">
                  {previewFile.type === 'pdf' ? (
                    previewUrl ? (
                      <iframe
                        key={previewFile.path}
                        src={previewUrl}
                        className="pdf-preview-iframe"
                        title="תצוגה מקדימה"
                      />
                    ) : (
                      <div className="folder-preview-panel-empty">
                        <p>טוען...</p>
                      </div>
                    )
                  ) : (
                    <TextViewer 
                      key={`folder-preview-${previewFile.id}`}
                      textPath={previewFile.path} 
                      title={previewFile.name}
                      isPreviewMode={true}
                    />
                  )}
                </div>
              ) : (
                <div className="folder-preview-panel-empty">
                  <div className="preview-panel-icon">
                    <EyeRegular />
                  </div>
                  <h3>תצוגה מקדימה</h3>
                  <p>בחר קובץ כדי לראות תצוגה מקדימה</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FolderPreview;
