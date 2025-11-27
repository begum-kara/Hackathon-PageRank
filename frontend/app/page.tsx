"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Network, Zap, Globe, Upload, Database, Link2, Play, Search, Clock, HardDrive } from "lucide-react"

function MouseTrail() {
  const [dots, setDots] = useState<Array<{ id: number; x: number; y: number; opacity: number; s: number }>>([])
  const nextIdRef = useRef(0)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const size = 10 // star size in px (smaller trail)
      const newDot = {
        id: nextIdRef.current++,
        x: e.clientX,
        y: e.clientY,
        opacity: 1,
        s: size,
      }
      setDots((prev) => [...prev, newDot].slice(-10))
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) =>
        prev
          .map((dot) => ({ ...dot, opacity: dot.opacity - 0.12 })) // faster fade
          .filter((dot) => dot.opacity > 0)
      )
    }, 30)
    return () => clearInterval(interval)
  }, [])

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
  )
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"url" | "upload" | "dataset" | "wikipedia">("url")
  const [url, setUrl] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<{
    pages: Array<{ name: string; rank: number; score: number }>
    metrics: { time: number; memory: number }
    graphData: any
  } | null>(null)

  const demoSectionRef = useRef<HTMLElement>(null)

  const scrollToDemo = () => {
    demoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setResults({
      pages: [
        { name: activeTab === "wikipedia" ? searchQuery || "Machine Learning" : "Homepage", rank: 1, score: 0.342 },
        { name: activeTab === "wikipedia" ? "Artificial Intelligence" : "About Us", rank: 2, score: 0.234 },
        { name: activeTab === "wikipedia" ? "Neural Networks" : "Services", rank: 3, score: 0.189 },
        { name: activeTab === "wikipedia" ? "Deep Learning" : "Contact", rank: 4, score: 0.156 },
        { name: activeTab === "wikipedia" ? "Natural Language Processing" : "Blog", rank: 5, score: 0.079 },
      ],
      metrics: {
        time: Math.random() * 2 + 0.5,
        memory: Math.random() * 100 + 50,
      },
      graphData: generateMockGraphData(),
    })
    setIsAnalyzing(false)
  }

  const generateMockGraphData = () => {
    const nodes = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      label: `Page ${i}`,
      size: Math.random() * 20 + 10,
    }))

    const edges = []
    for (let i = 0; i < 30; i++) {
      const from = Math.floor(Math.random() * 20)
      const to = Math.floor(Math.random() * 20)
      if (from !== to) {
        edges.push({ from, to })
      }
    }

    return { nodes, edges }
  }

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
            Efficiently implement and explore the PageRank algorithm on large-scale real-world graphs. Built for TUM's
            internal pages and Wikipedia.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="bg-blue-500 text-white hover:bg-blue-600" onClick={scrollToDemo}>
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
              <h3 className="mb-2 text-3xl font-bold text-orange-400">Scalable</h3>
              <p className="text-sm text-slate-400">Architecture</p>
            </div>
            <div className="text-center">
              <h3 className="mb-2 text-3xl font-bold text-purple-400">Real-time</h3>
              <p className="text-sm text-slate-400">Analysis</p>
            </div>
          </div>
        </div>
      </section>

      {/* What is PageRank Section */}
      <section className="px-4 py-16">
        <div className="container mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-4xl font-bold text-white md:text-5xl">
            What is{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">PageRank</span>
            ?
          </h2>
          <p className="mx-auto mb-12 max-w-3xl text-balance text-center text-lg text-slate-300">
            The algorithm that powered Google's search engine revolution. Now available as a web service.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-slate-700 bg-slate-800/50 p-6 backdrop-blur">
              <div className="mb-4 inline-flex rounded-lg bg-blue-500/10 p-3">
                <Network className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">Graph Analysis</h3>
              <p className="text-balance text-slate-400">
                Analyze complex network structures and relationships between nodes with precision.
              </p>
            </Card>

            <Card className="border-slate-700 bg-slate-800/50 p-6 backdrop-blur">
              <div className="mb-4 inline-flex rounded-lg bg-orange-500/10 p-3">
                <Zap className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">Fast Processing</h3>
              <p className="text-balance text-slate-400">
                Optimized algorithms handle large-scale graphs efficiently, processing millions of nodes.
              </p>
            </Card>

            <Card className="border-slate-700 bg-slate-800/50 p-6 backdrop-blur">
              <div className="mb-4 inline-flex rounded-lg bg-purple-500/10 p-3">
                <Globe className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">Real-World Data</h3>
              <p className="text-balance text-slate-400">
                Apply PageRank to actual networks like Wikipedia and TUM's internal pages.
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
            PageRank is a link analysis algorithm that assigns a numerical weighting to each element of a hyperlinked
            set of documents. The algorithm outputs a probability distribution representing the likelihood that a person
            randomly clicking on links will arrive at any particular page.
          </p>

          <Card className="border-slate-700 bg-slate-800/30 p-8 backdrop-blur">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-6 text-2xl font-bold text-white">Input Options</h3>
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
                <h3 className="mb-6 text-2xl font-bold text-white">Output Data</h3>
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

      {/* Try the Demo Section */}
      <section ref={demoSectionRef} className="px-4 py-16">
        <div className="container mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-4xl font-bold text-white md:text-5xl">
            Try the{" "}
            <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">Demo</span>
          </h2>
          <p className="mb-12 text-balance text-center text-lg text-slate-300">
            Experience PageRank in action with your own data or our sample datasets.
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
                Wikipedia Search
              </Button>
            </div>

            {activeTab === "url" && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="url-input" className="mb-2 block text-sm font-medium text-white">
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
                    We'll generate a sample graph and calculate PageRank scores for demonstration.
                  </p>
                </div>

                {!results ? (
                  <Card className="border-slate-700 bg-slate-900/50 p-6">
                    <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-white">
                      <span className="h-2 w-2 rounded-full bg-orange-400" />
                      Results will appear here
                    </h3>
                    <p className="text-slate-400">
                      Once you run the analysis, you'll see ranked pages, scores, and network visualizations.
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
                  <p className="mb-2 text-white">Drop your graph file here or click to browse</p>
                  <p className="text-sm text-slate-400">Supports CSV and JSON formats</p>
                  <Button onClick={handleAnalyze} className="mt-4 bg-blue-500 text-white hover:bg-blue-600">
                    Upload and Analyze
                  </Button>
                </div>
                {results && <ResultsDisplay results={results} />}
              </div>
            )}

            {activeTab === "dataset" && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <Card
                    className="cursor-pointer border-slate-700 bg-slate-900/50 p-4 transition-colors hover:border-blue-500"
                    onClick={handleAnalyze}
                  >
                    <h4 className="mb-1 font-semibold text-white">Wikipedia Sample</h4>
                    <p className="text-sm text-slate-400">10,000 interconnected Wikipedia pages</p>
                  </Card>
                  <Card
                    className="cursor-pointer border-slate-700 bg-slate-900/50 p-4 transition-colors hover:border-blue-500"
                    onClick={handleAnalyze}
                  >
                    <h4 className="mb-1 font-semibold text-white">TUM Internal Pages</h4>
                    <p className="text-sm text-slate-400">Complete TUM website graph structure</p>
                  </Card>
                </div>
                {results && <ResultsDisplay results={results} />}
              </div>
            )}

            {activeTab === "wikipedia" && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="search-input" className="mb-2 block text-sm font-medium text-white">
                    Search Wikipedia
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
                          handleAnalyze()
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
                    Find the most relevant Wikipedia pages using PageRank algorithm.
                  </p>
                </div>

                {!results ? (
                  <Card className="border-slate-700 bg-slate-900/50 p-6">
                    <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-white">
                      <span className="h-2 w-2 rounded-full bg-purple-400" />
                      Search results will appear here
                    </h3>
                    <p className="text-slate-400">
                      Enter a topic and click Search to see the most relevant Wikipedia pages ranked by PageRank.
                    </p>
                  </Card>
                ) : (
                  <ResultsDisplay results={results} />
                )}
              </div>
            )}
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
  )
}

function ResultsDisplay({
  results,
}: {
  results: {
    pages: Array<{ name: string; rank: number; score: number }>
    metrics: { time: number; memory: number }
    graphData: any
  }
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
              <p className="text-2xl font-bold text-white">{results.metrics.time.toFixed(2)}s</p>
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
              <p className="text-2xl font-bold text-white">{results.metrics.memory.toFixed(1)} MB</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-700 bg-slate-900/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Network Graph</h3>
          <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-950/50">
            <GraphVisualization data={results.graphData} />
          </div>
        </Card>

        <Card className="border-slate-700 bg-slate-900/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Top Ranked Pages</h3>
          <div className="space-y-3">
            {results.pages.map((page) => (
              <div
                key={page.rank}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-blue-400/50 bg-blue-950/30 text-blue-300">
                    #{page.rank}
                  </Badge>
                  <span className="text-sm font-medium text-white">{page.name}</span>
                </div>
                <span className="text-sm font-semibold text-orange-400">{page.score.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function GraphVisualization({ data }: { data: any }) {
  return (
    <div className="relative h-full w-full">
      <svg className="h-full w-full" viewBox="0 0 400 400">
        {data.edges.map((edge: any, i: number) => {
          const fromNode = data.nodes[edge.from]
          const toNode = data.nodes[edge.to]
          const x1 = 50 + (fromNode.id % 5) * 70 + Math.random() * 20
          const y1 = 50 + Math.floor(fromNode.id / 5) * 90 + Math.random() * 20
          const x2 = 50 + (toNode.id % 5) * 70 + Math.random() * 20
          const y2 = 50 + Math.floor(toNode.id / 5) * 90 + Math.random() * 20

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
          )
        })}

        {data.nodes.map((node: any) => {
          const x = 50 + (node.id % 5) * 70 + Math.random() * 20
          const y = 50 + Math.floor(node.id / 5) * 90 + Math.random() * 20
          const radius = node.size / 2

          return (
            <g key={`node-${node.id}`}>
              <circle cx={x} cy={y} r={radius} fill="rgb(96, 165, 250)" opacity="0.7" />
              <circle cx={x} cy={y} r={radius + 2} fill="none" stroke="rgb(147, 197, 253)" strokeWidth="1" />
            </g>
          )
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="rounded-lg bg-slate-900/80 px-3 py-1 text-xs text-slate-400">
          Interactive graph with {data.nodes.length} nodes
        </p>
      </div>
    </div>
  )
}
