const vm = require('node:vm');

const REQUIRED_BLUEPRINT_OUTPUT_FILES = ['index.html'];

const GAME_TEMPLATE_PATTERNS = [
  /运行概览/,
  /Blueprint H5 Output/i,
  /step-list/i,
  /节点执行完成/,
  /artifact/i
];

const hasAnyPattern = (value = '', patterns = []) =>
  patterns.some((pattern) => pattern.test(value));

const extractInlineScriptContent = (html = '') =>
  Array.from(String(html || '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean)
    .join('\n\n');

const validateBlueprintOutputBundle = (files = {}) => {
  const issues = [];
  const html = String(files['index.html'] || '');
  const inlineJs = extractInlineScriptContent(html);
  const combined = `${html}\n${inlineJs}`;

  REQUIRED_BLUEPRINT_OUTPUT_FILES.forEach((fileName) => {
    if (!String(files[fileName] || '').trim()) {
      issues.push(`${fileName} 为空或缺失`);
    }
  });

  if (html && !/id=["']app["']/.test(html)) issues.push('index.html 缺少 #app 挂载节点');
  if (html && !/<style\b[^>]*>[\s\S]*?<\/style>/i.test(html)) issues.push('index.html 缺少内联样式');
  if (html && !/<script\b[^>]*>[\s\S]*?<\/script>/i.test(html)) issues.push('index.html 缺少内联脚本');

  if (inlineJs) {
    try {
      new vm.Script(inlineJs);
    } catch (error) {
      issues.push(`index.html 内联脚本语法错误: ${error.message}`);
    }

    if (!/(document\.getElementById\(['"]app['"]\)|querySelector\(['"]#app['"]\))/.test(inlineJs)) {
      issues.push('index.html 内联脚本未挂载到 #app');
    }
    if (!/(addEventListener|onclick|onkeydown|pointerdown|keydown|click)/i.test(inlineJs)) {
      issues.push('缺少玩家交互处理');
    }
  }

  if (combined && hasAnyPattern(combined, GAME_TEMPLATE_PATTERNS)) {
    issues.push('疑似模板页或运行总结页，不是可玩的成品游戏');
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
