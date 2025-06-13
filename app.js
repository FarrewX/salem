const express = require('express')
const app = express()

//socket.io setup
const http = require('http')
const server = http.createServer(app)
const { Server } = require("socket.io")
const io = new Server(server, { pingInterval:2000, pingTimeout: 5000, connectionStateRecovery: {}})

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
let skillDeck = [];

io.on('connection', (socket) => {
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
        console.log(`🕒 ไม่มีผู้เล่นในห้อง ${roomId} กำลังรอลบข้อมูลใน 5 วินาที`);
        
        roomCleanupTimers[roomId] = setTimeout(() => {
          console.log(`🧹 ลบห้อง ${roomId} และข้อมูลทั้งหมดแล้ว`);

          delete rooms[roomId];
          delete playerSockets[roomId];
          delete backendPlayers[roomId];
          delete rooms[roomId]?.playerHands;
          delete rooms[roomId]?.seatMap;
          delete rooms[roomId]?.skillDeck;
          delete rooms[roomId]?.roles;
          delete rooms[roomId]?.host;
          delete roomCleanupTimers[roomId];
        }, 5000);

      } else {
        io.to(roomId).emit('updatePlayers', rooms[roomId].players);
        io.to(roomId).emit('updatePlayerList', rooms[roomId].players);
      }
    }
  delete backendPlayers[socket.playerName];
  });
  
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

  //สร้าง กองskillcard ตอนเริ่มเกม
  function generateCardSkill(roomId){
    const salemCardData = [
      { name: "ที่หลบภัย", description: "ผู้เล่นที่มีที่หลบภัยอยู่จะไม่ถูกสังหารในช่วงรัตติกาล", canTargetSelf: false, count: 1 },
      { name: "แม่สื่อ", description: "เมื่อมีผู้เล่น 2 คนมีการ์ดแม่สื่อทั้งคู่หากคนใดคนหนึ่งตาย อีกคนจะต้องตายไปด้วยกัน", canTargetSelf: false, count: 2 },
      { name: "ข้อแก้ต่าง", description: "ลบล้าง(ทิ้ง) 1-3 ข้อกล่าวหาที่อยู่ด่านหน้าผู้เล่นอื่นหนึ่งคน", canTargetSelf: false, count: 3 },
      { name: "ขื่อคา", description: "ผู้เล่นที่มีขื่อคาอยู่จะต้องข้ามตาเล่นถัดไป", canTargetSelf: false, count: 3 },
      { name: "วางเพลิง", description: "ทิ้งการ์ดทั้งหมดบนมือผู้เล่นอื่น 1 คน", canTargetSelf: false, count: 1 },
      { name: "แพะรับบาป", description: "นำการ์ดสีน้ำเงิน เขียวและแดง ที่อยู่ด้านหน้าผู้เล่นอื่น 1 คนย้ายไปวางไว้ด้านหน้าผู้เล่นอีกคน", canTargetSelf: false, count: 2 },
      { name: "ข้อกล่าวหา", description: "", canTargetSelf: false, count: 35 },
      { name: "พลังศรัทธา", description: "ไม่มาสารถเล่นการ์ดสีแดงใส่ผู้เล่นที่มีพลังศรัทธาอยู่ได้", canTargetSelf: false, count: 1 },
      { name: "พยาน", description: "นับเป็น 7 ข้อกล่าวหา", canTargetSelf: false, count: 1 },
      { name: "หลักฐาน", description: "นับเป็น 3 ข้อกล่าวหา", canTargetSelf: false, count: 5 },
      { name: "คำสาป", description: "ทิ้งการ์ดสีน้ำเงินที่อยู่ด้านหน้าผู้เล่นอื่น 1 ใบ", canTargetSelf: false, count: 1 },
      { name: "ปล้น", description: "นำกา์ดทั้งหมดบนมือจากผู้เล่นอื่น 1 คนไปให้กับผู้เล่นอีกคน", canTargetSelf: false, count: 1 },
    ];

    let deck_skillcard = [];
    let id = 1;

    salemCardData.forEach(cardType => {
      for (let i = 0; i < cardType.count; i++) {
        deck_skillcard.push({
          id: id++,
          name: cardType.name,
          description: cardType.description,
          canTargetSelf: cardType.canTargetSelf
        });
      }
    });

    return deck_skillcard;
  }

  // จั่วการ์ด
  function drawCardFromDeck(roomId, playerName) {
    const room = rooms[roomId];
    if (!room || !room.skillDeck || room.skillDeck.length === 0) return null;

    const card = room.skillDeck.pop(); // ดึงใบสุดท้ายของ deck

    if (!room.playerHands[playerName]) {
      room.playerHands[playerName] = [];
    }

    room.playerHands[playerName].push(card);
    return card;
  }

  // จั่วการ์ด
  socket.on('drawCard', ({ roomId, playerName }) => {
    if (!roomId || !playerName) return;

    const drawnCard = drawCardFromDeck(roomId, playerName);

    if (!drawnCard) {
      socket.emit('error', 'กองการ์ดหมดแล้ว');
      return;
    }

    socket.emit("cardDrawn", drawnCard);
    socket.emit("updateHand", rooms[roomId].playerHands[playerName]);

    // แจ้งทุกคนว่ากองการ์ดยังเหลือกี่ใบ
    io.to(roomId).emit('deckCount', rooms[roomId].skillDeck.length);

    console.log(`Player ${playerName} drew a card: ${drawnCard.name} ${drawnCard.description}`);
    //=====================================
    // น่าจะทำกลางคืนต่อจากนี้
  });


  socket.on("startGame", ({ roomId , playerName }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (socket.playerName !== room.host) {
      socket.emit("error", "คุณไม่ใช่โฮสต์ ไม่สามารถเริ่มเกมได้");
      return;
    }

    const playerCount = room.players.length;
    const roles = dealCards(room.players); // แจกไพ่ชีวิต 5 ใบ
    skillDeck = shuffle(generateCardSkill(roomId));

    rooms[roomId].roles = roles;
    rooms[roomId].skillDeck = skillDeck;
    rooms[roomId].playerHands = {};
    rooms[roomId].playerCount = playerCount;
    rooms[roomId].seatMap = {};

    socket.roomId = roomId;
    socket.playerName = playerName;

    // Map ชื่อเป็นที่นั่ง
    const shuffledPlayers = shuffle(room.players);
    room.seatMap = {};
    shuffledPlayers.forEach((playerName, index) => {
      room.seatMap[playerName] = index;
    });

    console.log("seatMap:", room.seatMap);

    // ส่ง role และตำแหน่งที่นั่งให้ผู้เล่น
    room.players.forEach((playerName) => {
      const playerSocket = findSocketByName(roomId, playerName);
      if (playerSocket) {
        playerSocket.emit("yourRole", room.roles[playerName]);
        playerSocket.emit("seatMap",  room.seatMap[playerName]);
      }
    });

    io.to(roomId).emit("gameState", {
      message: "เริ่มเกมแล้ว!",
      players: room.players.map((playerName) => ({ 
        playerName: playerName,
        roles: room.roles[playerName],
        seatMap: room.seatMap[playerName],
        status: "ปกติ"
        })),
    });

    io.to(roomId).emit("gameStarted");
    io.to(roomId).emit("skillDeck", room.skillDeck);
    io.to(roomId).emit("deckCount", room.skillDeck.length);
    io.to(roomId).emit("forceDisconnect", { message: "ห้องนี้เริ่มเกมแล้ว" })

    console.log(`ส่งการ์ดไปห้อง ${roomId} = ${room.skillDeck} จำนวน ${room.skillDeck.length} ใบ`)
  });

  socket.on("reconnectToRoom", ({ roomId, playerName }) => {
    socket.playerName = playerName;
    socket.roomId = roomId;
    socket.join(roomId);
    
    // console.log(`${playerName} กลับเข้าห้อง ${roomId} อีกครั้ง`);

    // ยกเลิกการลบห้อง
    if (roomCleanupTimers[roomId]) {
      clearTimeout(roomCleanupTimers[roomId]);
      delete roomCleanupTimers[roomId];
      console.log(`🚫 ยกเลิกการลบห้อง ${roomId} เพราะมีผู้เล่นกลับเข้ามา`);
    }

     // กู้คืน socket ใหม่
    if (!playerSockets[roomId]) playerSockets[roomId] = {};
    playerSockets[roomId][playerName] = socket;

    // ✅ สร้าง room object ถ้าไม่มี
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        roles: {},
        host: null,
        skillDeck: {},
        playerHands: {},
        seatMap: {},
      };
    } else if (!rooms[roomId].roles && roles) {
      rooms[roomId].roles = roles; // โหลดเข้า memory ถ้ายังไม่มี
    }

    // ⛳️ โหลด role
    const roles = rooms[roomId]?.roles || {};
    console.log(`🔍 โหลด role ของ ${playerName} ในห้อง ${roomId}:`, roles[playerName]);

    // ✅ ใส่ player ลงใน room ถ้ายังไม่มี
    if (!rooms[roomId].players.includes(playerName)) {
      rooms[roomId].players.push(playerName);
    }
    
    // 🔄 ส่งตำแหน่งที่นั่งกลับไปให้ผู้เล่นที่ reconnect
    const seatIndex = rooms[roomId].seatMap?.[playerName];
    if (seatIndex !== undefined) {
      socket.emit("seatMap", seatIndex);
      // console.log(`♻️ ผู้เล่น ${playerName} ได้ที่นั่งเดิม: ${seatIndex}`);
    } else {
      console.warn(`⚠️ ยังไม่มี seatMap สำหรับ ${playerName} ในห้อง ${roomId}`);
    }

    // ส่งไพ่กลับให้ผู้เล่น
    if (rooms[roomId].roles && rooms[roomId].roles[playerName]) {
      socket.emit("yourRole", rooms[roomId].roles[playerName]);
    } else {
      console.warn(`⚠️ ไม่มีไพ่ของ ${playerName}`);

      const targetSocket = findSocketByName(roomId, playerName);
      if (targetSocket) {
        targetSocket.emit("forceDisconnect", { roomId, message: "ไม่พบชื่อผู้เล่น กรุณาเข้าผ่านลิงก์ที่ถูกต้อง" });
        targetSocket.disconnect(true);
      }
    }

    // ส่งข้อมูลปัจจุบันกลับให้ผู้เล่น
    const room = rooms[roomId];

    //โหลดและส่งการ์ดสกิลเข้าห้อง
    const savedSkillDeck = rooms[roomId].skillDeck;
    if (savedSkillDeck) {
      socket.emit("skillDeck", savedSkillDeck);
    }else {
      rooms[roomId].skillDeck = []; // fallback ป้องกัน error
      console.warn(`⚠️ ไม่พบ skillDeck ของห้อง ${roomId}`);
    }

    //โหลดและส่งการ์ดสกิลให้ผู้เล่น
    const handplayer = rooms[roomId].playerHands[playerName];
    if (handplayer && !rooms[roomId].playerHands[playerName]) {
      rooms[roomId].playerHands = handplayer;
    }
    if (rooms[roomId].playerHands?.[playerName]) {
      socket.emit("updateHand", rooms[roomId].playerHands[playerName]);
      console.log(rooms[roomId].playerHands[playerName])
    }
    
    io.to(roomId).emit('updatePlayers', room.players);
    io.to(roomId).emit("skillDeck", room.skillDeck);
    
    if (rooms[roomId].playerHands?.[playerName]) {
      socket.emit("updateHand", rooms[roomId].playerHands[playerName]);
    }
  });

  socket.on("playCard", ({ roomId, cardIndex, targetId }) => {
    const playerName = socket.playerName
    const room = rooms[roomId];

    const hand = rooms[roomId]?.playerHands?.[playerName] || [];
    const card = hand.splice(cardIndex, 1)[0];

    // ส่งข้อมูลการ์ดที่เล่นให้ทุกคน
    io.to(roomId).emit("cardPlayed", {
      from: socket.roomId,
      to: targetId,
      card,
    });
  });

  socket.on("requestHand", ({ roomId, playerName }) => {
    const hand = rooms[roomId]?.playerHands[playerName] || [];
    socket.emit("updateHand", hand);
  });

  // console.log(backendPlayers)
});

setInterval(() => {
  io.emit('updatePlayers', backendPlayers);
}, 500)