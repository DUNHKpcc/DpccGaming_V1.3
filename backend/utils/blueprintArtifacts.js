const path = require('node:path');
const fs = require('node:fs/promises');

const BLUEPRINT_BUNDLE_FILES = ['index.html', 'style.css', 'game.js', 'README.md', 'manifest.json'];

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

const serializeInlineJson = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026');

const escapeHtmlText = (value = '') => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const createDefaultBlueprintIndexHtml = (manifest = {}) => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtmlText(manifest.title || 'Blueprint H5 Run')}</title>
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <main class="blueprint-app">
    <header class="blueprint-header">
      <div class="blueprint-eyebrow">Blueprint H5 Output</div>
      <h1>${escapeHtmlText(manifest.title || 'Blueprint Run')}</h1>
      <p class="blueprint-lead">Run ID ${String(manifest.runId || 0)}</p>
    </header>
    <section id="blueprint-run-root" class="blueprint-root"></section>
  </main>
  <script>
    window.__BLUEPRINT_RUN_MANIFEST__ = ${serializeInlineJson(manifest)};
  </script>
  <script src="./game.js"></script>
</body>
</html>`;

const createDefaultBlueprintStyleCss = () => `:root {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  background: #07111f;
  color: #f4f7fb;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(32, 89, 196, 0.28), transparent 42%),
    linear-gradient(180deg, #0a1530 0%, #07111f 100%);
  color: inherit;
}

.blueprint-app {
  max-width: 1080px;
  margin: 0 auto;
  padding: 40px 24px 56px;
}

.blueprint-header {
  margin-bottom: 32px;
}

.blueprint-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 12px;
  color: #79a7ff;
  margin-bottom: 10px;
}

h1 {
  margin: 0;
  font-size: clamp(32px, 6vw, 60px);
  line-height: 1;
}

.blueprint-lead {
  margin: 12px 0 0;
  color: rgba(244, 247, 251, 0.72);
}

.blueprint-root {
  display: grid;
  gap: 16px;
}

.blueprint-card {
  border: 1px solid rgba(121, 167, 255, 0.16);
  background: rgba(9, 19, 38, 0.76);
  backdrop-filter: blur(18px);
  border-radius: 20px;
  padding: 20px 22px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.22);
}

.blueprint-card h2,
.blueprint-card h3 {
  margin: 0 0 8px;
}

.blueprint-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.blueprint-meta div {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
}

.blueprint-meta span {
  display: block;
  font-size: 12px;
  color: rgba(244, 247, 251, 0.58);
  margin-bottom: 4px;
}

.blueprint-step-list {
  display: grid;
  gap: 12px;
}

.blueprint-step {
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
}

.blueprint-step strong {
  display: block;
  margin-bottom: 6px;
}

.blueprint-step p {
  margin: 0;
  color: rgba(244, 247, 251, 0.78);
  white-space: pre-wrap;
}
`;

const createDefaultBlueprintGameJs = (manifest = {}) => `
(function () {
  const manifest = window.__BLUEPRINT_RUN_MANIFEST__ || ${serializeInlineJson(manifest)};
  const root = document.getElementById('blueprint-run-root');

  if (!root) {
    return;
  }

  const runtime = manifest.runtime || {};
  const steps = Array.isArray(manifest.steps) ? manifest.steps : [];

  const meta = [
    ['状态', runtime.status || 'unknown'],
    ['模型', runtime.modelName || runtime.model || 'unknown'],
    ['范围', runtime.scope || 'unknown'],
    ['起始节点', runtime.startNodeId || 'none'],
    ['步骤数', String(runtime.stepCount || steps.length || 0)]
  ];

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  root.innerHTML = [
    '<section class="blueprint-card">',
    '<h2>运行概览</h2>',
    '<div class="blueprint-meta">',
    meta.map(([label, value]) => '<div><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>').join(''),
    '</div>',
    '<div class="blueprint-step-list">',
    steps.map((step) => {
      return [
        '<article class="blueprint-step">',
        '<strong>' + escapeHtml(step.nodeTitle || step.nodeId || '未命名节点') + '</strong>',
        '<p>' + escapeHtml(step.summary || step.output || step.artifactType || step.status || '') + '</p>',
        '</article>'
      ].join('');
    }).join(''),
    '</div>',
    '</section>'
  ].join('');
})();
`;

const createDefaultBlueprintReadme = (manifest = {}) => `# Blueprint H5 Run

- Run ID: ${String(manifest.runId || 0)}
- Preview URL: ${String(manifest.previewUrl || '')}
- Artifact type: ${String(manifest.artifactType || 'h5-bundle')}
- Generated at: ${String(manifest.generatedAt || '')}

Files:
- index.html
- style.css
- game.js
- README.md
- manifest.json
`;

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

const writeBlueprintRunBundle = async ({
  uploadsRootPath = '',
  runId = 0,
  manifest = {},
  indexHtml,
  styleCss,
  gameJs,
  readmeMd
} = {}) => {
  const bundleDir = getBlueprintRunBundleDir({ uploadsRootPath, runId });
  await fs.mkdir(bundleDir, { recursive: true });

  const previewUrl = `/uploads/blueprints/runs/${String(runId || 0)}/index.html`;
  const bundleFiles = {
    'index.html': {
      content: indexHtml || createDefaultBlueprintIndexHtml({ ...manifest, runId, previewUrl }),
      encoding: 'utf8'
    },
    'style.css': {
      content: styleCss || createDefaultBlueprintStyleCss(),
      encoding: 'utf8'
    },
    'game.js': {
      content: gameJs || createDefaultBlueprintGameJs({ ...manifest, runId, previewUrl }),
      encoding: 'utf8'
    },
    'README.md': {
      content: readmeMd || createDefaultBlueprintReadme({ ...manifest, runId, previewUrl }),
      encoding: 'utf8'
    }
  };

  for (const [fileName, fileDescriptor] of Object.entries(bundleFiles)) {
    await fs.writeFile(path.join(bundleDir, fileName), fileDescriptor.content, fileDescriptor.encoding);
  }

  const manifestPayload = buildBlueprintRunManifest({
    ...manifest,
    runId,
    previewUrl,
    files: {
      'index.html': {
        path: 'index.html',
        contentType: 'text/html; charset=utf-8'
      },
      'style.css': {
        path: 'style.css',
        contentType: 'text/css; charset=utf-8'
      },
      'game.js': {
        path: 'game.js',
        contentType: 'text/javascript; charset=utf-8'
      },
      'README.md': {
        path: 'README.md',
        contentType: 'text/markdown; charset=utf-8'
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
