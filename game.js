// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDZPdAtqmvGSc0-CSr5CYH5cQcV7ez3qgg",
  authDomain: "summit-7-zork.firebaseapp.com",
  databaseURL: "https://summit-7-zork-default-rtdb.firebaseio.com",
  projectId: "summit-7-zork",
  storageBucket: "summit-7-zork.firebasestorage.app",
  messagingSenderId: "631600869041",
  appId: "1:631600869041:web:695fda880031d0a5c87c90",
  measurementId: "G-VLDLBLWK1P"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Game world definition (map grid)
const mapWidth = 10;
const mapHeight = 10;
const map = [
  [1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,2,0,0,0,0,1],
  [1,0,3,0,2,0,4,0,0,1],
  [1,0,0,0,2,0,0,0,0,1],
  [1,2,2,2,0,2,2,2,2,1],
  [1,0,0,0,2,0,0,0,0,1],
  [1,0,0,0,2,0,0,0,0,1],
  [1,0,0,0,2,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1]
];
// 0: empty, 1: outer wall, 2: Service Desk walls, 3: Engineering Lab, 4: Client Network

// Initial game state
const initialGameState = {
  antivirusUnlocked: false,
  malwareAnalyzed: false,
  patchApplied: false,
  firewallDeployed: false,
  trained: false
};

// Game state variables
let posX = 5.5, posY = 5.5; // Player position
let dirX = -1, dirY = 0;   // Direction vector
let planeX = 0, planeY = 0.66; // Camera plane (FOV)
let inventory = [];
let gameState = { ...initialGameState };

// Sprites for items and interactables
const sprites = [
  { x: 2.5, y: 2.5, type: 'note', img: new Image(), active: true },
  { x: 3.5, y: 3.5, type: 'computer', img: new Image(), requires: 'note', action: unlockComputer }
];

// Texture and sprite images
const textureNames = { 1: 'brick', 2: 'office', 3: 'lab', 4: 'server' };
const textures = {};
Object.keys(textureNames).forEach(id => {
  const img = new Image();
  img.src = `textures/${textureNames[id]}.png`; // Ensure textures are in a local folder
  textures[id] = img;
});

const spriteImages = {
  'note': 'sprites/note.png',
  'computer': 'sprites/computer.png',
  'antivirus': 'sprites/antivirus.png'
};
sprites.forEach(s => s.img.src = spriteImages[s.type]);

// Canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Output text to the screen
function output(text) {
  const outputDiv = document.getElementById("output");
  const p = document.createElement("p");
  p.textContent = text;
  outputDiv.appendChild(p);
  outputDiv.scrollTop = outputDiv.scrollHeight;
}

// Reset game to initial state
function resetGame(silent = false) {
  posX = 5.5; posY = 5.5;
  dirX = -1; dirY = 0;
  planeX = 0; planeY = 0.66;
  inventory = [];
  gameState = { ...initialGameState };
  sprites.forEach(s => s.active = true);
  if (!silent) {
    output("Game reset. Starting over.");
  }
}

// Render the 3D view
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let x = 0; x < canvas.width; x++) {
    let cameraX = 2 * x / canvas.width - 1;
    let rayDirX = dirX + planeX * cameraX;
    let rayDirY = dirY + planeY * cameraX;

    let mapX = Math.floor(posX), mapY = Math.floor(posY);
    let deltaDistX = Math.abs(1 / rayDirX), deltaDistY = Math.abs(1 / rayDirY);
    let sideDistX, sideDistY, stepX, stepY;

    if (rayDirX < 0) { stepX = -1; sideDistX = (posX - mapX) * deltaDistX; }
    else { stepX = 1; sideDistX = (mapX + 1 - posX) * deltaDistX; }
    if (rayDirY < 0) { stepY = -1; sideDistY = (posY - mapY) * deltaDistY; }
    else { stepY = 1; sideDistY = (mapY + 1 - posY) * deltaDistY; }

    let hit = 0, side;
    while (!hit) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX; mapX += stepX; side = 0;
      } else {
        sideDistY += deltaDistY; mapY += stepY; side = 1;
      }
      if (map[mapY][mapX] > 0) hit = 1;
    }

    let perpWallDist = side == 0 ? (mapX - posX + (1 - stepX) / 2) / rayDirX : (mapY - posY + (1 - stepY) / 2) / rayDirY;
    let lineHeight = Math.floor(canvas.height / perpWallDist);
    let drawStart = Math.max(0, -lineHeight / 2 + canvas.height / 2);
    let drawEnd = Math.min(canvas.height, lineHeight / 2 + canvas.height / 2);

    // Texture mapping
    let wallX = side == 0 ? posY + perpWallDist * rayDirY : posX + perpWallDist * rayDirX;
    wallX -= Math.floor(wallX);
    let texX = Math.floor(wallX * textures[map[mapY][mapX]].width);
    if (side == 0 && rayDirX > 0) texX = textures[map[mapY][mapX]].width - texX - 1;
    if (side == 1 && rayDirY < 0) texX = textures[map[mapY][mapX]].width - texX - 1;

    ctx.drawImage(textures[map[mapY][mapX]], texX, 0, 1, textures[map[mapY][mapX]].height, x, drawStart, 1, drawEnd - drawStart);
  }
}

// Render sprites
function renderSprites() {
  sprites.forEach(sprite => {
    if (!sprite.active) return;
    let spriteX = sprite.x - posX, spriteY = sprite.y - posY;
    let inv = dirX * spriteY - dirY * spriteX;
    let transformY = (dirY * spriteX + dirX * spriteY) / inv;
    if (transformY <= 0) return;

    let spriteScreenX = Math.floor((canvas.width / 2) * (1 + spriteX / transformY));
    let spriteHeight = Math.abs(Math.floor(canvas.height / transformY));
    ctx.drawImage(sprite.img, spriteScreenX - spriteHeight / 2, canvas.height / 2 - spriteHeight / 2, spriteHeight, spriteHeight);
  });
}

// Player movement
let moveForward = false, moveBackward = false, turnLeft = false, turnRight = false;

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowUp') moveForward = true;
  if (e.key === 'ArrowDown') moveBackward = true;
  if (e.key === 'ArrowLeft') turnLeft = true;
  if (e.key === 'ArrowRight') turnRight = true;
  if (e.key === 'e') interact();
});

document.addEventListener('keyup', e => {
  if (e.key === 'ArrowUp') moveForward = false;
  if (e.key === 'ArrowDown') moveBackward = false;
  if (e.key === 'ArrowLeft') turnLeft = false;
  if (e.key === 'ArrowRight') turnRight = false;
});

function updatePlayer() {
  const moveSpeed = 0.1, rotSpeed = 0.05;
  if (moveForward) {
    let newX = posX + dirX * moveSpeed, newY = posY + dirY * moveSpeed;
    if (map[Math.floor(newY)][Math.floor(newX)] == 0) { posX = newX; posY = newY; }
  }
  if (moveBackward) {
    let newX = posX - dirX * moveSpeed, newY = posY - dirY * moveSpeed;
    if (map[Math.floor(newY)][Math.floor(newX)] == 0) { posX = newX; posY = newY; }
  }
  if (turnLeft) {
    let oldDirX = dirX;
    dirX = dirX * Math.cos(rotSpeed) - dirY * Math.sin(rotSpeed);
    dirY = oldDirX * Math.sin(rotSpeed) + dirY * Math.cos(rotSpeed);
    let oldPlaneX = planeX;
    planeX = planeX * Math.cos(rotSpeed) - planeY * Math.sin(rotSpeed);
    planeY = oldPlaneX * Math.sin(rotSpeed) + planeY * Math.cos(rotSpeed);
  }
  if (turnRight) {
    let oldDirX = dirX;
    dirX = dirX * Math.cos(-rotSpeed) - dirY * Math.sin(-rotSpeed);
    dirY = oldDirX * Math.sin(-rotSpeed) + dirY * Math.cos(-rotSpeed);
    let oldPlaneX = planeX;
    planeX = planeX * Math.cos(-rotSpeed) - planeY * Math.sin(-rotSpeed);
    planeY = oldPlaneX * Math.sin(-rotSpeed) + planeY * Math.cos(-rotSpeed);
  }
}

// Interact with sprites
function interact() {
  sprites.forEach(sprite => {
    if (!sprite.active) return;
    let dist = Math.sqrt((posX - sprite.x) ** 2 + (posY - sprite.y) ** 2);
    if (dist < 0.5) {
      if (sprite.type in spriteImages) {
        inventory.push(sprite.type);
        sprite.active = false;
        output(`You take the ${sprite.type}.`);
        updateInventory();
      } else if (sprite.requires && inventory.includes(sprite.requires)) {
        sprite.action();
        sprite.active = false;
      }
    }
  });
}

// Example action for computer
function unlockComputer() {
  gameState.antivirusUnlocked = true;
  inventory.push('antivirus');
  output('You unlock the computer with the note.');
  updateInventory();
}

// Update inventory UI
function updateInventory() {
  const invDiv = document.getElementById('inventory');
  invDiv.innerHTML = 'Inventory: ';
  inventory.forEach(item => {
    const img = document.createElement('img');
    img.src = spriteImages[item] || 'sprites/default.png';
    img.style.width = '32px';
    invDiv.appendChild(img);
  });
}

// Menu functionality
document.getElementById('menuButton').addEventListener('click', () => {
  const menu = document.getElementById('menu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('newGame').addEventListener('click', () => resetGame(false));
document.getElementById('saveGame').addEventListener('click', saveGame);
document.getElementById('loadGame').addEventListener('click', () => loadGame(auth.currentUser.uid));
document.getElementById('logout').addEventListener('click', logout);
document.getElementById('exit').addEventListener('click', () => window.close());

// Firebase Authentication Functions
function signUp(email, password) {
  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      output("Account created successfully!");
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("gameScreen").style.display = "block";
      loadGame(userCredential.user.uid);
    })
    .catch((error) => {
      output("Error: " + error.message);
    });
}

function logIn(email, password) {
  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      output("Logged in successfully!");
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("gameScreen").style.display = "block";
      loadGame(userCredential.user.uid);
    })
    .catch((error) => {
      output("Error: " + error.message);
    });
}

// Google Login Function
function logInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then((result) => {
      output("Logged in with Google successfully!");
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("gameScreen").style.display = "block";
      loadGame(result.user.uid);
    })
    .catch((error) => {
      output("Error: " + error.message);
    });
}

// Logout Function
function logout() {
  auth.signOut()
    .then(() => {
      resetGame(true);
      document.getElementById('output').innerHTML = '';
      document.getElementById('gameScreen').style.display = 'none';
      document.getElementById('loginScreen').style.display = 'block';
      document.getElementById('authMessage').textContent = "You have been logged out.";
    })
    .catch((error) => {
      output("Error logging out: " + error.message);
    });
}

// Cloud Save and Load
function saveGame() {
  const user = auth.currentUser;
  if (user) {
    const saveData = {
      posX, posY, dirX, dirY, planeX, planeY, inventory, gameState,
      sprites: sprites.map(s => ({ ...s, img: null }))
    };
    database.ref('users/' + user.uid + '/save').set(saveData)
      .then(() => {
        output("Game saved successfully!");
      })
      .catch((error) => {
        output("Error saving game: " + error.message);
      });
  } else {
    output("You need to be logged in to save the game.");
  }
}

function loadGame(uid) {
  database.ref('users/' + uid + '/save').once('value')
    .then((snapshot) => {
      const data = snapshot.val();
      if (data) {
        posX = data.posX; posY = data.posY;
        dirX = data.dirX; dirY = data.dirY;
        planeX = data.planeX; planeY = data.planeY;
        inventory = data.inventory || [];
        gameState = data.gameState || {};
        if (data.sprites) {
          data.sprites.forEach((savedSprite, i) => {
            sprites[i].active = savedSprite.active;
          });
        }
        updateInventory();
        output("Game loaded successfully!");
      } else {
        output("No saved game found. Starting a new game.");
        resetGame(false);
      }
    })
    .catch((error) => {
      output("Error loading game: " + error.message);
    });
}

// Game loop
function gameLoop() {
  updatePlayer();
  render();
  renderSprites();
  requestAnimationFrame(gameLoop);
}
gameLoop();

// Authentication state listener
auth.onAuthStateChanged((user) => {
  if (user) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    loadGame(user.uid);
  } else {
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('authMessage').textContent = "Please log in to play.";
  }
});

// Event listeners for authentication buttons
document.getElementById('signUpButton').addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  signUp(email, password);
});

document.getElementById('logInButton').addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  logIn(email, password);
});

document.getElementById('googleLogInButton').addEventListener('click', logInWithGoogle);

// Handle command input (for text-based interactions if needed)
const input = document.getElementById("commandInput");
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const inputText = input.value;
    input.value = "";
    output("> " + inputText);
    // Add command parsing here if desired
  }
});