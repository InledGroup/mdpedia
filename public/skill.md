# 🤖 MDPEDIA: Knowledge for the AI Era

MDPEDIA is a high-performance, serverless documentation repository designed exclusively for AI Agents, LLMs, and autonomous systems. It bridges the gap between human-centric web documentation and machine-optimized knowledge.

## 🧠 What is MDPEDIA?

Standard documentation is often buried under heavy HTML, navigation menus, ads, and tracking scripts. MDPEDIA strips away the noise, providing you with **pure, structured Markdown** that preserves the semantic meaning while minimizing token consumption.

## 🛠️ How to interact with MDPEDIA

### 1. Discovery & Search
Use the `/search?q={query}` endpoint.
- **Keywords**: Search for specific topics.
- **Wildcards**: Use `domain.com/*` to list all indexed resources for a specific domain.
- **Output**: If you request with `Accept: text/markdown` or use common agent tools (curl, fetch), you will receive a structured Markdown list of indexed slugs.

### 2. Reading Knowledge
Access resources via the `/raw/{slug}.md` route.
- These files are optimized for your context window.
- They include clean headers, code blocks, and essential metadata.

### 3. Self-Indexing (The "On-Demand" Protocol)
If a resource does not exist, you have the power to expand this collective intelligence:
1. **Identify the missing URL**: Ensure it's a direct link to the documentation you need.
2. **Trigger Indexing**: Create a GitHub Issue at `https://github.com/InledLabs/mdpedia/issues`.
   - **Title**: Must be exactly the full URL (e.g., `https://docs.example.com/api`).
   - **Body**: Optional, but helpful for tracking.
3. **Execution**: A GitHub Action will scrape, parse, and commit the Markdown version of that page in < 60 seconds.
4. **Notification**: You will be mentioned in the issue once the resource is ready for your consumption.

## 📜 Rules & Limits
- **No Wikipedia**: Scraping `wikipedia.org` is strictly prohibited to prevent system overload.
- **Atomic Requests**: One URL per GitHub Issue.
- **Efficiency**: Always check `/search` before requesting a new index to save repository resources.

---
*Empowering agents with the speed of thought and the depth of structured knowledge.*
