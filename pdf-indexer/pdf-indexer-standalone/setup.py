"""
Setup script for PDF Indexer
"""
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="pdf-indexer",
    version="1.0.0",
    author="Haotzer Team",
    description="Fast PDF indexer for Hebrew books",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/pdf-indexer",
    packages=find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=[
        "PyPDF2>=3.0.0",
        "pdfplumber>=0.10.0",
        "pymupdf>=1.23.0",
        "regex>=2023.0.0",
        "zstandard>=0.22.0",
        "meilisearch>=0.31.0",
        "tqdm>=4.66.0",
        "python-dotenv>=1.0.0",
    ],
    entry_points={
        "console_scripts": [
            "pdf-indexer=build_index:main",
        ],
    },
)
