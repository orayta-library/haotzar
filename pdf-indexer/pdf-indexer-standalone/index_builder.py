"""
Index Builder - Core indexing logic
"""
import sqlite3
import json
import zstandard as zstd
from typing import Dict, List, Tuple
import logging
from text_processor import tokenize_with_offsets, clean_text
from config import (
    CHUNK_SIZE, USE_COMPRESSION, COMPRESSION_LEVEL,
    DB_NAME, CHUNKS_FILE
)

logger = logging.getLogger(__name__)


class IndexBuilder:
    """Build inverted index with SQLite backend"""
    
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        self.db_path = f"{output_dir}/{DB_NAME}"
        self.chunks_path = f"{output_dir}/{CHUNKS_FILE}"
        self.db = None
        self.compressor = zstd.ZstdCompressor(level=COMPRESSION_LEVEL) if USE_COMPRESSION else None
        self.decompressor = zstd.ZstdDecompressor() if USE_COMPRESSION else None
        
        self._init_db()
    
    def _init_db(self):
        """Initialize SQLite database"""
        self.db = sqlite3.connect(self.db_path)
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                word TEXT PRIMARY KEY,
                postings BLOB
            )
        """)
        self.db.execute("CREATE INDEX IF NOT EXISTS idx_word ON posts(word)")
        self.db.commit()
        
        logger.info(f"Database initialized: {self.db_path}")
    
    def build_chunks_and_postings(
        self,
        file_id: str,
        text: str,
        pages: List[Dict]
    ) -> Tuple[List[Dict], Dict[str, List[int]]]:
        """
        Build chunks and postings for a file
        
        Args:
            file_id: File identifier
            text: Full text content
            pages: Page information
            
        Returns:
            (chunks, postings_map)
        """
        text = clean_text(text)
        chunks = []
        postings = {}
        
        # Safe file ID for Meilisearch
        safe_file_id = file_id.replace('.', '_').replace('/', '_')[:50]
        
        chunk_id = 0
        for start in range(0, len(text), CHUNK_SIZE):
            end = min(len(text), start + CHUNK_SIZE)
            chunk_text = text[start:end]
            
            # Find page number for this chunk
            page_num = self._get_page_for_offset(pages, start)
            
            # Create chunk
            chunks.append({
                'id': f"{safe_file_id}_{chunk_id}",
                'fileId': file_id,
                'safeFileId': safe_file_id,
                'chunkId': chunk_id,
                'chunkStart': start,
                'pageNum': page_num,
                'text': chunk_text[:200]  # Only first 200 chars for preview
            })
            
            # Tokenize and build postings
            tokens = tokenize_with_offsets(chunk_text)
            for token, offset, length in tokens:
                if token not in postings:
                    postings[token] = []
                postings[token].append(start + offset)
            
            chunk_id += 1
        
        logger.debug(f"Built {len(chunks)} chunks, {len(postings)} unique words for {file_id}")
        
        return chunks, postings
    
    def _get_page_for_offset(self, pages: List[Dict], offset: int) -> int:
        """Get page number for text offset"""
        if not pages:
            return 1
        
        for page in pages:
            if page['start_offset'] <= offset < page['end_offset']:
                return page['page_num']
        
        return pages[-1]['page_num']
    
    def append_chunks(self, chunks: List[Dict]):
        """Append chunks to JSONL file"""
        with open(self.chunks_path, 'a', encoding='utf-8') as f:
            for chunk in chunks:
                f.write(json.dumps(chunk, ensure_ascii=False) + '\n')
    
    def flush_postings(self, postings_map: Dict[str, Dict[str, List[int]]]):
        """
        Flush postings to database
        
        Args:
            postings_map: {word: {file_id: [offsets]}}
        """
        cursor = self.db.cursor()
        
        for word, file_postings in postings_map.items():
            # Get existing postings
            cursor.execute("SELECT postings FROM posts WHERE word = ?", (word,))
            row = cursor.fetchone()
            
            if row:
                # Merge with existing
                existing_data = self._decompress(row[0])
                existing = json.loads(existing_data)
                
                for file_id, offsets in file_postings.items():
                    if file_id in existing:
                        existing[file_id].extend(offsets)
                        existing[file_id].sort()
                        existing[file_id] = self._delta_encode(existing[file_id])
                    else:
                        existing[file_id] = self._delta_encode(sorted(offsets))
                
                merged = existing
            else:
                # New word
                merged = {
                    file_id: self._delta_encode(sorted(offsets))
                    for file_id, offsets in file_postings.items()
                }
            
            # Compress and store
            data = json.dumps(merged, ensure_ascii=False)
            compressed = self._compress(data)
            
            cursor.execute(
                "INSERT OR REPLACE INTO posts (word, postings) VALUES (?, ?)",
                (word, compressed)
            )
        
        self.db.commit()
        logger.debug(f"Flushed {len(postings_map)} words to database")
    
    def _delta_encode(self, arr: List[int]) -> List[int]:
        """Delta encode array for compression"""
        if not arr:
            return []
        
        result = [arr[0]]
        for i in range(1, len(arr)):
            result.append(arr[i] - arr[i-1])
        
        return result
    
    def _compress(self, data: str) -> bytes:
        """Compress data"""
        if USE_COMPRESSION:
            return self.compressor.compress(data.encode('utf-8'))
        return data.encode('utf-8')
    
    def _decompress(self, data: bytes) -> str:
        """Decompress data"""
        if USE_COMPRESSION:
            return self.decompressor.decompress(data).decode('utf-8')
        return data.decode('utf-8')
    
    def vacuum(self):
        """Optimize database"""
        logger.info("Running VACUUM on database...")
        self.db.execute("VACUUM")
        self.db.commit()
    
    def close(self):
        """Close database connection"""
        if self.db:
            self.db.close()
            logger.info("Database closed")
    
    def get_stats(self) -> Dict:
        """Get index statistics"""
        cursor = self.db.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM posts")
        word_count = cursor.fetchone()[0]
        
        # Count chunks
        chunk_count = 0
        try:
            with open(self.chunks_path, 'r', encoding='utf-8') as f:
                chunk_count = sum(1 for _ in f)
        except FileNotFoundError:
            pass
        
        return {
            'unique_words': word_count,
            'total_chunks': chunk_count
        }


if __name__ == "__main__":
    # Test
    import os
    import tempfile
    
    logging.basicConfig(level=logging.DEBUG)
    
    with tempfile.TemporaryDirectory() as tmpdir:
        builder = IndexBuilder(tmpdir)
        
        # Test data
        test_text = "שלום עולם! " * 100
        test_pages = [
            {'page_num': 1, 'start_offset': 0, 'end_offset': len(test_text)}
        ]
        
        chunks, postings = builder.build_chunks_and_postings(
            "test.pdf",
            test_text,
            test_pages
        )
        
        print(f"Chunks: {len(chunks)}")
        print(f"Unique words: {len(postings)}")
        
        builder.append_chunks(chunks)
        builder.flush_postings({'test.pdf': postings})
        
        stats = builder.get_stats()
        print(f"Stats: {stats}")
        
        builder.close()
