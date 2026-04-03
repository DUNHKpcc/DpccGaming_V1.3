const path = require('node:path');
const fs = require('node:fs/promises');

const BLUEPRINT_BUNDLE_FILES = ['index.html', 'manifest.json'];
const REQUIRED_GENERATED_FILES = ['index.html'];

const resolveUploadsRootPath = (uploadsRootPath = '') => {
  const normalized = String(uploadsRootPath || '').trim();
  if (normalized) return normalized;
  return path.join(process.cwd(), 'uploads');
};

const getBlueprintRunBundleDir = ({ uploadsRootPath = '', runId = 0 } = {}) => {
  return path.join(
    resolveUploadsRootPath(uploadsRootPath),
    'blueprints',
    'runs',
    String(runId || 0)
  );
};

const buildBlueprintRunManifest = ({
  runId = 0,
  previewUrl = '',
  artifactType = 'h5-bundle',
  title = '',
  generatedAt = new Date().toISOString(),
  runtime = {},
  steps = [],
  files = {}
} = {}) => ({
  runId: Number(runId || 0),
  previewUrl,
  artifactType,
  title: String(title || 'Blueprint Run'),
  generatedAt,
  runtime,
  steps,
  files
});

const assertGeneratedBundleFiles = (bundleFiles = {}) => {
  const missing = REQUIRED_GENERATED_FILES.filter((fileName) => !String(bundleFiles[fileName] || '').trim());
  if (missing.length) {
    throw new Error(`缺少有效的 Blueprint 输出文件: ${missing.join(', ')}`);
  }
};

const writeBlueprintRunBundle = async ({
  uploadsRootPath = '',
  runId = 0,
  manifest = {},
  indexHtml
} = {}) => {
  const bundleDir = getBlueprintRunBundleDir({ uploadsRootPath, runId });
  await fs.mkdir(bundleDir, { recursive: true });

  const previewUrl = `/uploads/blueprints/runs/${String(runId || 0)}/index.html`;
  const bundleFiles = {
    'index.html': String(indexHtml || '')
  };

  assertGeneratedBundleFiles(bundleFiles);

  await Promise.all(
    Object.entries(bundleFiles).map(([fileName, content]) =>
      fs.writeFile(path.join(bundleDir, fileName), content, 'utf8')
    )
  );

  const manifestPayload = buildBlueprintRunManifest({
    ...manifest,
    runId,
    previewUrl,
    files: {
      'index.html': {
        path: 'index.html',
        contentType: 'text/html; charset=utf-8'
      },
      'manifest.json': {
        path: 'manifest.json',
        contentType: 'application/json; charset=utf-8'
      }
    }
  });

  const manifestPath = path.join(bundleDir, 'manifest.json');
  await fs.writeFile(manifestPath, `${JSON.stringify(manifestPayload, null, 2)}\n`, 'utf8');

  return {
    bundleDir,
    previewUrl,
    manifestPath,
    manifest: manifestPayload,
    files: BLUEPRINT_BUNDLE_FILES.map((name) => ({
      name,
      path: path.join(bundleDir, name)
    }))
  };
};

module.exports = {
  buildBlueprintRunManifest,
  getBlueprintRunBundleDir,
  writeBlueprintRunBundle
};
