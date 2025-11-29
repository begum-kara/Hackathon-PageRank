# Hackathon-PageRank

This project implements the PageRank algorithm using both CPU and CUDA backends.
## Content Directory Structure
<pre>
  Hackathon-PageRank/
  │
  ├── api/                    
  │   ├── config.py
  │   ├── main.py   
  │   ├── recompute_pagerank.py   
  │   ├── tfidf_index.py   
  │
  ├── backend/                
  │   ├── data/               
  │   ├── cuda/        
  │   ├── jobs/   
  │
  ├── crawler/                
  │   ├── crawl.py
  │   ├── core.py  
  │   ├── data/                          
  │   └── README.md
  │
  ├── frontend/               
  │   ├── app/
  │   ├── components/
  │   ├── lib/
  │   ├── hooks/
  │   ├── styles/
  │
  ├── start.sh                
  ├── LICENSE
  └── README.md 
</pre>
## What is PageRank
- **PageRank** is a ranking algorithm originally used by Google to measure the importance of web pages. Instead of just counting how many times a keyword appears, PageRank uses the structure of links across pages to assess authority and relevance.
- The key intuition: **a page is important if many (and/or important) pages link to it**. Links act like “votes,” but not all votes are equal — a vote from a highly important page counts more.
- This idea models the web as a directed graph: each page is a node; each hyperlink is a directed edge from linking page to linked page.

## Overview
The project is divided into 4 parts:
### Crawler
A Python-based crawler that collects web pages, extracts links, and constructs a graph representation of the web structure.
Outputs include custom CSV and TXT representations used by the backend.
### Backend
A Python and CUDA-enhanced implementation of the PageRank algorithm.
Features:
- Handles large graphs
- Supports damping factor tuning
- Outputs ranked scores to text files
### API
A lightweight Python API (FastAPI) exposing:
- Graph upload
- PageRank execution
- Ranked result retrieval
### Frontend
A Next.js UI for visualizing:
- Crawling results
- Node ranking
- Graph insights
- Eye-pleasing Website
## Installation & Setup:

## Running backend localy:
### TUM, German-ish corpus
```python build_corpus.py \
  https://www.tum.de \
  --max-pages 200 \
  --lang de \
  --workers 5
```

### Wikipedia, English corpus
```python build_corpus.py \
  "https://en.wikipedia.org/wiki/Graph_(discrete_mathematics)" \
  --max-pages 300 \
  --lang en \
  --workers 8
```


 #### run the fastAPI 

``` uvicorn main:app --host 0.0.0.0 --port 8000 --reload```
## Running the frontend locally

```bash
npm install katex react-katex
cd frontend
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
pnpm dev
```
Then open: http://localhost:3000
