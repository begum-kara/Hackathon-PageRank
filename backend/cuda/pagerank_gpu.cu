#include <cstdio>
#include <vector>
#include <utility>
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <cuda_runtime.h>

//helper function for CUDA
#define CUDA_CHECK(call) do {                                      \
    cudaError_t err = (call);                                      \
    if (err != cudaSuccess) {                                      \
        std::fprintf(stderr, "CUDA error %s at %s:%d\n",           \
                    cudaGetErrorString(err), __FILE__, __LINE__);  \
        std::exit(1);                                              \
    }                                                              \
} while (0)


//  Basic graph struct (CPU side) 

struct Graph {
    int n;  // number of nodes
    std::vector<std::pair<int,int>> edges;        // list of (u, v)
    std::vector<int> outdeg;                      // out-degree for each node
    std::vector<unsigned char> is_dangling;       // 1 if outdeg == 0
};

//  CSR matrix for transition matrix P 
// P is column-stochastic, but stored in row-wise CSR form: P[i,j] is prob from j->i

struct CSR {
    int n;                              // number of rows/cols
    std::vector<int> row_ptr;           // size n+1
    std::vector<int> col_idx;           // size nnz
    std::vector<double> val;            // size nnz
};

// -- Load graph from edge list file 

Graph load_graph(const char* input_path) {
    Graph g;
    g.n = 0;

    std::FILE* f = std::fopen(input_path, "r");
    if (!f) {
        std::fprintf(stderr, "ERROR: could not open input file '%s'\n", input_path);
        std::exit(1);
    }

    int u, v;
    int max_id = -1;
    while (std::fscanf(f, "%d %d", &u, &v) == 2) {
        g.edges.emplace_back(u, v);
        if (u > max_id) max_id = u;
        if (v > max_id) max_id = v;
    }
    std::fclose(f);

    if (max_id < 0) {
        std::fprintf(stderr, "ERROR: input graph is empty or invalid\n");
        std::exit(1);
    }

    g.n = max_id + 1;  // node IDs are 0..max_id
    g.outdeg.assign(g.n, 0);

    for (const auto &e : g.edges) {
        int src = e.first;
        if (src < 0 || src >= g.n) {
            std::fprintf(stderr, "ERROR: edge source out of range: %d\n", src);
            std::exit(1);
        }
        g.outdeg[src]++;
    }

    g.is_dangling.assign(g.n, 0);
    for (int i = 0; i < g.n; ++i) {
        if (g.outdeg[i] == 0) g.is_dangling[i] = 1;
    }

    return g;
}

// -- Build CSR for transition matrix P --
//
// For each edge u -> v:
//   P[v, u] = 1 / outdeg[u]
// We store by rows (v): row_ptr[v]..row_ptr[v+1] lists all columns u.

CSR build_P(const Graph& g) {
    CSR P;
    P.n = g.n;
    const auto &edges = g.edges;
    const auto &outdeg = g.outdeg;

    // 1) count entries per row
    std::vector<int> row_counts(g.n, 0);
    for (const auto &e : edges) {
        int u = e.first;
        int v = e.second;
        if (outdeg[u] > 0) {   // only non-dangling contribute
            row_counts[v]++;
        }
    }

    // 2) build row_ptr
    P.row_ptr.resize(g.n + 1);
    P.row_ptr[0] = 0;
    for (int i = 0; i < g.n; ++i) {
        P.row_ptr[i + 1] = P.row_ptr[i] + row_counts[i];
    }

    int nnz = P.row_ptr[g.n];
    P.col_idx.resize(nnz);
    P.val.resize(nnz);

    // 3) temporary offsets to fill rows
    std::vector<int> offset = P.row_ptr;

    // 4) fill col_idx and val
    for (const auto &e : edges) {
        int u = e.first;
        int v = e.second;
        if (outdeg[u] == 0) continue; // dangling nodes handled separately

        int pos = offset[v]++;
        P.col_idx[pos] = u;                  // column = source node
        P.val[pos]     = 1.0 / outdeg[u];    // probability
    }

    return P;
}

// -- CPU PageRank using CSR 

std::vector<double> pagerank_cpu(const CSR& P,
                                 const std::vector<unsigned char>& is_dangling,
                                 double alpha,
                                 double tol,
                                 int max_iter) {
    int n = P.n;
    std::vector<double> r(n, 1.0 / n);
    std::vector<double> r_new(n, 0.0);

    double teleport = (1.0 - alpha) / n;

    for (int it = 0; it < max_iter; ++it) {
        // 1) dangling mass: sum of ranks of nodes with no outlinks
        double dangling_mass = 0.0;
        for (int i = 0; i < n; ++i) {
            if (is_dangling[i]) dangling_mass += r[i];
        }
        double dang_contrib = alpha * dangling_mass / n;

        // 2) sparse mat-vec: r_new[i] = alpha * (sum_j P[i,j] * r[j] + dangling_mass / n) + teleport
        for (int i = 0; i < n; ++i) {
            double sum = 0.0;
            int start = P.row_ptr[i];
            int end   = P.row_ptr[i + 1];
            for (int k = start; k < end; ++k) {
                int j = P.col_idx[k];   // column (source)
                double v = P.val[k];    // P[i,j]
                sum += v * r[j];
            }
            r_new[i] = alpha * (sum + dangling_mass / n) + teleport;
        }

        // 3) compute L1 difference and swap
        double delta = 0.0;
        for (int i = 0; i < n; ++i) {
            delta += std::fabs(r_new[i] - r[i]);
        }

        r.swap(r_new);

        if (delta < tol) {
            std::printf("Converged in %d iterations, delta=%.6e\n", it, delta);
            break;
        }
    }

    // Normalize just in case
    double total = 0.0;
    for (double x : r) total += x;
    if (total > 0) {
        for (double &x : r) x /= total;
    }

    return r;
}


// ============ CUDA kernels ============

// y[i] = sum_j P[i,j] * r[j]
__global__ void spmv_csr_kernel(
    int n,
    const int* __restrict__ row_ptr,
    const int* __restrict__ col_idx,
    const double* __restrict__ val,
    const double* __restrict__ r,
    double* __restrict__ y)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= n) return;

    double sum = 0.0;
    int start = row_ptr[i];
    int end   = row_ptr[i + 1];

    for (int k = start; k < end; ++k) {
        int j = col_idx[k];
        sum += val[k] * r[j];
    }
    y[i] = sum;
}

// r_new[i] = alpha * (y[i] + dangling_mass / n) + teleport
__global__ void update_pr_kernel(
    int n,
    const double* __restrict__ y,
    double* __restrict__ r_new,
    double alpha,
    double dangling_mass,
    double teleport)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= n) return;

    double base = alpha * (y[i] + dangling_mass / n) + teleport;
    r_new[i] = base;
}

std::vector<double> pagerank_gpu_cuda(
    const CSR& P,
    const std::vector<unsigned char>& is_dangling,
    double alpha,
    double tol,
    int max_iter)
{
    int n   = P.n;
    int nnz = (int)P.col_idx.size();

    //  Host vectors 
    std::vector<double> r_host(n, 1.0 / n);
    std::vector<double> r_new_host(n);

    double teleport = (1.0 - alpha) / n;

    //  Device memory 
    int *d_row_ptr = nullptr, *d_col_idx = nullptr;
    double *d_val = nullptr, *d_r = nullptr, *d_r_new = nullptr, *d_y = nullptr;

    CUDA_CHECK(cudaMalloc(&d_row_ptr, (n + 1) * sizeof(int)));
    CUDA_CHECK(cudaMalloc(&d_col_idx, nnz * sizeof(int)));
    CUDA_CHECK(cudaMalloc(&d_val,     nnz * sizeof(double)));
    CUDA_CHECK(cudaMalloc(&d_r,       n   * sizeof(double)));
    CUDA_CHECK(cudaMalloc(&d_r_new,   n   * sizeof(double)));
    CUDA_CHECK(cudaMalloc(&d_y,       n   * sizeof(double)));

    CUDA_CHECK(cudaMemcpy(d_row_ptr, P.row_ptr.data(),
                          (n + 1) * sizeof(int), cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(d_col_idx, P.col_idx.data(),
                          nnz * sizeof(int), cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(d_val, P.val.data(),
                          nnz * sizeof(double), cudaMemcpyHostToDevice));
    CUDA_CHECK(cudaMemcpy(d_r, r_host.data(),
                          n * sizeof(double), cudaMemcpyHostToDevice));

    // We'll compute dangling_mass on CPU using r_host for now (simpler).
    std::vector<unsigned char> dang = is_dangling;

    int blockSize = 256;
    int gridSize  = (n + blockSize - 1) / blockSize;

    for (int it = 0; it < max_iter; ++it) {
        // 1) copy current ranks back to host (for dangling_mass + convergence)
        CUDA_CHECK(cudaMemcpy(r_host.data(), d_r,
                              n * sizeof(double), cudaMemcpyDeviceToHost));

        double dangling_mass = 0.0;
        for (int i = 0; i < n; ++i) {
            if (dang[i]) dangling_mass += r_host[i];
        }

        // 2) y = P * r
        spmv_csr_kernel<<<gridSize, blockSize>>>(
            n, d_row_ptr, d_col_idx, d_val, d_r, d_y);
        CUDA_CHECK(cudaGetLastError());

        // 3) r_new = alpha*(y + dangling_mass/n) + teleport
        update_pr_kernel<<<gridSize, blockSize>>>(
            n, d_y, d_r_new, alpha, dangling_mass, teleport);
        CUDA_CHECK(cudaGetLastError());

        // 4) get r_new back to host to check convergence
        CUDA_CHECK(cudaMemcpy(r_new_host.data(), d_r_new,
                              n * sizeof(double), cudaMemcpyDeviceToHost));

        double delta = 0.0;
        for (int i = 0; i < n; ++i) {
            delta += std::fabs(r_new_host[i] - r_host[i]);
        }

        // 5) swap device vectors: d_r <- d_r_new
        std::swap(d_r, d_r_new);

        if (delta < tol) {
            std::printf("[GPU] Converged in %d iterations, delta=%.6e\n", it, delta);
            break;
        }
    }

    // Copy final ranks from device (d_r) to host r_host
    CUDA_CHECK(cudaMemcpy(r_host.data(), d_r,
                          n * sizeof(double), cudaMemcpyDeviceToHost));

    // Normalize (safety)
    double total = 0.0;
    for (double x : r_host) total += x;
    if (total > 0) {
        for (double &x : r_host) x /= total;
    }

    // Free device memory
    CUDA_CHECK(cudaFree(d_row_ptr));
    CUDA_CHECK(cudaFree(d_col_idx));
    CUDA_CHECK(cudaFree(d_val));
    CUDA_CHECK(cudaFree(d_r));
    CUDA_CHECK(cudaFree(d_r_new));
    CUDA_CHECK(cudaFree(d_y));

    return r_host;
}


//helper to check if using gpu is ok
bool has_gpu() {
    int count = 0;
    cudaError_t err = cudaGetDeviceCount(&count);
    if (err != cudaSuccess) {
        std::fprintf(stderr, "cudaGetDeviceCount failed: %s\n",
                     cudaGetErrorString(err));
        return false;
    }
    if (count <= 0) {
        std::fprintf(stderr, "No CUDA devices found, using CPU.\n");
        return false;
    }
    return true;
}


// - MAIN 

int main(int argc, char** argv) {
    if (argc < 3) {
        std::fprintf(stderr, "Usage: %s input.txt output.txt [alpha tol max_iter top_k]\n", argv[0]);
        return 1;
    }

    const char* input_path  = argv[1];
    const char* output_path = argv[2];

    // Optional parameters
    double alpha    = (argc >= 4) ? std::atof(argv[3]) : 0.85;
    double tol      = (argc >= 5) ? std::atof(argv[4]) : 1e-8;
    int    max_iter = (argc >= 6) ? std::atoi(argv[5]) : 100;
    int    top_k    = (argc >= 7) ? std::atoi(argv[6]) : 10;

    std::printf("pagerank_gpu (CPU prototype) running\n");
    std::printf("  input    : %s\n", input_path);
    std::printf("  output   : %s\n", output_path);
    std::printf("  alpha    : %.3f\n", alpha);
    std::printf("  tol      : %.1e\n", tol);
    std::printf("  max_iter : %d\n", max_iter);
    std::printf("  top_k    : %d\n", top_k);

    // 1) Load graph
    Graph g = load_graph(input_path);

    // 2) Build CSR for transition matrix
    CSR P = build_P(g);

    // 3) Run PageRank: GPU first, CPU fallback

    // CPU reference
    std::vector<double> ranks;

    if (has_gpu()) {
        std::printf("Using GPU backend for PageRank\n");
        ranks = pagerank_gpu_cuda(P, g.is_dangling, alpha, tol, max_iter);
    } else {
        std::printf("Using CPU backend for PageRank (no GPU detected)\n");
        ranks = pagerank_cpu(P, g.is_dangling, alpha, tol, max_iter);
    }
    //compare CPU vs GPU

/*
    double max_diff = 0.0;
    for (int i = 0; i < g.n; ++i) {
        double d = std::fabs(ranks_cpu[i] - ranks_gpu[i]);
        if (d > max_diff) max_diff = d;
    }
    std::printf("Max |CPU-GPU| diff = %.12f\n", max_diff);

    // then pick which one to write to file:
    const std::vector<double>& ranks = ranks_gpu; // or ranks_cpu
    */
    
    // 4) Open output file
    FILE* f = std::fopen(output_path, "w");
    if (!f) {
        std::fprintf(stderr, "ERROR: could not open output file '%s' for writing\n", output_path);
        return 1;
    }

    // Write summary
    std::fprintf(f, "Graph summary:\n");
    std::fprintf(f, "  N (nodes) : %d\n", g.n);
    std::fprintf(f, "  M (edges) : %zu\n", g.edges.size());

    int dangling_count = 0;
    for (int i = 0; i < g.n; ++i)
        if (g.is_dangling[i]) dangling_count++;
    std::fprintf(f, "  Dangling nodes: %d\n\n", dangling_count);

    // Get top-k nodes by PageRank
    std::vector<int> idx(g.n);
    for (int i = 0; i < g.n; ++i) idx[i] = i;
    std::sort(idx.begin(), idx.end(), [&](int a, int b) {
        return ranks[a] > ranks[b];
    });

    if (top_k > g.n) top_k = g.n;

    std::fprintf(f, "Top %d nodes by PageRank:\n", top_k);
    for (int i = 0; i < top_k; ++i) {
        int node = idx[i];
        std::fprintf(f, "  node %d : %.10f\n", node, ranks[node]);
    }

    std::fclose(f);

    return 0;
}
