const socket = io();

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("roomId");
const playerName = urlParams.get("name");
const type = urlParams.get("type"); // "create" หรือ "join"

let isHost = false;

// window.addEventListener('DOMContentLoaded', () => {
//     const canvas = document.querySelector('canvas')
//     const c = canvas.getContext('2d')

//     const devicePixelRatio = window.devicePixelRatio || 1

//     canvas.width = innerWidth * devicePixelRatio
//     canvas.height = innerHeight * devicePixelRatio

//     c.scale(devicePixelRatio, devicePixelRatio)
// })

const frontendPlayers = {}
const playerInputs = [] // เพิ่มตัวแปรนี้ ถ้าใช้ input prediction

// อัปเดทผู้เล่น
socket.on('updatePlayers', (backendPlayers) => {
  for (const playerName in backendPlayers) {
    const backendPlayer = backendPlayers[playerName]

    if (!frontendPlayers[playerName]) {
      playerName: backendPlayer.playerName

      document.querySelector('#player-list').innerHTML += `<div data-playerName="${playerName}">${playerName} : 0</div>`
    } else {

    }
  }

  for (const playerName in frontendPlayers) {
    if (!backendPlayers[playerName]) {
      const divToDelete = document.querySelector(`div[data-playerName="${playerName}"]`)
      if (divToDelete?.parentNode) {
        divToDelete.parentNode.removeChild(divToDelete)
      }
      delete frontendPlayers[playerName]
    }
  }
})

socket.on("forceDisconnect", (data) => {
  window.location.href = "/";
  alert(data.message || "ไม่พบข้อมูลผู้เล่น");
});

// ✅ สำหรับชื่อผู้เล่นในห้อง
socket.on('updatePlayerList', (players) => {
  const list = document.getElementById("player-list");
  list.innerHTML = "";

  players.forEach((p) => {
    if (p !== playerName) { //ไม่แสดงชื่อตัวเอง
        const li = document.createElement("li");
        li.textContent = p;
        list.appendChild(li);
    }
    });

  const startBtn = document.getElementById("start-btn");
  if (players.length >= 4 && isHost) {
    startBtn.style.display = "inline-block";
  } else {
    startBtn.style.display = "none";
  }
});

// แสดงข้อมูลห้องและชื่อผู้เล่น
document.getElementById("room-info").innerText = `รหัสห้อง: ${roomId}`;
document.getElementById("player-info").innerText = `ชื่อผู้เล่น: ${playerName}`;

// แจ้ง server ว่าจะสร้างหรือเข้าห้อง
if (type === "create") {
  socket.emit("createRoom", { roomId, playerName });
} else {
  socket.emit("joinRoom", { roomId, playerName });
}

// รับข้อมูลว่าผู้ใช้เป็น host หรือไม่
socket.on("hostInfo", (data) => {
  isHost = data.isHost;
});

// ปุ่มเริ่มเกม
document.getElementById("start-btn").addEventListener("click", () => {
  socket.emit("startGame", { roomId, playerName });
});

document.getElementById("leave-btn").addEventListener("click", () => {
  window.location.href = "/";
});

socket.on("gameStarted", () => {
  window.location.href = `../component/playsalem.html?roomId=${roomId}&name=${playerName}`;
});

// ถ้าเกิด error
socket.on("error", (msg) => {
  alert(msg);
  window.location.href = "/";
});
