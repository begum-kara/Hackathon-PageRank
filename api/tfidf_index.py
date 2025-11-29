# tfidf_index.py
import math
import os
import re
from collections import defaultdict, Counter
from re import search
from typing import Dict, List, Tuple, Hashable

import numpy as np

# GPU libs (required for GPUTfidfSearchIndex)
try:
    import cupy as cp
    import cupyx.scipy.sparse as cpx_sparse
    GPU_AVAILABLE = True
except ImportError:
    # You can still use the CPU index without CuPy
    GPU_AVAILABLE = False
    cp = None          # type: ignore
    cpx_sparse = None  # type: ignore


TOKEN_RE = re.compile(r"\b\w+\b", re.UNICODE)


def tokenize(text: str):
    """Very simple word tokenizer → lowercase tokens."""
    return [t.lower() for t in TOKEN_RE.findall(text)]


# 
# CPU-only version (drop-in replacement)
# 
class TfidfSearchIndex:
    """
    CPU-only TF-IDF index (more efficient than original).
    Kept as a non-GPU fallback (e.g. on macOS laptops).
    """

    def __init__(self):
        # term -> {doc_id: weight} (initially raw tf, later tf-idf)
        self.inverted_index = defaultdict(dict)
        self.doc_lengths = {}
        self.documents = {}
        self.df = Counter()
        self.idf = {}
        self.doc_norms = {}
        self.N = 0

    def add_document(self, doc_id, text: str):
        tokens = tokenize(text)
        if not tokens:
            return

        self.documents[doc_id] = text
        self.doc_lengths[doc_id] = len(tokens)
        self.N += 1

        tf = Counter(tokens)

        for term, freq in tf.items():
            self.inverted_index[term][doc_id] = float(freq)
            self.df[term] += 1

    def finalize(self):
        """
        Compute IDF, convert postings to tf-idf, and doc norms.
        Complexity: O(total postings).
        """
        # 1) IDF
        N = self.N
        idf = {}
        for term, df in self.df.items():
            idf_val = math.log((1 + N) / (1 + df)) + 1.0
            idf[term] = idf_val
        self.idf = idf

        # 2) tf -> tf-idf; accumulate norms
        doc_norm_sq = defaultdict(float)

        for term, posting in self.inverted_index.items():
            term_idf = idf.get(term, 0.0)
            if term_idf == 0.0:
                continue

            for doc_id, tf in posting.items():
                w = tf * term_idf
                posting[doc_id] = w
                doc_norm_sq[doc_id] += w * w

        # 3) norms
        for doc_id, nsq in doc_norm_sq.items():
            self.doc_norms[doc_id] = math.sqrt(nsq) if nsq > 0 else 1.0

    def search(self, query: str, top_k: int = 10):
        tokens = tokenize(query)
        if not tokens:
            return []

        q_tf = Counter(tokens)

        q_weights = {}
        for term, freq in q_tf.items():
            term_idf = self.idf.get(term)
            if term_idf is None:
                continue
            q_weights[term] = freq * term_idf

        if not q_weights:
            return []

        q_norm_sq = sum(w * w for w in q_weights.values())
        q_norm = math.sqrt(q_norm_sq) if q_norm_sq > 0 else 1.0

        scores = defaultdict(float)
        inv = self.inverted_index

        for term, q_w in q_weights.items():
            posting = inv.get(term)
            if posting is None:
                continue
            for doc_id, d_w in posting.items():  # d_w is tf-idf
                scores[doc_id] += q_w * d_w

        results = []
        dn = self.doc_norms
        for doc_id, dot in scores.items():
            d_norm = dn.get(doc_id, 1.0)
            results.append((doc_id, dot / (q_norm * d_norm)))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]


# 
# GPU TF-IDF index for cluster usage
# 
class GPUTfidfSearchIndex:
    """
    TF-IDF search index optimized for GPU.

    Pipeline:
      1) add_document(doc_id, text)          -- CPU
      2) finalize()                          -- CPU: IDF, TF-IDF, CSR build, upload to GPU
      3) search(query, top_k=10)            -- GPU: SpMV + cosine normalization
    """

    def __init__(self):
        if not GPU_AVAILABLE:
            raise RuntimeError(
                "CuPy not available. Install cupy (e.g. `pip install cupy-cuda11x`) "
                "or use TfidfSearchIndex (CPU) instead."
            )

        # term -> {doc_id: tf or tf-idf (after finalize)}
        self.inverted_index: Dict[str, Dict[Hashable, float]] = defaultdict(dict)

        # doc_id -> original text
        self.documents: Dict[Hashable, str] = {}

        # doc_id -> #tokens
        self.doc_lengths: Dict[Hashable, int] = {}

        # term -> document frequency
        self.df: Counter = Counter()

        # term -> idf
        self.idf: Dict[str, float] = {}

        # doc_id -> ||d||
        self.doc_norms: Dict[Hashable, float] = {}

        # mappings
        self.doc_to_row: Dict[Hashable, int] = {}
        self.row_to_doc: List[Hashable] = []
        self.term_to_col: Dict[str, int] = {}
        self.col_to_term: List[str] = []

        # CSR on CPU
        self.csr_indptr: np.ndarray | None = None
        self.csr_indices: np.ndarray | None = None
        self.csr_data: np.ndarray | None = None

        # GPU arrays
        self.d_indptr = None
        self.d_indices = None
        self.d_data = None
        self.d_doc_norms = None

        self.n_docs: int = 0
        self.n_terms: int = 0
        self.N: int = 0  # number of docs added

        self._finalized: bool = False

    # -- building the index (CPU) -- #

    def add_document(self, doc_id: Hashable, text: str):
        tokens = tokenize(text)
        if not tokens:
            return

        self.documents[doc_id] = text
        self.doc_lengths[doc_id] = len(tokens)
        self.N += 1

        tf = Counter(tokens)
        for term, freq in tf.items():
            self.inverted_index[term][doc_id] = float(freq)
            self.df[term] += 1

    def _compute_idf_and_tfidf(self):
        """Compute IDF and convert postings tf -> tf-idf; accumulate norms."""
        N = self.N
        idf: Dict[str, float] = {}
        for term, df in self.df.items():
            idf_val = math.log((1.0 + N) / (1.0 + df)) + 1.0
            idf[term] = idf_val
        self.idf = idf

        doc_norm_sq: Dict[Hashable, float] = defaultdict(float)

        for term, posting in self.inverted_index.items():
            term_idf = idf.get(term, 0.0)
            if term_idf == 0.0:
                continue
            for doc_id, tf in posting.items():
                w = tf * term_idf
                posting[doc_id] = w
                doc_norm_sq[doc_id] += w * w

        for doc_id, nsq in doc_norm_sq.items():
            self.doc_norms[doc_id] = math.sqrt(nsq) if nsq > 0 else 1.0

    def _build_mappings(self):
        # doc -> row
        self.doc_to_row = {doc_id: i for i, doc_id in enumerate(self.documents.keys())}
        self.row_to_doc = list(self.documents.keys())
        self.n_docs = len(self.doc_to_row)

        # term -> col
        self.term_to_col = {term: j for j, term in enumerate(self.inverted_index.keys())}
        self.col_to_term = list(self.inverted_index.keys())
        self.n_terms = len(self.term_to_col)

    def _build_csr_cpu(self):
        n_docs = self.n_docs
        doc_rows: List[List[Tuple[int, float]]] = [[] for _ in range(n_docs)]

        for term, posting in self.inverted_index.items():
            col = self.term_to_col[term]
            for doc_id, w in posting.items():  # w is tf-idf
                row = self.doc_to_row[doc_id]
                doc_rows[row].append((col, w))

        indptr = [0]
        indices: List[int] = []
        data: List[float] = []

        for row in range(n_docs):
            entries = doc_rows[row]
            if entries:
                entries.sort(key=lambda x: x[0])
                for col, w in entries:
                    indices.append(col)
                    data.append(w)
            indptr.append(len(indices))

        self.csr_indptr = np.asarray(indptr, dtype=np.int32)
        self.csr_indices = np.asarray(indices, dtype=np.int32)
        self.csr_data = np.asarray(data, dtype=np.float32)

    def _upload_to_gpu(self):
        assert self.csr_indptr is not None
        assert self.csr_indices is not None
        assert self.csr_data is not None

        self.d_indptr = cp.asarray(self.csr_indptr)
        self.d_indices = cp.asarray(self.csr_indices)
        self.d_data = cp.asarray(self.csr_data)

        # doc norms aligned with row_to_doc
        norm_arr = np.empty(self.n_docs, dtype=np.float32)
        for i, doc_id in enumerate(self.row_to_doc):
            norm_arr[i] = self.doc_norms.get(doc_id, 1.0)
        self.d_doc_norms = cp.asarray(norm_arr)

    def finalize(self):
        """Call once after all documents are added."""
        if self._finalized:
            return
        if self.N == 0:
            raise RuntimeError("No documents added before finalize().")

        self._compute_idf_and_tfidf()
        self._build_mappings()
        self._build_csr_cpu()
        self._upload_to_gpu()
        self._finalized = True

    #  search (GPU) - #

    def search(self, query: str, top_k: int = 10):
        """
        Run TF-IDF cosine similarity search on GPU.

        Returns: list[(doc_id, score)]
        """
        if not self._finalized:
            raise RuntimeError("Index must be finalized() before search().")

        tokens = tokenize(query)
        if not tokens:
            return []

        q_tf = Counter(tokens)
        q = cp.zeros(self.n_terms, dtype=cp.float32)

        for term, freq in q_tf.items():
            col = self.term_to_col.get(term)
            if col is None:
                continue
            term_idf = self.idf.get(term, 0.0)
            if term_idf == 0.0:
                continue
            q[col] = freq * term_idf

        q_norm = cp.linalg.norm(q)
        if q_norm == 0.0:
            return []
        q /= q_norm

        D = cpx_sparse.csr_matrix(
            (self.d_data, self.d_indices, self.d_indptr),
            shape=(self.n_docs, self.n_terms),
        )

        scores = D.dot(q)  # (n_docs,)
        scores = scores / self.d_doc_norms

        k = min(top_k, self.n_docs)
        if k <= 0:
            return []

        topk_idx = cp.argpartition(scores, -k)[-k:]
        topk_idx = topk_idx[cp.argsort(scores[topk_idx])][::-1]

        topk_idx_host = cp.asnumpy(topk_idx)
        scores_host = cp.asnumpy(scores)

        results = []
        for row_idx in topk_idx_host:
            doc_id = self.row_to_doc[int(row_idx)]
            score = float(scores_host[int(row_idx)])
            results.append((doc_id, score))

        return results


# 
# Factory / convenience: choose CPU or GPU index automatically
# 
def create_tfidf_index(prefer_gpu: bool | None = None):
    """
    Factory to create a TF-IDF index that works both on macOS (no GPU)
    and on the GPU cluster (with CuPy).

    - If prefer_gpu is None, it is read from env var TFIDF_USE_GPU (default: True).
    - If GPU is not available, always falls back to TfidfSearchIndex.
    """
    if prefer_gpu is None:
        env_val = os.getenv("TFIDF_USE_GPU", "1").strip()
        # treat "0", "false", "no" as false, everything else as true-ish
        prefer_gpu = env_val not in {"0", "false", "False", "no", "No"}

    if prefer_gpu and GPU_AVAILABLE:
        return GPUTfidfSearchIndex()
    else:
        return TfidfSearchIndex()
