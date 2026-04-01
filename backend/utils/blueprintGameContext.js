const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const AdmZip = require('adm-zip');

const CODE_BROWSE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.css', '.scss', '.less', '.html', '.json', '.md', '.c', '.cpp', '.h', '.cs', '.py']);
const CODE_BROWSE_MAX_FILES = 60;
const CODE_BROWSE_MAX_FILE_SIZE = 200 * 1024;
const CODE_BROWSE_SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.output', '.cache']);
const CODE_SNIPPET_LIMIT = 1200;

const normalizeCodePath = (value = '') => String(value).replace(/\\/g, '/').replace(/^\/+/, '');

const resolveCodeArtifacts = (codeRootPath, gameId) => {
  const codeDir = path.join(codeRootPath, gameId);
  const codeZipPath = path.join(codeRootPath, `${gameId}.zip`);
  const dirExists = fsSync.existsSync(codeDir) && fsSync.lstatSync(codeDir).isDirectory();
  const zipExists = fsSync.existsSync(codeZipPath);
  return { codeDir, codeZipPath, dirExists, zipExists };
};

const collectCodeFilesFromDirectory = async (targetDir) => {
  const files = [];

  async function walk(dir) {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (files.length >= CODE_BROWSE_MAX_FILES) return;
      const full = path.join(dir, item.name);

      if (item.isDirectory()) {
        if (CODE_BROWSE_SKIP_DIRS.has(item.name)) continue;
        await walk(full);
        continue;
      }

      const ext = path.extname(item.name).toLowerCase();
      if (!CODE_BROWSE_EXTS.has(ext)) continue;

      const rel = normalizeCodePath(path.relative(targetDir, full));
      if (!rel || rel.startsWith('..')) continue;

      try {
        const stat = await fs.lstat(full);
        if (stat.size > CODE_BROWSE_MAX_FILE_SIZE) continue;
        const content = await fs.readFile(full, 'utf8');
        files.push({ path: rel, content });
      } catch {
        // ignore unreadable files
      }
    }
  }

  await walk(targetDir);
  return files;
};

const collectCodeFilesFromZip = (zipPath) => {
  try {
    const files = [];
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries() || [];

    for (const entry of entries) {
      if (files.length >= CODE_BROWSE_MAX_FILES) break;
      if (entry.isDirectory) continue;

      const rel = normalizeCodePath(entry.entryName || '');
      if (!rel || rel.includes('../')) continue;

      const ext = path.extname(rel).toLowerCase();
      if (!CODE_BROWSE_EXTS.has(ext)) continue;

      const rawSize = Number(entry.header?.size || 0);
      if (Number.isFinite(rawSize) && rawSize > CODE_BROWSE_MAX_FILE_SIZE) continue;

      try {
        const content = entry.getData().toString('utf8');
        if (Buffer.byteLength(content, 'utf8') > CODE_BROWSE_MAX_FILE_SIZE) continue;
        files.push({ path: rel, content });
      } catch {
        // ignore decode issues
      }
    }

    return files;
  } catch {
    return [];
  }
};

const truncateCodeSnippet = (value = '') => {
  const content = String(value || '').trim();
  if (content.length <= CODE_SNIPPET_LIMIT) return content;
  return `${content.slice(0, CODE_SNIPPET_LIMIT)}\n...`;
};

const pickPreferredCodeFile = (files = [], preferredPath = '') => {
  const normalizedPreferredPath = normalizeCodePath(preferredPath);
  if (normalizedPreferredPath) {
    const exactMatch = files.find((file) => normalizeCodePath(file.path) === normalizedPreferredPath);
    if (exactMatch) return exactMatch;
  }

  return files[0] || null;
};

const loadBlueprintGameCodePreview = async ({ gameId = '', preferredPath = '' } = {}) => {
  const normalizedGameId = String(gameId || '').trim();
  if (!normalizedGameId) {
    return { codeSnippet: '', codeSnippetPath: '' };
  }

  const codeRootPath = process.env.CODE_ROOT_PATH || path.join(process.cwd(), 'uploads', 'code');
  const { codeDir, codeZipPath, dirExists, zipExists } = resolveCodeArtifacts(codeRootPath, normalizedGameId);

  let files = [];
  if (dirExists) {
    files = await collectCodeFilesFromDirectory(codeDir);
  }

  if (!files.length && zipExists) {
    files = collectCodeFilesFromZip(codeZipPath);
  }

  const selectedFile = pickPreferredCodeFile(files, preferredPath);
  if (!selectedFile) {
    return { codeSnippet: '', codeSnippetPath: '' };
  }

  return {
    codeSnippet: truncateCodeSnippet(selectedFile.content || ''),
    codeSnippetPath: String(selectedFile.path || '')
  };
};

module.exports = {
  loadBlueprintGameCodePreview
};
