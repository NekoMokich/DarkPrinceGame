const gameWrapper = document.querySelector('.game-wrapper');
const game = document.getElementById('game');
const scoreLabel = document.getElementById('score');
const livesLabel = document.getElementById('lives');
const levelLabel = document.getElementById('level');
const ammoLabel = document.getElementById('ammo');
const scoreboardList = document.getElementById('scoreboardList');
const scoreboardContainer = document.getElementById('scoreboardContainer');
const menu = document.getElementById('menu');
const editorPanel = document.getElementById('editorPanel');
const characterSelect = document.getElementById('characterSelect');
const startButton = document.getElementById('startButton');
const scoreboardButton = document.getElementById('scoreboardButton');
const musicToggleButton = document.getElementById('musicToggleButton');
const editorButton = document.getElementById('editorButton');
const saveLevelButton = document.getElementById('saveLevelButton');
const playCustomButton = document.getElementById('playCustomButton');
const clearLevelButton = document.getElementById('clearLevelButton');
const backToMenuButton = document.getElementById('backToMenuButton');
const tileTypeButtons = document.querySelectorAll('.tile-type-button');
const bgMusic = document.getElementById('bgMusic');
const shopModal = document.getElementById('shopModal');
const buySniperButton = document.getElementById('buySniperButton');
const closeShopButton = document.getElementById('closeShopButton');
const shopPoints = document.getElementById('shopPoints');
const tileSize = 48;
const viewportWidth = 960;
const viewportHeight = 480;
let world = null;
let worldWidth = 0;
let cameraX = 0;
let menuOpen = true;
let editorMode = false;
let editorMap = [];
let selectedEditorTile = '.';
let editorCols = 30;
let editorRows = 10;
let customLevelMap = null;
let useCustomLevel = false;
let musicEnabled = true;

const controls = {
  left: false,
  right: false,
  jump: false,
};

let gameSeed = Date.now();

function createRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function hasFloorAt(grid, x, floorRow) {
  const tile = grid[floorRow][x];
  return tile === '#' || tile === 'B';
}

function carveFloorGaps(grid, heights, floorRow, cols, rand) {
  const maxGapWidth = 3;
  const maxGaps = 2 + Math.floor(rand() * 2);
  const minX = 5;
  const maxX = cols - 6;
  const placed = [];

  for (let attempt = 0; attempt < 12 && placed.length < maxGaps; attempt += 1) {
    if (rand() < 0.4) continue;

    const width = 1 + Math.floor(rand() * maxGapWidth);
    const x = minX + Math.floor(rand() * (maxX - minX - width + 1));
    const overlaps = placed.some(gap => x <= gap.x + gap.width + 2 && x + width + 2 >= gap.x);
    if (overlaps) continue;

    for (let col = x; col < x + width; col += 1) {
      for (let row = 0; row <= floorRow; row += 1) {
        if (grid[row][col] === '#' || grid[row][col] === 'B') {
          grid[row][col] = '.';
        }
      }
      heights[col] = 0;
    }
    placed.push({ x, width });
  }

  return placed;
}

function isBossLevel(levelIndex) {
  // Every 5th level: 5, 10, 15... (1-based)
  return (levelIndex + 1) % 5 === 0;
}

function generateBossLevel(levelIndex) {
  const cols = 30;
  const rows = 10;
  const floorRow = rows - 1;
  const map = Array.from({ length: rows }, () => '.'.repeat(cols));
  const grid = map.map(r => r.split(''));

  for (let x = 0; x < cols; x += 1) {
    grid[floorRow][x] = 'B';
  }

  // Boss level pits: up to 3 tiles wide.
  // Constraints:
  // - keep start area safe
  // - keep flag area safe
  // - no pits within 9 tiles of boss spawn zone
  const levelSeed = gameSeed + levelIndex * 7777 + 54321;
  const rand = createRandom(levelSeed);
  const maxGapWidth = 3;
  const maxGaps = 2 + Math.floor(rand() * 2);
  const flagX = cols - 2;
  const bossCol = cols - 5;
  const safeRadius = 9;
  const placed = [];

  for (let attempt = 0; attempt < 18 && placed.length < maxGaps; attempt += 1) {
    if (rand() < 0.35) continue;
    const width = 1 + Math.floor(rand() * maxGapWidth);
    const x = 5 + Math.floor(rand() * (cols - 11 - width));

    const nearBoss = x <= bossCol + safeRadius && x + width - 1 >= bossCol - safeRadius;
    const nearFlag = x <= flagX + 2 && x + width - 1 >= flagX - 2;
    if (nearBoss || nearFlag) continue;

    const overlaps = placed.some(gap => x <= gap.x + gap.width + 2 && x + width + 2 >= gap.x);
    if (overlaps) continue;

    for (let col = x; col < x + width; col += 1) {
      grid[floorRow][col] = '.';
    }
    placed.push({ x, width });
  }

  // Ensure flag always has floor under it and exists in the map (spawned after boss death).
  grid[floorRow][flagX] = 'B';
  grid[floorRow - 2][flagX] = 'F';

  return grid.map(row => row.join(''));
}

function generateLevel(levelIndex) {
  const cols = 30;
  const rows = 10;
  const floorRow = rows - 1;
  const map = Array.from({ length: rows }, () => '.'.repeat(cols));
  const levelSeed = gameSeed + levelIndex * 1234 + Math.floor(Math.random() * 10000);
  const rand = createRandom(levelSeed);
  const heights = Array(cols).fill(0);
  const special = levelIndex % 2 === 1;

  let step = 0;
  for (let x = 2; x < cols - 4; x += 1) {
    if (rand() < 0.25) {
      step += rand() < 0.5 ? -1 : 1;
      step = Math.max(0, Math.min(3, step));
    }
    heights[x] = step;
  }

  const grid = map.map(r => r.split(''));
  for (let x = 0; x < cols; x += 1) {
    grid[floorRow][x] = special ? 'B' : '#';
    for (let height = 1; height <= heights[x]; height += 1) {
      grid[floorRow - height][x] = special ? 'B' : '#';
    }
  }

  carveFloorGaps(grid, heights, floorRow, cols, rand);

  if (special) {
    const floatRow = floorRow - 2;
    for (let x = 4; x < cols - 4; x += 1) {
      if (rand() < 0.45) {
        grid[floatRow][x] = 'B';
      }
    }
    if (!grid[floatRow].includes('B')) {
      grid[floatRow][Math.floor(cols / 2)] = 'B';
    }
  }

  {
    let boxPlaced = false;
    for (let tryBox = 0; tryBox < 12 && !boxPlaced; tryBox += 1) {
      const boxX = 5 + Math.floor(rand() * (cols - 10));
      const boxY = floorRow - 3 - Math.floor(rand() * 2);
      if (grid[boxY][boxX] === '.' && hasFloorAt(grid, boxX, floorRow)) {
        grid[boxY][boxX] = 'M';
        boxPlaced = true;
      }
    }
  }

  // Монеты на земле и на вершинах
  for (let x = 1; x < cols - 1; x += 1) {
    if (x === cols - 2) continue;
    if (!hasFloorAt(grid, x, floorRow)) continue;
    const threshold = special ? 0.55 : 0.45;
    if (rand() < threshold) {
      const height = heights[x];
      const coinRow = floorRow - height - 1;
      if (coinRow >= 0 && grid[coinRow][x] === '.') {
        grid[coinRow][x] = 'C';
      }
    }
  }

  const enemyCount = special ? 4 : 2;
  const enemyPositions = [];
  let enemyTries = 0;
  while (enemyPositions.length < enemyCount && enemyTries < 40) {
    enemyTries += 1;
    const pos = 6 + Math.floor(rand() * (cols - 12));
    if (enemyPositions.includes(pos)) continue;
    if (!hasFloorAt(grid, pos, floorRow)) continue;
    enemyPositions.push(pos);
  }

  enemyPositions.forEach((pos, index) => {
    const type = index % 2 === 0 ? 'G' : 'K';
    let enemyRow = floorRow - heights[pos] - 1;
    if (special) {
      const floatRow = floorRow - 2;
      if (grid[floatRow][pos] === '.') {
        enemyRow = floatRow;
      }
    }
    if (enemyRow >= 0 && grid[enemyRow][pos] === '.') {
      grid[enemyRow][pos] = type;
    }
  });

  const flagX = cols - 2;
  if (!hasFloorAt(grid, flagX, floorRow)) {
    grid[floorRow][flagX] = special ? 'B' : '#';
    heights[flagX] = 0;
  }
  const flagRow = special ? floorRow - 2 : floorRow - heights[flagX] - 1;
  if (flagRow >= 0 && grid[flagRow][flagX] === '.') {
    grid[flagRow][flagX] = 'F';
  }

  // Place a secret shop flag floating high in the sky in every standard level
  if (!isBossLevel(levelIndex)) {
    const secretX = 8 + Math.floor(rand() * 12); // column 8 to 19
    grid[floorRow - 4][secretX] = 'S';
  }

  return grid.map(row => row.join(''));
}

let currentLevel = 0;
let score = 0;
let lives = 3;
let ammo = 0;
let sniperAmmo = 0;
let playerName = 'Игрок';
let scoreboard = [];
let selectedCharacterFile = 'Mario.png';
let player = null;
let mousePlatform = null;
let movingPlatforms = [];
let coins = [];
let enemies = [];
let powerups = [];
let projectiles = [];
let enemyProjectiles = [];
let mysteryBoxes = [];
let flag = null;
let pendingBossFlag = null;
let tileRects = [];
let shopFlags = [];
let lastTime = performance.now();
let running = true;
let levelRestartPending = false;

// --- Combo System State & Functions ---
let comboCount = 0;
let comboTimer = 0;
const COMBO_DURATION = 3.5;

function getComboMultiplier(kills) {
  if (kills < 3) return 1;
  if (kills === 3) return 2;
  if (kills === 4) return 3;
  if (kills === 5) return 4;
  return 5; // Max x5 multiplier
}

function updateComboUI() {
  const comboDisplay = document.getElementById('comboDisplay');
  const comboValue = document.getElementById('comboValue');
  const comboBar = document.getElementById('comboBar');
  
  if (!comboDisplay || !comboValue || !comboBar) return;
  
  if (comboCount >= 3) {
    const mult = getComboMultiplier(comboCount);
    comboValue.textContent = `x${mult}`;
    comboDisplay.classList.add('active');
    
    const pct = Math.max(0, Math.min(100, (comboTimer / COMBO_DURATION) * 100));
    comboBar.style.width = `${pct}%`;
  } else {
    comboDisplay.classList.remove('active');
  }
}

function showComboFloatingText(x, y, points, multiplier) {
  const ft = document.createElement('div');
  ft.className = 'floating-text';
  ft.style.left = `${x}px`;
  ft.style.top = `${y}px`;
  if (multiplier > 1) {
    ft.innerHTML = `+${points} <span style="color:#ffdd57;font-size:1.25rem;">x${multiplier}!</span>`;
    if (multiplier === 2) ft.style.color = '#70caff';
    else if (multiplier === 3) ft.style.color = '#ffdd57';
    else if (multiplier === 4) ft.style.color = '#ff6b6b';
    else ft.style.color = '#ff3333';
  } else {
    ft.textContent = `+${points}`;
  }
  if (world) {
    world.appendChild(ft);
  } else {
    game.appendChild(ft);
  }
  setTimeout(() => {
    if (ft.parentElement) {
      ft.parentElement.removeChild(ft);
    }
  }, 1000);
}

function defeatEnemy(enemy, killedByStomp = false) {
  comboCount += 1;
  comboTimer = COMBO_DURATION;
  
  const basePoints = enemy.type === 'koopa' ? 200 : 150;
  const mult = getComboMultiplier(comboCount);
  const pointsEarned = basePoints * mult;
  
  score += pointsEarned;
  updateHUD();
  updateComboUI();
  
  showComboFloatingText(enemy.x, enemy.y, pointsEarned, mult);
  
  removeEntity(enemy);
}

function defeatBoss(boss) {
  comboCount += 1;
  comboTimer = COMBO_DURATION;
  
  const basePoints = 1000;
  const mult = getComboMultiplier(comboCount);
  const pointsEarned = basePoints * mult;
  
  score += pointsEarned;
  updateHUD();
  updateComboUI();
  
  showComboFloatingText(boss.x, boss.y, pointsEarned, mult);
  
  removeEntity(boss);
  onBossDefeated();
}

// --- Shooting Sound Synthesizer (Web Audio API) ---
let audioCtx = null;

function playShootSound(isSniper = false) {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    
    if (isSniper) {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.35);
      
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.35);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
      
      const bufferSize = audioCtx.sampleRate * 0.25;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1000, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.25);
      
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.15, now);
      noiseGain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      
      noise.start(now);
      noise.stop(now + 0.25);
    } else {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);
      
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.15);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch (err) {
    console.warn('Audio synthesis failed', err);
  }
}

// --- Shop & Sniper Rifle Powerup Logic ---
function openShop() {
  running = false;
  if (shopPoints && shopModal) {
    shopPoints.textContent = score;
    shopModal.classList.add('visible');
  }
}

function closeShop() {
  if (shopModal) {
    shopModal.classList.remove('visible');
  }
  running = true;
  lastTime = performance.now();
  window.requestAnimationFrame(loop);
}

function buySniperRifle() {
  if (score >= 500) {
    score -= 500;
    player.hasSniper = true;
    player.sniperAmmo = 2;
    player.hasGun = false;
    updateHUD();
    alert('Вы приобрели Снайперскую Винтовку! (2 мощных снаряда)');
    closeShop();
  } else {
    alert('Недостаточно очков! Требуется 500 очков.');
  }
}

function updateShopFlag() {
  if (levelRestartPending || menuOpen) return;
  shopFlags = shopFlags.filter(shopFlag => {
    if (rectsOverlap(player, shopFlag)) {
      openShop();
      removeEntity(shopFlag);
      return false;
    }
    return true;
  });
}

function createEntity(type, x, y) {
  const element = document.createElement('div');
  element.className = type;
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  if (world) {
    world.appendChild(element);
  } else {
    game.appendChild(element);
  }
  return { element, x, y, width: tileSize, height: tileSize };
}

function characterLabelFromFilename(filename) {
  return filename.replace(/\.[^.]+$/, '');
}

function applyPlayerSprite(element, filename) {
  const url = characterAssetUrl(filename);
  const img = new Image();
  img.onload = () => {
    element.style.backgroundImage = `url('${url}')`;
  };
  img.src = `${url}?v=${Date.now()}`;
}

const CHARACTER_IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;
const CHARACTER_CACHE_KEY = 'marioCharacterFiles';

function isCharacterSpriteFile(name) {
  if (!name || name.startsWith('.')) return false;
  if (name === 'manifest.json') return false;
  return CHARACTER_IMAGE_RE.test(name);
}

function parseCharacterNamesFromDirectoryHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const names = Array.from(doc.querySelectorAll('a[href]'))
    .map(link => {
      const href = decodeURIComponent(link.getAttribute('href') || '');
      return href.split('/').pop().split('?')[0];
    })
    .filter(isCharacterSpriteFile);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

async function scanCharactersDirectory() {
  const response = await fetch('characters/', { cache: 'no-store' });
  if (!response.ok) throw new Error('characters directory listing unavailable');
  const html = await response.text();
  const names = parseCharacterNamesFromDirectoryHtml(html);
  if (names.length === 0) throw new Error('no character sprites found in directory listing');
  return names;
}

async function loadCharactersCacheFile() {
  try {
    const response = await fetch('characters/.characters-cache.json', { cache: 'no-store' });
    if (!response.ok) return [];
    const list = await response.json();
    if (!Array.isArray(list)) return [];
    return list.filter(name => typeof name === 'string' && isCharacterSpriteFile(name));
  } catch (error) {
    return [];
  }
}

function loadCachedCharacterList() {
  try {
    const stored = localStorage.getItem(CHARACTER_CACHE_KEY);
    if (!stored) return [];
    const list = JSON.parse(stored);
    if (!Array.isArray(list)) return [];
    return list.filter(name => typeof name === 'string' && isCharacterSpriteFile(name));
  } catch (error) {
    return [];
  }
}

function saveCachedCharacterList(list) {
  localStorage.setItem(CHARACTER_CACHE_KEY, JSON.stringify(list));
}

function characterAssetUrl(filename) {
  return `characters/${filename}`;
}

async function characterAssetExists(filename) {
  const url = characterAssetUrl(filename);
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (response.ok) return true;
  } catch (error) {
    // HEAD may be blocked on some static hosts; fall back to image probe.
  }

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = `${url}?probe=${Date.now()}`;
  });
}

async function probeCharacterCandidates(candidates) {
  const unique = [...new Set(candidates.filter(isCharacterSpriteFile))];
  const found = [];
  for (const filename of unique) {
    if (await characterAssetExists(filename)) {
      found.push(filename);
    }
  }
  return found.sort((a, b) => a.localeCompare(b));
}

async function loadCharacterList() {
  const candidates = new Set([
    ...loadCachedCharacterList(),
    selectedCharacterFile,
    'Hero.png',
    'Mario.png',
    'Mario2.png',
  ]);

  try {
    const scanned = await scanCharactersDirectory();
    scanned.forEach(name => candidates.add(name));
    saveCachedCharacterList(scanned);
    return scanned;
  } catch (error) {
    // Directory listing is unavailable (for example file:// or some static hosts).
  }

  const cacheFileList = await loadCharactersCacheFile();
  cacheFileList.forEach(name => candidates.add(name));
  if (cacheFileList.length > 0) {
    saveCachedCharacterList(cacheFileList);
    return cacheFileList;
  }

  const probed = await probeCharacterCandidates([...candidates]);
  if (probed.length > 0) {
    saveCachedCharacterList(probed);
    return probed;
  }

  return ['Hero.png'];
}

function loadSelectedCharacter() {
  const stored = localStorage.getItem('marioSelectedCharacter');
  if (stored) selectedCharacterFile = stored;
}

function saveSelectedCharacter(filename) {
  selectedCharacterFile = filename;
  localStorage.setItem('marioSelectedCharacter', filename);
}

async function initCharacterSelect() {
  if (!characterSelect) return;

  loadSelectedCharacter();
  const characters = await loadCharacterList();
  characterSelect.innerHTML = '';
  characters.forEach(filename => {
    const option = document.createElement('option');
    option.value = filename;
    option.textContent = characterLabelFromFilename(filename);
    characterSelect.appendChild(option);
  });

  if (!characters.includes(selectedCharacterFile)) {
    selectedCharacterFile = characters[0] || 'Mario.png';
    saveSelectedCharacter(selectedCharacterFile);
  }
  characterSelect.value = selectedCharacterFile;

  characterSelect.addEventListener('change', () => {
    saveSelectedCharacter(characterSelect.value);
  });
}

function removeEntity(entity) {
  if (entity && entity.element && entity.element.parentElement) {
    entity.element.parentElement.removeChild(entity.element);
  }
}

function buildLevel(levelIndex, mapOverride = null) {
  game.innerHTML = '';

  // Recreate comboDisplay dynamically so it is not lost when game.innerHTML is cleared
  const comboDisplay = document.createElement('div');
  comboDisplay.id = 'comboDisplay';
  comboDisplay.className = 'combo-display';
  comboDisplay.innerHTML = `
    <div class="combo-title">COMBO</div>
    <div class="combo-value" id="comboValue">x1</div>
    <div class="combo-bar-container">
      <div class="combo-bar" id="comboBar"></div>
    </div>
  `;
  game.appendChild(comboDisplay);

  // Reset combo state
  comboCount = 0;
  comboTimer = 0;
  updateComboUI();

  coins = [];
  enemies = [];
  powerups = [];
  projectiles = [];
  enemyProjectiles = [];
  mysteryBoxes = [];
  tileRects = [];
  shopFlags = [];
  flag = null;
  pendingBossFlag = null;
  world = document.createElement('div');
  world.id = 'world';
  world.style.position = 'relative';
  world.style.height = `${viewportHeight}px`;
  game.appendChild(world);

  const bossLevel = !mapOverride && !useCustomLevel && isBossLevel(levelIndex);
  const map = mapOverride || (bossLevel ? generateBossLevel(levelIndex) : generateLevel(levelIndex));
  const special = levelIndex % 2 === 1;
  game.classList.toggle('gray', special || bossLevel);
  worldWidth = Math.max(...map.map(line => line.length)) * tileSize;
  world.style.width = `${worldWidth}px`;

  for (let row = 0; row < map.length; row += 1) {
    const line = map[row];
    for (let col = 0; col < line.length; col += 1) {
      const char = line[col];
      const x = col * tileSize;
      const y = row * tileSize;

      if (char === '#') {
        const tile = createEntity('tile brick', x, y);
        tileRects.push(tile);
      }
      if (char === 'B') {
        const tile = createEntity('tile brick2', x, y);
        tileRects.push(tile);
      }
      if (char === 'M') {
        const box = createEntity('tile mystery-box', x, y);
        box.type = 'mystery';
        mysteryBoxes.push(box);
        tileRects.push(box);
      }
      if (char === 'C') {
        const coin = createEntity('coin', x, y);
        coins.push(coin);
      }
      if (char === 'G') {
        const enemy = createEntity('enemy goomba', x, y);
        enemy.type = 'goomba';
        enemy.direction = 1;
        enemy.vx = 0;
        enemy.vy = 0;
        enemy.onGround = false;
        enemy.jumpTimer = 0;
        enemies.push(enemy);
      }
      if (char === 'K') {
        const enemy = createEntity('enemy koopa', x, y);
        enemy.type = 'koopa';
        enemy.direction = 1;
        enemy.vx = 0;
        enemy.vy = 0;
        enemy.onGround = false;
        enemy.jumpTimer = 0;
        enemies.push(enemy);
      }
      if (char === 'F') {
        if (bossLevel) {
          pendingBossFlag = { x, y: y - 8 };
        } else {
          flag = createEntity('flag', x, y - 8);
        }
      }
      if (char === 'S') {
        const shopFlag = createEntity('flag flag-shop', x, y - 8);
        shopFlag.type = 'shop-flag';
        shopFlags.push(shopFlag);
      }
    }
  }

  player = createEntity('player', 80, 360);
  player.vx = 0;
  player.vy = 0;
  player.direction = 1;
  player.canJump = false;
  player.jumpCount = 0;
  player.jumpPressed = false;
  player.hasGun = ammo > 0 && sniperAmmo <= 0;
  player.ammo = ammo;
  player.hasSniper = sniperAmmo > 0;
  player.sniperAmmo = sniperAmmo;
  player.shootCooldown = 0;
  player.width = tileSize;
  player.height = tileSize;
  applyPlayerSprite(player.element, selectedCharacterFile);

  mousePlatform = createEntity('tile cursor-platform', 0, 0);
  mousePlatform.type = 'cursor';
  mousePlatform.active = false;
  mousePlatform.element.style.display = 'none';
  tileRects.push(mousePlatform);

  if (bossLevel) {
    const bossX = Math.max(240, worldWidth - 240);
    const bossSize = 64;
    const bossY = viewportHeight - tileSize - bossSize;
    const boss = createEntity('enemy boss', bossX, bossY);
    boss.type = 'boss';
    boss.direction = -1;
    boss.vx = 0;
    boss.vy = 0;
    boss.onGround = false;
    boss.hp = 3;
    boss.stompHits = 0;
    boss.fireCooldown = 0.8;
    boss.width = bossSize;
    boss.height = bossSize;
    boss.element.style.width = `${bossSize}px`;
    boss.element.style.height = `${bossSize}px`;
    enemies.push(boss);
  }

  levelLabel.textContent = currentLevel + 1;
  cameraX = 0;
  updateCamera();
  updateHUD();
}

function setEditorToolbarVisible(visible) {
  if (editorPanel) {
    editorPanel.classList.toggle('visible', visible);
  }
  if (gameWrapper) {
    gameWrapper.classList.toggle('editor-active', visible);
  }
}

function showMenu() {
  menu.classList.add('visible');
  setEditorToolbarVisible(false);
  if (scoreboardContainer) {
    scoreboardContainer.classList.add('hidden');
  }
  if (scoreboardButton) {
    scoreboardButton.textContent = 'Scoreboard';
  }
  menuOpen = true;
}

function hideMenu() {
  menu.classList.remove('visible');
  menuOpen = false;
}

function updateHUD() {
  scoreLabel.textContent = score;
  livesLabel.textContent = lives;
  if (player && player.hasSniper) {
    ammoLabel.textContent = `SNIPER (${player.sniperAmmo})`;
  } else {
    ammoLabel.textContent = ammo;
  }
}

function toggleScoreboard() {
  if (!scoreboardContainer || !scoreboardButton) return;
  const visible = scoreboardContainer.classList.contains('hidden');
  scoreboardContainer.classList.toggle('hidden', !visible);
  scoreboardButton.textContent = visible ? 'Скрыть scoreboard' : 'Scoreboard';
  if (visible) {
    renderScoreboard();
  }
}

function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (!musicEnabled) {
    bgMusic.pause();
    musicToggleButton.textContent = 'Включить музыку';
  } else {
    bgMusic.play().catch(() => {});
    musicToggleButton.textContent = 'Отключить музыку';
  }
}

function loadScoreboard() {
  try {
    const stored = localStorage.getItem('marioScoreboard');
    scoreboard = stored ? JSON.parse(stored) : [];
  } catch (error) {
    scoreboard = [];
  }
}

function saveScoreboard() {
  localStorage.setItem('marioScoreboard', JSON.stringify(scoreboard));
}

function renderScoreboard() {
  if (!scoreboardList) return;
  if (scoreboard.length === 0) {
    scoreboardList.innerHTML = '<div class="scoreboard-row">Нет записей</div>';
    return;
  }
  scoreboardList.innerHTML = scoreboard.map(entry => `
    <div class="scoreboard-row">
      <span>${entry.name}</span>
      <span>${entry.levels}</span>
      <span>${entry.score}</span>
    </div>
  `).join('');
}

function addScoreboardEntry(name, levels, scorePoints) {
  const entry = {
    name: name || 'Игрок',
    levels: levels || 0,
    score: scorePoints || 0,
    date: new Date().toLocaleDateString(),
  };
  scoreboard.push(entry);
  scoreboard.sort((a, b) => b.levels - a.levels || b.score - a.score);
  scoreboard = scoreboard.slice(0, 10);
  saveScoreboard();
  renderScoreboard();
}

function askPlayerName() {
  const storedName = localStorage.getItem('marioPlayerName');
  if (storedName) {
    playerName = storedName;
  }
  const name = prompt('Введите имя игрока', playerName || 'Игрок');
  if (name) {
    playerName = name.trim().slice(0, 16) || playerName;
    localStorage.setItem('marioPlayerName', playerName);
  }
}

function loadCustomLevel() {
  try {
    const stored = localStorage.getItem('marioCustomLevel');
    customLevelMap = stored ? JSON.parse(stored) : null;
  } catch (error) {
    customLevelMap = null;
  }
}

function renderEditorGrid() {
  game.innerHTML = '';
  world = document.createElement('div');
  world.id = 'world';
  world.style.position = 'relative';
  world.style.width = `${viewportWidth}px`;
  world.style.height = `${viewportHeight}px`;
  game.appendChild(world);
  editorMap.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const cellTile = createEntity('tile editor-cell', colIndex * tileSize, rowIndex * tileSize);
      cellTile.type = 'editor';
      cellTile.element.dataset.row = rowIndex;
      cellTile.element.dataset.col = colIndex;
      cellTile.element.style.width = `${tileSize}px`;
      cellTile.element.style.height = `${tileSize}px`;
      cellTile.element.style.background = 'rgba(0,0,0,0.08)';
      cellTile.element.style.border = '1px solid rgba(255,255,255,0.08)';
      cellTile.element.style.pointerEvents = 'none';
    });
  });
  updateEditorDisplay();
}

function updateEditorDisplay() {
  if (!world) return;
  world.querySelectorAll('.editor-cell').forEach(cell => {
    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);
    const tileType = editorMap[row][col];
    switch (tileType) {
      case '#':
        cell.style.background = '#8b5a2b';
        break;
      case 'B':
        cell.style.background = '#b97a57';
        break;
      case 'M':
        cell.style.background = '#e3c93d';
        break;
      case 'C':
        cell.style.background = '#f5d742';
        break;
      case 'G':
        cell.style.background = '#a74a3f';
        break;
      case 'K':
        cell.style.background = '#6b9b8c';
        break;
      case 'F':
        cell.style.background = '#e63946';
        break;
      case 'S':
        cell.style.background = '#ffdd57';
        cell.style.backgroundImage = "url('flagshop.png')";
        cell.style.backgroundSize = 'contain';
        cell.style.backgroundRepeat = 'no-repeat';
        break;
      default:
        cell.style.background = 'rgba(0,0,0,0.08)';
        break;
    }
  });
}

function enterEditorMode() {
  editorMode = true;
  running = false;
  hideMenu();
  if (mousePlatform) {
    mousePlatform.active = false;
    mousePlatform.element.style.display = 'none';
  }
  setEditorToolbarVisible(true);
  editorMap = customLevelMap ? customLevelMap.map(row => row.split('')) : Array.from({ length: editorRows }, () => Array(editorCols).fill('.'));
  renderEditorGrid();
  selectedEditorTile = '.';
  tileTypeButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.tile === selectedEditorTile);
  });
}

function exitEditorMode() {
  editorMode = false;
  setEditorToolbarVisible(false);
  if (mousePlatform) {
    mousePlatform.element.style.display = 'none';
    mousePlatform.active = false;
  }
  showMenu();
  game.innerHTML = '';
}

function saveEditorLevel() {
  customLevelMap = editorMap.map(row => row.join(''));
  localStorage.setItem('marioCustomLevel', JSON.stringify(customLevelMap));
  alert('Уровень сохранён. Теперь нажмите «Играть кастомный», чтобы запустить его.');
}

function clearEditorLevel() {
  editorMap = Array.from({ length: editorRows }, () => Array(editorCols).fill('.'));
  renderEditorGrid();
}

function playCustomLevel() {
  if (!customLevelMap) {
    alert('Сначала сохраните уровень.');
    return;
  }
  editorMode = false;
  setEditorToolbarVisible(false);
  useCustomLevel = true;
  currentLevel = 0;
  hideMenu();
  startGame(true);
}

function toggleEditorCell(col, row, tile) {
  if (row < 0 || row >= editorRows || col < 0 || col >= editorCols) return;
  editorMap[row][col] = tile;
  updateEditorDisplay();
}

function getEditorTileFromButton(button) {
  return button.dataset.tile || '.';
}

function updateCamera() {
  cameraX = Math.min(Math.max(player.x + player.width / 2 - viewportWidth / 2, 0), Math.max(worldWidth - viewportWidth, 0));
  if (world) {
    world.style.transform = `translateX(-${cameraX}px)`;
  }
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function getTileCollision(rect) {
  for (const tile of tileRects) {
    if (rectsOverlap(rect, tile)) {
      return tile;
    }
  }
  return null;
}

function updatePlayer(delta) {
  const walkSpeed = 220;
  const gravity = 1600;
  const jumpSpeed = 560;

  player.vx = 0;
  if (controls.left) {
    player.vx -= walkSpeed;
    player.direction = -1;
  }
  if (controls.right) {
    player.vx += walkSpeed;
    player.direction = 1;
  }

  if (controls.jump && !player.jumpPressed) {
    if (player.canJump || player.jumpCount < 2) {
      player.vy = -jumpSpeed;
      player.canJump = false;
      player.jumpCount += 1;
    }
  }
  player.jumpPressed = controls.jump;

  player.vy += gravity * delta;
  player.x += player.vx * delta;
  player.y += player.vy * delta;

  player.x = Math.max(0, Math.min(player.x, worldWidth - player.width));

  const futureRect = { ...player, x: player.x, y: player.y };
  player.canJump = false;

  for (const tile of tileRects) {
    if (tile.type === 'cursor' && !tile.active) continue;
    const tileRect = { ...tile };
    if (!rectsOverlap(futureRect, tileRect)) continue;

    const overlapX = Math.min(player.x + player.width, tileRect.x + tileRect.width) - Math.max(player.x, tileRect.x);
    const overlapY = Math.min(player.y + player.height, tileRect.y + tileRect.height) - Math.max(player.y, tileRect.y);

    if (overlapX < overlapY) {
      if (player.x < tileRect.x) {
        player.x = tileRect.x - player.width;
      } else {
        player.x = tileRect.x + tileRect.width;
      }
      player.vx = 0;
    } else {
      if (player.y < tileRect.y) {
        player.y = tileRect.y - player.height;
        player.vy = 0;
        player.canJump = true;
        player.jumpCount = 0;
      } else {
        if (tile.type === 'mystery' && player.vy < 0) {
          removeEntity(tile);
          const boxIndex = mysteryBoxes.indexOf(tile);
          if (boxIndex >= 0) mysteryBoxes.splice(boxIndex, 1);
          const tileIndex = tileRects.indexOf(tile);
          if (tileIndex >= 0) tileRects.splice(tileIndex, 1);
          spawnPowerup(tile);
        }
        player.y = tileRect.y + tileRect.height;
        player.vy = 0;
      }
    }
  }

  if (player.y > viewportHeight + 40) {
    loseLife();
    return;
  }

  player.element.style.left = `${player.x}px`;
  player.element.style.top = `${player.y}px`;
  updateCamera();
}

function updateMysteryBoxes() {
  // Mystery boxes are broken by player hits from below in updatePlayer().
  // Keep the array clean in case a box was removed from the world.
  mysteryBoxes = mysteryBoxes.filter(box => box && box.element.parentElement);
}

function updatePowerups(delta) {
  const gravity = 1400;
  powerups = powerups.filter(powerup => {
    powerup.vy += gravity * delta;
    powerup.y += powerup.vy * delta;

    const rect = { ...powerup, width: powerup.width, height: powerup.height };
    for (const tile of tileRects) {
      if (!rectsOverlap(rect, tile)) continue;
      if (powerup.y + powerup.height <= tile.y + 10) {
        powerup.y = tile.y - powerup.height;
        powerup.vy = 0;
        break;
      }
    }

    if (rectsOverlap(player, powerup)) {
      removeEntity(powerup);
      if (powerup.type === 'poison') {
        loseLife();
        return false;
      }
      player.hasGun = true;
      ammo = 5;
      player.ammo = ammo;
      player.shootCooldown = 0;
      updateHUD();
      return false;
    }

    if (powerup.y > viewportHeight + 40) {
      removeEntity(powerup);
      return false;
    }

    powerup.element.style.left = `${powerup.x}px`;
    powerup.element.style.top = `${powerup.y}px`;
    return true;
  });
}

function updateProjectiles(delta) {
  const speed = 560;
  projectiles = projectiles.filter(projectile => {
    projectile.x += projectile.direction * speed * delta;
    const rect = { ...projectile, width: projectile.width, height: projectile.height };
    let alive = true;

    const matchingTiles = tileRects.filter(tile => {
      if (tile.type === 'cursor' && !tile.active) return false;
      if (tile.type === 'cursor') return false;
      return rectsOverlap(rect, tile);
    });

    for (const tile of matchingTiles) {
      const tileIndex = tileRects.indexOf(tile);
      if (tileIndex < 0) continue;

      if (!projectile.isSniper) {
        if (tile.type === 'mystery') {
          const boxIndex = mysteryBoxes.indexOf(tile);
          if (boxIndex >= 0) mysteryBoxes.splice(boxIndex, 1);
        }
        removeEntity(tile);
        tileRects.splice(tileIndex, 1);
        removeEntity(projectile);
        alive = false;
        break;
      } else {
        if (tile.type === 'brick' || tile.type === 'brick2' || tile.type === 'mystery' || tile.className.includes('brick') || tile.className.includes('mystery')) {
          if (tile.type === 'mystery') {
            const boxIndex = mysteryBoxes.indexOf(tile);
            if (boxIndex >= 0) mysteryBoxes.splice(boxIndex, 1);
            spawnPowerup(tile);
          }
          removeEntity(tile);
          tileRects.splice(tileIndex, 1);
          
          projectile.tilesPenetrated = (projectile.tilesPenetrated || 0) + 1;
          if (projectile.tilesPenetrated >= 3) {
            removeEntity(projectile);
            alive = false;
            break;
          }
        }
      }
    }

    if (!alive) return false;

    enemies = enemies.filter(enemy => {
      if (!rectsOverlap(rect, enemy)) return true;
      
      if (enemy.type === 'boss') {
        if (projectile.isSniper) {
          enemy.hp -= 3;
          if (enemy.hp <= 0) {
            defeatBoss(enemy);
            removeEntity(projectile);
            alive = false;
            return false;
          }
          
          projectile.enemiesPenetrated = (projectile.enemiesPenetrated || 0) + 1;
          if (projectile.enemiesPenetrated >= 3) {
            removeEntity(projectile);
            alive = false;
          }
          return true;
        } else {
          enemy.hp -= 1;
          removeEntity(projectile);
          alive = false;
          if (enemy.hp <= 0) {
            defeatBoss(enemy);
            return false;
          }
          return true;
        }
      }
      
      if (projectile.isSniper) {
        defeatEnemy(enemy, false);
        
        projectile.enemiesPenetrated = (projectile.enemiesPenetrated || 0) + 1;
        if (projectile.enemiesPenetrated >= 3) {
          removeEntity(projectile);
          alive = false;
        }
        return false;
      } else {
        defeatEnemy(enemy, false);
        removeEntity(projectile);
        alive = false;
        return false;
      }
    });

    if (!alive) return false;

    if (projectile.x < 0 || projectile.x > worldWidth) {
      removeEntity(projectile);
      return false;
    }

    projectile.element.style.left = `${projectile.x}px`;
    projectile.element.style.top = `${projectile.y}px`;
    return true;
  });
}

const POISON_POWERUP_CHANCE = 0.25;

function onBossDefeated() {
  running = false;
  if (!flag && pendingBossFlag) {
    flag = createEntity('flag', pendingBossFlag.x, pendingBossFlag.y);
    pendingBossFlag = null;
  }
  showMessage('Босс побеждён!\nДоберитесь до флага.', 'Продолжить', () => {
    running = true;
    lastTime = performance.now();
    window.requestAnimationFrame(loop);
  });
}

function updateEnemyProjectiles(delta) {
  const gravity = 900;
  enemyProjectiles = enemyProjectiles.filter(fireball => {
    fireball.vy += gravity * delta;
    fireball.x += fireball.vx * delta;
    fireball.y += fireball.vy * delta;

    const rect = { ...fireball, width: fireball.width, height: fireball.height };
    for (const tile of tileRects) {
      if (tile.type === 'cursor' && !tile.active) continue;
      if (!rectsOverlap(rect, tile)) continue;
      removeEntity(fireball);
      return false;
    }

    if (rectsOverlap(rect, player)) {
      removeEntity(fireball);
      loseLife();
      return false;
    }

    if (fireball.x < -100 || fireball.x > worldWidth + 100 || fireball.y > viewportHeight + 120) {
      removeEntity(fireball);
      return false;
    }

    fireball.element.style.left = `${fireball.x}px`;
    fireball.element.style.top = `${fireball.y}px`;
    return true;
  });
}

function spawnPowerup(box) {
  const isPoison = Math.random() < POISON_POWERUP_CHANCE;
  const powerupType = isPoison ? 'poison' : 'gun';
  const powerup = createEntity(`powerup powerup-${powerupType}`, box.x, box.y - tileSize);
  powerup.type = powerupType;
  powerup.vy = 0;
  powerup.width = tileSize;
  powerup.height = tileSize;
  powerups.push(powerup);
}

function updateShooting(delta) {
  if (player.shootCooldown > 0) player.shootCooldown -= delta;

  if (player.hasSniper && player.sniperAmmo > 0) {
    if (controls.shoot && player.shootCooldown <= 0) {
      const dir = player.direction || 1;
      const projectile = createEntity('projectile projectile-sniper', player.x + player.width / 2 - 12, player.y + player.height / 2 - 12);
      projectile.direction = dir;
      projectile.isSniper = true;
      projectile.tilesPenetrated = 0;
      projectile.enemiesPenetrated = 0;
      projectile.width = 24;
      projectile.height = 24;
      projectile.element.style.width = '24px';
      projectile.element.style.height = '24px';
      projectile.element.style.backgroundImage = "url('flagshop.png')";
      projectile.element.style.backgroundSize = 'contain';
      projectile.element.style.marginLeft = dir === 1 ? '8px' : '0';
      projectiles.push(projectile);

      player.sniperAmmo -= 1;
      sniperAmmo = player.sniperAmmo;
      if (player.sniperAmmo <= 0) {
        player.hasSniper = false;
      }
      player.shootCooldown = 0.55;
      playShootSound(true);
      updateHUD();
    }
    return;
  }

  if (!player.hasGun || player.ammo <= 0) return;
  if (controls.shoot && player.shootCooldown <= 0) {
    const dir = player.direction || 1;
    const projectile = createEntity('projectile', player.x + player.width / 2, player.y + player.height / 2);
    projectile.direction = dir;
    projectile.width = 16;
    projectile.height = 16;
    projectile.element.style.width = '16px';
    projectile.element.style.height = '16px';
    projectile.element.style.marginLeft = dir === 1 ? '8px' : '0';
    projectiles.push(projectile);
    player.ammo -= 1;
    ammo = player.ammo;
    if (player.ammo <= 0) {
      player.ammo = 0;
      player.hasGun = false;
    }
    player.shootCooldown = 0.35;
    playShootSound(false);
    updateHUD();
  }
}

function updateEnemies(delta) {
  const hasSolidAtPoint = (x, y) => {
    const pointRect = { x, y, width: 1, height: 1 };
    for (const tile of tileRects) {
      if (tile.type === 'cursor' && !tile.active) continue;
      if (rectsOverlap(pointRect, tile)) return true;
    }
    return false;
  };

  const hasGroundAtX = (x, enemy) => {
    const footY = enemy.y + enemy.height + 2;
    return hasSolidAtPoint(x, footY);
  };

  enemies.forEach(enemy => {
    const wasOnGround = enemy.onGround;
    const baseGravity = 1600;
    let speed = 80;

    if (enemy.type === 'boss') {
      speed = 40;
      enemy.fireCooldown -= delta;
      if (enemy.fireCooldown <= 0) {
        const dir = player.x < enemy.x ? -1 : 1;
        const fireball = createEntity('fireball', enemy.x + enemy.width / 2, enemy.y + 10);
        fireball.type = 'fireball';
        fireball.width = 18;
        fireball.height = 18;
        fireball.vx = dir * 320;
        fireball.vy = -140;
        fireball.element.style.width = '18px';
        fireball.element.style.height = '18px';
        enemyProjectiles.push(fireball);
        enemy.fireCooldown = 1.25 + Math.random() * 0.35;
      }
    }

    if (enemy.type === 'koopa') {
      speed = 70;
      const chaseDistance = 220;
      const dx = player.x - enemy.x;
      if (Math.abs(dx) < chaseDistance) {
        enemy.direction = dx > 0 ? 1 : -1;
      }
      enemy.jumpTimer += delta;
      if (enemy.onGround && enemy.jumpTimer > 1.5) {
        enemy.vy = -340;
        enemy.onGround = false;
        enemy.jumpTimer = 0;
      }
    }

    // Edge / gap behavior:
    // - Don't walk off platforms into pits.
    // - If the gap is exactly 1 tile wide, jump over it.
    if (wasOnGround) {
      const dir = enemy.direction || 1;
      const aheadFootX = dir === 1 ? enemy.x + enemy.width + 2 : enemy.x - 2;
      const twoAheadFootX = aheadFootX + dir * tileSize;
      const hasGroundAhead = hasGroundAtX(aheadFootX, enemy);

      if (!hasGroundAhead) {
        const canJumpOneTile = hasGroundAtX(twoAheadFootX, enemy);
        if (canJumpOneTile) {
          // Jump over a 1-tile gap.
          if (enemy.vy >= 0) {
            enemy.vy = -380;
            if (enemy.type === 'koopa') {
              enemy.onGround = false;
              enemy.jumpTimer = 0;
            }
          }
        } else {
          // Wider gap: turn around instead of falling.
          enemy.direction = -dir;
          // Skip horizontal movement this frame to avoid stepping off the edge.
          speed = 0;
        }
      }
    }

    enemy.x += enemy.direction * speed * delta;
    enemy.vy += baseGravity * delta;
    enemy.y += enemy.vy * delta;
    enemy.onGround = false;

    const collisionRect = { ...enemy, width: enemy.width, height: enemy.height };
    for (const tile of tileRects) {
      if (!rectsOverlap(collisionRect, tile)) continue;
      const overlapX = Math.min(enemy.x + enemy.width, tile.x + tile.width) - Math.max(enemy.x, tile.x);
      const overlapY = Math.min(enemy.y + enemy.height, tile.y + tile.height) - Math.max(enemy.y, tile.y);

      if (overlapX < overlapY) {
        if (enemy.x < tile.x) {
          enemy.x = tile.x - enemy.width;
        } else {
          enemy.x = tile.x + tile.width;
        }
        enemy.direction *= -1;
        enemy.vx = 0;
      } else {
        if (enemy.y < tile.y) {
          enemy.y = tile.y - enemy.height;
          enemy.vy = 0;
          enemy.onGround = true;
        } else {
          enemy.y = tile.y + tile.height;
          enemy.vy = 0;
        }
      }
    }

    if (enemy.x < 0) {
      enemy.x = 0;
      enemy.direction = 1;
    }
    if (enemy.x + enemy.width > worldWidth) {
      enemy.x = worldWidth - enemy.width;
      enemy.direction = -1;
    }

    enemy.element.style.left = `${enemy.x}px`;
    enemy.element.style.top = `${enemy.y}px`;
  });
}

function updateCoins() {
  coins = coins.filter(coin => {
    if (!coin) return false;
    if (rectsOverlap(player, coin)) {
      score += 100;
      updateHUD();
      removeEntity(coin);
      return false;
    }
    return true;
  });
}

function updateEnemyCollisions() {
  if (levelRestartPending) return;
  enemies = enemies.filter(enemy => {
    if (!enemy) return true;
    if (!rectsOverlap(player, enemy)) return true;

    const playerBottom = player.y + player.height;
    if (player.vy > 0 && playerBottom - enemy.y < 20) {
      if (enemy.type === 'boss') {
        enemy.stompHits = (enemy.stompHits || 0) + 1;
        // Knock the player away from the boss so double-stomps aren't free.
        const knockDir = player.x + player.width / 2 < enemy.x + enemy.width / 2 ? -1 : 1;
        player.x = Math.max(0, Math.min(player.x + knockDir * 140, worldWidth - player.width));
        player.vy = -220;
        player.element.style.left = `${player.x}px`;
        if (enemy.stompHits >= 3) {
          defeatBoss(enemy);
          return false;
        }
        return true;
      }
      defeatEnemy(enemy, true);
      player.vy = -280;
      return false;
    }

    loseLife();
    return true;
  });
}

function updateFlag() {
  if (levelRestartPending) return;
  if (!flag) return;
  if (rectsOverlap(player, flag)) {
    flag = null;
    running = false;
    currentLevel += 1;
    score += 500;
    updateHUD();
    showMessage('Уровень пройден!', 'Продолжить', () => resetLevel());
  }
}

function returnToMenuAfterGameOver() {
  game.innerHTML = '';
  running = false;
  useCustomLevel = false;
  score = 0;
  lives = 3;
  ammo = 0;
  sniperAmmo = 0;
  currentLevel = 0;
  updateHUD();
  showMenu();
}

function loseLife() {
  if (levelRestartPending) return;
  comboCount = 0;
  comboTimer = 0;
  sniperAmmo = 0;
  updateComboUI();
  lives -= 1;
  updateHUD();
  if (lives <= 0) {
    running = false;
    askPlayerName();
    addScoreboardEntry(playerName, currentLevel, score);
    showDeathScreen(
      'GAME OVER\nРезультат сохранён в таблице рекордов',
      null,
      returnToMenuAfterGameOver,
      1800,
    );
  } else {
    showDeathScreen('DEATH SCREEN\nПереходим на следующий уровень...', null, () => {
      currentLevel += 1;
      resetLevel();
    }, 1200);
  }
}

function resetLevel() {
  buildLevel(currentLevel, useCustomLevel ? customLevelMap : null);
  if (!running) {
    running = true;
  }
  lastTime = performance.now();
  window.requestAnimationFrame(loop);
}

function showDeathScreen(text, buttonText, onConfirm, delay = 0) {
  running = false;
  const overlay = document.createElement('div');
  overlay.className = 'message';
  overlay.innerHTML = `<div>${text.replace(/\n/g, '<br>')}</div>${buttonText ? `<button class="retry">${buttonText}</button>` : ''}`;
  game.appendChild(overlay);

  const finish = () => {
    if (overlay.parentElement) {
      game.removeChild(overlay);
    }
    onConfirm();
    lastTime = performance.now();
    window.requestAnimationFrame(loop);
  };

  if (buttonText) {
    const button = overlay.querySelector('button');
    button.focus();
    button.addEventListener('click', finish);
  } else {
    setTimeout(finish, delay);
  }
}

function showMessage(text, buttonText, onConfirm) {
  showDeathScreen(text, buttonText, onConfirm, 0);
}

function loop(time) {
  if (!running) return;
  const delta = Math.min((time - lastTime) / 1000, 0.032);
  lastTime = time;

  if (comboTimer > 0) {
    comboTimer -= delta;
    if (comboTimer <= 0) {
      comboCount = 0;
      comboTimer = 0;
    }
    updateComboUI();
  }

  updatePlayer(delta);
  updateMysteryBoxes();
  updateShooting(delta);
  updatePowerups(delta);
  updateProjectiles(delta);
  updateEnemyProjectiles(delta);
  updateEnemies(delta);
  updateCoins();
  updateEnemyCollisions();
  updateShopFlag();

  if (levelRestartPending) {
    levelRestartPending = false;
    resetLevel();
    return;
  }

  updateFlag();
  window.requestAnimationFrame(loop);
}

function startGame(resetAll = false) {
  if (resetAll) {
    score = 0;
    lives = 3;
    ammo = 0;
    sniperAmmo = 0;
    currentLevel = 0;
    gameSeed = Date.now();
  }
  updateHUD();
  running = true;
  buildLevel(currentLevel, useCustomLevel ? customLevelMap : null);
  lastTime = performance.now();
  hideMenu();
  try {
    bgMusic.currentTime = 0;
    bgMusic.play().catch(() => {
      /* Фоновая музыка будет включена при взаимодействии пользователя */
    });
  } catch (error) {
    console.warn('Audio start failed', error);
  }
  window.requestAnimationFrame(loop);
}

function beginGame() {
  if (!menu.classList.contains('visible')) return;
  startGame(true);
}

window.addEventListener('keydown', event => {
  if (menu.classList.contains('visible') && event.code === 'Enter') {
    beginGame();
    return;
  }

  if (event.code === 'ArrowLeft') controls.left = true;
  if (event.code === 'ArrowRight') controls.right = true;
  if (event.code === 'ArrowUp' || event.code === 'Space') controls.jump = true;
  if (event.code === 'KeyZ') controls.shoot = true;
});

window.addEventListener('keyup', event => {
  if (event.code === 'ArrowLeft') controls.left = false;
  if (event.code === 'ArrowRight') controls.right = false;
  if (event.code === 'ArrowUp' || event.code === 'Space') controls.jump = false;
  if (event.code === 'KeyZ') controls.shoot = false;
});

loadScoreboard();
renderScoreboard();
buildLevel(currentLevel);
loadCustomLevel();
updateHUD();
showMenu();
initCharacterSelect();
startButton.addEventListener('click', beginGame);
scoreboardButton.addEventListener('click', toggleScoreboard);
musicToggleButton.addEventListener('click', toggleMusic);
editorButton.addEventListener('click', enterEditorMode);
saveLevelButton.addEventListener('click', saveEditorLevel);
playCustomButton.addEventListener('click', () => {
  playCustomLevel();
});
clearLevelButton.addEventListener('click', clearEditorLevel);
backToMenuButton.addEventListener('click', () => {
  exitEditorMode();
});

if (buySniperButton) {
  buySniperButton.addEventListener('click', buySniperRifle);
}
if (closeShopButton) {
  closeShopButton.addEventListener('click', closeShop);
}

tileTypeButtons.forEach(button => {
  button.addEventListener('click', () => {
    selectedEditorTile = getEditorTileFromButton(button);
    tileTypeButtons.forEach(item => item.classList.toggle('active', item === button));
  });
});

game.addEventListener('click', event => {
  if (!editorMode) return;
  const rect = game.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  const col = Math.floor(localX / tileSize);
  const row = Math.floor(localY / tileSize);
  const tile = event.button === 2 ? '.' : selectedEditorTile;
  toggleEditorCell(col, row, tile);
});

game.addEventListener('contextmenu', event => {
  if (!editorMode) return;
  event.preventDefault();
});

game.addEventListener('mousemove', event => {
  if (!mousePlatform || !world) return;
  if (editorMode) {
    mousePlatform.active = false;
    mousePlatform.element.style.display = 'none';
    return;
  }
  const rect = game.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  if (localX < 0 || localX > rect.width || localY < 0 || localY > rect.height) {
    mousePlatform.active = false;
    mousePlatform.element.style.display = 'none';
    return;
  }
  const platformX = Math.max(0, Math.min(worldWidth - tileSize, cameraX + localX - tileSize / 2));
  const platformY = Math.max(0, Math.min(viewportHeight - tileSize, localY - tileSize / 2));
  mousePlatform.x = platformX;
  mousePlatform.y = platformY;
  mousePlatform.element.style.left = `${platformX}px`;
  mousePlatform.element.style.top = `${platformY}px`;
  mousePlatform.element.style.display = 'block';
  mousePlatform.active = true;
});
