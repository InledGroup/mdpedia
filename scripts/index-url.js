import fs from 'fs';
import path from 'path';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

async function fetchAndParse(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });
    
    if (response.status === 404 && !url.endsWith('/')) {
        const retryUrl = url + '/';
        const retryResponse = await fetch(retryUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (retryResponse.ok) return { html: await retryResponse.text(), url: retryResponse.url };
    }

    if (!response.ok) {
        throw new Error("Failed to fetch " + url + ": " + response.status + " " + response.statusText);
    }
    const html = await response.text();
    return { html, url: response.url };
}

function cleanTitle(title) {
    if (!title) return "";
    let clean = title.replace(/\s*[–\-\|]\s*(React|Astro|Vue|Vue\.js|Documentation)\s*$/i, '');
    return clean.trim();
}

async function indexSingleUrl(url, skipDomainIndex = false) {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('wikipedia.org')) return;
    
    console.log("Processing: " + url);
    const { html } = await fetchAndParse(url);
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) return;

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    
    const markdown = turndownService.turndown(article.content);
    const domain = urlObj.hostname;
    let pathname = urlObj.pathname === '/' ? '/index' : urlObj.pathname;
    if (pathname.endsWith('.html')) pathname = pathname.replace('.html', '');
    
    const targetDir = path.join('src', 'docs', domain, path.dirname(pathname));
    const fileName = path.basename(pathname) + ".md";
    const filePath = path.join(targetDir, fileName);

    fs.mkdirSync(targetDir, { recursive: true });
    
    const displayTitle = cleanTitle(article.title);
    const content = "---\ntitle: \"" + displayTitle.replace(/"/g, '\\"') + "\"\nsource: " + url + "\nauthor: " + (article.byline || 'Unknown') + "\nexcerpt: " + (article.excerpt || '').replace(/\n/g, ' ') + "\n---\n\n# " + displayTitle + "\n\n" + markdown + "\n";

    fs.writeFileSync(filePath, content);
    if (!skipDomainIndex) updateDomainIndex(domain);
    return filePath;
  } catch (error) {
    console.error("Error indexing " + url + ":", error.message);
  }
}

async function indexUrl(inputUrl) {
    let url = inputUrl;
    let onlyUpdateIndex = false;

    if (url.startsWith('reindex ')) {
        onlyUpdateIndex = true;
        url = url.replace('reindex ', '').trim();
    }

    if (url.endsWith('*')) {
        let baseUrl = url.slice(0, -1);
        const domain = new URL(baseUrl).hostname;

        if (onlyUpdateIndex) {
            updateDomainIndex(domain);
            return;
        }

        console.log("Deep Wildcard detected. Exploring: " + baseUrl);
        const visited = new Set();
        const toProcess = [baseUrl];
        const results = new Set();

        while (toProcess.length > 0) {
            const current = toProcess.shift();
            if (visited.has(current)) continue;
            visited.add(current);

            try {
                const { html, url: finalUrl } = await fetchAndParse(current);
                const dom = new JSDOM(html, { url: finalUrl });
                const links = Array.from(dom.window.document.querySelectorAll('a'));
                
                for (const a of links) {
                    try {
                        const u = new URL(a.href, finalUrl);
                        u.hash = ''; // Remove anchors
                        const href = u.href.replace(/\/$/, '');
                        const cleanBase = baseUrl.replace(/\/$/, '');

                        if (u.origin === new URL(baseUrl).origin && href.startsWith(cleanBase)) {
                            if (!visited.has(href)) {
                                // If it looks like a page (not just an anchor), add to results
                                results.add(href);
                                // If it doesn't have an extension or is .html, we might want to explore it for more links
                                if (!path.extname(u.pathname) || u.pathname.endsWith('.html')) {
                                    toProcess.push(href);
                                }
                            }
                        }
                    } catch (e) {}
                }
            } catch (error) {
                console.error("Error crawling " + current + ": " + error.message);
            }
        }

        console.log("Found " + results.size + " unique pages to process.");
        for (const link of Array.from(results)) {
            await indexSingleUrl(link, true);
        }
        updateDomainIndex(domain);
    } else {
        const urlObj = new URL(url);
        if (onlyUpdateIndex) updateDomainIndex(urlObj.hostname);
        else await indexSingleUrl(url);
    }
}

function updateDomainIndex(domain) {
    const domainDir = path.join('src', 'docs', domain);
    if (!fs.existsSync(domainDir)) return;
    const files = [];
    
    function walk(dir) {
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                walk(fullPath);
            } else if (file.endsWith('.md') && file !== '_index.md') {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const titleMatch = content.match(/title:\s*"(.*)"/);
                const relativePath = path.relative(domainDir, fullPath);
                const webRelativePath = relativePath.split(path.sep).join('/').replace(/\.md$/, '');
                
                let title = titleMatch ? titleMatch[1].trim() : file;
                if (title.toLowerCase() === "react" || title.toLowerCase() === "astro" || title.toLowerCase() === "vue" || title.length < 2) {
                    title = webRelativePath.split('/').pop().replace(/[\-_]/g, ' ');
                }
                files.push({ title, path: webRelativePath });
            }
        });
    }

    walk(domainDir);

    if (files.length > 0) {
        let indexContent = "---\ntitle: \"Knowledge Index for " + domain + "\"\nsource: https://" + domain + "\n---\n\n# 📚 Knowledge Index for " + domain + "\n\nThis is a generated index of all documentation resources retrieved from **" + domain + "**.\n\n";
        const structure = {};
        files.forEach(f => {
            const parts = f.path.split('/');
            if (parts.length > 1) {
                const folder = parts[0];
                if (!structure[folder]) structure[folder] = [];
                structure[folder].push(f);
            } else {
                if (!structure["root"]) structure["root"] = [];
                structure["root"].push(f);
            }
        });

        Object.keys(structure).sort().forEach(folder => {
            if (folder !== "root") {
                indexContent += "### 📁 " + folder.charAt(0).toUpperCase() + folder.slice(1) + "\n";
            }
            structure[folder].sort((a,b) => a.title.localeCompare(b.title)).forEach(f => {
                indexContent += "- [" + f.title + "](/doc/" + domain + "/" + f.path + ")\n";
            });
            indexContent += "\n";
        });
        
        indexContent += "\n---\n*Generated by MDPEDIA — Knowledge for the AI Era*\n";
        fs.writeFileSync(path.join(domainDir, '_index.md'), indexContent);
        patchFilesWithIndexInstruction(domain, domainDir);
    }
}

function patchFilesWithIndexInstruction(domain, domainDir) {
    function walk(dir) {
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                walk(fullPath);
            } else if (file.endsWith('.md') && file !== '_index.md') {
                let content = fs.readFileSync(fullPath, 'utf-8');
                const finalPath = "/doc/" + domain + "/_index";
                const instruction = "> 💡 **Tip**: Explore all indexed documents for **" + domain + "** in the [Domain Index](" + finalPath + ").";
                if (content.indexOf('[Domain Index]') === -1) {
                    const fmEndIndex = content.indexOf('---', 4);
                    if (fmEndIndex !== -1) {
                        const postFm = content.slice(fmEndIndex + 3);
                        content = content.slice(0, fmEndIndex + 3) + "\n\n" + instruction + "\n\n---" + postFm;
                        fs.writeFileSync(fullPath, content);
                    }
                }
            }
        });
    }
    walk(domainDir);
}

const url = process.argv[2];
if (!url) process.exit(1);
indexUrl(url);
