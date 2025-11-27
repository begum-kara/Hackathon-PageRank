import sys
import random

def main():
    if len(sys.argv) != 3:
        print("Usage: python gen_random_graph.py NUM_NODES NUM_EDGES", file=sys.stderr)
        sys.exit(1)

    n = int(sys.argv[1])
    m = int(sys.argv[2])

    # Simple random directed graph: m edges between nodes 0..n-1
    edges = set()
    while len(edges) < m:
        u = random.randrange(n)
        v = random.randrange(n)
        if u == v:
            continue  # skip self-loops
        edges.add((u, v))

    for u, v in edges:
        print(u, v)

if __name__ == "__main__":
    main()
