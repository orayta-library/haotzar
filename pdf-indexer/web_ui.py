#!/usr/bin/env python3
"""
PDF Indexer - Web UI
Modern web interface for building PDF index
"""
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import sys
import json
import threading
import time
from pathlib import Path
import logging
from tkinter import Tk, filedialog

from pdf_extractor import PDFExtractor
from index_builder import IndexBuilder
from checkpoint_manager import CheckpointManager
from meili_uploader import MeiliUploader
from config import CHUNK_SIZE, FLUSH_EVERY, CHECKPOINT_FILE

app = Flask(__name__)
CORS(app)

# Global state
indexing_state = {
    'running': False,
    'progress': 0,
    'current_file': '',
    'processed': 0,
    'total': 0,
    'chunks': 0,
    'words': 0,
    'errors': [],
    'start_time': None,
    'elapsed': 0
}

indexing_thread = None


def find_files(books_dir: str) -> list:
    """Find all PDF and TXT files"""
    extensions = ['.pdf', '.txt']
    files = []
    for ext in extensions:
        files.extend(Path(books_dir).rglob(f'*{ext}'))
    return [str(f) for f in sorted(files)]


def process_file(file_path: str, builder: IndexBuilder, extractor: PDFExtractor, postings_map: dict):
    """Process a single file"""
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
            return 0, 0, False, "File too short or empty"
        
        # Build chunks and postings
        chunks, postings = builder.build_chunks_and_postings(file_id, text, pages)
        
        # Append chunks
        builder.append_chunks(chunks)
        
        # Merge postings
        for word, offsets in postings.items():
            if word not in postings_map:
                postings_map[word] = {}
            postings_map[word][file_id] = offsets
        
        return len(chunks), len(postings), True, None
        
    except Exception as e:
        return 0, 0, False, str(e)


def indexing_worker(books_dir: str, output_dir: str, flush_every: int, reset: bool, upload_meili: bool):
    """Background worker for indexing"""
    global indexing_state
    
    builder = None
    
    try:
        indexing_state['running'] = True
        indexing_state['start_time'] = time.time()
        indexing_state['errors'] = []
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Find files
        files = find_files(books_dir)
        indexing_state['total'] = len(files)
        
        if not files:
            indexing_state['errors'].append("No files found!")
            indexing_state['running'] = False
            return
        
        # Initialize components
        checkpoint_path = os.path.join(output_dir, CHECKPOINT_FILE)
        checkpoint = CheckpointManager(checkpoint_path)
        
        if reset:
            checkpoint.reset()
        
        builder = IndexBuilder(output_dir)
        extractor = PDFExtractor()
        
        # Get already processed count
        already_processed = len(checkpoint.get_processed_files())
        
        # Process files
        postings_map = {}
        processed_count = 0
        total_chunks = 0
        total_words = 0
        
        for i, file_path in enumerate(files):
            if not indexing_state['running']:
                # Save before stopping
                if postings_map:
                    builder.flush_postings(postings_map)
                    postings_map = {}
                break
            
            filename = os.path.basename(file_path)
            
            # Skip if already processed
            if checkpoint.is_processed(filename):
                indexing_state['processed'] = already_processed + processed_count
                indexing_state['progress'] = (indexing_state['processed'] / indexing_state['total']) * 100
                continue
            
            indexing_state['current_file'] = filename
            
            # Process file
            chunks_count, words_count, success, error = process_file(
                file_path, builder, extractor, postings_map
            )
            
            if success:
                total_chunks += chunks_count
                total_words += words_count
                processed_count += 1
                
                indexing_state['chunks'] = total_chunks
                indexing_state['words'] = total_words
                
                # Mark as processed
                checkpoint.mark_processed(filename, i)
                
                # Flush periodically
                if processed_count % flush_every == 0:
                    builder.flush_postings(postings_map)
                    postings_map = {}
            else:
                indexing_state['errors'].append(f"{filename}: {error}")
            
            indexing_state['processed'] = already_processed + processed_count
            indexing_state['progress'] = ((i + 1) / indexing_state['total']) * 100
            indexing_state['elapsed'] = time.time() - indexing_state['start_time']
        
        # Final flush
        if postings_map:
            builder.flush_postings(postings_map)
        
        # Mark as completed only if finished all files
        if indexing_state['running']:
            checkpoint.mark_completed()
            
            # Optimize database
            builder.vacuum()
            
            # Upload to Meilisearch
            if upload_meili:
                uploader = MeiliUploader()
                uploader.configure_index()
                uploader.upload_from_file(builder.chunks_path)
        
        indexing_state['elapsed'] = time.time() - indexing_state['start_time']
        
    except Exception as e:
        indexing_state['errors'].append(f"Fatal error: {str(e)}")
        # Try to save postings before crashing
        if builder and 'postings_map' in locals() and postings_map:
            try:
                builder.flush_postings(postings_map)
            except:
                pass
    finally:
        if builder:
            builder.close()
        indexing_state['running'] = False


@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')


@app.route('/api/status')
def get_status():
    """Get current indexing status"""
    return jsonify(indexing_state)


@app.route('/api/start', methods=['POST'])
def start_indexing():
    """Start indexing"""
    global indexing_thread
    
    if indexing_state['running']:
        return jsonify({'error': 'Indexing already running'}), 400
    
    data = request.json
    books_dir = data.get('books_dir', '../books')
    output_dir = data.get('output_dir', './index')
    flush_every = int(data.get('flush_every', FLUSH_EVERY))
    reset = data.get('reset', False)
    upload_meili = data.get('upload_meili', False)
    
    # Validate books directory
    if not os.path.exists(books_dir):
        return jsonify({'error': f'Directory not found: {books_dir}'}), 400
    
    # Start indexing in background
    indexing_thread = threading.Thread(
        target=indexing_worker,
        args=(books_dir, output_dir, flush_every, reset, upload_meili)
    )
    indexing_thread.daemon = True
    indexing_thread.start()
    
    return jsonify({'success': True, 'message': 'Indexing started'})


@app.route('/api/stop', methods=['POST'])
def stop_indexing():
    """Stop indexing"""
    if not indexing_state['running']:
        return jsonify({'error': 'No indexing in progress'}), 400
    
    indexing_state['running'] = False
    return jsonify({'success': True, 'message': 'Stopping indexing...'})


@app.route('/api/checkpoint')
def get_checkpoint():
    """Get checkpoint information"""
    output_dir = request.args.get('output_dir', './index')
    checkpoint_path = os.path.join(output_dir, CHECKPOINT_FILE)
    
    if not os.path.exists(checkpoint_path):
        return jsonify({'exists': False})
    
    checkpoint = CheckpointManager(checkpoint_path)
    
    # Count files in books directory
    books_dir = request.args.get('books_dir', '../books')
    total_files = len(find_files(books_dir)) if os.path.exists(books_dir) else 0
    
    progress = checkpoint.get_progress(total_files)
    
    return jsonify({
        'exists': True,
        'processed': progress['processed'],
        'total': progress['total'],
        'remaining': progress['remaining'],
        'percentage': progress['percentage'],
        'completed': progress['completed']
    })


@app.route('/api/browse', methods=['POST'])
def browse_directory():
    """Browse directory - returns only subdirectories"""
    data = request.json
    path = data.get('path', os.path.expanduser('~'))
    
    try:
        # Normalize path
        path = os.path.abspath(os.path.expanduser(path))
        
        if not os.path.exists(path):
            path = os.path.expanduser('~')
        
        if not os.path.isdir(path):
            path = os.path.dirname(path)
        
        items = []
        
        # Add parent directory
        parent = os.path.dirname(path)
        if parent != path:
            items.append({
                'name': '..',
                'path': parent,
                'type': 'directory'
            })
        
        # List directories only
        try:
            entries = os.listdir(path)
        except PermissionError:
            return jsonify({'error': 'אין הרשאה לגשת לתיקייה זו'}), 403
        
        for item in sorted(entries):
            item_path = os.path.join(path, item)
            try:
                if os.path.isdir(item_path) and not item.startswith('.'):
                    items.append({
                        'name': item,
                        'path': item_path,
                        'type': 'directory'
                    })
            except (PermissionError, OSError):
                # Skip items we can't access
                continue
        
        return jsonify({
            'current': path,
            'items': items
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 400


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 PDF Indexer - Web UI")
    print("=" * 60)
    print()
    print("📱 Open in browser: http://localhost:5000")
    print("⏹️  Press Ctrl+C to stop")
    print()
    
    # Disable Flask logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    
    app.run(host='0.0.0.0', port=5000, debug=False)
