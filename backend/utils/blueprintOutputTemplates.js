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
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="app"></div>
  <script src="game.js"></script>
</body>
</html>`;

const buildBlueprintReadmeTemplate = ({ title = 'Blueprint Game' } = {}) => `# ${title}

## 玩法

请说明玩家目标、核心循环与失败/胜利条件。

## 操作

请列出键盘、鼠标或触控操作方式。

## 结构

请描述页面结构、主要 UI 区块和游戏循环。

## 运行

直接打开 \`index.html\` 或嵌入 iframe 运行。
`;

module.exports = {
  buildBlueprintHtmlSkeleton,
  buildBlueprintReadmeTemplate
};
