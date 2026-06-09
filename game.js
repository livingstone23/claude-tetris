'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
  '#ec407a', // tuerca - pink
];

const SKINS = {
  retro: {
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#7986cb', '#ffb74d', '#ec407a'],
    bg: null,
    glow: false,
    rounded: false,
    pixelArt: false,
  },
  neon: {
    colors: [null, '#00ffff', '#ffff00', '#ff00ff', '#00ff00', '#ff0040', '#4040ff', '#ff8000', '#ff1493'],
    bg: '#0a0a0a',
    glow: true,
    rounded: false,
    pixelArt: false,
  },
  pastel: {
    colors: [null, '#a8d8ea', '#ffeaa7', '#dda0dd', '#b8e0d2', '#ffb3ba', '#b0c4de', '#ffd8b1', '#ffb6c1'],
    bg: null,
    glow: false,
    rounded: true,
    pixelArt: false,
  },
  pixelart: {
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#7986cb', '#ffb74d', '#ec407a'],
    bg: '#1a1a2e',
    glow: false,
    rounded: false,
    pixelArt: true,
  },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // tuerca
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
const _storedSkin = localStorage.getItem('tetris_skin');
let currentSkin = (_storedSkin && _storedSkin in SKINS) ? _storedSkin : 'retro';

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin];
  const color = skin.colors[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const bw = size - 2;
  const bh = size - 2;
  const radius = 4;

  context.globalAlpha = alpha ?? 1;

  if (skin.glow) {
    context.shadowBlur = 15;
    context.shadowColor = color;
  }

  context.fillStyle = color;

  if (skin.rounded) {
    context.beginPath();
    context.moveTo(px + radius, py);
    context.lineTo(px + bw - radius, py);
    context.arcTo(px + bw, py, px + bw, py + radius, radius);
    context.lineTo(px + bw, py + bh - radius);
    context.arcTo(px + bw, py + bh, px + bw - radius, py + bh, radius);
    context.lineTo(px + radius, py + bh);
    context.arcTo(px, py + bh, px, py + bh - radius, radius);
    context.lineTo(px, py + radius);
    context.arcTo(px, py, px + radius, py, radius);
    context.closePath();
    context.fill();

    if (skin.glow) {
      context.shadowBlur = 0;
    }

    // highlight clipped to rounded shape
    context.save();
    context.clip();
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(px, py, bw, 4);
    context.restore();
  } else {
    context.fillRect(px, py, bw, bh);

    if (skin.glow) {
      context.shadowBlur = 0;
    }

    // highlight
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(px, py, bw, 4);
  }

  if (skin.pixelArt) {
    // draw small dark dots to simulate pixel texture
    const dotSize = 3;
    context.fillStyle = 'rgba(0,0,0,0.3)';
    const dotPositions = [
      [px + 2, py + 2],
      [px + bw - dotSize - 2, py + 2],
      [px + 2, py + bh - dotSize - 2],
      [px + bw - dotSize - 2, py + bh - dotSize - 2],
      [px + Math.floor(bw / 2) - 1, py + Math.floor(bh / 2) - 1],
    ];
    for (const [dx, dy] of dotPositions) {
      context.fillRect(dx, dy, dotSize, dotSize);
    }
  }

  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = document.body.classList.contains('light-mode') ? '#c8c8d8' : '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const skinBg = SKINS[currentSkin].bg;
  if (skinBg) {
    ctx.fillStyle = skinBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const skinBg = SKINS[currentSkin].bg;
  if (skinBg) {
    nextCtx.fillStyle = skinBg;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

document.getElementById('theme-toggle').addEventListener('change', e => {
  document.body.classList.toggle('light-mode', e.target.checked);
  draw();
});

function updateSkinButtons() {
  document.querySelectorAll('#skin-selector button').forEach(btn => {
    btn.classList.toggle('skin-active', btn.dataset.skin === currentSkin);
  });
}

document.getElementById('skin-selector').addEventListener('click', e => {
  const btn = e.target.closest('button[data-skin]');
  if (!btn) return;
  currentSkin = btn.dataset.skin;
  localStorage.setItem('tetris_skin', currentSkin);
  updateSkinButtons();
  draw();
});

updateSkinButtons();
init();
