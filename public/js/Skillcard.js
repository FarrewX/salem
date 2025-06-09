
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

const container = document.getElementById("cardContainer");
deck_skillcard.forEach(card => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
    <h3>${card.name}</h3>
    <p>${card.description}</p>`;
    container.appendChild(div);
});
