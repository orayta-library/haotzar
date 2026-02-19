import { useState } from 'react';
import {
  SearchRegular,
  PrintRegular,
  ChevronRightRegular,
  ChevronLeftRegular,
  PanelRightContractRegular,
  PanelRightExpandRegular,
  ZoomInRegular,
  ZoomOutRegular,
  PanelLeftRegular
} from '@fluentui/react-icons';
import './TextViewerTopBar.css';

const TextViewerTopBar = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  onNextPage, 
  onPrevPage, 
  isToolbarCollapsed, 
  onToggleToolbar,
  onZoomIn,
  onZoomOut,
  onSearch,
  onToggleOutline,
  outlineCount = 0
}) => {
  const [pageInput, setPageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const handleOpenSearch = () => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      setTimeout(() => {
        document.querySelector('.text-search-input')?.focus();
      }, 100);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      if (onSearch) {
        onSearch(searchQuery);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePageInputChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setPageInput(value);
    }
  };

  const handlePageInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      const pageNum = parseInt(pageInput);
      if (pageNum >= 1 && pageNum <= totalPages) {
        onPageChange(pageNum);
        setPageInput('');
      }
    }
  };

  const handlePageInputBlur = () => {
    const pageNum = parseInt(pageInput);
    if (pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
    }
    setPageInput('');
  };

  return (
    <div className="text-viewer-top-bar">
      <div className="text-viewer-top-bar-right">
        <button
          className="text-viewer-top-bar-btn"
          onClick={onToggleOutline}
          title={`תוכן עניינים (${outlineCount} פריטים)`}
        >
          <PanelLeftRegular />
        </button>

        <button
          className="text-viewer-top-bar-btn"
          onClick={handleOpenSearch}
          title="חיפוש (Ctrl F)"
        >
          <SearchRegular />
        </button>

        {showSearch && (
          <div className="text-search-box">
            <input
              type="text"
              className="text-search-input"
              placeholder="חפש בטקסט..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
            />
            <button
              className="text-search-close"
              onClick={() => setShowSearch(false)}
              title="סגור"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="text-page-controls">
        <button
          className="text-page-nav-btn"
          onClick={onPrevPage}
          disabled={currentPage <= 1}
          title="עמוד קודם (←)"
        >
          <ChevronLeftRegular />
        </button>
        
        <input
          type="text"
          className="text-page-input"
          placeholder={currentPage.toString()}
          value={pageInput}
          onChange={handlePageInputChange}
          onKeyDown={handlePageInputKeyDown}
          onBlur={handlePageInputBlur}
          title="מספר עמוד"
        />
        <span className="text-page-separator">/</span>
        <span className="text-page-total">{totalPages}</span>
        
        <button
          className="text-page-nav-btn"
          onClick={onNextPage}
          disabled={currentPage >= totalPages}
          title="עמוד הבא (→)"
        >
          <ChevronRightRegular />
        </button>
      </div>

      <div className="text-viewer-top-bar-left">
        <div className="text-zoom-controls">
          <button
            className="text-viewer-top-bar-btn text-zoom-btn"
            onClick={onZoomOut}
            title="הקטן (Ctrl -)"
          >
            <ZoomOutRegular />
          </button>
          
          <button
            className="text-viewer-top-bar-btn text-zoom-btn"
            onClick={onZoomIn}
            title="הגדל (Ctrl +)"
          >
            <ZoomInRegular />
          </button>
        </div>
        
        <button
          className="text-viewer-top-bar-btn"
          onClick={handlePrint}
          title="הדפס (Ctrl P)"
        >
          <PrintRegular />
        </button>
        
        <button
          className="text-viewer-top-bar-btn text-toolbar-toggle-btn"
          onClick={onToggleToolbar}
          title={isToolbarCollapsed ? 'הצג סרגל כלים' : 'הסתר סרגל כלים'}
        >
          {isToolbarCollapsed ? <PanelRightExpandRegular /> : <PanelRightContractRegular />}
        </button>
      </div>
    </div>
  );
};

export default TextViewerTopBar;
