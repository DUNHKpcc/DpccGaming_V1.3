const escapeHtmlText = (value = '') => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const buildBlueprintHtmlSkeleton = ({ title = 'Blueprint Game' } = {}) => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtmlText(title)}</title>
  <style>
    html, body {
      margin: 0;
      min-height: 100%;
      background: #111;
      color: #fff;
      font-family: "Arial", sans-serif;
    }

    #app {
      min-height: 100vh;
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    const app = document.getElementById('app');
    app.textContent = '${escapeHtmlText(title)}';
  </script>
</body>
</html>`;

module.exports = {
  buildBlueprintHtmlSkeleton
};
