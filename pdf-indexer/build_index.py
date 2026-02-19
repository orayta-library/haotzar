#!/usr/bin/env python3
"""
PDF Indexer - Main Script
Fast and memory-efficient PDF indexing for Hebrew books
"""
import os
import sys
import argparse
import logging
import time
from pathlib import Path
from typing import List
from tqdm import tqdm

from pdf_extractor import PDFExtractor
from text_processor import clean_text
from index_builder import IndexBuilder
from checkpoint_manager import CheckpointManager
from meili_uploader import MeiliUploader
from config import (
    CHUNK_SIZE, FLUSH_EVERY, SUPPORTED_EXTENSIONS,
    CHECKPOINT_FILE, LOG_FILE, LOG_LEVEL
)


def setup_logging(verbose: bool = False):
    """Setup logging configuration"""
    level = logging.DEBUG if verbose else getattr(logging, LOG_LEVEL)
    
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(LOG_FILE, encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )


def find_files(books_dir: str, skip_pdf: bool = False) -> List[str]:
    """Find all supported files recursively"""
    extensions = ['.txt'] if skip_pdf else SUPPORTED_EXTENSIONS
    files = []
    
    for ext in extensions:
        files.extend(Path(books_dir).rglob(f'*{ext}'))
    
    return [str(f) for f in sorted(files)]


def process_file(
    file_path: str,
    builder: IndexBuilder,
    extractor: PDFExtractor,
    postings_map: dict
) -> tuple:
    """
    Process a single file
    
    Returns:
        (chunks_count, words_count, success)
    """
    filename = os.path.basename(file_path)
    file_id = filename.rsplit('.', 1)[0]
    
    try:
        # Extract text
        if file_path.lower().endswith('.pdf'):
            result = extractor.extract_text(file_path)
            text = result['text']
            pages = result['pages']
        else:
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
            pages = [{'page_num': 1, 'start_offset': 0, 'end_offset': len(text)}]
        
        if not text or len(text) < 10:
            logging.warning(f"File too short or empty: {filename}")
            return 0, 0, False
        
        # Build chunks and postings
        chunks, postings = builder.build_chunks_and_postings(file_id, text, pages)
        
        # Append chunks to file
        builder.append_chunks(chunks)
        
        # Merge postings into map
        for word, offsets in postings.items():
            if word not in postings_map:
                postings_map[word] = {}
            postings_map[word][file_id] = offsets
        
        return len(chunks), len(postings), True
        
    except Exception as e:
        logging.error(f"Failed to process {filename}: {e}")
        return 0, 0, False


def main():
    parser = argparse.ArgumentParser(
        description='PDF Indexer - Fast Hebrew book indexing'
    )
    
    parser.add_argument(
        '--books-dir',
        required=True,
        help='Directory containing PDF/TXT files'
    )
    
    parser.add_argument(
        '--output-dir',
        default='./index',
        help='Output directory for index files'
    )
    
    parser.add_argument(
        '--chunk-size',
        type=int,
        default=CHUNK_SIZE,
        help=f'Chunk size in characters (default: {CHUNK_SIZE})'
    )
    
    parser.add_argument(
        '--flush-every',
        type=int,
        default=FLUSH_EVERY,
        help=f'Flush to DB every N files (default: {FLUSH_EVERY})'
    )
    
    parser.add_argument(
        '--max-files',
        type=int,
        default=0,
        help='Limit number of files to process (for testing)'
    )
    
    parser.add_argument(
        '--skip-pdf',
        action='store_true',
        help='Skip PDF files, process only TXT'
    )
    
    parser.add_argument(
        '--reset',
        action='store_true',
        help='Reset checkpoint and start from scratch'
    )
    
    parser.add_argument(
        '--upload-meili',
        action='store_true',
        help='Upload to Meilisearch after indexing'
    )
    
    parser.add_argument(
        '--meili-host',
        default='http://127.0.0.1:7700',
        help='Meilisearch host'
    )
    
    parser.add_argument(
        '--meili-index',
        default='books',
        help='Meilisearch index name'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    # Setup
    setup_logging(args.verbose)
    logger = logging.getLogger(__name__)
    
    print("🚀 PDF Indexer - Fast Hebrew Book Indexing")
    print("=" * 50)
    print(f"📂 Books directory: {args.books_dir}")
    print(f"💾 Output directory: {args.output_dir}")
    print(f"📏 Chunk size: {args.chunk_size}")
    print(f"💾 Flush every: {args.flush_every} files")
    print(f"📄 Skip PDF: {'YES' if args.skip_pdf else 'NO'}")
    print(f"🔄 Upload to Meili: {'YES' if args.upload_meili else 'NO'}")
    print()
    
    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Find files
    logger.info("Scanning for files...")
    files = find_files(args.books_dir, args.skip_pdf)
    
    if args.max_files and len(files) > args.max_files:
        logger.warning(f"Limiting to first {args.max_files} files for testing")
        files = files[:args.max_files]
    
    print(f"📋 Found {len(files)} files\n")
    
    if not files:
        print("❌ No files found!")
        return 1
    
    # Initialize components
    checkpoint_path = os.path.join(args.output_dir, CHECKPOINT_FILE)
    checkpoint = CheckpointManager(checkpoint_path)
    
    if args.reset:
        logger.info("Resetting checkpoint...")
        checkpoint.reset()
    
    # Check if already completed
    progress = checkpoint.get_progress(len(files))
    if progress['completed'] and progress['remaining'] == 0:
        print("✅ Indexing already completed!")
        print(f"💡 Use --reset to rebuild from scratch")
        return 0
    
    if progress['processed'] > 0:
        print(f"📍 Resuming from checkpoint:")
        print(f"   Already processed: {progress['processed']} files")
        print(f"   Remaining: {progress['remaining']} files")
        print(f"   Progress: {progress['percentage']:.1f}%\n")
    
    builder = IndexBuilder(args.output_dir)
    extractor = PDFExtractor()
    
    # Process files
    postings_map = {}
    processed_count = 0
    total_chunks = 0
    total_words = 0
    start_time = time.time()
    
    print("🔨 Processing files...\n")
    
    try:
        with tqdm(total=len(files), desc="Processing", unit="file") as pbar:
            for i, file_path in enumerate(files):
                filename = os.path.basename(file_path)
                
                # Skip if already processed
                if checkpoint.is_processed(filename):
                    pbar.update(1)
                    pbar.set_postfix_str(f"⏭️  {filename}")
                    continue
                
                pbar.set_postfix_str(f"📄 {filename}")
                
                # Process file
                chunks_count, words_count, success = process_file(
                    file_path,
                    builder,
                    extractor,
                    postings_map
                )
                
                if success:
                    total_chunks += chunks_count
                    total_words += words_count
                    processed_count += 1
                    
                    # Mark as processed
                    checkpoint.mark_processed(filename, i)
                    
                    # Flush periodically
                    if processed_count % args.flush_every == 0:
                        pbar.set_postfix_str(f"💾 Flushing {len(postings_map)} words...")
                        builder.flush_postings(postings_map)
                        postings_map = {}
                
                pbar.update(1)
        
        # Final flush
        if postings_map:
            print("\n💾 Final flush...")
            builder.flush_postings(postings_map)
        
        # Mark as completed
        checkpoint.mark_completed()
        
        # Optimize database
        print("🗜️  Optimizing database...")
        builder.vacuum()
        
        # Get stats
        stats = builder.get_stats()
        
        elapsed = time.time() - start_time
        
        print("\n" + "=" * 50)
        print("✅ Indexing completed!")
        print("=" * 50)
        print(f"⏱️  Time: {elapsed:.1f}s ({elapsed/60:.1f} minutes)")
        print(f"📊 Files processed: {processed_count}")
        print(f"📦 Total chunks: {stats['total_chunks']}")
        print(f"📝 Unique words: {stats['unique_words']}")
        print(f"💾 Database: {builder.db_path}")
        print(f"📄 Chunks file: {builder.chunks_path}")
        print()
        
        # Upload to Meilisearch
        if args.upload_meili:
            print("📤 Uploading to Meilisearch...")
            uploader = MeiliUploader(args.meili_host, args.meili_index)
            uploader.configure_index()
            uploader.upload_from_file(builder.chunks_path)
            
            meili_stats = uploader.get_stats()
            print(f"✓ Meilisearch: {meili_stats.get('documents', 0)} documents")
        
        print("\n🎉 Done!")
        
    except KeyboardInterrupt:
        print("\n\n⏸️  Interrupted by user")
        print("💾 Saving progress...")
        
        if postings_map:
            builder.flush_postings(postings_map)
        
        print(f"✅ Progress saved! Processed {processed_count} files")
        print(f"💡 Run again to resume from checkpoint")
        
        return 130
    
    finally:
        builder.close()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
