# <img src="https://hosted.inled.es/mdpedia.png" width="40" height="40" align="center" /> MDPEDIA

### *Knowledge for the AI Era*

**MDPEDIA** is an imposing, serverless documentation repository designed to be the bridge between human knowledge and AI agents. Built with **Astro** and deployed on **Cloudflare Workers**, it provides a high-performance, extensionless UI for humans and a raw, token-efficient Markdown API for agents.

---

## ⚙️ How it Works

- **Intelligent Content Routing**: The system automatically detects the requester. Humans are served a polished, extensionless Fluent 3D interface for comfortable reading, while AI agents receive raw, token-efficient Markdown via `/raw/` paths or `Accept` headers.
- **Issue-Driven Indexing**: MDPEDIA acts as a "remote-controlled" library. By opening a GitHub Issue with a URL, you trigger a serverless crawler that fetches the content, strips away web noise (ads, navbars, trackers), and converts it into structured Markdown.
- **Recursive Wildcard Expansion**: When a URL ends in `*`, the system performs a directory-level crawl. It maps the entire documentation structure of a domain and indexes every sub-page while maintaining the original hierarchy.
- **Context-Aware Link Transformation**: To ensure seamless navigation, the system dynamically rewrites internal links. Agents are kept within the high-speed Markdown ecosystem, while humans enjoy clean, extensionless navigation.
- **Zero-Latency Global Search**: By utilizing a pre-computed search index generated during the build process, MDPEDIA provides millisecond-latency results across all indexed domains without requiring a traditional database.

## 🛠️ Tech Stack

- **Framework**: [Astro 5.0](https://astro.build/) (Server-side Rendering)
- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Styling**: Vanilla CSS (Fluent 3D patterns)
- **Icons**: FontAwesome 6.5.1
- **Typography**: Plus Jakarta Sans

---

## 🚀 How to use it

### For Humans 👨‍💻
Navigate to [mdpedia.inled.es](https://mdpedia.inled.es) to explore the indexed knowledge. Use the search bar to find specific topics across multiple documentation domains.

### For AI Agents 🤖
Agents can access any document in raw Markdown by prepending `/raw/` to the path or by using a standard `curl` request:

```bash
# Search for knowledge
curl -H "Accept: text/markdown" "https://mdpedia.inled.es/search?q=react"

# Fetch a specific document
curl "https://mdpedia.inled.es/raw/es.react.dev/reference/react/useState.md"
```

---

## 📈 Indexing New Content

Indexing is completely automated via GitHub Issues:

1. **Single Page**: Open an issue with the title: `https://example.com/docs/page`
2. **Bulk Indexing**: Open an issue with the title: `https://example.com/docs/*` (The crawler will recursively find all sub-pages).
3. **Refresh Index**: Use `reindex https://example.com/docs/*` to update the domain's structure and titles without re-downloading everything.

---

## 📜 Security & Policies

- **Wikipedia Block**: MDPEDIA explicitly blocks `wikipedia.org` to focus on technical and structured documentation.
- **Agent Detection**: We use specific User-Agents and Header detection to ensure agents get the most efficient content.

---

<p align="center">
  <sub>Built by <strong>InledLabs</strong> — Optimizing the world's knowledge for the next generation of intelligence.</sub>
</p>
