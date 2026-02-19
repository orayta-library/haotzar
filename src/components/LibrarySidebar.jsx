import { useState, useMemo } from 'react';
import { 
  DocumentRegular,
  ChevronDownRegular,
  ChevronLeftRegular,
  FolderRegular,
  FolderOpenRegular,
  DismissRegular,
  PinRegular,
  PinOffRegular,
  HistoryRegular,
} from '@fluentui/react-icons';
import './LibrarySidebar.css';
import { buildOtzariaVirtualTree } from '../utils/otzariaIntegration';

const LibrarySidebar = ({ allFiles, pinnedBooks = [], onFileClick, onUnpinBook, isOpen = true, recentBooks = [], onFolderClick, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  // טיפול בלחיצה על קובץ - תמיד פותח כרטיסייה חדשה
  const handleFileClick = (file) => {
    onFileClick(file);
  };

  // טיפול בלחיצה על תיקיה - פתיחת תצוגה מקדימה
  const handleFolderClickAction = (node) => {
    if (onFolderClick) {
      onFolderClick(node);
    }
  };

  // בניית עץ מרשימת קבצים - תומך בתיקיות מרובות
  const buildTree = (filesList) => {
    const root = {
      name: 'ספרייה',
      type: 'folder',
      path: 'root',
      children: [],
      isVirtual: false
    };

    // הוספת תיקיות וירטואליות בתחילת העץ
    const virtualFolders = [];

    // תיקיית אוצריא (אם יש חיבור למסד הנתונים)
    console.log('🔍 LibrarySidebar: מנסה לבנות עץ אוצריא...');
    const otzariaTree = buildOtzariaVirtualTree();
    console.log('📊 LibrarySidebar: תוצאת buildOtzariaVirtualTree:', otzariaTree);
    if (otzariaTree) {
      console.log('✅ LibrarySidebar: מוסיף תיקיית אוצריא עם', otzariaTree.children?.length, 'ילדים');
      virtualFolders.push(otzariaTree);
    } else {
      console.warn('⚠️ LibrarySidebar: לא התקבל עץ אוצריא');
    }

    // תיקיית היסטוריה
    if (recentBooks && recentBooks.length > 0) {
      virtualFolders.push({
        name: 'היסטוריה',
        type: 'folder',
        path: 'virtual-history',
        isVirtual: true,
        virtualType: 'history',
        children: recentBooks.map((book, index) => ({
          name: book.name,
          type: 'file',
          path: book.path,
          fullData: book,
          isVirtual: true
        }))
      });
    }

    // תיקיית ספרים מוצמדים (אם יש)
    if (pinnedBooks && pinnedBooks.length > 0) {
      virtualFolders.push({
        name: 'מוצמדים',
        type: 'folder',
        path: 'virtual-pinned',
        isVirtual: true,
        virtualType: 'pinned',
        children: pinnedBooks.map((book, index) => ({
          name: book.name,
          type: 'file',
          path: book.path,
          fullData: book,
          isVirtual: true
        }))
      });
    }

    // מצא את התיקייה הראשונה המשותפת לכל הקבצים מכל תיקייה
    const folderRoots = new Map(); // מפה של תיקיות ראשיות לקבצים שלהן
    
    filesList.forEach(file => {
      const normalizedPath = file.path.replace(/\\/g, '/');
      
      // אם הנתיב מכיל 'books/', זו תיקיית books הרגילה
      const booksIndex = normalizedPath.indexOf('books/');
      if (booksIndex !== -1) {
        const afterBooks = normalizedPath.substring(booksIndex + 'books/'.length);
        const rawParts = afterBooks.split('/').filter(p => p);
        
        if (rawParts.length > 0) {
          const isFileDirectlyInBooks = rawParts.length === 1;
          const rootFolder = isFileDirectlyInBooks ? 'books' : rawParts[0]; // התיקייה הראשונה אחרי books
          if (!folderRoots.has(rootFolder)) {
            folderRoots.set(rootFolder, []);
          }
          folderRoots.get(rootFolder).push({
            file,
            parts: isFileDirectlyInBooks ? rawParts : rawParts.slice(1) // כל השאר אחרי התיקייה הראשונה
          });
        }
      } else {
        // תיקייה מותאמת - קח את שם התיקייה האחרונה בנתיב (לפני הקבצים)
        const pathParts = normalizedPath.split('/');
        
        // מצא את התיקייה האחרונה שמכילה תתי-תיקיות או קבצים
        // נתחיל מהסוף ונחפש את התיקייה הראשונה שיש בה יותר מקובץ אחד
        let rootFolderIndex = -1;
        
        // אם יש לפחות 2 חלקים (תיקייה + קובץ), קח את התיקייה האחרונה לפני הקובץ
        if (pathParts.length >= 2) {
          // אם הקובץ נמצא ישירות בתיקייה (ללא תתי-תיקיות)
          if (pathParts.length === 2 || 
              (pathParts.length === 3 && (pathParts[0].includes(':') || pathParts[0] === ''))) {
            // קח את התיקייה האחרונה
            rootFolderIndex = pathParts.length - 2;
          } else {
            // יש תתי-תיקיות - חפש את התיקייה הראשונה שאינה תיקיית מערכת
            for (let i = 0; i < pathParts.length - 1; i++) {
              const part = pathParts[i].toLowerCase();
              // דלג על תיקיות מערכת וכוננים
              if (part && part !== 'c:' && part !== 'd:' && part !== 'e:' && 
                  part !== 'users' && part !== 'user' && 
                  part !== 'documents' && part !== 'downloads' && part !== 'desktop' &&
                  !part.includes('appdata') && !part.includes('program') && part !== '') {
                rootFolderIndex = i;
                break;
              }
            }
          }
        }
        
        if (rootFolderIndex !== -1 && rootFolderIndex < pathParts.length) {
          const rootFolder = pathParts[rootFolderIndex];
          if (!folderRoots.has(rootFolder)) {
            folderRoots.set(rootFolder, []);
          }
          folderRoots.get(rootFolder).push({
            file,
            parts: pathParts.slice(rootFolderIndex + 1) // כל השאר אחרי התיקייה הראשונה
          });
        }
      }
    });

    // בנה את העץ מהתיקיות הראשיות
    folderRoots.forEach((files, rootFolderName) => {
      const rootFolder = {
        name: rootFolderName,
        type: 'folder',
        path: `root/${rootFolderName}`,
        children: []
      };
      
      files.forEach(({ file, parts }) => {
        let currentLevel = rootFolder.children;
        let currentPath = `root/${rootFolderName}`;
        
        parts.forEach((part, index) => {
          currentPath += '/' + part;
          const isLastPart = index === parts.length - 1;
          
          if (isLastPart) {
            // זה קובץ
            currentLevel.push({
              name: file.name,
              type: 'file',
              path: file.path,
              fullData: file
            });
          } else {
            // זו תיקייה
            let folder = currentLevel.find(item => item.name === part && item.type === 'folder');
            
            if (!folder) {
              folder = {
                name: part,
                type: 'folder',
                path: currentPath,
                children: []
              };
              currentLevel.push(folder);
            }
            
            currentLevel = folder.children;
          }
        });
      });
      
      root.children.push(rootFolder);
    });

    // מיון
    const sortNodes = (nodes) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name, 'he');
      });
      
      nodes.forEach(node => {
        if (node.type === 'folder' && node.children) {
          sortNodes(node.children);
        }
      });
    };

    sortNodes(root.children);
    
    // הוסף תיקיות וירטואליות בתחילה
    root.children = [...virtualFolders, ...root.children];
    
    return root;
  };

  // סינון עץ לפי חיפוש
  const filterTree = (node, term) => {
    if (!term) return node;
    
    const lowerTerm = term.toLowerCase();
    
    if (node.type === 'file') {
      return node.name.toLowerCase().includes(lowerTerm) ? node : null;
    }
    
    const filteredChildren = node.children
      .map(child => filterTree(child, term))
      .filter(child => child !== null);
    
    if (filteredChildren.length > 0 || node.name.toLowerCase().includes(lowerTerm)) {
      return {
        ...node,
        children: filteredChildren
      };
    }
    
    return null;
  };

  // טיפול בלחיצה על חץ - רק הרחבה/כיווץ
  const toggleFolderExpand = (folderPath) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  // רינדור צומת בעץ
  const renderNode = (node, level = 0) => {
    const isFolder = node.type === 'folder';
    const isExpanded = expandedFolders.has(node.path) || searchQuery;
    const hasChildren = isFolder && node.children && node.children.length > 0;

    return (
      <div key={node.path} className="sidebar-tree-node">
        <div 
          className={`sidebar-tree-item ${isFolder ? 'folder' : 'file'}`}
          style={{ paddingRight: `${level * 20 + 12}px` }}
        >
          {isFolder && hasChildren && (
            <span 
              className="sidebar-tree-chevron"
              onClick={(e) => {
                e.stopPropagation();
                toggleFolderExpand(node.path);
              }}
            >
              {isExpanded ? <ChevronDownRegular /> : <ChevronLeftRegular />}
            </span>
          )}
          
          <span 
            className="sidebar-tree-icon"
            onClick={() => {
              if (isFolder) {
                handleFolderClickAction(node);
              } else {
                handleFileClick(node.fullData);
              }
            }}
          >
            {isFolder ? (
              node.isVirtual && node.virtualType === 'history' ? (
                <HistoryRegular />
              ) : node.isVirtual && node.virtualType === 'pinned' ? (
                <PinRegular />
              ) : (
                isExpanded ? <FolderOpenRegular /> : <FolderRegular />
              )
            ) : (
              <DocumentRegular />
            )}
          </span>
          
          <span 
            className="sidebar-tree-label"
            onClick={() => {
              if (isFolder) {
                handleFolderClickAction(node);
              } else {
                handleFileClick(node.fullData);
              }
            }}
          >
            {node.name}
          </span>
          
          {isFolder && hasChildren && (
            <span className="sidebar-tree-count">{node.children.length}</span>
          )}
        </div>
        
        {isFolder && isExpanded && hasChildren && (
          <div className="sidebar-tree-children">
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // בניית העץ עם useMemo - רק כאשר allFiles, recentBooks או pinnedBooks משתנים
  const tree = useMemo(() => {
    console.log('🔄 LibrarySidebar: בונה עץ מחדש (useMemo)');
    return buildTree(allFiles);
  }, [allFiles, recentBooks, pinnedBooks]);
  
  const filteredTree = searchQuery ? filterTree(tree, searchQuery) : tree;

  return (
    <div className={`library-sidebar ${!isOpen ? 'collapsed' : ''}`}>
      <div className="library-sidebar-search-wrapper">
        <button
          className="library-sidebar-close"
          onClick={() => {
            if (onClose) onClose();
          }}
          aria-label="סגור ספרייה"
          title="סגור"
          type="button"
        >
          <DismissRegular />
        </button>
        <input
          type="text"
          placeholder="חיפוש בספרייה..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="library-sidebar-search-input"
        />
        {searchQuery && (
          <button
            className="library-sidebar-clear-search"
            onClick={() => setSearchQuery('')}
            aria-label="נקה חיפוש"
          >
            ×
          </button>
        )}
      </div>

      <div className="library-sidebar-content">
        {/* ספרים מוצמדים */}
        {pinnedBooks && pinnedBooks.length > 0 && !searchQuery && (
          <div className="pinned-books-section">
            {pinnedBooks.map((book) => (
              <div
                key={`pinned-${book.id}`}
                className="sidebar-tree-item file pinned-book-item"
                style={{ paddingRight: '12px' }}
                onClick={() => handleFileClick(book)}
              >
                <span className="pinned-icon">
                  <PinRegular />
                </span>
                <span className="sidebar-tree-icon">
                  <DocumentRegular />
                </span>
                <span className="sidebar-tree-label">{book.name}</span>
                <button
                  className="unpin-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnpinBook(book.id);
                  }}
                  title="בטל הצמדה"
                  aria-label="בטל הצמדה"
                >
                  <PinOffRegular style={{ fontSize: '14px' }} />
                </button>
              </div>
            ))}
            <div className="pinned-books-divider"></div>
          </div>
        )}
        
        {/* עץ הספרייה */}
        {filteredTree && filteredTree.children && filteredTree.children.length > 0 ? (
          filteredTree.children.map(child => renderNode(child, 0))
        ) : (
          <div className="library-sidebar-empty">
            {searchQuery ? 'לא נמצאו תוצאות' : 'אין ספרים זמינים'}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibrarySidebar;
