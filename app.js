const express = require('express')
const app = express()

//socket.io setup
const http = require('http')
const server = http.createServer(app)
const { Server } = require("socket.io")
const io = new Server(server, { pingInterval:2000, pingTimeout: 5000})

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
const backendPlayers = {}

io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('createRoom', ({ roomId, playerName }) => {
    if (rooms[roomId]) {
      socket.emit('error', 'ห้องนี้มีอยู่แล้ว');
      return;
    }

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
      rooms[roomId].players = rooms[roomId].players.filter(p => p !== playerName);

      if (rooms[roomId].players.length === 0) {
        delete rooms[roomId];
      } else {
        io.to(roomId).emit('updatePlayers', rooms[roomId].players);
        io.to(roomId).emit('updatePlayerList', rooms[roomId].players);
      }
    }
    delete backendPlayers[socket.playerName]
  });
    setInterval(() => {
    io.emit('updatePlayers', backendPlayers)
  }, 150)

  console.log(backendPlayers)
});
