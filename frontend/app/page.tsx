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
    GitBranch
} from "lucide-react";
import {
  uploadGraph,
  PageRankNode,
  searchTum,
  SearchResult,
  PageRankResponse,
  pagerankFromUrl,
  SearchResponse,
} from "@/lib/api";
import { Plus, Settings } from "lucide-react";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../components/ui/select";
import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";

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
    "url" | "upload" | "wikipedia" | "custom"
  >("url");
  const [url, setUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<{
    pages: Array<{ name: string; rank: number; score: number }>;
    graphData: any;
  } | null>(null);
  // Custom graph state
  const [customNodes, setCustomNodes] = useState<
    Array<{ id: string; name: string; x: number; y: number }>
  >([]);
  const [customEdges, setCustomEdges] = useState<
    Array<{ from: string; to: string }>
  >([]);
  const [newNodeName, setNewNodeName] = useState("");
  const [edgeFrom, setEdgeFrom] = useState("");
  const [edgeTo, setEdgeTo] = useState("");
  const [dampingFactor, setDampingFactor] = useState(0.85);
  const [convergenceThreshold, setConvergenceThreshold] = useState(0.0001);
  const [danglingNodeStrategy, setDanglingNodeStrategy] = useState<
    "teleport" | "distribute"
  >("teleport");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [customResults, setCustomResults] = useState<any>(null);

  const [customZoom, setCustomZoom] = useState(1);
  const [customPan, setCustomPan] = useState({ x: 0, y: 0 });
  const [customIsPanning, setCustomIsPanning] = useState(false);
  const [customPanStart, setCustomPanStart] = useState({ x: 0, y: 0 });

  const [customNetworkDraggedNode, setCustomNetworkDraggedNode] = useState<
    string | null
  >(null);
  const [customNetworkNodePositions, setCustomNetworkNodePositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pagerankResults, setPagerankResults] = useState<PageRankNode[] | null>(
    null
  );
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(
    null
  );

  const demoSectionRef = useRef<HTMLElement>(null);
  const whatIsSectionRef = useRef<HTMLElement | null>(null);

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
  const scrollToWhatIs = () => {
    whatIsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const addNode = () => {
    if (!newNodeName.trim()) return;

    const id = String(customNodes.length);
    const newNode = {
      id,
      name: newNodeName.trim(),
      x: 200 + Math.random() * 100 - 50,
      y: 200 + Math.random() * 100 - 50,
    };

    setCustomNodes([...customNodes, newNode]);
    setNewNodeName("");
    setResults(null);
  };

  const removeNode = (id: string) => {
    setCustomNodes(customNodes.filter((n) => n.id !== id));
    setCustomEdges(customEdges.filter((e) => e.from !== id && e.to !== id));
    setResults(null);
  };

  const addEdge = () => {
    if (!edgeFrom || !edgeTo) return;
    if (edgeFrom === edgeTo) return;

    setCustomEdges([...customEdges, { from: edgeFrom, to: edgeTo }]);
    setResults(null);
  };

  const removeEdge = (from: string, to: string) => {
    setCustomEdges(
      customEdges.filter((e) => !(e.from === from && e.to === to))
    );
    setResults(null);
  };

  const handleNodeMouseDown = (e: any, nodeId: string) => {
    e.stopPropagation();

    const node = customNodes.find((n) => n.id === nodeId);
    if (!node) return;

    setDraggedNode(nodeId);
    setDragOffset({
      x: e.clientX - node.x,
      y: e.clientY - node.y,
    });
  };

  const handleMouseMove = (e: any) => {
    if (!draggedNode) return;

    setCustomNodes((prev) =>
      prev.map((n) =>
        n.id === draggedNode
          ? { ...n, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }
          : n
      )
    );
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
  };

  const calculateArrowEndpoint = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    radius: number
  ) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    return {
      x: x2 - Math.cos(angle) * radius,
      y: y2 - Math.sin(angle) * radius,
    };
  };

  const startPan = (e: any) => {
    setCustomIsPanning(true);
    setCustomPanStart({
      x: e.clientX - customPan.x,
      y: e.clientY - customPan.y,
    });
  };

  const doPan = (e: any) => {
    if (!customIsPanning) return;
    setCustomPan({
      x: e.clientX - customPanStart.x,
      y: e.clientY - customPanStart.y,
    });
  };

  const endPan = () => setCustomIsPanning(false);

  const handleZoom = (e: any) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setCustomZoom((z) => Math.min(2.5, Math.max(0.4, z + delta)));
  };

  const calculatePageRank = () => {
    const N = customNodes.length;
    if (N === 0) return [];

    // Build adjacency
    const inbound: Record<string, string[]> = {};
    const outDegree: Record<string, number> = {};

    customNodes.forEach((n) => {
      inbound[n.id] = [];
      outDegree[n.id] = 0;
    });

    customEdges.forEach((e) => {
      inbound[e.to].push(e.from);
      outDegree[e.from]++;
    });

    // Initialize rank
    let rank: Record<string, number> = {};
    customNodes.forEach((n) => (rank[n.id] = 1 / N));

    let converged = false;

    while (!converged) {
      const newRank: Record<string, number> = {};
      converged = true;

      // Total rank from dangling nodes
      let danglingMass = 0;
      customNodes.forEach((n) => {
        if (outDegree[n.id] === 0) {
          danglingMass += rank[n.id];
        }
      });

      customNodes.forEach((node) => {
        const id = node.id;

        // (1-d)/N teleportation base
        let r = (1 - dampingFactor) / N;

        // Dangling node contribution
        if (danglingNodeStrategy === "distribute") {
          r += dampingFactor * (danglingMass / N);
        } else if (danglingNodeStrategy === "teleport") {
          // teleporting: danglingMass is absorbed into teleport (already in base term)
          // so we add nothing here
        }

        // Add inbound contribution
        inbound[id].forEach((src) => {
          if (outDegree[src] > 0) {
            r += (dampingFactor * rank[src]) / outDegree[src];
          }
        });

        newRank[id] = r;

        // Check convergence
        if (Math.abs(newRank[id] - rank[id]) > convergenceThreshold) {
          converged = false;
        }
      });

      rank = newRank;
    }

    return customNodes
      .map((n) => ({ id: n.id, score: rank[n.id] }))
      .sort((a, b) => b.score - a.score);
  };

  const buildAdjacencyMatrix = () => {
    const size = customNodes.length;
    const matrix = Array.from({ length: size }, () => Array(size).fill(0));

    customEdges.forEach((e) => {
      const fromIndex = customNodes.findIndex((n) => n.id === e.from);
      const toIndex = customNodes.findIndex((n) => n.id === e.to);
      if (fromIndex !== -1 && toIndex !== -1) {
        matrix[fromIndex][toIndex] = 1;
      }
    });

    return matrix;
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
        const trimmed = url.trim();
        if (!trimmed) {
          alert("Please enter a URL");
          return;
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
          graphData: {
            nodes: apiRes.nodes.map((n) => ({
              id: n.id,
              label: n.url,
            })),
            edges: apiRes.edges,
          },
        });

        // URL mode is a PageRank demo, not TF-IDF search
        setSearchResults(null);
        return;
      } else if (activeTab === "custom") {
        const pageRankResults = calculatePageRank();
        const endTime = performance.now();
        const formattedPages = pageRankResults.map((r, i) => ({
          name: customNodes.find((n) => n.id === r.id)?.name ?? `Node ${r.id}`,
          rank: i + 1,
          score: r.score,
        }));

        setResults({
          pages: formattedPages,
          graphData: {
            nodes: customNodes.map((n) => ({
              id: n.id,
              label: n.name,
              size:
                (pageRankResults.find((p) => p.id === n.id)?.score || 0) * 400 +
                10,
            })),
            edges: customEdges.map((e) => ({
              from: e.from,
              to: e.to,
            })),
          },
        });
        return;
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
              onClick={scrollToWhatIs}
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
            Experience PageRank in action. Search for a URL, upload a file or
            explore by keywords.
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
              <Button
                onClick={() => setActiveTab("custom")}
                className={
                  activeTab === "custom"
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }
              >
                <GitBranch className="mr-2 h-4 w-4" />

              Custom Graph
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
                    We'll crawl a small neighborhood around this URL and
                    calculate PageRank scores for the discovered pages.
                  </p>
                </div>
                {!results ? (
                  <Card className="border-slate-700 bg-slate-900/50 p-6">
                    <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-white">
                      <span className="h-2 w-2 rounded-full bg-purple-400" />
                      PageRank results will appear here
                    </h3>
                    <p className="text-slate-400">
                      Enter a URL and click Analyze to see the most important
                      pages in its local link graph.
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
                  <p className="mb-2 text-white">Click to browse.</p>
                  <p className="text-sm text-slate-400">
                    Supports TXT in 0 1 edge list format
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
                      Enter a topic and click Search to see the most relevant
                      TUM pages ranked by TF-IDF + PageRank.
                    </p>
                  </Card>
                ) : (
                  <SearchResultsDisplay results={searchResults.results} />
                )}
              </div>
            )}
            {activeTab === "custom" && (
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Interactive Graph Canvas */}
                  <Card className="border-slate-700 bg-slate-900/50 p-6">
                    <h3 className="mb-4 text-lg font-semibold text-white">
                      Interactive Graph
                    </h3>
                    <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-700 bg-slate-950/50">
                      <svg
                        className="h-full w-full"
                        viewBox="0 0 400 400"
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      >
                        {customEdges.map((edge, idx) => {
                          const fromNode = customNodes.find(
                            (n) => n.id === edge.from
                          );
                          const toNode = customNodes.find(
                            (n) => n.id === edge.to
                          );
                          if (!fromNode || !toNode) return null;

                          const nodeRadius = 20;
                          const endpoint = calculateArrowEndpoint(
                            fromNode.x,
                            fromNode.y,
                            toNode.x,
                            toNode.y,
                            nodeRadius
                          );

                          return (
                            <g key={`edge-${idx}`}>
                              <line
                                x1={fromNode.x}
                                y1={fromNode.y}
                                x2={endpoint.x}
                                y2={endpoint.y}
                                stroke="rgb(100, 116, 139)"
                                strokeWidth="2"
                                opacity="0.6"
                                markerEnd="url(#arrowhead)"
                              />
                            </g>
                          );
                        })}

                        {/* Arrow marker definition */}
                        <defs>
                          <marker
                            id="arrowhead"
                            markerWidth="10"
                            markerHeight="10"
                            refX="9"
                            refY="3"
                            orient="auto"
                            markerUnits="strokeWidth"
                          >
                            <path
                              d="M0,0 L0,6 L9,3 z"
                              fill="rgb(100, 116, 139)"
                            />
                          </marker>
                          <marker
                            id="network-arrowhead"
                            markerWidth="8"
                            markerHeight="8"
                            refX="7"
                            refY="2.5"
                            orient="auto"
                            markerUnits="strokeWidth"
                          >
                            <path
                              d="M0,0 L0,5 L7,2.5 z"
                              fill="rgb(100, 116, 139)"
                            />
                          </marker>
                        </defs>

                        {/* Draw nodes */}
                        {customNodes.map((node) => (
                          <g key={node.id}>
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r="20" // Node radius
                              fill={
                                selectedNode === node.id
                                  ? "rgb(167, 139, 250)"
                                  : "rgb(96, 165, 250)"
                              } // Highlight selected node
                              opacity="0.8"
                              className="cursor-move transition-all hover:opacity-100"
                              onClick={() =>
                                setSelectedNode(
                                  selectedNode === node.id ? null : node.id
                                )
                              } // Toggle node selection
                              onMouseDown={(e) =>
                                handleNodeMouseDown(e, node.id)
                              }
                              style={{
                                cursor:
                                  draggedNode === node.id ? "grabbing" : "grab",
                              }}
                            />
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r="22" // Outer ring for selection indication
                              fill="none"
                              stroke={
                                selectedNode === node.id
                                  ? "rgb(196, 181, 253)"
                                  : "rgb(147, 197, 253)"
                              }
                              strokeWidth="2"
                              className="pointer-events-none"
                            />
                            {/* Node ID */}
                            <text
                              x={node.x}
                              y={node.y}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="white"
                              fontSize="12"
                              fontWeight="bold"
                              className="pointer-events-none" // Prevent text from interfering with clicks
                            >
                              {node.id}
                            </text>
                            {/* Node Name */}
                            <text
                              x={node.x}
                              y={node.y + 35} // Position below the node
                              textAnchor="middle"
                              fill="rgb(203, 213, 225)"
                              fontSize="10"
                              className="pointer-events-none"
                            >
                              {node.name}
                            </text>
                          </g>
                        ))}
                      </svg>

                      {/* Placeholder if no nodes are added */}
                      {customNodes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p className="text-slate-500">
                            Add nodes to start building your graph
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {/* Node creation controls */}
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Node name"
                          value={newNodeName}
                          onChange={(e) => setNewNodeName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addNode()}
                          className="h-8 w-32 border-slate-600 bg-slate-950/50 text-sm text-white placeholder:text-slate-500"
                        />
                        <Button
                          onClick={addNode}
                          size="sm"
                          className="h-8 bg-green-600 hover:bg-green-700"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Edge creation controls */}
                      <div className="flex items-center gap-2">
                        <Select value={edgeFrom} onValueChange={setEdgeFrom}>
                          <SelectTrigger className="h-8 w-24 border-slate-600 bg-slate-950/50 text-sm text-white">
                            <SelectValue placeholder="From" />
                          </SelectTrigger>
                          <SelectContent>
                            {customNodes.map((node) => (
                              <SelectItem key={node.id} value={node.id}>
                                {node.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-slate-400">→</span>
                        <Select value={edgeTo} onValueChange={setEdgeTo}>
                          <SelectTrigger className="h-8 w-20 border-slate-600 bg-slate-950/50 text-sm text-white">
                            <SelectValue placeholder="To" />
                          </SelectTrigger>
                          <SelectContent>
                            {customNodes.map((node) => (
                              <SelectItem key={node.id} value={node.id}>
                                {node.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={addEdge}
                          size="sm"
                          className="h-8 bg-green-600 hover:bg-green-700"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {/* Parameters & Controls */}
                  <div className="space-y-4">
                    {/* Parameters Card */}
                    <Card className="border-slate-700 bg-slate-900/50 p-6">
                      <div className="mb-4 flex items-center gap-2">
                        <Settings className="h-5 w-5 text-purple-400" />
                        <h3 className="text-lg font-semibold text-white">
                          PageRank Parameters
                        </h3>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm text-slate-300">
                            Damping Factor
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="1"
                              step="0.05"
                              value={dampingFactor}
                              onChange={(e) => {
                                setDampingFactor(
                                  Number.parseFloat(e.target.value)
                                );
                                setResults(null);
                              }}
                              className="border-slate-600 bg-slate-950/50 text-white"
                            />
                            <span className="text-sm text-slate-400">
                              {dampingFactor}
                            </span>
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm text-slate-300">
                            Convergence Threshold
                          </Label>
                          <Input
                            type="number"
                            min="0.00001"
                            max="0.01"
                            step="0.0001"
                            value={convergenceThreshold}
                            onChange={(e) => {
                              setConvergenceThreshold(
                                Number.parseFloat(e.target.value)
                              );
                              setResults(null);
                            }}
                            className="border-slate-600 bg-slate-950/50 text-white"
                          />
                        </div>

                        <div>
                          <Label className="text-sm text-slate-300">
                            Dangling Node Strategy
                          </Label>
                          <Select
                            value={danglingNodeStrategy}
                            onValueChange={(v: any) => {
                              setDanglingNodeStrategy(v);
                              setResults(null);
                            }}
                          >
                            <SelectTrigger className="border-slate-600 bg-slate-950/50 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="teleport">
                                Teleport to Random
                              </SelectItem>
                              <SelectItem value="distribute">
                                Distribute Evenly
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </Card>

                    {/* PageRank formula explanation */}
                    <Card className="border-slate-700 bg-slate-900/50 p-6">
                      <div className="mb-4 flex items-center gap-2">
                        <svg
                          className="h-5 w-5 text-orange-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        </svg>
                        <h3 className="text-lg font-semibold text-white">
                          PageRank Formula
                        </h3>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-lg bg-slate-950/50 p-4">
                          <div className="overflow-x-auto text-center">
                            <div className="text-base text-white">
                              <span className="font-mono text-white">
                                <BlockMath math="\mathrm{PR}(p_i)=\frac{1-d}{N}+d\sum_{p_j\in M(p_i)}\frac{\mathrm{PR}(p_j)}{L(p_j)}" />
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-slate-300">
                          <h4 className="font-semibold text-white">
                            Notation:
                          </h4>
                          <div className="grid gap-2">
                            <div className="flex gap-2">
                              <span className="font-mono text-blue-400">
                                {"PR(pᵢ)"}
                              </span>
                              <span className="text-slate-400">-</span>
                              <span>{"PageRank score of page pᵢ"}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="font-mono text-blue-400">
                                {"d"}
                              </span>
                              <span className="text-slate-400">-</span>
                              <span>
                                Damping factor (probability of following a link)
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <span className="font-mono text-blue-400">
                                {"N"}
                              </span>
                              <span className="text-slate-400">-</span>
                              <span>Total number of pages in the graph</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="font-mono text-blue-400">
                                {"M(pᵢ)"}
                              </span>
                              <span className="text-slate-400">-</span>
                              <span>{"Set of pages that link to page pᵢ"}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="font-mono text-blue-400">
                                {"L(pⱼ)"}
                              </span>
                              <span className="text-slate-400">-</span>
                              <span>
                                {"Number of outbound links from page pⱼ"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/30 p-3">
                            <p className="text-xs leading-relaxed text-slate-400">
                              {
                                "The formula represents the probability that a random surfer will arrive at a page. The first term (1-d)/N represents the probability of randomly jumping to any page (teleportation), while the second term represents the probability of following links from other pages."
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Adjacency Matrix */}
                {customNodes.length > 0 && ( // Only show if there are nodes
                  <Card className="border-slate-700 bg-slate-900/50 p-6">
                    <h3 className="mb-4 text-lg font-semibold text-white">
                      Adjacency Matrix
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr>
                            <th className="border border-slate-700 bg-slate-800 p-2 text-xs text-slate-400"></th>
                            {customNodes.map((node) => (
                              <th
                                key={node.id}
                                className="border border-slate-700 bg-slate-800 p-2 text-xs text-blue-300"
                              >
                                {node.id} {/* Display node IDs in header */}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {buildAdjacencyMatrix().map((row, i) => (
                            <tr key={i}>
                              <th className="border border-slate-700 bg-slate-800 p-2 text-xs text-blue-300">
                                {customNodes[i].id}{" "}
                                {/* Display node ID in row header */}
                              </th>
                              {row.map((cell, j) => (
                                <td
                                  key={j}
                                  className={`border border-slate-700 p-2 text-center text-xs ${
                                    cell === 1
                                      ? "bg-blue-900/50 font-semibold text-blue-200"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {/* Calculate Button */}
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || customNodes.length === 0} // Disable if no nodes or analyzing
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  size="lg"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Calculate PageRank
                    </>
                  )}
                </Button>
              </div>
            )}
            {activeTab === "custom" && results && (
              <ResultsDisplay results={results} showNetworkGraph={true} />
            )}
          </Card>
        </div>
      </section>

      {/* What is PageRank Section */}
      <section ref={whatIsSectionRef} className="px-4 py-16">
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
                    <span>Search query using keywords</span>
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
  showNetworkGraph,
}: {
  showNetworkGraph?: boolean;
  results: {
    pages: Array<{ name: string; rank: number; score: number }>;
    graphData: any;
  };
}) {
  return (
    <div className="space-y-6">
      <div
        className={
          showNetworkGraph
            ? "grid gap-6 lg:grid-cols-2" // two columns when graph exists
            : "grid gap-6 lg:grid-cols-1" // one column when NO graph
        }
      >
        {/* Only render the network graph if explicitly allowed */}
        {showNetworkGraph && (
          <Card className="border-slate-700 bg-slate-900/50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">
              Network Graph
            </h3>
            <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-950/50">
              <GraphVisualization
                data={results.graphData}
                draggedNode={null}
                setDraggedNode={() => {}}
                nodePositions={new Map()}
                setNodePositions={() => {}}
              />
            </div>
          </Card>
        )}

        <Card className="border-slate-700 bg-slate-900/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            Top Ranked Pages
          </h3>
          <div className="space-y-3 break-words">
            {results.pages.map((page) => (
              <div
                key={page.rank}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/50 p-3 "
              >
                <div className="flex items-center gap-3  max-w-full overflow-hidden">
                  <Badge
                    variant="outline"
                    className="border-blue-400/50 bg-blue-950/30 text-blue-300 break-all"
                  >
                    #{page.rank}
                  </Badge>
                  <span className="text-sm font-medium text-white break-all">
                    {page.name}
                  </span>
                </div>
                <span className="text-sm font-semibold text-orange-400 pl-3">
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

function GraphVisualization({
  data,
  zoom = 1,
  pan = { x: 0, y: 0 },
  draggedNode = null,
  setDraggedNode = () => {},
  nodePositions = new Map(),
  setNodePositions = () => {},
}: {
  data: any;
  zoom?: number;
  pan?: { x: number; y: number };
  draggedNode?: string | null;
  setDraggedNode?: (id: string | null) => void;
  nodePositions?: Map<string, { x: number; y: number }>;
  setNodePositions?: (positions: Map<string, { x: number; y: number }>) => void;
}) {
  if (!data || !data.nodes || !data.edges) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-slate-500">No graph data available.</p>
      </div>
    );
  }

  const nodeMap = new Map<string, { x: number; y: number; size: number }>();
  const canvasWidth = 400;
  const canvasHeight = 400;
  const padding = 50;

  // Initialize positions if not set
  if (nodePositions.size === 0) {
    const nodesPerRow = Math.min(5, data.nodes.length);
    const newPositions = new Map<string, { x: number; y: number }>();

    data.nodes.forEach((node: any, index: number) => {
      if (node.id !== undefined && node.size !== undefined) {
        const x =
          padding +
          ((index % nodesPerRow) * (canvasWidth - 2 * padding)) / nodesPerRow;
        const y =
          padding +
          (Math.floor(index / nodesPerRow) * (canvasHeight - 2 * padding)) /
            Math.ceil(data.nodes.length / nodesPerRow);
        newPositions.set(node.id.toString(), { x, y });
        nodeMap.set(node.id.toString(), { x, y, size: node.size });
      }
    });

    setNodePositions(newPositions);
  } else {
    // Use existing positions
    data.nodes.forEach((node: any) => {
      const pos = nodePositions.get(node.id.toString());
      if (pos && node.size !== undefined) {
        nodeMap.set(node.id.toString(), { ...pos, size: node.size });
      }
    });
  }

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggedNode(nodeId);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggedNode) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvasWidth;
    const y = ((e.clientY - rect.top) / rect.height) * canvasHeight;

    const clampedX = Math.max(30, Math.min(canvasWidth - 30, x));
    const clampedY = Math.max(30, Math.min(canvasHeight - 30, y));

    const newPositions = new Map(nodePositions);
    newPositions.set(draggedNode, { x: clampedX, y: clampedY });
    setNodePositions(newPositions);
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
  };

  const calculateArrowEndpoint = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    nodeRadius: number
  ) => {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return { x: toX, y: toY };

    const ux = dx / distance;
    const uy = dy / distance;

    return {
      x: toX - ux * nodeRadius,
      y: toY - uy * nodeRadius,
    };
  };

  return (
    <div className="relative h-full w-full">
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${
            pan.y / zoom
          }px)`,
          transformOrigin: "center",
          transition: draggedNode ? "none" : "transform 0.1s ease-out",
        }}
      >
        {data.edges.map((edge: any, i: number) => {
          const fromNode = nodeMap.get(edge.from.toString());
          const toNode = nodeMap.get(edge.to.toString());

          if (!fromNode || !toNode) return null;

          const nodeRadius = toNode.size / 2;
          const endpoint = calculateArrowEndpoint(
            fromNode.x,
            fromNode.y,
            toNode.x,
            toNode.y,
            nodeRadius
          );

          return (
            <line
              key={`edge-${i}`}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={endpoint.x}
              y2={endpoint.y}
              stroke="rgb(100, 116, 139)"
              strokeWidth="1.5"
              opacity="0.4"
              markerEnd="url(#network-arrowhead)"
            />
          );
        })}

        {data.nodes.map((node: any) => {
          const nodeData = nodeMap.get(node.id.toString());
          if (!nodeData) return null;

          const radius = nodeData.size / 2;

          return (
            <g
              key={`node-${node.id}`}
              style={{
                cursor:
                  draggedNode === node.id.toString() ? "grabbing" : "grab",
              }}
            >
              <circle
                cx={nodeData.x}
                cy={nodeData.y}
                r={radius}
                fill="rgb(96, 165, 250)"
                opacity="0.7"
                onMouseDown={(e) => handleNodeMouseDown(e, node.id.toString())}
              />
              <circle
                cx={nodeData.x}
                cy={nodeData.y}
                r={radius + 2}
                fill="none"
                stroke="rgb(147, 197, 253)"
                strokeWidth="1"
                className="pointer-events-none"
              />
            </g>
          );
        })}

        <defs>
          <marker
            id="network-arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="2.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,5 L7,2.5 z" fill="rgb(100, 116, 139)" />
          </marker>
        </defs>
      </svg>
      <div className="pointer-events-none absolute bottom-4 left-4">
        <p className="rounded-lg bg-slate-900/80 px-3 py-1 text-xs text-slate-400">
          Drag nodes • Scroll to zoom • Drag background to pan
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
