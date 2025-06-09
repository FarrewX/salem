const express = require('express')
const app = express()

//socket.io setup
const http = require('http')
const server = http.createServer(app)
const { Server } = require("socket.io")
const io = new Server(server, { pingInterval:2000, pingTimeout: 5000})

const fs = require('fs');
const path = require('path');

const port = 3000

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

app.get('/room.html', (req, res) => {
  res.sendFile(path.join(__dirname, './component/room.html'));
});

server.listen(port, () => {
  console.log(`app listening on port ${port}`)
})

console.log('server did loaded')

const rooms = {};
const backendPlayers = {};
const playerSockets = {}; // ใช้ map ชื่อผู้เล่น -> socket
const roomCleanupTimers = {}; // roomId -> timeout ID
const playerCount = 0;

io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('createRoom', ({ roomId, playerName }) => {
    if (rooms[roomId]) {
      socket.emit('error', 'ห้องนี้มีอยู่แล้ว');
      return;
    }

    if (!playerSockets[roomId]) playerSockets[roomId] = {};
    playerSockets[roomId][playerName] = socket;


    rooms[roomId] = {
      players: [playerName],
      host: playerName
    };

    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerName = playerName;

    socket.emit('hostInfo', { isHost: true });
    io.to(roomId).emit('updatePlayers', rooms[roomId].players);
    io.to(roomId).emit('updatePlayerList', rooms[roomId].players);
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (!rooms[roomId]) {
      socket.emit('error', 'ไม่พบห้อง');
      return;
    }

    if (rooms[roomId].players.includes(playerName)) {
      socket.emit('error', 'มีผู้เล่นใช้ชื่อนี้อยู่แล้วในห้อง');
      return;
    }

    rooms[roomId].players.push(playerName);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerName = playerName;

    if (!playerSockets[roomId]) playerSockets[roomId] = {};
    playerSockets[roomId][playerName] = socket;


    const isHost = (rooms[roomId].host === playerName);
    socket.emit('hostInfo', { isHost });
    io.to(roomId).emit('updatePlayers', rooms[roomId].players);
    io.to(roomId).emit('updatePlayerList', rooms[roomId].players);
  });

  socket.on('disconnect', (reason) => {
    console.log(reason)
    const roomId = socket.roomId;
    const playerName = socket.playerName;

    if (roomId && rooms[roomId]) {
      // ลบ player ออกจากห้อง
      rooms[roomId].players = rooms[roomId].players.filter(p => p !== playerName);
      delete playerSockets[roomId]?.[playerName];

      if (rooms[roomId].players.length === 0) {
        console.log(`🕒 ไม่มีผู้เล่นในห้อง ${roomId} กำลังรอลบข้อมูลใน 2 นาที`);
        
        roomCleanupTimers[roomId] = setTimeout(() => {
          console.log(`🧹 ลบห้อง ${roomId} และข้อมูลทั้งหมดแล้ว`);

          delete rooms[roomId];
          delete playerSockets[roomId];
          delete backendPlayers[roomId];
          delete roomCleanupTimers[roomId];

          const filePath = path.join(__dirname, 'data', `${roomId}_roles.json`);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ ลบไฟล์บทบาทของห้อง ${roomId} แล้ว`);
          }
        }, 2 * 60 * 1000);

      } else {
        io.to(roomId).emit('updatePlayers', rooms[roomId].players);
        io.to(roomId).emit('updatePlayerList', rooms[roomId].players);
      }

    }

  delete backendPlayers[socket.playerName];
  });

  // function generateDeck() {
  //   const deck = [];
  //   deck.push("แม่มด");
  //   deck.push("สายตรวจ");
  //   for (let i = 0; i < 18; i++) {
  //     deck.push("ชาวบ้าน");
  //   }
  //   return deck;
  // }
  
  function generateDeck(playerCount) {
    const totalCards = playerCount * 5;

    // กำหนดจำนวนแม่มดกับสายตรวจตามจำนวนผู้เล่น
    let numWitch = 1;

    if (playerCount <= 5) numWitch = 1;
    if (playerCount >= 6) numWitch = 2;

    const cardsToRemove = numWitch + 1;
    const finalCardCount = totalCards - cardsToRemove;

    const deck = [];

    // เพิ่มไพ่แม่มด
    for (let i = 0; i < numWitch; i++) {
      deck.push("แม่มด");
    }

    // เพิ่มไพ่สายตรวจ
    for (let i = 0; i < 1; i++) {
      deck.push("สายตรวจ");
    }

    // เพิ่มไพ่ชาวบ้านให้ครบตามจำนวนที่เหลือ
    for (let i = 0; i < finalCardCount; i++) {
      deck.push("ชาวบ้าน");
    }

    return deck;
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function dealCards(players) {
    let deck = shuffle(generateDeck(players.length));
    const roles = {};
    players.forEach((playerName) => {
      roles[playerName] = [];
      for (let i = 0; i < 5; i++) {
        roles[playerName].push(deck.pop());
      }
    });
    return roles; // { "player1": ["ชาวบ้าน", "แม่มด", ...], "player2": [...] }
  }

  function findSocketByName(roomId, playerName) {
    return playerSockets[roomId]?.[playerName];
  }

  function saveRolesToFile(roomId, roles) {
    const dir = path.join(__dirname, 'data');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir); // สร้างโฟลเดอร์ถ้ายังไม่มี
    }

    const filePath = path.join(dir, `${roomId}_roles.json`);
    const data = {
      timestamp: new Date().toISOString(),
      roles
    };
    fs.writeFileSync(filePath, JSON.stringify({ roles }, null, 2), 'utf8');
  }

  function loadRolesFromFile(roomId) {
    const filePath = path.join(__dirname, 'data', `${roomId}_roles.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      try {
        const parsed = JSON.parse(data);
        if (parsed.roles) return parsed.roles;
        return parsed; // fallback
      } catch (err) {
        console.error("Error parsing JSON file:", err);
        return null;
      }
    }
    return null;
  }

  socket.on("startGame", ({ roomId , playerName }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (socket.playerName !== room.host) {
      socket.emit("error", "คุณไม่ใช่โฮสต์ ไม่สามารถเริ่มเกมได้");
      return;
    }

    class SkillCard {
  constructor(id, name, description, canTargetSelf = false) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.canTargetSelf = canTargetSelf;
  }
}

const deck_skillcard = [];

const salemCardData = [
  { name: "Investigate", description: "ดูไพ่ Tryal ของผู้เล่น 1 คน", canTargetSelf: false, count: 6 },
  { name: "Kill", description: "ฆ่า Tryal ใบหนึ่งของผู้เล่น 1 คน", canTargetSelf: false, count: 3 },
  { name: "Stocks", description: "ทำให้ผู้เล่นไม่สามารถเล่นไพ่ในเทิร์นถัดไป", canTargetSelf: false, count: 5 },
  { name: "Alibi", description: "ป้องกันการถูก Investigate หรือ Kill", canTargetSelf: true, count: 4 },
  { name: "Self Defense", description: "ป้องกัน Kill ใส่ตัวเอง", canTargetSelf: true, count: 2 },
  { name: "Conspiracy", description: "สั่ง Kill โดยไม่เปิดเผย", canTargetSelf: false, count: 3 },
  { name: "Blackmail", description: "ผู้เล่นที่ถูกเลือกห้ามพูด", canTargetSelf: false, count: 4 },
  { name: "Scapegoat", description: "โอนผลของ Kill ไปยังผู้เล่นอื่นแบบสุ่ม", canTargetSelf: true, count: 2 },
  { name: "Pardon", description: "ลบสถานะ Stocks หรือ Blackmail", canTargetSelf: true, count: 2 },
  { name: "Matchmaker", description: "เชื่อมผู้เล่น 2 คน ให้ชะตาเหมือนกัน", canTargetSelf: false, count: 1 }
];

// เพิ่มเข้า deck
let id = 1;
salemCardData.forEach(cardType => {
  for (let i = 0; i < cardType.count; i++) {
    deck_skillcard.push(
      new SkillCard(
        id++,
        cardType.name,
        cardType.description,
        cardType.canTargetSelf
      )
    );
  }
});

console.log(deck_skillcard); // ✅ ได้ครบ ~59 ใบ


    const playerCount = room.players.length;
    const roles = dealCards(room.players); // แจกไพ่ชีวิต 5 ใบ
    rooms[roomId].roles = roles;

    // 🔥 บันทึกลงไฟล์
    saveRolesToFile(roomId, roles);

    room.players.forEach((playerName) => {
      const playerSocket = findSocketByName(roomId, playerName);
      if (playerSocket) {
        playerSocket.emit("yourRole", roles[playerName]);
      }
    });

    console.log(`[${new Date().toLocaleString()}] แจกไพ่ให้ห้อง ${roomId}:`, roles);

    io.to(roomId).emit("gameState", {
      message: "เริ่มเกมแล้ว! แจกไพ่บทบาทเรียบร้อย",
      players: room.players.map((playerName) => ({ playerName, status: "ปกติ" })),
    });

    io.to(roomId).emit("gameStarted");
  });

  socket.on("reconnectToRoom", ({ roomId, playerName }) => {
    socket.playerName = playerName;
    socket.roomId = roomId;

    socket.join(roomId);
    console.log(`${playerName} กลับเข้าห้อง ${roomId} อีกครั้ง`);

    // ยกเลิกการลบห้อง
    if (roomCleanupTimers[roomId]) {
      clearTimeout(roomCleanupTimers[roomId]);
      delete roomCleanupTimers[roomId];
      console.log(`🚫 ยกเลิกการลบห้อง ${roomId} เพราะมีผู้เล่นกลับเข้ามา`);
    }

    // ⛳️ โหลด roles จากไฟล์
    const roles = loadRolesFromFile(roomId);

    // ✅ สร้าง room object ถ้าไม่มี
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        roles: roles || {},
        host: null,
      };
    } else if (!rooms[roomId].roles && roles) {
      rooms[roomId].roles = roles; // โหลดเข้า memory ถ้ายังไม่มี
    }

    // ✅ ใส่ player ลงใน room ถ้ายังไม่มี
    if (!rooms[roomId].players.includes(playerName)) {
      rooms[roomId].players.push(playerName);
    }

    // ส่งไพ่กลับให้ผู้เล่น
    if (rooms[roomId].roles && rooms[roomId].roles[playerName]) {
      socket.emit("yourRole", rooms[roomId].roles[playerName]);
    } else {
      console.warn(`⚠️ ไม่มีไพ่ของ ${playerName}`);
    }
    console.log(`ส่งไพ่ไปห้อง ${roomId}`,roles);

    // ส่งสถานะเกมกลับให้ผู้เล่น
    const players = rooms[roomId].players;
    io.to(socket.id).emit("gameState", {
      players: players.map((playerName) => ({ playerName, status: "ปกติ" })),
    });
    
    io.to(roomId).emit('updatePlayers', rooms[roomId].players);
  });

  // socket.on("endGame", ({ roomId }) => {
  //   if (!rooms[roomId]) return;

  //   console.log(`🎯 เกมในห้อง ${roomId} จบแล้ว กำลังลบข้อมูลทั้งหมด`);

  //   delete rooms[roomId];
  //   delete playerSockets[roomId];
  //   delete backendPlayers[roomId];

  //   const filePath = path.join(__dirname, 'data', `${roomId}_roles.json`);
  //   if (fs.existsSync(filePath)) {
  //     fs.unlinkSync(filePath);
  //     console.log(`🗑️ ลบไฟล์บทบาทของห้อง ${roomId} แล้ว`);
  //   }

  //   io.to(roomId).emit("gameEnded", { message: "เกมจบแล้ว ขอบคุณที่เล่น!" });
  // });

  console.log(backendPlayers)
});

setInterval(() => {
  io.emit('updatePlayers', backendPlayers);
}, 150)