# Hackathon-PageRank

This project implements the PageRank algorithm using both CPU and CUDA backends.
## Content Directory Structure
<pre>
  Hackathon-PageRank/
  │
  ├── api/                    
  │   ├── config.py
  │   ├── main.py            
  │   ├── requirements.txt
  │   └── test.txt
  │
  ├── backend/                
  │   ├── data/               
  │   ├── cuda/               
  │   ├── output.txt
  │   └── output_1k.txt
  │
  ├── crawler/                
  │   ├── crawl.py
  │   ├── data/               
  │   ├── source/             
  │   ├── requirements.txt
  │   └── README.md
  │
  ├── frontend/               
  │   ├── app/
  │   ├── components/
  │   ├── lib/
  │   ├── hooks/
  │   ├── styles/
  │   ├── next.config.mjs
  │   ├── package.json
  │   └── tsconfig.json
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
- Optional GPU acceleration
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
### Run the frontend locally

```bash
cd frontend
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
pnpm dev
```
Then open: http://localhost:3000
