"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Network,
  Zap,
  Globe,
  Upload,
  Database,
  Link2,
  Play,
  Search,
  Clock,
  HardDrive,
} from "lucide-react";
import {
  uploadGraph,
  PageRankNode,
  searchTum,
  SearchResult,
  PageRankResponse,
  pagerankFromUrl,
  SearchResponse
} from "@/lib/api";

function MouseTrail() {
  const [dots, setDots] = useState<
    Array<{ id: number; x: number; y: number; opacity: number; s: number }>
  >([]);
  const nextIdRef = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const size = 10; // star size in px (smaller trail)
      const newDot = {
        id: nextIdRef.current++,
        x: e.clientX,
        y: e.clientY,
        opacity: 1,
        s: size,
      };
      setDots((prev) => [...prev, newDot].slice(-10));
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) =>
        prev
          .map((dot) => ({ ...dot, opacity: dot.opacity - 0.12 })) // faster fade
          .filter((dot) => dot.opacity > 0)
      );
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {dots.map((dot) => (
        <svg
          key={dot.id}
          className="pointer-events-none fixed z-50"
          width={dot.s}
          height={dot.s}
          viewBox="0 0 24 24"
          style={{
            left: dot.x - dot.s / 2,
            top: dot.y - dot.s / 2,
            opacity: dot.opacity,
            transition: "opacity 0.03s linear",
            filter: "drop-shadow(0 0 6px rgba(147, 197, 253, 0.7))",
          }}
        >
          <defs>
            <linearGradient id={`g-${dot.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#A78BFA" />
            </linearGradient>
          </defs>
          <path
            d="M12 2l2.7 6.9L22 9.2l-5.4 4.4 1.7 7.2L12 17.9 5.7 20.8l1.7-7.2L2 9.2l7.3-.3L12 2z"
            fill={`url(#g-${dot.id})`}
          />
        </svg>
      ))}
    </>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<
    "url" | "upload" | "dataset" | "wikipedia"
  >("url");
  const [url, setUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<{
    pages: Array<{ name: string; rank: number; score: number }>;
    metrics: { time: number; memory: number };
    graphData: any;
  } | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pagerankResults, setPagerankResults] = useState<PageRankNode[] | null>(
    null
  );
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)

  const demoSectionRef = useRef<HTMLElement>(null);

  interface ResultsPayload {
    pages: {
      name: string;
      rank: number;
      score: number;
    }[];
    metrics: {
      time: number;
      memory: number;
    };
    graphData: any;
  }

  const scrollToDemo = () => {
    demoSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  function mapPageRankToResults(payload: PageRankResponse) {
    return {
      pages: payload.top.map((node, idx) => ({
        name: `Node ${node.node}`, 
        rank: idx + 1, 
        score: node.score, 
      })),
      metrics: {
        time: 0, 
        memory: 0, 
      },
      graphData: generateMockGraphData(), 
    };
  }

  const handleAnalyze = async () => {
    try {
      setIsAnalyzing(true);

      if (activeTab === "upload") {
        if (!uploadFile) {
          alert("Please choose a graph file first.");
          return;
        }
        const apiRes = await uploadGraph(uploadFile, 10);
        setResults(mapPageRankToResults(apiRes));
      } else if (activeTab === "wikipedia") {
          const q = searchQuery.trim();
          if (!q) return;
          const res = await searchTum(q, 10); // from lib/api
          setSearchResults(res);
          setResults(null); // optional: clear pagerank demo
      } else if (activeTab === "url") {
        const trimmed = url.trim()
        if (!trimmed) {
          alert("Please enter a URL")
          return
        }
        // call backend URL PageRank endpoint
        const apiRes = await pagerankFromUrl(trimmed, 30, 20);

        // map to ResultsDisplay shape
        setResults({
          pages: apiRes.pages.map((p) => ({
            name: p.url,
            rank: p.rank,
            score: p.score,
          })),
          metrics: { time: 0, memory: 0 },
          graphData: {
            nodes: apiRes.nodes.map((n) => ({
              id: n.id,
              label: n.url,
            })),
            edges: apiRes.edges,
          },
        });

        // URL mode is a PageRank demo, not TF-IDF search
        setSearchResults(null)
        return
      }
      else if (activeTab === "dataset") {
        // Same, you can later switch datasets & call backend accordingly.
        alert("Dataset demo not wired yet. You can try Upload or Search tabs.");
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Something went wrong while running PageRank.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateMockGraphData = () => {
    const nodes = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      label: `Page ${i}`,
      size: Math.random() * 20 + 10,
    }));

    const edges = [];
    for (let i = 0; i < 30; i++) {
      const from = Math.floor(Math.random() * 20);
      const to = Math.floor(Math.random() * 20);
      if (from !== to) {
        edges.push({ from, to });
      }
    }

    return { nodes, edges };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1f3a] via-[#253058] to-[#2d2550]">
      <MouseTrail />

      {/* Hero Section */}
      <section className="relative px-4 py-16 md:py-24">
        <div className="container mx-auto max-w-6xl text-center">
          <Badge
            variant="outline"
            className="mb-8 border-blue-400/30 bg-blue-950/30 text-blue-300 hover:bg-blue-950/50"
          >
            <Network className="mr-2 h-4 w-4" />
            TUM Hackathon Project
          </Badge>

          <h1 className="mb-6 text-5xl font-bold leading-tight text-white md:text-7xl">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              PageRank
            </span>
            <br />
            <span className="text-balance">Algorithm Visualizer</span>
          </h1>

          <p className="mx-auto mb-12 max-w-3xl text-balance text-lg text-slate-300 md:text-xl">
            Efficiently implement and explore the PageRank algorithm on
            large-scale real-world graphs. Built for TUM's internal pages and
            Wikipedia.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-blue-500 text-white hover:bg-blue-600"
              onClick={scrollToDemo}
            >
              Try Demo <Play className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-slate-600 bg-slate-800/50 text-white hover:bg-slate-700"
            >
              Learn More
            </Button>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <h3 className="mb-2 text-3xl font-bold text-blue-400">Fast</h3>
              <p className="text-sm text-slate-400">Algorithm</p>
            </div>
            <div className="text-center">
              <h3 className="mb-2 text-3xl font-bold text-orange-400">
                Scalable
              </h3>
              <p className="text-sm text-slate-400">Architecture</p>
            </div>
            <div className="text-center">
              <h3 className="mb-2 text-3xl font-bold text-purple-400">
                Real-time
              </h3>
              <p className="text-sm text-slate-400">Analysis</p>
            </div>
          </div>
        </div>
      </section>

      {/* Try the Demo Section */}
      <section ref={demoSectionRef} className="px-4 py-16">
        <div className="container mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-4xl font-bold text-white md:text-5xl">
            Try the{" "}
            <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">
              Demo
            </span>
          </h2>
          <p className="mb-12 text-balance text-center text-lg text-slate-300">
            Experience PageRank in action with your own data or our sample
            datasets.
          </p>

          <Card className="border-slate-700 bg-slate-800/50 p-8 backdrop-blur">
            <div className="mb-8 flex flex-wrap gap-4">
              <Button
                onClick={() => setActiveTab("url")}
                className={
                  activeTab === "url"
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }
              >
                <Link2 className="mr-2 h-4 w-4" />
                URL
              </Button>
              <Button
                onClick={() => setActiveTab("upload")}
                className={
                  activeTab === "upload"
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
              <Button
                onClick={() => setActiveTab("dataset")}
                className={
                  activeTab === "dataset"
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }
              >
                <Database className="mr-2 h-4 w-4" />
                Dataset
              </Button>
              <Button
                onClick={() => setActiveTab("wikipedia")}
                className={
                  activeTab === "wikipedia"
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }
              >
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>

            {activeTab === "url" && (
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="url-input"
                    className="mb-2 block text-sm font-medium text-white"
                  >
                    Enter Website URL
                  </label>
                  <div className="flex gap-3">
                    <Input
                      id="url-input"
                      type="url"
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="flex-1 border-slate-600 bg-slate-900/50 text-white placeholder:text-slate-500"
                    />
                    <Button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {isAnalyzing ? "Analyzing..." : "Analyze"}
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    We'll crawl a small neighborhood around this URL and calculate PageRank
                    scores for the discovered pages.
                  </p>
                </div>
                {!results ? (
                  <Card className="border-slate-700 bg-slate-900/50 p-6">
                    <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-white">
                      <span className="h-2 w-2 rounded-full bg-purple-400" />
                      PageRank results will appear here
                    </h3>
                    <p className="text-slate-400">
                      Enter a URL and click Analyze to see the most important pages in its local link graph.
                    </p>
                  </Card>
                ) : (
                  <ResultsDisplay results={results} />
                )}
              </div>
            )}


            {activeTab === "upload" && (
              <div className="space-y-6">
                <div className="rounded-lg border-2 border-dashed border-slate-600 bg-slate-900/50 p-12 text-center">
                  <Upload className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                  <p className="mb-2 text-white">
                    Drop your graph file here or click to browse
                  </p>
                  <p className="text-sm text-slate-400">
                    Supports CSV and JSON formats
                  </p>

                  {/* Simple file input */}
                  <div className="mt-4 flex flex-col items-center gap-3">
                      <label className="cursor-pointer">
                        <span className="rounded bg-slate-800/80 px-3 py-2 text-xs text-slate-200">
                          Browse files
                        </span>
                        <input
                          type="file"
                          accept=".txt,.csv,.json"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setUploadFile(file);
                          }}
                          className="hidden"
                        />
                      </label>
                    {uploadFile && (
                      <p className="text-xs text-slate-400">
                        Selected:{" "}
                        <span className="font-mono">{uploadFile.name}</span>
                      </p>
                    )}
                    <Button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !uploadFile}
                      className="bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {isAnalyzing ? "Analyzing..." : "Upload and Analyze"}
                    </Button>
                  </div>
                </div>

                {/* Show PageRank results (uploaded graph) */}
                {results && <ResultsDisplay results={results} />}
              </div>
            )}

            {activeTab === "wikipedia" && (
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="search-input"
                    className="mb-2 block text-sm font-medium text-white"
                  >
                    Search Wikipedia / TUM Pages
                  </label>
                  <div className="flex gap-3">
                    <Input
                      id="search-input"
                      type="text"
                      placeholder="Enter a topic (e.g., Machine Learning)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 border-slate-600 bg-slate-900/50 text-white placeholder:text-slate-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && searchQuery.trim()) {
                          handleAnalyze();
                        }
                      }}
                    />
                    <Button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !searchQuery.trim()}
                      className="bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                    >
                      <Search className="mr-2 h-4 w-4" />
                      {isAnalyzing ? "Searching..." : "Search"}
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Find the most relevant pages using PageRank algorithm.
                  </p>
                </div>

                {!searchResults ? (
                  <Card className="border-slate-700 bg-slate-900/50 p-6">
                    <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-white">
                      <span className="h-2 w-2 rounded-full bg-purple-400" />
                      Search results will appear here
                    </h3>
                    <p className="text-slate-400">
                      Enter a topic and click Search to see the most relevant TUM pages ranked by TF-IDF + PageRank.
                    </p>
                  </Card>
                ) : (
                  <SearchResultsDisplay results={searchResults.results} />
                )}
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* What is PageRank Section */}
      <section className="px-4 py-16">
        <div className="container mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-4xl font-bold text-white md:text-5xl">
            What is{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              PageRank
            </span>
            ?
          </h2>
          <p className="mx-auto mb-12 max-w-3xl text-balance text-center text-lg text-slate-300">
            The algorithm that powered Google's search engine revolution. Now
            available as a web service.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-slate-700 bg-slate-800/50 p-6 backdrop-blur">
              <div className="mb-4 inline-flex rounded-lg bg-blue-500/10 p-3">
                <Network className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">
                Graph Analysis
              </h3>
              <p className="text-balance text-slate-400">
                Analyze complex network structures and relationships between
                nodes with precision.
              </p>
            </Card>

            <Card className="border-slate-700 bg-slate-800/50 p-6 backdrop-blur">
              <div className="mb-4 inline-flex rounded-lg bg-orange-500/10 p-3">
                <Zap className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">
                Fast Processing
              </h3>
              <p className="text-balance text-slate-400">
                Optimized algorithms handle large-scale graphs efficiently,
                processing millions of nodes.
              </p>
            </Card>

            <Card className="border-slate-700 bg-slate-800/50 p-6 backdrop-blur">
              <div className="mb-4 inline-flex rounded-lg bg-purple-500/10 p-3">
                <Globe className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">
                Real-World Data
              </h3>
              <p className="text-balance text-slate-400">
                Apply PageRank to actual networks like Wikipedia and TUM's
                internal pages.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 py-16">
        <div className="container mx-auto max-w-6xl">
          <h2 className="mb-6 text-4xl font-bold text-white">How It Works</h2>

          <p className="mb-12 text-balance text-lg leading-relaxed text-slate-300">
            PageRank is a link analysis algorithm that assigns a numerical
            weighting to each element of a hyperlinked set of documents. The
            algorithm outputs a probability distribution representing the
            likelihood that a person randomly clicking on links will arrive at
            any particular page.
          </p>

          <Card className="border-slate-700 bg-slate-800/30 p-8 backdrop-blur">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-6 text-2xl font-bold text-white">
                  Input Options
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-slate-300">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                    <span>Upload graph files (CSV, JSON)</span>
                  </li>
                  <li className="flex items-start gap-3 text-slate-300">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                    <span>Provide URL for web crawling</span>
                  </li>
                  <li className="flex items-start gap-3 text-slate-300">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-400" />
                    <span>Use pre-loaded datasets</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-6 text-2xl font-bold text-white">
                  Output Data
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-slate-300">
                    <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
                    <span>Ranked list of pages</span>
                  </li>
                  <li className="flex items-start gap-3 text-slate-300">
                    <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
                    <span>PageRank scores</span>
                  </li>
                  <li className="flex items-start gap-3 text-slate-300">
                    <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
                    <span>Network visualizations</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 px-4 py-8">
        <div className="container mx-auto max-w-6xl text-center text-sm text-slate-400">
          <p>Built for TUM Hackathon 2025 • PageRank Algorithm Visualizer</p>
        </div>
      </footer>
    </div>
  );
}

function ResultsDisplay({
  results,
}: {
  results: {
    pages: Array<{ name: string; rank: number; score: number }>;
    metrics: { time: number; memory: number };
    graphData: any;
  };
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-slate-700 bg-gradient-to-br from-blue-950/50 to-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Clock className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Processing Time</p>
              <p className="text-2xl font-bold text-white">
                {results.metrics.time.toFixed(2)}s
              </p>
            </div>
          </div>
        </Card>
        <Card className="border-slate-700 bg-gradient-to-br from-purple-950/50 to-slate-900/50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/10 p-2">
              <HardDrive className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Memory Used</p>
              <p className="text-2xl font-bold text-white">
                {results.metrics.memory.toFixed(1)} MB
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-700 bg-slate-900/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            Network Graph
          </h3>
          <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-950/50">
            <GraphVisualization data={results.graphData} />
          </div>
        </Card>

        <Card className="border-slate-700 bg-slate-900/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            Top Ranked Pages
          </h3>
          <div className="space-y-3">
            {results.pages.map((page) => (
              <div
                key={page.rank}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="border-blue-400/50 bg-blue-950/30 text-blue-300"
                  >
                    #{page.rank}
                  </Badge>
                  <span className="text-sm font-medium text-white">
                    {page.name}
                  </span>
                </div>
                <span className="text-sm font-semibold text-orange-400">
                  {page.score.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function GraphVisualization({ data }: { data: any }) {
  if (!data || !data.nodes || !data.edges) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
        No graph data available.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
<svg className="h-full w-full" viewBox="0 0 400 400">
  {/* Draw edges */}
  {data.edges?.map((edge: any, i: number) => {
    // Find nodes by id instead of indexing by array position
    const fromNode = data.nodes?.find((n: any) => n.id === edge.from);
    const toNode = data.nodes?.find((n: any) => n.id === edge.to);

    // If we can't find either node, skip this edge
    if (!fromNode || !toNode) return null;

    if (
      typeof fromNode.id !== "number" ||
      typeof toNode.id !== "number" ||
      Number.isNaN(fromNode.id) ||
      Number.isNaN(toNode.id)
    ) {
      return null;
    }

    const x1 = 50 + (fromNode.id % 5) * 70 + Math.random() * 20;
    const y1 = 50 + Math.floor(fromNode.id / 5) * 90 + Math.random() * 20;
    const x2 = 50 + (toNode.id % 5) * 70 + Math.random() * 20;
    const y2 = 50 + Math.floor(toNode.id / 5) * 90 + Math.random() * 20;

    return (
      <line
        key={`edge-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="rgb(100, 116, 139)"
        strokeWidth="1"
        opacity="0.3"
      />
    );
  })}

  {/* Draw nodes */}
  {data.nodes?.map((node: any) => {
    if (
      !node ||
      typeof node.id !== "number" ||
      Number.isNaN(node.id)
    ) {
      return null;
    }

    const x = 50 + (node.id % 5) * 70 + Math.random() * 20;
    const y = 50 + Math.floor(node.id / 5) * 90 + Math.random() * 20;

    // Fallback radius if size is missing (URL mode)
    const baseSize = typeof node.size === "number" && !Number.isNaN(node.size)
      ? node.size
      : 12; // default size
    const radius = baseSize / 2;

    return (
      <g key={`node-${node.id}`}>
        <circle
          cx={x}
          cy={y}
          r={radius}
          fill="rgb(96, 165, 250)"
          opacity="0.7"
        />
        <circle
          cx={x}
          cy={y}
          r={radius + 2}
          fill="none"
          stroke="rgb(147, 197, 253)"
          strokeWidth="1"
        />
      </g>
    );
  })}
</svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <p className="rounded-lg bg-slate-900/80 px-3 py-1 text-xs text-slate-400">
          Interactive graph with {data.nodes.length} nodes
        </p>
      </div>
    </div>
  );
}

function SearchResultsDisplay({ results }: { results: SearchResult[] }) {
  if (!results.length) {
    return (
      <Card className="border-slate-700 bg-slate-900/50 p-6">
        <p className="text-slate-400">No results found for this query.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((r) => (
        <Card
          key={r.url + r.tfidf_score}
          className="border-slate-700 bg-slate-900/50 p-4"
        >
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:underline break-all"
          >
            {r.url}
          </a>
          <p className="mt-2 text-sm text-slate-300">{r.snippet}</p>
          <p className="mt-3 text-xs text-slate-500">
            TF-IDF: {r.tfidf_score.toFixed(3)} | PageRank:{" "}
            {r.pagerank_score.toExponential(3)} | Combined:{" "}
            {r.combined_score.toFixed(3)}
          </p>
        </Card>
      ))}
    </div>
  );
}
