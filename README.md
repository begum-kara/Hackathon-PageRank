# Hackathon-PageRank

This project implements the PageRank algorithm using both CPU and CUDA backends, inspired by the Cornell University explanation of PageRank.

## Content Directory Structure

<pre>
  |-- <a href="#2.2">Hackathon-PageRank</a>
     |-- cpu
     |-- cuda
     |-- data
     |-- uploads
     |-- web
     |-- web
     |   |-- api
     |   |   |-- __init__.py
     |   |   |-- schemas.py
     |   |   |-- uploads.py
     |   |-- main.py
     |   |-- requirements.txt
     |-- README.md
     |-- LICENCE.md
</pre>

## What is PageRank
- **PageRank** is a ranking algorithm originally used by Google to measure the importance of web pages. Instead of just counting how many times a keyword appears, PageRank uses the structure of links across pages to assess authority and relevance.
- The key intuition: **a page is important if many (and/or important) pages link to it**. Links act like “votes,” but not all votes are equal — a vote from a highly important page counts more.
- This idea models the web as a directed graph: each page is a node; each hyperlink is a directed edge from linking page to linked page.

The score for a page i:

$$ PR(i) = \frac{1 - d}{N} + d \sum_{j \in M(i)} \frac{PR(j)}{L_j} $$

d = damping factor (usually 0.85)

N = total number of pages

$$L_j$$ = number of outgoing links from page j

The sum is over all pages linking to i.

The algorithm repeats this computation until ranks converge.
