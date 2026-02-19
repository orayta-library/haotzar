"""
PDF Text Extraction with page numbers
"""
import fitz  # PyMuPDF - fastest
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class PDFExtractor:
    """Extract text from PDF with page information"""
    
    def __init__(self):
        self.current_file = None
    
    def extract_text(self, pdf_path: str) -> Dict:
        """
        Extract text from PDF with page information
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            {
                'text': str,  # Full text
                'pages': [    # Page information
                    {
                        'page_num': int,
                        'text': str,
                        'start_offset': int,
                        'end_offset': int
                    }
                ]
            }
        """
        self.current_file = pdf_path
        
        try:
            return self._extract_with_pymupdf(pdf_path)
        except Exception as e:
            logger.error(f"PyMuPDF failed for {pdf_path}: {e}")
            try:
                return self._extract_with_pypdf2(pdf_path)
            except Exception as e2:
                logger.error(f"PyPDF2 also failed for {pdf_path}: {e2}")
                return {'text': '', 'pages': []}
    
    def _extract_with_pymupdf(self, pdf_path: str) -> Dict:
        """Extract using PyMuPDF (fastest)"""
        doc = fitz.open(pdf_path)
        
        pages = []
        full_text = ''
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            page_text = page.get_text() + '\n'
            
            pages.append({
                'page_num': page_num + 1,
                'text': page_text,
                'start_offset': len(full_text),
                'end_offset': len(full_text) + len(page_text)
            })
            
            full_text += page_text
        
        doc.close()
        
        logger.debug(f"Extracted {len(pages)} pages from {pdf_path}")
        
        return {
            'text': full_text,
            'pages': pages
        }
    
    def _extract_with_pypdf2(self, pdf_path: str) -> Dict:
        """Fallback: Extract using PyPDF2"""
        import PyPDF2
        
        pages = []
        full_text = ''
        
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            
            for page_num in range(len(reader.pages)):
                page = reader.pages[page_num]
                page_text = page.extract_text() + '\n'
                
                pages.append({
                    'page_num': page_num + 1,
                    'text': page_text,
                    'start_offset': len(full_text),
                    'end_offset': len(full_text) + len(page_text)
                })
                
                full_text += page_text
        
        logger.debug(f"Extracted {len(pages)} pages from {pdf_path} (PyPDF2)")
        
        return {
            'text': full_text,
            'pages': pages
        }
    
    def get_page_for_offset(self, pages: List[Dict], offset: int) -> int:
        """Get page number for a given text offset"""
        for page in pages:
            if page['start_offset'] <= offset < page['end_offset']:
                return page['page_num']
        
        # Default to last page if offset is beyond
        return pages[-1]['page_num'] if pages else 1


if __name__ == "__main__":
    # Test
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python pdf_extractor.py <pdf_file>")
        sys.exit(1)
    
    logging.basicConfig(level=logging.DEBUG)
    
    extractor = PDFExtractor()
    result = extractor.extract_text(sys.argv[1])
    
    print(f"Extracted {len(result['text'])} characters")
    print(f"Pages: {len(result['pages'])}")
    print(f"\nFirst 500 characters:")
    print(result['text'][:500])
