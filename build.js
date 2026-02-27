const fs = require('fs');
const path = require('path');

// Read sprites
const spritesPath = path.join(__dirname, 'assets/final/sprites.json');
const sprites = JSON.parse(fs.readFileSync(spritesPath, 'utf8'));

// Build HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AMPLECT OFFICE</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            font-family: 'Courier New', monospace;
            color: #fff;
        }
        h1 {
            text-align: center;
            color: #00ff00;
            text-shadow: 0 0 10px #00ff00;
            margin-bottom: 10px;
        }
        #gameCanvas {
            display: block;
            margin: 0 auto;
            background: #2a2a2a;
            border: 2px solid #00ff00;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
        }
        #tooltip {
            position: absolute;
            background: rgba(0,0,0,0.8);
            color: #fff;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
            pointer-events: none;
            display: none;
            border: 1px solid #00ff00;
        }
        .legend {
            margin-top: 10px;
            text-align: center;
            font-size: 12px;
        }
        .legend span {
            margin: 0 10px;
        }
        .active { color: #00ff00; }
        .idle { color: #888; }
        .credits {
            text-align: center;
            margin-top: 10px;
            font-size: 10px;
            color: #888;
        }
    </style>
</head>
<body>
    <h1>AMPLECT OFFICE</h1>
    <canvas id="gameCanvas" width="1920" height="1280"></canvas>
    <div id="tooltip"></div>
    <div class="legend">
        <span class="active">● Active (at desk)</span>
        <span class="idle">● Idle (wandering)</span>
    </div>
    <div class="credits">Character sprites: LPC Character Generator (CC-BY-SA 3.0/GPL 3.0)</div>
    
    <script>
const SPRITES = ${JSON.stringify(sprites)};

const spriteImages = {};
const spritePromises = Object.entries(SPRITES).map(([name, base64]) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            spriteImages[name] = img;
            resolve();
        };
        img.src = 'data:image/png;base64,' + base64;
    });
});

Promise.all(spritePromises).then(() => {
    console.log('All sprites loaded!');
    initGame();
});

const TILE_SIZE = 32;
const SCALE = 2;
const SCALED_TILE = TILE_SIZE * SCALE;
const MAP_WIDTH = 30;
const MAP_HEIGHT = 20;
const SPRITE_SIZE = 64;
const SPRITE_SCALE = 2;
const SCALED_SPRITE = SPRITE_SIZE * SPRITE_SCALE;

const DIRECTIONS = { UP: 0, LEFT: 1, DOWN: 2, RIGHT: 3 };
const FRAMES_PER_ROW = 9;

const COLORS = {
    wall: '#333',
    wallBorder: '#555',
    marketing: '#D4B896',
    directors: '#B8860B',
    developers: '#6B7B8D',
    corridor: '#C0C0C0',
    empty: '#AAA',
    desk: '#8B4513',
    monitor: '#000'
};

const CHARACTERS = {
    molchan: { x: 16, y: 4, dir: DIRECTIONS.DOWN, role: 'Director' },
    krasner: { x: 18, y: 3, dir: DIRECTIONS.LEFT, role: 'Director' },
    artemius: { x: 2, y: 14, dir: DIRECTIONS.DOWN, role: 'Developer' },
    pavel: { x: 5, y: 14, dir: DIRECTIONS.DOWN, role: 'Developer' },
    xamel1ion: { x: 8, y: 14, dir: DIRECTIONS.DOWN, role: 'Developer' },
    slava: { x: 2, y: 17, dir: DIRECTIONS.DOWN, role: 'Developer' },
    dmitriy: { x: 5, y: 17, dir: DIRECTIONS.DOWN, role: 'Developer' },
    egor: { x: 8, y: 17, dir: DIRECTIONS.DOWN, role: 'Developer' },
    anton: { x: 2, y: 3, dir: DIRECTIONS.DOWN, role: 'Marketing' }
};

let canvas, ctx, offscreenCanvas, offscreenCtx;
let characters = {};
let lastTime = 0;

function initGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = MAP_WIDTH * SCALED_TILE;
    offscreenCanvas.height = MAP_HEIGHT * SCALED_TILE;
    offscreenCtx = offscreenCanvas.getContext('2d');
    
    renderStaticElements();
    
    for (const [name, data] of Object.entries(CHARACTERS)) {
        characters[name] = {
            ...data,
            deskX: data.x,
            deskY: data.y,
            targetX: data.x,
            targetY: data.y,
            active: true,
            frame: 0,
            animTimer: 0,
            lastStateChange: Date.now()
        };
    }
    
    requestAnimationFrame(gameLoop);
    canvas.addEventListener('mousemove', handleMouseMove);
}

function renderStaticElements() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            let color;
            if (x < 10 && y < 6) color = COLORS.marketing;
            else if (x >= 10 && x < 20 && y < 6) color = COLORS.directors;
            else if (x >= 20 && y < 6) color = COLORS.empty;
            else if (x >= 10 && y >= 6 && y < 9) color = COLORS.corridor;
            else if (y >= 9) color = COLORS.developers;
            else color = COLORS.corridor;
            
            offscreenCtx.fillStyle = color;
            offscreenCtx.fillRect(x * SCALED_TILE, y * SCALED_TILE, SCALED_TILE, SCALED_TILE);
        }
    }
    
    offscreenCtx.strokeStyle = COLORS.wallBorder;
    offscreenCtx.lineWidth = 2;
    offscreenCtx.strokeRect(0, 0, MAP_WIDTH * SCALED_TILE, MAP_HEIGHT * SCALED_TILE);
    
    offscreenCtx.beginPath();
    offscreenCtx.moveTo(10 * SCALED_TILE, 0);
    offscreenCtx.lineTo(10 * SCALED_TILE, 9 * SCALED_TILE);
    offscreenCtx.moveTo(20 * SCALED_TILE, 0);
    offscreenCtx.lineTo(20 * SCALED_TILE, 6 * SCALED_TILE);
    offscreenCtx.stroke();
    
    offscreenCtx.beginPath();
    offscreenCtx.moveTo(0, 6 * SCALED_TILE);
    offscreenCtx.lineTo(10 * SCALED_TILE, 6 * SCALED_TILE);
    offscreenCtx.moveTo(10 * SCALED_TILE, 9 * SCALED_TILE);
    offscreenCtx.lineTo(MAP_WIDTH * SCALED_TILE, 9 * SCALED_TILE);
    offscreenCtx.stroke();
    
    const desks = [
        {x: 2, y: 3}, {x: 5, y: 3}, {x: 7, y: 3}, {x: 2, y: 5},
        {x: 16, y: 4}, {x: 18, y: 3},
        {x: 22, y: 3}, {x: 24, y: 3},
        {x: 2, y: 14}, {x: 5, y: 14}, {x: 8, y: 14},
        {x: 2, y: 17}, {x: 5, y: 17}, {x: 8, y: 17}
    ];
    
    offscreenCtx.fillStyle = COLORS.desk;
    for (const desk of desks) {
        offscreenCtx.fillRect(
            desk.x * SCALED_TILE + 4,
            desk.y * SCALED_TILE + 4,
            SCALED_TILE - 8,
            SCALED_TILE - 8
        );
    }
    
    offscreenCtx.fillStyle = '#ff0000';
    offscreenCtx.beginPath();
    offscreenCtx.arc(25 * SCALED_TILE, 7.5 * SCALED_TILE, 20, 0, Math.PI * 2);
    offscreenCtx.fill();
}

function gameLoop(time) {
    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;
    
    updateCharacters(deltaTime);
    render();
    
    requestAnimationFrame(gameLoop);
}

function updateCharacters(dt) {
    const now = Date.now();
    
    for (const [name, char] of Object.entries(characters)) {
        if (now - char.lastStateChange > (30000 + Math.random() * 30000)) {
            char.active = !char.active;
            if (!char.active) {
                char.targetX = 12 + Math.floor(Math.random() * 8);
                char.targetY = 7 + Math.floor(Math.random() * 2);
            } else {
                char.targetX = char.deskX;
                char.targetY = char.deskY;
            }
            char.lastStateChange = now;
        }
        
        if (char.x !== char.targetX || char.y !== char.targetY) {
            const speed = dt;
            
            if (char.x < char.targetX) {
                char.x = Math.min(char.x + speed, char.targetX);
                char.dir = DIRECTIONS.RIGHT;
            } else if (char.x > char.targetX) {
                char.x = Math.max(char.x - speed, char.targetX);
                char.dir = DIRECTIONS.LEFT;
            } else if (char.y < char.targetY) {
                char.y = Math.min(char.y + speed, char.targetY);
                char.dir = DIRECTIONS.DOWN;
            } else if (char.y > char.targetY) {
                char.y = Math.max(char.y - speed, char.targetY);
                char.dir = DIRECTIONS.UP;
            }
            
            char.animTimer += dt;
            if (char.animTimer > 0.125) {
                char.frame = (char.frame % 8) + 1;
                char.animTimer = 0;
            }
        } else {
            char.frame = 0;
        }
    }
}

function render() {
    ctx.drawImage(offscreenCanvas, 0, 0);
    
    for (const [name, char] of Object.entries(characters)) {
        if (!spriteImages[name]) continue;
        
        const sx = char.frame * SPRITE_SIZE;
        const sy = char.dir * SPRITE_SIZE;
        const dx = char.x * SCALED_TILE;
        const dy = char.y * SCALED_TILE;
        
        ctx.drawImage(
            spriteImages[name],
            sx, sy, SPRITE_SIZE, SPRITE_SIZE,
            dx, dy, SCALED_SPRITE, SCALED_SPRITE
        );
        
        ctx.fillStyle = char.active ? '#00ff00' : '#888';
        ctx.beginPath();
        ctx.arc(dx + SCALED_SPRITE / 2, dy + 10, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(name, dx + SCALED_SPRITE / 2, dy + SCALED_SPRITE + 15);
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const tooltip = document.getElementById('tooltip');
    let found = false;
    
    for (const [name, char] of Object.entries(characters)) {
        const dx = char.x * SCALED_TILE;
        const dy = char.y * SCALED_TILE;
        
        if (mouseX >= dx && mouseX < dx + SCALED_SPRITE &&
            mouseY >= dy && mouseY < dy + SCALED_SPRITE) {
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 10) + 'px';
            tooltip.style.top = (e.clientY + 10) + 'px';
            tooltip.innerHTML = \`<strong>\${name}</strong><br/>Role: \${char.role}<br/>Status: \${char.active ? 'Active' : 'Idle'}\`;
            found = true;
            break;
        }
    }
    
    if (!found) {
        tooltip.style.display = 'none';
    }
}
    </script>
</body>
</html>`;

fs.writeFileSync('index.html', html);
console.log('✅ index.html created successfully!');
console.log('File size:', Math.round(html.length / 1024), 'KB');
