const socket = io();

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("roomId");
const playerName = urlParams.get("name");

let myRoles = [];
let playerHand = [];
let showHand = true;

document.getElementById("player-info").innerText = `ชื่อผู้เล่น: ${playerName}`;

document.getElementById("drawCardBtn").addEventListener("click", drawCard);

document.getElementById("showHandBtn").addEventListener("click", () => {
  showHand = !showHand;
  socket.emit("requestHand", { roomId, playerName });
  const handContainer = document.getElementById("handContainer");
  const showHandBtn = document.getElementById("showHandBtn");
  if (showHand) {
    renderHand();
    showHandBtn.innerHTML = "ซ่อนการ์ดการ์ดบนมือ";
    handContainer.style.display = "flex";
  } else {
    showHandBtn.innerHTML = "แสดงการ์ดการ์ดบนมือ";
    handContainer.style.display = "none";
  }
});

function renderHand() {
  const handContainer = document.getElementById("handContainer");
  handContainer.innerHTML = "";
  playerHand.forEach(card => {
    const cardDiv = document.createElement("div");
    cardDiv.classList.add("skill-card");
    cardDiv.innerHTML = `
      <strong>${card.name}</strong><br>
      <small>${card.description}</small>
    `;
    handContainer.appendChild(cardDiv);
  });
}

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

socket.on("skillDeck", (deck, index) => {
  // console.log("ได้รับ skillDeck:", deck);
  const deckskillContainer = document.getElementById("cardContainer");
  if (!deckskillContainer) return;
  const drawCard = document.createElement("drawCardBtn");
  if(deck.length > 0){
  deckskillContainer.innerHTML = "";
  drawCard.classList.add("div");
  drawCard.innerHTML = `
      <h7>CARD</h7><br>
      <h9>Salem</h9>
    `;
  deckskillContainer.appendChild(drawCard);
  }
  if(deck.length === 0){
    deckskillContainer.innerHTML = "";
    drawCard.classList.add("div");
    drawCard.innerHTML = `
        <h7>CARD</h7><br>
        <h9>None</h9>
      `;
    deckskillContainer.appendChild(drawCard);
  }
});

socket.on("deckSizeUpdate", (count) => {
  deckSizeElement.innerText = `Deck: ${count} cards`;
});

socket.on("cardDrawn", (card) => {
  playerHand.push(card);
  renderHand();
});

function drawCard() {
  socket.emit("drawCard", { roomId, playerName });
}

socket.on("cardPlayed", ({ from, to, card }) => {
  // แสดงว่าใครเล่นการ์ดใส่ใคร พร้อมแสดงการ์ด
  showNotification(`${fromName} played ${card.name} on ${toName}`);
  revealPlayedCard(card);
});

socket.on('updateHand', (cards) => {
  playerHand = cards;
  renderHand();
});