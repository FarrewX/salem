const socket = io();

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("roomId");
const playerName = urlParams.get("name");

document.getElementById("player-info").innerText = `ชื่อผู้เล่น: ${playerName}`;

let myRoles = [];

socket.on("connect", () => {
  // ถ้ามีข้อมูลห้องเก่า ส่งไปให้ server ฟื้นสถานะ
  if (roomId && playerName) {
    socket.emit("reconnectToRoom", { roomId, playerName });
  }
});

socket.on("forceDisconnect", (data) => {
  window.location.href = "/";
  alert(data.message || "ไม่พบข้อมูลผู้เล่น");
});

// รับ role ที่ server ส่งกลับมา
socket.on("yourRole", (roles) => {
  myRoles = roles;
  renderPlayerCards(); // render เฉพาะเมื่อรู้ role ตัวเอง
});

// รับสถานะเกม
socket.on("gameState", (data) => {
  console.log("ข้อมูลผู้เล่นทั้งหมด:", data.players);
  renderPlayerCards(data.players); // render ทั้งหมดเมื่อมีข้อมูลเกม
});

socket.on("updatePlayers", (playerNames) => {
  const playerList = playerNames.map(name => ({ playerName: name }));
  renderPlayerCards(playerList);
});

function renderPlayerCards(playerList = []) {
  const container = document.getElementById("players-container");
  container.innerHTML = ""; // clear ก่อน

  playerList.forEach(player => {
    const isYou = player.playerName === playerName;

    const playerBox = document.createElement("div");
    playerBox.className = `player-box ${isYou ? "you" : ""}`;

    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.playerName;
    playerBox.appendChild(name);

    const roles = isYou ? myRoles : Array(5).fill("?");

    roles.forEach(role => {
      const card = document.createElement("div");
      card.className = "card";
      card.textContent = role;
      playerBox.appendChild(card);
    });

    container.appendChild(playerBox);
  });
}

socket.on("skillDeck", (deck) => {
  console.log("ได้รับ skillDeck:", deck);
  const deckskillContainer = document.getElementById("cardContainer");
  if (!deckskillContainer) return;
  deckskillContainer.innerHTML = "";

  // สมมุติว่าข้อมูล deck เป็น array ถูกต้องแล้ว
  deck.forEach(card => {
    const cardDiv = document.createElement("div");
    cardDiv.classList.add("skill-card");
    cardDiv.innerHTML = `
      <strong>${card.name}</strong><br>
      <small>${card.description}</small>
    `;
    deckskillContainer.appendChild(cardDiv);
  });
});