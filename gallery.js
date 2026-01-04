// gallery.js (IndexedDB version)

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("dokkanDB", 1);

    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("cards")) {
        db.createObjectStore("cards", { keyPath: "id" });
      }
    };

    request.onsuccess = e => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = e => reject(e);
  });
}

function loadAllCardsFromDB() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cards", "readonly");
    const store = tx.objectStore("cards");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = e => reject(e);
  });
}

// match your editor type colors
const TYPE_COLORS = {
  SUPER_AGL: "#1e88e5",
  SUPER_STR: "#e53935",
  SUPER_TEQ: "#43a047",
  SUPER_INT: "#8e24aa",
  SUPER_PHY: "#fbc02d",

  EXTREME_AGL: "#1e88e5",
  EXTREME_STR: "#e53935",
  EXTREME_TEQ: "#43a047",
  EXTREME_INT: "#8e24aa",
  EXTREME_PHY: "#fbc02d"
};

// icon paths (same idea as your editor)
function typeIconPath(type) {
  return `img/${type}.png`;
}
function rarityIconPath(rarity) {
  return `img/${rarity}.png`;
}

async function render() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  const cards = await loadAllCardsFromDB();
  grid.innerHTML = "";

  const RARITY_ORDER = { LR: 0, UR: 1 };
  const TYPE_ORDER = { AGL: 0, TEQ: 1, INT: 2, STR: 3, PHY: 4 };
  const ALIGN_ORDER = { SUPER: 0, EXTREME: 1 };
  
  function splitType(t) {
    const parts = (t || "").toUpperCase().split("_");
    return {
      align: parts[0] || "",
      type: parts[1] || ""
    };
  }
  
  function cleanName(s) {
    return (s || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }
  
  cards.sort((a, b) => {
    // 1) Rarity: LR first, then UR
    const ra = RARITY_ORDER[a.rarity] ?? 99;
    const rb = RARITY_ORDER[b.rarity] ?? 99;
    if (ra !== rb) return ra - rb;
  
    const at = splitType(a.type);
    const bt = splitType(b.type);
  
    // 2) Type order: AGL, TEQ, INT, STR, PHY
    const ta = TYPE_ORDER[at.type] ?? 99;
    const tb = TYPE_ORDER[bt.type] ?? 99;
    if (ta !== tb) return ta - tb;
  
    // 3) Super before Extreme inside the same type
    const aa = ALIGN_ORDER[at.align] ?? 99;
    const ba = ALIGN_ORDER[bt.align] ?? 99;
    if (aa !== ba) return aa - ba;
  
    // 4) Alphabetical by card name
    const nameA = cleanName(a.titleMain);
    const nameB = cleanName(b.titleMain);
    return nameA.localeCompare(nameB, "en", { sensitivity: "base" });
  });


  for (const card of cards) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.style.borderColor = TYPE_COLORS[card.type] || "#666";

    const art = document.createElement("img");
    art.className = "art";
    if (card.artBlob) {
      art.src = URL.createObjectURL(card.artBlob);
    } else {
      art.src = "https://via.placeholder.com/400x560?text=No+Art";
    }

    const rarity = document.createElement("img");
    rarity.className = "badge rarity";
    rarity.src = rarityIconPath(card.rarity || "UR");

    const type = document.createElement("img");
    type.className = "badge type";
    type.src = typeIconPath(card.type || "SUPER_AGL");

    const title = document.createElement("div");
    title.className = "title";
    title.innerHTML = `
      ${card.titleMain || "Untitled"}
      <span class="sub">${card.titleSub || ""}</span>
    `;

    tile.append(art, rarity, type, title);
    tile.addEventListener("click", () => {
      window.location.href = `index.html?id=${encodeURIComponent(card.id)}`;
    });

    grid.appendChild(tile);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await openDB();
    await render();
  } catch (e) {
    console.error("Gallery failed:", e);
    alert("Gallery failed to load. Check console for details.");
  }
});
