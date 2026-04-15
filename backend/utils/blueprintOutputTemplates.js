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

const escapeJsText = (value = '') => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const buildBlueprintFallbackPlayableGameHtml = ({
  title = 'Blueprint Game',
  description = '',
  theme = '',
  coreLoop = ''
} = {}) => {
  const safeTitle = escapeHtmlText(title);
  const safeDescription = escapeHtmlText(description);
  const safeTheme = escapeHtmlText(theme);
  const safeCoreLoop = escapeHtmlText(coreLoop);
  const jsTitle = escapeJsText(title);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg-a: #09111f;
      --bg-b: #13233f;
      --panel: rgba(6, 12, 24, 0.78);
      --line: rgba(255, 255, 255, 0.14);
      --text: #f5f7fb;
      --muted: #9fb0c8;
      --accent: #7cf0c8;
      --danger: #ff6b6b;
      --warn: #ffd166;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      min-height: 100%;
      background:
        radial-gradient(circle at top, rgba(124, 240, 200, 0.18), transparent 30%),
        linear-gradient(180deg, var(--bg-b), var(--bg-a));
      color: var(--text);
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
    }

    body {
      min-height: 100vh;
    }

    #app {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
      gap: 20px;
      padding: 20px;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 18px;
      backdrop-filter: blur(16px);
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
    }

    .hud {
      padding: 22px 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .eyebrow {
      color: var(--accent);
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: clamp(28px, 3vw, 40px);
      line-height: 1.02;
    }

    .meta, .tips {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.6;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .stat-card {
      padding: 14px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .stat-card strong {
      display: block;
      font-size: 24px;
      margin-top: 6px;
    }

    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    button {
      border: none;
      border-radius: 999px;
      padding: 12px 18px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.16s ease, opacity 0.16s ease;
    }

    button:hover { transform: translateY(-1px); }
    button:active { transform: translateY(1px) scale(0.99); }

    .primary-btn {
      background: var(--accent);
      color: #06111f;
    }

    .secondary-btn {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
      border: 1px solid rgba(255, 255, 255, 0.12);
    }

    .game-shell {
      position: relative;
      min-height: 540px;
      overflow: hidden;
      display: grid;
      place-items: center;
      padding: 18px;
    }

    canvas {
      width: min(100%, 920px);
      aspect-ratio: 16 / 9;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background:
        radial-gradient(circle at top, rgba(124, 240, 200, 0.12), transparent 28%),
        linear-gradient(180deg, #10213e, #060c18);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    .overlay {
      position: absolute;
      inset: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(2, 6, 14, 0.56);
      border-radius: 18px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .overlay.is-visible {
      opacity: 1;
      pointer-events: auto;
    }

    .overlay-card {
      width: min(100%, 420px);
      padding: 24px;
      text-align: center;
      border-radius: 18px;
      background: rgba(5, 10, 20, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.12);
    }

    .overlay-card p {
      color: var(--muted);
      line-height: 1.6;
    }

    @media (max-width: 980px) {
      #app {
        grid-template-columns: 1fr;
      }

      .game-shell {
        min-height: 420px;
      }
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    const app = document.getElementById('app');
    app.innerHTML = \`
      <aside class="panel hud">
        <div>
          <div class="eyebrow">Blueprint Fallback</div>
          <h1>${safeTitle}</h1>
        </div>
        <div class="meta">
          <p>${safeDescription || 'AI 输出失败时，系统自动生成的可玩 H5 保底版本。'}</p>
          <p>${safeTheme || '主题目标：快速提供一个稳定、可立即运行的浏览器小游戏。'}</p>
          <p>${safeCoreLoop || '核心循环：移动接取能量球，躲避红色障碍，在倒计时结束前冲高分。'}</p>
        </div>
        <div class="stats">
          <div class="stat-card"><span>分数</span><strong id="scoreValue">0</strong></div>
          <div class="stat-card"><span>剩余时间</span><strong id="timeValue">45</strong></div>
          <div class="stat-card"><span>生命</span><strong id="livesValue">3</strong></div>
          <div class="stat-card"><span>状态</span><strong id="stateValue">待开始</strong></div>
        </div>
        <div class="actions">
          <button id="startButton" class="primary-btn">开始游戏</button>
          <button id="restartButton" class="secondary-btn">重新开始</button>
        </div>
        <div class="tips">
          <p>操作：键盘左右方向键 / A D 键移动，移动端也支持拖动屏幕。</p>
          <p>目标：接住青色能量球加分，躲开红色障碍；生命耗尽或时间结束后可重新开始。</p>
        </div>
      </aside>
      <main class="panel game-shell">
        <canvas id="gameCanvas" width="960" height="540" aria-label="${safeTitle} 游戏画布"></canvas>
        <div id="overlay" class="overlay is-visible">
          <div class="overlay-card">
            <h2 id="overlayTitle">准备开始</h2>
            <p id="overlayText">点击“开始游戏”后进入挑战。倒计时结束前尽量拿到更高分数。</p>
            <button id="overlayButton" class="primary-btn">开始游戏</button>
          </div>
        </div>
      </main>
    \`;

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreValue = document.getElementById('scoreValue');
    const timeValue = document.getElementById('timeValue');
    const livesValue = document.getElementById('livesValue');
    const stateValue = document.getElementById('stateValue');
    const startButton = document.getElementById('startButton');
    const restartButton = document.getElementById('restartButton');
    const overlay = document.getElementById('overlay');
    const overlayTitle = document.getElementById('overlayTitle');
    const overlayText = document.getElementById('overlayText');
    const overlayButton = document.getElementById('overlayButton');

    const config = {
      width: canvas.width,
      height: canvas.height,
      paddleWidth: 132,
      paddleHeight: 18,
      durationMs: 45000,
      targetScore: 18
    };

    let gameState = null;
    let animationId = 0;
    let pointerActive = false;

    const randomBetween = (min, max) => min + Math.random() * (max - min);

    const createOrb = (kind = 'score') => ({
      kind,
      x: randomBetween(40, config.width - 40),
      y: -24,
      radius: kind === 'score' ? 12 : 14,
      speed: kind === 'score' ? randomBetween(140, 250) : randomBetween(180, 300)
    });

    const resetState = () => {
      gameState = {
        title: \`${jsTitle}\`,
        running: false,
        ended: false,
        score: 0,
        lives: 3,
        startedAt: 0,
        remainingMs: config.durationMs,
        paddleX: config.width / 2 - config.paddleWidth / 2,
        moveDir: 0,
        orbs: [],
        lastSpawnAt: 0
      };
      syncHud();
      showOverlay('准备开始', '点击“开始游戏”后进入挑战。倒计时结束前尽量拿到更高分数。', '开始游戏');
      draw();
    };

    const syncHud = () => {
      scoreValue.textContent = String(gameState.score);
      timeValue.textContent = String(Math.max(0, Math.ceil(gameState.remainingMs / 1000)));
      livesValue.textContent = String(gameState.lives);
      stateValue.textContent = gameState.ended ? '已结束' : (gameState.running ? '进行中' : '待开始');
    };

    const showOverlay = (title, text, actionLabel = '重新开始') => {
      overlayTitle.textContent = title;
      overlayText.textContent = text;
      overlayButton.textContent = actionLabel;
      overlay.classList.add('is-visible');
    };

    const hideOverlay = () => {
      overlay.classList.remove('is-visible');
    };

    const endGame = (reason) => {
      gameState.running = false;
      gameState.ended = true;
      syncHud();
      const success = gameState.score >= config.targetScore;
      const title = success ? '挑战成功' : '游戏结束';
      const text = success
        ? \`你达成了目标分数，最终得分 \${gameState.score}。\`
        : \`\${reason} 最终得分 \${gameState.score}，点击重新开始再来一局。\`;
      showOverlay(title, text, '重新开始');
      cancelAnimationFrame(animationId);
    };

    const startGame = () => {
      resetState();
      gameState.running = true;
      gameState.ended = false;
      gameState.startedAt = performance.now();
      gameState.lastSpawnAt = gameState.startedAt;
      hideOverlay();
      syncHud();
      cancelAnimationFrame(animationId);
      animationId = requestAnimationFrame(loop);
    };

    const movePaddleTo = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = config.width / rect.width;
      const nextX = (clientX - rect.left) * ratio - config.paddleWidth / 2;
      gameState.paddleX = Math.max(0, Math.min(config.width - config.paddleWidth, nextX));
    };

    const drawBackground = () => {
      const gradient = ctx.createLinearGradient(0, 0, 0, config.height);
      gradient.addColorStop(0, '#16305e');
      gradient.addColorStop(1, '#09111f');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, config.width, config.height);

      for (let i = 0; i < 32; i += 1) {
        ctx.fillStyle = i % 3 === 0 ? 'rgba(124,240,200,0.14)' : 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.arc((i * 37) % config.width, ((i * 83) % config.height), (i % 4) + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawHudText = () => {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '700 24px Trebuchet MS';
      ctx.fillText(gameState.title, 28, 40);
      ctx.font = '500 16px Trebuchet MS';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('接住青色能量球，躲避红色障碍', 28, 66);
    };

    const drawPaddle = () => {
      ctx.fillStyle = '#7cf0c8';
      ctx.fillRect(gameState.paddleX, config.height - 44, config.paddleWidth, config.paddleHeight);
    };

    const drawOrbs = () => {
      gameState.orbs.forEach((orb) => {
        ctx.beginPath();
        ctx.fillStyle = orb.kind === 'score' ? '#7cf0c8' : '#ff6b6b';
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const draw = () => {
      drawBackground();
      drawHudText();
      drawPaddle();
      drawOrbs();
    };

    const spawnOrbs = (now) => {
      if (now - gameState.lastSpawnAt < 420) return;
      gameState.lastSpawnAt = now;
      gameState.orbs.push(createOrb(Math.random() > 0.24 ? 'score' : 'danger'));
    };

    const updateOrbs = (deltaSeconds) => {
      const paddleTop = config.height - 44;
      const paddleBottom = paddleTop + config.paddleHeight;
      const paddleLeft = gameState.paddleX;
      const paddleRight = paddleLeft + config.paddleWidth;

      gameState.orbs = gameState.orbs.filter((orb) => {
        orb.y += orb.speed * deltaSeconds;

        const hitsPaddle =
          orb.y + orb.radius >= paddleTop &&
          orb.y - orb.radius <= paddleBottom &&
          orb.x >= paddleLeft &&
          orb.x <= paddleRight;

        if (hitsPaddle) {
          if (orb.kind === 'score') {
            gameState.score += 1;
          } else {
            gameState.lives -= 1;
          }
          return false;
        }

        if (orb.y - orb.radius > config.height) {
          if (orb.kind === 'score') {
            gameState.score = Math.max(0, gameState.score - 1);
          }
          return false;
        }

        return true;
      });
    };

    const updatePaddle = (deltaSeconds) => {
      if (pointerActive) return;
      const speed = 420;
      gameState.paddleX += gameState.moveDir * speed * deltaSeconds;
      gameState.paddleX = Math.max(0, Math.min(config.width - config.paddleWidth, gameState.paddleX));
    };

    let lastFrameAt = 0;
    const loop = (now) => {
      if (!gameState.running) return;

      if (!lastFrameAt) lastFrameAt = now;
      const deltaSeconds = Math.min(0.04, (now - lastFrameAt) / 1000);
      lastFrameAt = now;

      gameState.remainingMs = Math.max(0, config.durationMs - (now - gameState.startedAt));
      updatePaddle(deltaSeconds);
      spawnOrbs(now);
      updateOrbs(deltaSeconds);
      syncHud();
      draw();

      if (gameState.lives <= 0) {
        endGame('生命耗尽。');
        return;
      }

      if (gameState.remainingMs <= 0) {
        endGame('倒计时结束。');
        return;
      }

      animationId = requestAnimationFrame(loop);
    };

    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') gameState.moveDir = -1;
      if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') gameState.moveDir = 1;
      if (event.key === 'Enter' && !gameState.running) startGame();
    });

    window.addEventListener('keyup', (event) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(event.key)) gameState.moveDir = 0;
    });

    canvas.addEventListener('pointerdown', (event) => {
      pointerActive = true;
      movePaddleTo(event.clientX);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!pointerActive) return;
      movePaddleTo(event.clientX);
    });
    window.addEventListener('pointerup', () => {
      pointerActive = false;
    });

    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
    overlayButton.addEventListener('click', startGame);

    resetState();
  </script>
</body>
</html>`;
};

module.exports = {
  buildBlueprintFallbackPlayableGameHtml,
  buildBlueprintHtmlSkeleton
};
