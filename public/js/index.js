document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("name");
  const roomInput = document.getElementById("roomId");

  window.createRoom = function () {
    const name = nameInput.value.trim();
    let roomId = roomInput.value.trim();

    if (!name) {
      alert("กรุณากรอกชื่อผู้เล่น");
      return;
    }

    if (!roomId) {
      roomId = generateRoomId();
    }

    window.location.href = `./component/room.html?roomId=${roomId}&name=${encodeURIComponent(name)}&type=create`;
  };

  window.joinRoom = function () {
    const name = nameInput.value.trim();
    const roomId = roomInput.value.trim();

    if (!name || !roomId) {
      alert("กรุณากรอกทั้งชื่อผู้เล่นและรหัสห้อง");
      return;
    }

    window.location.href = `./component/room.html?roomId=${roomId}&name=${encodeURIComponent(name)}&type=join`;
  };
});

function generateRoomId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}
