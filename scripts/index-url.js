import fs from 'fs';
import path from 'path';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

async function fetchAndParse(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    if (!response.ok) {
        throw new Error("Failed to fetch " + url + ": " + response.statusText);
    }
    const html = await response.text();
    return { html, url: response.url };
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
    
    const content = "---\ntitle: " + article.title + "\nsource: " + url + "\nauthor: " + (article.byline || 'Unknown') + "\nexcerpt: " + (article.excerpt || '') + "\n---\n\n# " + article.title + "\n\n" + markdown + "\n";

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
    if (inputUrl.endsWith('*')) {
        let baseUrl = inputUrl.slice(0, -1);
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

        console.log("Wildcard detected. Exploring: " + baseUrl);
        
        try {
            const { html } = await fetchAndParse(baseUrl);
            const dom = new JSDOM(html, { url: baseUrl });
            const links = Array.from(dom.window.document.querySelectorAll('a'));
            
            const toIndex = links
                .map(a => a.href)
                .filter(href => {
                    try {
                        const u = new URL(href, baseUrl);
                        const isSameOrigin = u.origin === new URL(baseUrl).origin;
                        const startsWithBase = u.href.startsWith(baseUrl);
                        const isNotSelf = u.href !== baseUrl && u.href !== (baseUrl + '/');
                        return isSameOrigin && startsWithBase && isNotSelf;
                    } catch { return false; }
                })
                .filter((v, i, a) => a.indexOf(v) === i); // Unique

            console.log("Found " + toIndex.length + " links to process.");
            
            for (const link of toIndex) {
                await indexSingleUrl(link, true);
            }
            
            const domain = new URL(baseUrl).hostname;
            updateDomainIndex(domain);
            
        } catch (error) {
            console.error("Error exploring wildcard: " + error.message);
            process.exit(1);
        }
    } else {
        await indexSingleUrl(inputUrl);
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
                const titleMatch = content.match(/title:\s*(.*)/);
                const relativePath = path.relative(domainDir, fullPath);
                const webRelativePath = relativePath.split(path.sep).join('/').replace(/\.md$/, '');
                files.push({
                    title: titleMatch ? titleMatch[1].trim() : file,
                    path: "./" + webRelativePath
                });
            }
        });
    }

    walk(domainDir);

    if (files.length > 1) {
        let indexContent = "---\ntitle: Index of " + domain + "\n---\n\n# 📚 Knowledge Index for " + domain + "\n\nThis is a generated index of all documentation resources retrieved from **" + domain + "**.\n\n";
        files.sort((a,b) => a.title.localeCompare(b.title)).forEach(f => {
            indexContent += "- [" + f.title + "](" + f.path + ")\n";
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
                
                const relativeDir = path.relative(path.dirname(fullPath), domainDir);
                const indexPath = path.join(relativeDir, '_index.md').split(path.sep).join('/').replace(/\.md$/, '');
                const finalPath = indexPath.startsWith('.') ? indexPath : "./" + indexPath;
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
