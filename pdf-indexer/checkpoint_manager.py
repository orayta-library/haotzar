"""
Checkpoint Manager - Resume support
"""
import json
import os
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


class CheckpointManager:
    """Manage indexing checkpoints for resume support"""
    
    def __init__(self, checkpoint_path: str):
        self.checkpoint_path = checkpoint_path
        self.checkpoint = self._load()
    
    def _load(self) -> Dict:
        """Load checkpoint from file"""
        if os.path.exists(self.checkpoint_path):
            try:
                with open(self.checkpoint_path, 'r', encoding='utf-8') as f:
                    checkpoint = json.load(f)
                    logger.info(f"Loaded checkpoint: {len(checkpoint.get('processedFiles', []))} files processed")
                    return checkpoint
            except Exception as e:
                logger.error(f"Failed to load checkpoint: {e}")
        
        return {
            'lastProcessedIndex': -1,
            'processedFiles': [],
            'completed': False
        }
    
    def save(self):
        """Save checkpoint to file"""
        try:
            with open(self.checkpoint_path, 'w', encoding='utf-8') as f:
                json.dump(self.checkpoint, f, ensure_ascii=False, indent=2)
            logger.debug("Checkpoint saved")
        except Exception as e:
            logger.error(f"Failed to save checkpoint: {e}")
    
    def is_processed(self, filename: str) -> bool:
        """Check if file was already processed"""
        return filename in self.checkpoint['processedFiles']
    
    def mark_processed(self, filename: str, index: int):
        """Mark file as processed"""
        self.checkpoint['processedFiles'].append(filename)
        self.checkpoint['lastProcessedIndex'] = index
        self.save()
    
    def mark_completed(self):
        """Mark indexing as completed"""
        self.checkpoint['completed'] = True
        self.save()
        logger.info("Indexing marked as completed")
    
    def reset(self):
        """Reset checkpoint"""
        self.checkpoint = {
            'lastProcessedIndex': -1,
            'processedFiles': [],
            'completed': False
        }
        self.save()
        logger.info("Checkpoint reset")
    
    def get_progress(self, total_files: int) -> Dict:
        """Get progress information"""
        processed = len(self.checkpoint['processedFiles'])
        remaining = total_files - processed
        percentage = (processed / total_files * 100) if total_files > 0 else 0
        
        return {
            'processed': processed,
            'remaining': remaining,
            'total': total_files,
            'percentage': percentage,
            'completed': self.checkpoint['completed']
        }
    
    def should_skip(self, filename: str) -> bool:
        """Check if file should be skipped"""
        return self.is_processed(filename)
    
    def get_processed_files(self) -> List[str]:
        """Get list of processed files"""
        return self.checkpoint['processedFiles'].copy()


if __name__ == "__main__":
    # Test
    import tempfile
    
    logging.basicConfig(level=logging.DEBUG)
    
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as f:
        checkpoint_path = f.name
    
    try:
        manager = CheckpointManager(checkpoint_path)
        
        # Test operations
        print("Initial state:", manager.checkpoint)
        
        manager.mark_processed("file1.pdf", 0)
        manager.mark_processed("file2.pdf", 1)
        
        print("After processing 2 files:", manager.checkpoint)
        print("Is file1.pdf processed?", manager.is_processed("file1.pdf"))
        print("Is file3.pdf processed?", manager.is_processed("file3.pdf"))
        
        progress = manager.get_progress(10)
        print("Progress:", progress)
        
        manager.mark_completed()
        print("Final state:", manager.checkpoint)
        
    finally:
        os.unlink(checkpoint_path)
