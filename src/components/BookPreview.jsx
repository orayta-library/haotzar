import { useState } from 'react';
import { DismissRegular } from '@fluentui/react-icons';
import PDFViewer from '../PDFViewer';
import TextViewer from '../TextViewer';
import './BookPreview.css';

const BookPreview = ({ selectedBook, onClose }) => {
  if (!selectedBook) {
    return (
      <div className="book-preview-container empty">
        <div className="preview-empty-state">
          <p>בחר ספר מהספרייה לתצוגה מקדימה</p>
        </div>
      </div>
    );
  }

  return (
    <div className="book-preview-container">
      <div className="preview-header">
        <h3 className="preview-title">{selectedBook.name}</h3>
        <button className="preview-close-btn" onClick={onClose} title="סגור תצוגה מקדימה">
          <DismissRegular />
        </button>
      </div>
      
      <div className="preview-content">
        {selectedBook.type === 'pdf' ? (
          <PDFViewer 
            pdfPath={selectedBook.path} 
            title={selectedBook.name}
            isPreviewMode={true}
          />
        ) : (
          <TextViewer textPath={selectedBook.path} title={selectedBook.name} />
        )}
      </div>
    </div>
  );
};

export default BookPreview;
