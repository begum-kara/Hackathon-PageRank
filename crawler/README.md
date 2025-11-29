## 🚀 Crawler Usage Guide

This folder contains the web crawler that generates the input graph for our C++ PageRank engine.
It crawls a website, collects internal links, and saves them as a CSV file in the project’s /data/ directory.

## 📦 1. Setup (one time)
### 1) Open a terminal

PowerShell, macOS Terminal, or Linux console.

### 2) Navigate to the crawler folder

```cd Hackathon-PageRank/crawler```

### 3) Create & activate a virtual environment

macOS / Linux

```python3 -m venv .venv
source .venv/bin/activate
```


Windows (PowerShell)

```python -m venv .venv
.\.venv\Scripts\activate
```

### 4) Install dependencies

```pip install -r requirements.txt```

## ▶️ 2. Running the crawler

Activate the venv (same command as above), then run:

```python crawl.py <start_url> --max-pages <N> --output <filename.csv>```

Example:

```python crawl.py https://www.python.org --max-pages 30 --output python.csv```


This produces:

Hackathon-PageRank/data/python.csv

## 📁 3. Output format

Each row in the CSV represents a directed edge:

source,target
https://www.python.org,https://www.python.org/about
https://www.python.org/about,https://www.python.org/jobs
...


The C++ PageRank engine uses this file to build the graph.

## 🔁 4. Notes & Tips

Only same-domain links are followed

```--max-pages``` controls crawl size (20–50 recommended)

Always activate the virtual environment before running the crawler

All output files are saved to:

Hackathon-PageRank/data/<filename.csv>

## 🧪 5. Example session
```cd Hackathon-PageRank/crawler
source .venv/bin/activate    # Windows: .\.venv\Scripts\activate

python crawl.py https://www.tum.de --max-pages 50 --output tum.csv
```
# → Output saved to ../data/tum.csv
