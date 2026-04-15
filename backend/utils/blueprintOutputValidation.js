const vm = require('node:vm');

const REQUIRED_BLUEPRINT_OUTPUT_FILES = ['index.html'];

const extractInlineScriptContent = (html = '') =>
  Array.from(String(html || '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean)
    .join('\n\n');

const extractAppNodeInnerHtml = (html = '') => {
  const match = String(html || '').match(/<([a-z0-9-]+)\b[^>]*id=["']app["'][^>]*>([\s\S]*?)<\/\1>/i);
  return String(match?.[2] || '').trim();
};

const validateBlueprintOutputBundle = (files = {}) => {
  const issues = [];
  const html = String(files['index.html'] || '');
  const inlineJs = extractInlineScriptContent(html);
  const appInnerHtml = extractAppNodeInnerHtml(html);
  const hasInlineScript = /<script\b[^>]*>[\s\S]*?<\/script>/i.test(html);
  const hasStaticAppContent = Boolean(appInnerHtml.replace(/<[^>]+>/g, '').trim());

  REQUIRED_BLUEPRINT_OUTPUT_FILES.forEach((fileName) => {
    if (!String(files[fileName] || '').trim()) {
      issues.push(`${fileName} 为空或缺失`);
    }
  });

  if (html && !/id=["']app["']/.test(html)) issues.push('index.html 缺少 #app 挂载节点');
  if (html && !/<style\b[^>]*>[\s\S]*?<\/style>/i.test(html)) issues.push('index.html 缺少内联样式');
  if (html && !hasInlineScript && !hasStaticAppContent) issues.push('index.html 缺少内联脚本');

  if (inlineJs) {
    try {
      new vm.Script(inlineJs);
    } catch (error) {
      issues.push(`index.html 内联脚本语法错误: ${error.message}`);
    }

    if (!/(document\.getElementById\(['"]app['"]\)|querySelector\(['"]#app['"]\))/.test(inlineJs)) {
      issues.push('index.html 内联脚本未挂载到 #app');
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
};

const validateBlueprintPlayableBundle = (files = {}) => {
  const baseValidation = validateBlueprintOutputBundle(files);
  const issues = [...baseValidation.issues];
  const html = String(files['index.html'] || '');
  const inlineJs = extractInlineScriptContent(html);

  if (!html || !inlineJs) {
    if (!inlineJs && !issues.includes('index.html 缺少内联脚本')) {
      issues.push('index.html 缺少内联脚本');
    }
    return {
      ok: issues.length === 0,
      issues
    };
  }

  const hasGameplayLoop = /(requestAnimationFrame|setInterval|setTimeout)/.test(inlineJs);
  const hasInteractiveInput = /addEventListener\(['"](keydown|keyup|pointerdown|pointermove|click|touchstart|mousedown)['"]|\.onclick\s*=/.test(inlineJs);
  const hasRestartOrStartControl = /(重新开始|再来一次|开始游戏|restart|start)/i.test(`${html}\n${inlineJs}`);
  const hasScoreOrState = /(score|分数|生命|lives|倒计时|timer|game over|胜利|失败)/i.test(`${html}\n${inlineJs}`);

  if (!hasGameplayLoop) issues.push('index.html 缺少游戏循环逻辑');
  if (!hasInteractiveInput) issues.push('index.html 缺少可交互输入逻辑');
  if (!hasRestartOrStartControl) issues.push('index.html 缺少开始或重开控制');
  if (!hasScoreOrState) issues.push('index.html 缺少分数、生命或状态反馈');

  return {
    ok: issues.length === 0,
    issues
  };
};

module.exports = {
  REQUIRED_BLUEPRINT_OUTPUT_FILES,
  validateBlueprintOutputBundle,
  validateBlueprintPlayableBundle
};
