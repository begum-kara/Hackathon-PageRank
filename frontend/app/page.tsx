"use client"

import { useState } from "react"
import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Network, Zap, Globe, Upload, Database, Link2, Play } from "lucide-react"
import { uploadGraph } from "../lib/api";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"url" | "upload" | "dataset">("url")
  const [url, setUrl] = useState("")

  //for uploading files
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  //upload handler 
  async function handleUpload() {
  if (!uploadFile) {
    setUploadError("Please upload a file first.");
    return;
  }

  setUploadLoading(true);
  setUploadError(null);
  setUploadResult(null);

  try {
    const result = await uploadGraph(uploadFile, 10);
    setUploadResult(result.top);
  } catch (err: any) {
    setUploadError(err.message);
  } finally {
    setUploadLoading(false);
  }
}

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1f3a] via-[#253058] to-[#2d2550]">
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
            <Button size="lg" className="bg-blue-500 text-white hover:bg-blue-600">
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

          {/* Feature Pills */}
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
            {/* Graph Analysis Card */}
            <Card className="border-slate-700 bg-slate-800/50 p-6 backdrop-blur">
              <div className="mb-4 inline-flex rounded-lg bg-blue-500/10 p-3">
                <Network className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">Graph Analysis</h3>
              <p className="text-balance text-slate-400">
                Analyze complex network structures and relationships between nodes with precision.
              </p>
            </Card>

            {/* Fast Processing Card */}
            <Card className="border-slate-700 bg-slate-800/50 p-6 backdrop-blur">
              <div className="mb-4 inline-flex rounded-lg bg-orange-500/10 p-3">
                <Zap className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">Fast Processing</h3>
              <p className="text-balance text-slate-400">
                Optimized algorithms handle large-scale graphs efficiently, processing millions of nodes.
              </p>
            </Card>

            {/* Real-World Data Card */}
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
              {/* Input Options */}
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

              {/* Output Data */}
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
      
      <section className="px-4 py-16">
        <div className="container mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-4xl font-bold text-white md:text-5xl">
            Try the{" "}
            <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">Demo</span>
          </h2>
          <p className="mb-12 text-balance text-center text-lg text-slate-300">
            Experience PageRank in action with your own data or our sample datasets.
          </p>

          <Card className="border-slate-700 bg-slate-800/50 p-8 backdrop-blur">
            {/* Tab Buttons */}
            <div className="mb-8 flex gap-4">
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
            </div>

            {/* URL Tab Content */}
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
                    <Button className="bg-blue-500 text-white hover:bg-blue-600">
                      <Play className="mr-2 h-4 w-4" />
                      Analyze
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    We'll generate a sample graph and calculate PageRank scores for demonstration.
                  </p>
                </div>

                <Card className="border-slate-700 bg-slate-900/50 p-6">
                  <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-white">
                    <span className="h-2 w-2 rounded-full bg-orange-400" />
                    Results will appear here
                  </h3>
                  <p className="text-slate-400">
                    Once you run the analysis, you'll see ranked pages, scores, and network visualizations.
                  </p>
                </Card>
              </div>
            )}

            {/* Upload Tab Content */}
            {activeTab === "upload" && (
  <div className="space-y-6">

    {/* Upload Box */}
    <div className="rounded-lg border-2 border-dashed border-slate-600 bg-slate-900/50 p-12 text-center">
      <input
        type="file"
        id="file-upload"
        className="hidden"
        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        <Upload className="mx-auto mb-4 h-12 w-12 text-slate-400" />
        <p className="mb-2 text-white">Drop your graph file here or click to browse</p>
        <p className="text-sm text-slate-400">Supports TXT edge lists</p>
      </label>
    </div>

    {/* Run Button */}
    <Button
      onClick={handleUpload}
      disabled={uploadLoading}
      className="bg-blue-500 text-white hover:bg-blue-600"
    >
      {uploadLoading ? "Running PageRank..." : "Run PageRank"}
    </Button>

    {/* Results */}
    <Card className="border-slate-700 bg-slate-900/50 p-6">
      <h3 className="mb-2 text-lg font-semibold text-white">Results</h3>

      {uploadError && <p className="text-red-400">{uploadError}</p>}

      {uploadResult && (
        <ul className="space-y-2 text-white">
          {uploadResult.map((node: any, idx: number) => (
            <li key={idx}>
              <span className="font-bold">Node {node.node}</span> → {node.score.toFixed(10)}
            </li>
          ))}
        </ul>
      )}

      {!uploadResult && !uploadError && (
        <p className="text-slate-400">Upload a graph to see PageRank scores.</p>
      )}
    </Card>

  </div>
)}


            {/* Dataset Tab Content */}
            {activeTab === "dataset" && (
              <div className="space-y-4">
                <Card className="cursor-pointer border-slate-700 bg-slate-900/50 p-4 transition-colors hover:border-blue-500">
                  <h4 className="mb-1 font-semibold text-white">Wikipedia Sample</h4>
                  <p className="text-sm text-slate-400">10,000 interconnected Wikipedia pages</p>
                </Card>
                <Card className="cursor-pointer border-slate-700 bg-slate-900/50 p-4 transition-colors hover:border-blue-500">
                  <h4 className="mb-1 font-semibold text-white">TUM Internal Pages</h4>
                  <p className="text-sm text-slate-400">Complete TUM website graph structure</p>
                </Card>
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
