"""
Configuration for PDF Indexer
"""

# Meilisearch Settings
MEILI_HOST = "http://127.0.0.1:7700"
MEILI_INDEX = "books"
MEILI_BATCH_SIZE = 1000

# Processing Settings
CHUNK_SIZE = 2000  # characters per chunk
FLUSH_EVERY = 2    # flush to DB every N files
MAX_WORKERS = 4    # parallel processing (set to CPU cores)

# Hebrew Text Processing
REMOVE_NIKUD = True
MIN_WORD_LENGTH = 2
NIKUD_PATTERN = r'[\u0591-\u05C7]'

# File Processing
SUPPORTED_EXTENSIONS = ['.pdf', '.txt']
SKIP_PATTERNS = ['temp', 'backup', '.git']

# Database
DB_NAME = "posmap.db"
CHUNKS_FILE = "chunks.jsonl"
CHECKPOINT_FILE = "checkpoint.json"

# Performance
USE_COMPRESSION = True  # zstd compression for postings
COMPRESSION_LEVEL = 3   # 1-22, higher = better compression but slower

# Logging
LOG_LEVEL = "INFO"  # DEBUG, INFO, WARNING, ERROR
LOG_FILE = "indexer.log"
