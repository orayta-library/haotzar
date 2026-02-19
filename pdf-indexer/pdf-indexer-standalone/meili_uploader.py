"""
Meilisearch Uploader
"""
import json
from typing import List, Dict
import logging
from meilisearch import Client
from config import MEILI_HOST, MEILI_INDEX, MEILI_BATCH_SIZE

logger = logging.getLogger(__name__)


class MeiliUploader:
    """Upload chunks to Meilisearch"""
    
    def __init__(self, host: str = MEILI_HOST, index_name: str = MEILI_INDEX):
        self.client = Client(host)
        self.index = self.client.index(index_name)
        self.host = host
        self.index_name = index_name
        
        logger.info(f"Meilisearch uploader initialized: {host}/{index_name}")
    
    def upload_from_file(self, chunks_file: str):
        """
        Upload chunks from JSONL file
        
        Args:
            chunks_file: Path to chunks.jsonl file
        """
        logger.info(f"Loading chunks from {chunks_file}...")
        
        chunks = []
        with open(chunks_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    chunks.append(json.loads(line))
        
        logger.info(f"Loaded {len(chunks)} chunks")
        
        self.upload_chunks(chunks)
    
    def upload_chunks(self, chunks: List[Dict]):
        """
        Upload chunks to Meilisearch in batches
        
        Args:
            chunks: List of chunk dictionaries
        """
        total = len(chunks)
        uploaded = 0
        
        logger.info(f"Uploading {total} chunks in batches of {MEILI_BATCH_SIZE}...")
        
        for i in range(0, total, MEILI_BATCH_SIZE):
            batch = chunks[i:i + MEILI_BATCH_SIZE]
            
            # Prepare documents
            docs = [
                {
                    'id': chunk['id'],
                    'fileId': chunk['fileId'],
                    'safeFileId': chunk['safeFileId'],
                    'chunkId': chunk['chunkId'],
                    'chunkStart': chunk['chunkStart'],
                    'pageNum': chunk.get('pageNum', 1),
                    'text': chunk['text']
                }
                for chunk in batch
            ]
            
            # Upload batch
            try:
                task = self.index.add_documents(docs)
                uploaded += len(docs)
                
                progress = (uploaded / total) * 100
                logger.info(f"Uploaded batch {i//MEILI_BATCH_SIZE + 1}: {uploaded}/{total} ({progress:.1f}%)")
                
            except Exception as e:
                logger.error(f"Failed to upload batch {i//MEILI_BATCH_SIZE + 1}: {e}")
                raise
        
        logger.info(f"✓ Upload complete! {uploaded} documents uploaded")
    
    def configure_index(self):
        """Configure Meilisearch index settings"""
        logger.info("Configuring index settings...")
        
        try:
            # Searchable attributes
            self.index.update_searchable_attributes([
                'text',
                'fileId'
            ])
            
            # Filterable attributes
            self.index.update_filterable_attributes([
                'fileId',
                'pageNum',
                'safeFileId'
            ])
            
            # Sortable attributes
            self.index.update_sortable_attributes([
                'pageNum',
                'chunkId'
            ])
            
            # Display attributes
            self.index.update_displayed_attributes([
                'id',
                'fileId',
                'pageNum',
                'text'
            ])
            
            logger.info("✓ Index configured successfully")
            
        except Exception as e:
            logger.error(f"Failed to configure index: {e}")
            raise
    
    def get_stats(self) -> Dict:
        """Get index statistics"""
        try:
            stats = self.index.get_stats()
            return {
                'documents': stats.number_of_documents,
                'indexing': stats.is_indexing
            }
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {}
    
    def test_search(self, query: str, limit: int = 5) -> List[Dict]:
        """
        Test search functionality
        
        Args:
            query: Search query
            limit: Number of results
            
        Returns:
            List of search results
        """
        try:
            results = self.index.search(query, {'limit': limit})
            return results['hits']
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []


if __name__ == "__main__":
    # Test
    import sys
    
    logging.basicConfig(level=logging.INFO)
    
    if len(sys.argv) < 2:
        print("Usage: python meili_uploader.py <chunks_file>")
        sys.exit(1)
    
    uploader = MeiliUploader()
    
    # Configure index
    uploader.configure_index()
    
    # Upload chunks
    uploader.upload_from_file(sys.argv[1])
    
    # Get stats
    stats = uploader.get_stats()
    print(f"\nIndex stats: {stats}")
    
    # Test search
    print("\nTesting search with 'שבת'...")
    results = uploader.test_search('שבת', limit=3)
    for i, result in enumerate(results, 1):
        print(f"\n{i}. {result['fileId']} - Page {result['pageNum']}")
        print(f"   {result['text'][:100]}...")
