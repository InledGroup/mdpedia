import fs from 'fs';
import path from 'path';

function getMarkdownFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getMarkdownFiles(filePath, fileList);
    } else if (file.endsWith('.md')) {
      const relativePath = path.relative(path.join(process.cwd(), 'src', 'docs'), filePath);
      const slug = relativePath.replace(/\.md$/, '');
      const content = fs.readFileSync(filePath, 'utf-8');
      const titleMatch = content.match(/title:\s*(.*)/);

      fileList.push({
        slug: slug.split(path.sep).join('/'),
        title: titleMatch ? titleMatch[1].trim() : slug.split(path.sep).pop(),
        path: '/doc/' + slug.split(path.sep).join('/'),
        raw: '/raw/' + relativePath.split(path.sep).join('/')
      });
    }
  });
  return fileList;
}

const indexedFiles = getMarkdownFiles(path.join(process.cwd(), 'src', 'docs'));
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/search-index.json', JSON.stringify(indexedFiles, null, 2));
console.log('Search index generated!');
