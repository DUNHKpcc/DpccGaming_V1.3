const vm = require('node:vm');

const REQUIRED_BLUEPRINT_OUTPUT_FILES = ['index.html', 'style.css', 'game.js', 'README.md'];

const GAME_TEMPLATE_PATTERNS = [
  /运行概览/,
  /Blueprint H5 Output/i,
  /step-list/i,
  /节点执行完成/,
  /artifact/i
];

const hasAnyPattern = (value = '', patterns = []) =>
  patterns.some((pattern) => pattern.test(value));

const validateBlueprintOutputBundle = (files = {}) => {
  const issues = [];
  const html = String(files['index.html'] || '');
  const css = String(files['style.css'] || '');
  const js = String(files['game.js'] || '');
  const readme = String(files['README.md'] || '');
  const combined = `${html}\n${css}\n${js}`;

  REQUIRED_BLUEPRINT_OUTPUT_FILES.forEach((fileName) => {
    if (!String(files[fileName] || '').trim()) {
      issues.push(`${fileName} 为空或缺失`);
    }
  });

  if (html && !/style\.css/.test(html)) issues.push('index.html 未引用 style.css');
  if (html && !/game\.js/.test(html)) issues.push('index.html 未引用 game.js');
  if (html && !/id=["']app["']/.test(html)) issues.push('index.html 缺少 #app 挂载节点');
  if (css && css.length < 24) issues.push('style.css 内容过少，疑似未生成真实界面样式');
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

    if (!/(document\.getElementById\(['"]app['"]\)|querySelector\(['"]#app['"]\))/.test(js)) {
      issues.push('game.js 未挂载到 #app');
    }
    if (!/(start|menu|ready|renderStart|startGame|开始)/i.test(js)) {
      issues.push('缺少开始状态');
    }
    if (!/(playing|gameplay|running|inGame|renderPlay|playState|游玩)/i.test(js)) {
      issues.push('缺少运行中状态');
    }
    if (!/(gameover|gameOver|fail|lose|victory|win|complete|finish|renderGameOver|结束|失败|胜利)/i.test(js)) {
      issues.push('缺少结束或失败状态');
    }
    if (!/(restart|reset|playAgain|restartGame|重新开始)/i.test(js)) {
      issues.push('缺少重开能力');
    }
    if (!/(addEventListener|onclick|onkeydown|pointerdown|keydown|click)/i.test(js)) {
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
