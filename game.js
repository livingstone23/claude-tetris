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

const SKINS = {
  retro: {
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#7986cb', '#ffb74d', '#ec407a'],
    gridColor() { return document.body.classList.contains('light-mode') ? '#c8c8d8' : '#22222e'; },
    drawBlock(ctx, x, y, color, size, alpha) {
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      ctx.globalAlpha = 1;
    },
  },
  neon: {
    colors: [null, '#00f5ff', '#f5ff00', '#ff00f5', '#00ff88', '#ff3355', '#4488ff', '#ff8800', '#ff44cc'],
    gridColor() { return '#0a0a1a'; },
    drawBlock(ctx, x, y, color, size, alpha) {
      ctx.globalAlpha = alpha ?? 1;
      ctx.shadowBlur = 14;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x * size + 7, y * size + 7, size - 14, size - 14);
      ctx.globalAlpha = 1;
    },
  },
  pastel: {
    colors: [null, '#87d7ef', '#f0d060', '#cc99d9', '#90d490', '#f09090', '#9999d9', '#f5b870', '#f099bb'],
    gridColor() { return '#d8d0ec'; },
    drawBlock(ctx, x, y, color, size, alpha) {
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      const bx = x * size + 2, by = y * size + 2, bw = size - 4, bh = size - 4;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.roundRect(bx + 2, by + 2, bw - 4, 4, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    },
  },
  pixel: {
    colors: [null, '#00aadd', '#ddaa00', '#9900cc', '#00aa44', '#cc2200', '#2244cc', '#cc6600', '#cc0077'],
    gridColor() { return '#000000'; },
    drawBlock(ctx, x, y, color, size, alpha) {
      ctx.globalAlpha = alpha ?? 1;
      const bx = x * size, by = y * size;
      ctx.fillStyle = color;
      ctx.fillRect(bx, by, size, size);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(bx, by, size - 1, 3);
      ctx.fillRect(bx, by, 3, size - 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx + 1, by + size - 3, size - 1, 3);
      ctx.fillRect(bx + size - 3, by + 1, 3, size - 1);
      ctx.globalAlpha = 1;
    },
  },
};
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayStats = document.getElementById('overlay-stats');
const overlayScoreEl = document.getElementById('overlay-score');
const overlayExtraEl = document.getElementById('overlay-extra');
const recordEntry = document.getElementById('record-entry');
const playerNameInput = document.getElementById('player-name');
const saveRecordBtn = document.getElementById('save-record-btn');
const overlayRecordsEl = document.getElementById('overlay-records');
const restartBtn = document.getElementById('restart-btn');
const mainBox = document.getElementById('main-box');
const pauseBox = document.getElementById('pause-box');
const pauseControlsList = document.getElementById('pause-controls-list');
const controlsToggleBtn = document.getElementById('controls-toggle-btn');
const startLevelVal = document.getElementById('start-level-val');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const panelRecordsEl = document.getElementById('panel-records');

let board, current, next, score, lines, level, combo, maxCombo;
let paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let startLevel = 1;
let activeSkin = SKINS.retro;
let overlayMode = 'start';

// ---- Records ----

function loadRecords() {
  try { return JSON.parse(localStorage.getItem('tetris-records')) || []; }
  catch { return []; }
}

function saveRecords(r) {
  localStorage.setItem('tetris-records', JSON.stringify(r));
}

function isEligible(s) {
  const r = loadRecords();
  return s > 0 && (r.length < 5 || s > r[r.length - 1].score);
}

function addRecord(name, s, l, mc) {
  const entry = { name, score: s, lines: l, maxCombo: mc, ts: Date.now() };
  const r = loadRecords();
  r.push(entry);
  r.sort((a, b) => b.score - a.score);
  r.splice(5);
  saveRecords(r);
  return r.findIndex(e => e.ts === entry.ts);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtScore(s) {
  if (s >= 1e6) return (s / 1e6).toFixed(1) + 'M';
  if (s >= 1e3) return (s / 1e3).toFixed(1) + 'K';
  return String(s);
}

function renderRecords(elId, highlightIdx) {
  const el = document.getElementById(elId);
  const records = loadRecords();

  if (!records.length) {
    el.innerHTML = '<p class="no-records">Sin records aún</p>';
    return;
  }

  if (elId === 'panel-records') {
    el.innerHTML = records.map((r, i) =>
      `<div class="pr-row${i === highlightIdx ? ' pr-highlight' : ''}">
        <span class="pr-rank">${i + 1}</span>
        <span class="pr-name">${esc(r.name)}</span>
        <span class="pr-score">${fmtScore(r.score)}</span>
      </div>`
    ).join('');
  } else {
    el.innerHTML =
      `<table class="records-table">
        <thead><tr><th>#</th><th>Nombre</th><th>Pts</th><th>L</th><th>C</th></tr></thead>
        <tbody>${records.map((r, i) =>
          `<tr class="${i === highlightIdx ? 'rec-highlight' : ''}">
            <td>${i + 1}</td>
            <td>${esc(r.name)}</td>
            <td>${r.score.toLocaleString()}</td>
            <td>${r.lines}</td>
            <td>${r.maxCombo}x</td>
          </tr>`
        ).join('')}</tbody>
      </table>`;
  }
}

// ---- Overlay states ----

function showStartOverlay() {
  overlayMode = 'start';
  overlayTitle.textContent = 'TETRIS';
  overlayTitle.dataset.mode = 'start';
  overlayStats.classList.add('hidden');
  recordEntry.classList.add('hidden');
  resetRecordsBtn.classList.remove('hidden');
  restartBtn.textContent = 'JUGAR';
  renderRecords('overlay-records', null);
  renderRecords('panel-records', null);
  pauseBox.classList.add('hidden');
  mainBox.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function showGameOverOverlay() {
  overlayMode = 'gameover';
  overlayTitle.textContent = 'GAME OVER';
  overlayTitle.dataset.mode = 'gameover';

  overlayScoreEl.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayExtraEl.textContent = `Líneas: ${lines}  |  Combo máx: ${maxCombo}x`;
  overlayStats.classList.remove('hidden');

  restartBtn.textContent = 'REINICIAR';
  resetRecordsBtn.classList.remove('hidden');

  if (isEligible(score)) {
    recordEntry.classList.remove('hidden');
    playerNameInput.value = '';
    overlayRecordsEl.innerHTML = '';
    setTimeout(() => playerNameInput.focus(), 100);
  } else {
    recordEntry.classList.add('hidden');
    renderRecords('overlay-records', null);
  }

  pauseBox.classList.add('hidden');
  mainBox.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

// ---- Game logic ----

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
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  } else {
    combo = 0;
  }
  updateHUD();
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
  activeSkin.drawBlock(context, x, y, activeSkin.colors[colorIndex], size, alpha);
}

function setSkin(name) {
  activeSkin = SKINS[name] || SKINS.retro;
  document.body.dataset.skin = name in SKINS ? name : 'retro';
  localStorage.setItem('tetris-skin', name);
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.skin === name);
  });
  if (current) { draw(); drawNext(); }
}

function drawGrid() {
  ctx.strokeStyle = activeSkin.gridColor();
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
  if (!current) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
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
  showGameOverOverlay();
}

function togglePause() {
  if (gameOver || overlayMode === 'start') return;
  paused = !paused;
  if (paused) {
    cancelAnimationFrame(animId);
    pauseControlsList.classList.add('hidden');
    controlsToggleBtn.textContent = 'Ver controles';
    mainBox.classList.add('hidden');
    pauseBox.classList.remove('hidden');
    overlayMode = 'pause';
    overlay.classList.remove('hidden');
  } else {
    pauseBox.classList.add('hidden');
    overlay.classList.add('hidden');
    overlayMode = 'playing';
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
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

function startGame() {
  cancelAnimationFrame(animId);
  board = createBoard();
  score = 0; lines = 0; level = startLevel; combo = 0; maxCombo = 0;
  paused = false; gameOver = false;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90); dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  mainBox.classList.add('hidden');
  pauseBox.classList.add('hidden');
  overlayMode = 'playing';
  renderRecords('panel-records', null);
  overlay.classList.add('hidden');
  animId = requestAnimationFrame(loop);
}

// ---- Events ----

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause(); return; }
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

restartBtn.addEventListener('click', () => {
  if (overlayMode === 'pause') {
    togglePause();
  } else {
    startGame();
  }
});

saveRecordBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim() || 'Anónimo';
  const idx = addRecord(name, score, lines, maxCombo);
  recordEntry.classList.add('hidden');
  renderRecords('overlay-records', idx);
  renderRecords('panel-records', idx);
});

playerNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveRecordBtn.click();
});

resetRecordsBtn.addEventListener('click', () => {
  localStorage.removeItem('tetris-records');
  renderRecords('overlay-records', null);
  renderRecords('panel-records', null);
});

document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('restart-pause-btn').addEventListener('click', startGame);

controlsToggleBtn.addEventListener('click', () => {
  const nowHidden = pauseControlsList.classList.toggle('hidden');
  controlsToggleBtn.textContent = nowHidden ? 'Ver controles' : 'Ocultar controles';
});

document.getElementById('level-dec').addEventListener('click', () => {
  if (startLevel > 1) startLevelVal.textContent = --startLevel;
});
document.getElementById('level-inc').addEventListener('click', () => {
  if (startLevel < 15) startLevelVal.textContent = ++startLevel;
});

document.getElementById('theme-toggle').addEventListener('change', e => {
  document.body.classList.toggle('light-mode', e.target.checked);
  if (current) draw();
});

document.querySelectorAll('.skin-btn').forEach(btn => {
  btn.addEventListener('click', () => setSkin(btn.dataset.skin));
});

showStartOverlay();
setSkin(localStorage.getItem('tetris-skin') || 'retro');
