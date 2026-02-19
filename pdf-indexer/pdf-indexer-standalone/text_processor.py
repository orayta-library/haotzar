"""
Hebrew Text Processing
"""
import regex as re  # Use regex module for Unicode support
from typing import List, Tuple
from config import REMOVE_NIKUD, MIN_WORD_LENGTH, NIKUD_PATTERN


def remove_nikud(text: str) -> str:
    """Remove Hebrew nikud (vowel points)"""
    if not REMOVE_NIKUD:
        return text
    return re.sub(NIKUD_PATTERN, '', text)


def tokenize_with_offsets(text: str) -> List[Tuple[str, int, int]]:
    """
    Tokenize text and return (token, start_offset, length)
    
    Args:
        text: Input text
        
    Returns:
        List of (cleaned_token, offset, original_length)
    """
    tokens = []
    
    # Match Hebrew, English, and numbers
    pattern = re.compile(r'[\p{L}\p{N}]+', re.UNICODE)
    
    for match in pattern.finditer(text):
        raw_token = match.group(0)
        cleaned = remove_nikud(raw_token).lower()
        
        if len(cleaned) >= MIN_WORD_LENGTH:
            tokens.append((
                cleaned,
                match.start(),
                len(raw_token)
            ))
    
    return tokens


def normalize_hebrew(text: str) -> str:
    """
    Normalize Hebrew text
    - Remove nikud
    - Normalize final letters (ך->כ, ם->מ, etc.)
    - Lowercase
    """
    text = remove_nikud(text)
    
    # Normalize final letters
    finals = {
        'ך': 'כ',
        'ם': 'מ',
        'ן': 'נ',
        'ף': 'פ',
        'ץ': 'צ'
    }
    
    for final, regular in finals.items():
        text = text.replace(final, regular)
    
    return text.lower()


def extract_gematria_value(text: str) -> int:
    """
    Calculate gematria value for Hebrew text
    """
    gematria_values = {
        'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
        'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
        'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90, 'ק': 100,
        'ר': 200, 'ש': 300, 'ת': 400
    }
    
    total = 0
    for char in text:
        total += gematria_values.get(char, 0)
    
    return total


def is_hebrew(text: str) -> bool:
    """Check if text contains Hebrew characters"""
    hebrew_pattern = re.compile(r'[\u0590-\u05FF]')
    return bool(hebrew_pattern.search(text))


def clean_text(text: str) -> str:
    """
    Clean text for indexing
    - Remove extra whitespace
    - Remove control characters
    - Normalize line breaks
    """
    # Remove control characters except newlines and tabs
    text = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]', '', text)
    
    # Normalize whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n', '\n\n', text)
    
    return text.strip()


if __name__ == "__main__":
    # Test
    test_text = "שָׁלוֹם עוֹלָם! Hello World 123"
    
    print("Original:", test_text)
    print("No nikud:", remove_nikud(test_text))
    print("Normalized:", normalize_hebrew(test_text))
    print("Tokens:", tokenize_with_offsets(test_text))
    print("Gematria of שלום:", extract_gematria_value("שלום"))
