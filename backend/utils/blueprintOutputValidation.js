const vm = require('node:vm');

const REQUIRED_BLUEPRINT_OUTPUT_FILES = ['index.html', 'style.css', 'game.js', 'README.md'];

const validateBlueprintOutputBundle = (files = {}) => {
  const issues = [];
  const html = String(files['index.html'] || '');
  const css = String(files['style.css'] || '');
  const js = String(files['game.js'] || '');
  const readme = String(files['README.md'] || '');

  REQUIRED_BLUEPRINT_OUTPUT_FILES.forEach((fileName) => {
    if (!String(files[fileName] || '').trim()) {
      issues.push(`${fileName} 为空或缺失`);
    }
  });

  if (html && !/style\.css/.test(html)) issues.push('index.html 未引用 style.css');
  if (html && !/game\.js/.test(html)) issues.push('index.html 未引用 game.js');
  if (html && !/<div[^>]+id=["']app["']/.test(html)) issues.push('index.html 缺少 #app 挂载节点');
  if (readme && !/##\s*玩法/.test(readme)) issues.push('README.md 缺少玩法章节');
  if (readme && !/##\s*操作/.test(readme)) issues.push('README.md 缺少操作章节');
  if (readme && !/##\s*结构/.test(readme)) issues.push('README.md 缺少结构章节');
  if (readme && !/##\s*运行/.test(readme)) issues.push('README.md 缺少运行章节');

  if (js) {
    try {
      new vm.Script(js);
    } catch (error) {
      issues.push(`game.js 语法错误: ${error.message}`);
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
};

module.exports = {
  REQUIRED_BLUEPRINT_OUTPUT_FILES,
  validateBlueprintOutputBundle
};
