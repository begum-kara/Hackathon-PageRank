# tfidf_index.py
import math
import re
from collections import defaultdict, Counter

TOKEN_RE = re.compile(r"\b\w+\b", re.UNICODE)  # regex to find words


# outputs a list of words from the text, all lowercase
def tokenize(text: str):
    return [t.lower() for t in TOKEN_RE.findall(text)]


class TfidfSearchIndex:
    def __init__(self):
        # term -> {doc_id: term_frequency_in_doc}
        self.inverted_index = defaultdict(dict)
        # doc_id -> doc_length (num tokens)
        self.doc_lengths = {}
        # doc_id -> original text (for snippet display)
        self.documents = {}
        # term -> document frequency
        self.df = Counter()
        # term -> idf
        self.idf = {}
        # doc_id -> precomputed doc vector norm (for cosine)
        self.doc_norms = {}
        # number of documents
        self.N = 0

    def add_document(self, doc_id, text: str):
        """
        Add one document to the index.
        doc_id: any hashable ID (int, str, URL)
        text  : full text (e.g., title + body)
        """
        tokens = tokenize(text)
        if not tokens:
            return

        self.documents[doc_id] = text
        self.doc_lengths[doc_id] = len(tokens)
        self.N += 1

        tf = Counter(tokens)  # no. of times each word appears in this doc

        for term, freq in tf.items():
            # store raw tf; we'll apply idf later
            self.inverted_index[term][doc_id] = freq
            self.df[term] += 1  # how many documents a term appears in

    def finalize(self):
        """
        Compute IDF and precompute document vector norms
        for cosine-like scoring.
        Call this once after adding all documents.
        """
        # Compute IDF
        for term, df in self.df.items():
            # slight smoothing to avoid division by zero
            self.idf[term] = math.log((1 + self.N) / (1 + df)) + 1.0

        # Precompute document norms: ||d|| = sqrt( sum_t (tfidf_t,d)^2 )
        for doc_id in self.documents.keys():
            norm_sq = 0.0
            # iterate over all terms that appear in this doc
            for term, doc_tf_map in self.inverted_index.items():
                if doc_id in doc_tf_map:
                    tf = doc_tf_map[doc_id]
                    idf = self.idf.get(term, 0.0)
                    w = tf * idf
                    norm_sq += w * w
            self.doc_norms[doc_id] = math.sqrt(norm_sq) if norm_sq > 0 else 1.0

    def search(self, query: str, top_k: int = 10):
        """
        Return top_k documents for a given query string.
        Score is cosine similarity between query TF-IDF and doc TF-IDF.
        Returns: list[(doc_id, score)]
        """
        tokens = tokenize(query)
        if not tokens:
            return []

        # query term frequencies
        q_tf = Counter(tokens)

        # build query vector and its norm
        q_weights = {}
        for term, freq in q_tf.items():
            idf = self.idf.get(term, 0.0)
            q_weights[term] = freq * idf

        q_norm_sq = sum(w * w for w in q_weights.values())
        q_norm = math.sqrt(q_norm_sq) if q_norm_sq > 0 else 1.0

        # accumulate scores for docs (dot product)
        scores = defaultdict(float)

        for term, q_w in q_weights.items():
            if term not in self.inverted_index:
                continue
            idf = self.idf.get(term, 0.0)

            # for each doc containing this term
            for doc_id, tf in self.inverted_index[term].items():
                d_w = tf * idf  # doc tf-idf weight
                scores[doc_id] += q_w * d_w  # dot product contribution

        # normalize by norms to get cosine similarity
        results = []
        for doc_id, dot in scores.items():
            d_norm = self.doc_norms.get(doc_id, 1.0)
            score = dot / (q_norm * d_norm)
            results.append((doc_id, score))

        # sort by score descending
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]
