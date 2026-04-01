const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');

const sanitizePathSegment = (value = '', fallback = 'unknown') => {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || fallback;
};

const resolveUploadsRootPath = (uploadsRootPath = '') =>
  String(uploadsRootPath || '').trim() || process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');

const resolveLocalVideoPath = ({ videoUrl = '', uploadsRootPath = '' } = {}) => {
  const normalizedUrl = String(videoUrl || '').trim();
  if (!normalizedUrl.startsWith('/uploads/')) return '';

  const relativePath = normalizedUrl.replace(/^\/uploads\//, '');
  return path.join(resolveUploadsRootPath(uploadsRootPath), relativePath);
};

const defaultRunFfmpeg = ({ videoPath, outputDir, frameCount }) =>
  new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', videoPath,
      '-vf', 'fps=1,scale=640:-1',
      '-frames:v', String(frameCount || 4),
      path.join(outputDir, 'frame-%02d.jpg')
    ];

    const child = spawn('ffmpeg', args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });

const extractBlueprintVideoKeyframes = async ({
  gameId = '',
  videoUrl = '',
  uploadsRootPath = '',
  frameCount = 4,
  runFfmpeg = defaultRunFfmpeg
} = {}) => {
  const normalizedUploadsRootPath = resolveUploadsRootPath(uploadsRootPath);
  const videoPath = resolveLocalVideoPath({ videoUrl, uploadsRootPath: normalizedUploadsRootPath });

  if (!videoPath) {
    return {
      skipped: true,
      reason: '当前仅支持从本地 uploads 视频提取关键帧。',
      frames: []
    };
  }

  const safeGameId = sanitizePathSegment(gameId, 'game');
  const outputDir = path.join(normalizedUploadsRootPath, 'blueprints', 'video-keyframes', safeGameId);

  try {
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.mkdir(outputDir, { recursive: true });
    await runFfmpeg({
      videoPath,
      outputDir,
      frameCount: Math.max(1, Number(frameCount || 4))
    });

    const files = (await fs.readdir(outputDir))
      .filter((fileName) => /\.(png|jpe?g|webp)$/i.test(fileName))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));

    return {
      skipped: false,
      reason: '',
      frames: files.map((fileName, index) => ({
        index: index + 1,
        fileName,
        path: path.join(outputDir, fileName),
        url: `/uploads/blueprints/video-keyframes/${safeGameId}/${fileName}`
      }))
    };
  } catch (error) {
    if (String(error?.code || '').toUpperCase() === 'ENOENT' || /ffmpeg/i.test(String(error?.message || ''))) {
      return {
        skipped: true,
        reason: '当前环境未安装 ffmpeg，已跳过关键帧提取。',
        frames: []
      };
    }

    return {
      skipped: true,
      reason: error?.message || '关键帧提取失败。',
      frames: []
    };
  }
};

module.exports = {
  extractBlueprintVideoKeyframes,
  __test: {
    resolveLocalVideoPath,
    sanitizePathSegment
  }
};
