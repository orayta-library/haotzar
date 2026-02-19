#!/usr/bin/env python3
"""
Example: Search in indexed books using Meilisearch
"""
from meilisearch import Client
import sys


def search_books(query: str, limit: int = 10):
    """
    Search for a query in indexed books
    
    Args:
        query: Search query (Hebrew or English)
        limit: Number of results to return
    """
    # Connect to Meilisearch
    client = Client('http://127.0.0.1:7700')
    index = client.index('books')
    
    print(f"🔍 Searching for: '{query}'")
    print("=" * 60)
    
    # Search
    results = index.search(query, {
        'limit': limit,
        'attributesToHighlight': ['text'],
        'highlightPreTag': '**',
        'highlightPostTag': '**'
    })
    
    hits = results['hits']
    total = results['estimatedTotalHits']
    
    print(f"\nFound {total} results (showing {len(hits)}):\n")
    
    # Display results
    for i, hit in enumerate(hits, 1):
        print(f"{i}. 📖 {hit['fileId']}")
        print(f"   📄 Page: {hit['pageNum']}")
        print(f"   📍 Chunk: {hit['chunkId']}")
        
        # Show highlighted text
        if '_formatted' in hit and 'text' in hit['_formatted']:
            text = hit['_formatted']['text']
        else:
            text = hit['text']
        
        # Truncate if too long
        if len(text) > 200:
            text = text[:200] + "..."
        
        print(f"   📝 {text}")
        print()


def search_in_file(query: str, file_id: str, limit: int = 5):
    """
    Search within a specific file
    
    Args:
        query: Search query
        file_id: File identifier (without extension)
        limit: Number of results
    """
    client = Client('http://127.0.0.1:7700')
    index = client.index('books')
    
    print(f"🔍 Searching for '{query}' in '{file_id}'")
    print("=" * 60)
    
    # Search with filter
    results = index.search(query, {
        'limit': limit,
        'filter': f'fileId = "{file_id}"',
        'attributesToHighlight': ['text']
    })
    
    hits = results['hits']
    
    if not hits:
        print(f"\n❌ No results found in {file_id}")
        return
    
    print(f"\nFound {len(hits)} results:\n")
    
    for i, hit in enumerate(hits, 1):
        print(f"{i}. Page {hit['pageNum']} - Chunk {hit['chunkId']}")
        text = hit.get('_formatted', {}).get('text', hit['text'])
        if len(text) > 150:
            text = text[:150] + "..."
        print(f"   {text}")
        print()


def get_index_stats():
    """Get statistics about the index"""
    client = Client('http://127.0.0.1:7700')
    index = client.index('books')
    
    stats = index.get_stats()
    
    print("📊 Index Statistics")
    print("=" * 60)
    print(f"Documents: {stats.number_of_documents:,}")
    print(f"Indexing: {'Yes' if stats.is_indexing else 'No'}")
    print()


def list_files():
    """List all indexed files"""
    client = Client('http://127.0.0.1:7700')
    index = client.index('books')
    
    # Get unique file IDs using facet search
    results = index.search('', {
        'limit': 0,
        'facets': ['fileId']
    })
    
    if 'facetDistribution' in results and 'fileId' in results['facetDistribution']:
        files = results['facetDistribution']['fileId']
        
        print("📚 Indexed Files")
        print("=" * 60)
        print(f"Total files: {len(files)}\n")
        
        for file_id, count in sorted(files.items()):
            print(f"  • {file_id} ({count} chunks)")
    else:
        print("❌ Could not retrieve file list")


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python example_search.py <query>")
        print("  python example_search.py --stats")
        print("  python example_search.py --list")
        print("  python example_search.py --file <file_id> <query>")
        print()
        print("Examples:")
        print("  python example_search.py שבת")
        print("  python example_search.py --stats")
        print("  python example_search.py --list")
        print("  python example_search.py --file 'משנה ברורה - חלק ראשון' שבת")
        sys.exit(1)
    
    try:
        if sys.argv[1] == '--stats':
            get_index_stats()
        elif sys.argv[1] == '--list':
            list_files()
        elif sys.argv[1] == '--file':
            if len(sys.argv) < 4:
                print("Error: --file requires <file_id> and <query>")
                sys.exit(1)
            search_in_file(sys.argv[3], sys.argv[2])
        else:
            query = ' '.join(sys.argv[1:])
            search_books(query)
    
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nMake sure Meilisearch is running:")
        print("  .\\resources\\meilisearch\\meilisearch.exe")
        sys.exit(1)


if __name__ == "__main__":
    main()
