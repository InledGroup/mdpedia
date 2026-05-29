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
    
    // If not found and it's a directory-like URL, try adding /
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
    let clean = title.replace(/\s*[–\-\|]\s*React\s*$/i, '');
    clean = clean.replace(/\s*[–\-\|]\s*Astro\s*$/i, '');
    clean = clean.replace(/\s*[–\-\|]\s*Documentation\s*$/i, '');
    return clean.trim();
}

async function indexSingleUrl(url, skipDomainIndex = false) {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('wikipedia.org')) {
      console.warn('Skipping Wikipedia for: ' + url);
      return;
    }
    
    console.log("Processing: " + url);
    const { html } = await fetchAndParse(url);
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      console.warn('Could not extract content from: ' + url);
      return;
    }

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    
    const markdown = turndownService.turndown(article.content);
    const domain = urlObj.hostname;
    const pathname = urlObj.pathname === '/' ? '/index' : urlObj.pathname;
    
    const targetDir = path.join('src', 'docs', domain, path.dirname(pathname));
    const fileName = path.basename(pathname) + ".md";
    const filePath = path.join(targetDir, fileName);

    fs.mkdirSync(targetDir, { recursive: true });
    
    const displayTitle = cleanTitle(article.title);
    
    const content = "---\ntitle: \"" + displayTitle.replace(/"/g, '\\"') + "\"\nsource: " + url + "\nauthor: " + (article.byline || 'Unknown') + "\nexcerpt: " + (article.excerpt || '').replace(/\n/g, ' ') + "\n---\n\n# " + displayTitle + "\n\n" + markdown + "\n";

    fs.writeFileSync(filePath, content);
    
    if (!skipDomainIndex) {
        updateDomainIndex(domain);
    }
    
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
            console.log("Updating indices for domain: " + domain);
            updateDomainIndex(domain);
            return;
        }

        console.log("Wildcard detected. Exploring: " + baseUrl);
        try {
            const { html, url: finalBaseUrl } = await fetchAndParse(baseUrl);
            const dom = new JSDOM(html, { url: finalBaseUrl });
            const links = Array.from(dom.window.document.querySelectorAll('a'));
            
            const toIndex = links
                .map(a => a.href)
                .filter(href => {
                    try {
                        const u = new URL(href, finalBaseUrl);
                        const isSameOrigin = u.origin === new URL(finalBaseUrl).origin;
                        const startsWithBase = u.href.startsWith(finalBaseUrl);
                        const isNotSelf = u.href !== finalBaseUrl && u.href !== (finalBaseUrl + '/');
                        return isSameOrigin && startsWithBase && isNotSelf;
                    } catch { return false; }
                })
                .filter((v, i, a) => a.indexOf(v) === i);

            console.log("Found " + toIndex.length + " links to process.");
            for (const link of toIndex) {
                await indexSingleUrl(link, true);
            }
            updateDomainIndex(domain);
        } catch (error) {
            console.error("Error exploring wildcard: " + error.message);
            process.exit(1);
        }
    } else {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        if (onlyUpdateIndex) {
            updateDomainIndex(domain);
        } else {
            await indexSingleUrl(url);
        }
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
                if (title.toLowerCase() === "react" || title.toLowerCase() === "astro" || title.length < 2) {
                    title = webRelativePath.split('/').pop().replace(/[\-_]/g, ' ');
                }

                files.push({
                    title: title,
                    path: webRelativePath
                });
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
        console.log("Domain index updated for " + domain);
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
if (!url) {
  console.error('Usage: node index-url.js <URL>');
  process.exit(1);
}

indexUrl(url);
