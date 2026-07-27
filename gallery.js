// gallery.js (IndexedDB version)

// ===== TOASTS =====
function showToast(msg, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = "opacity 0.3s, transform 0.3s";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(16px)";
    setTimeout(() => toast.remove(), 320);
  }, 3000);
}

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

function deleteCardFromDB(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cards", "readwrite");
    const store = tx.objectStore("cards");
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e);
  });
}

let ALL_CARDS = [];
let CATEGORY_INDEX = []; // [{key,label}]
const state = {
  type: "ALL",
  align: "ALL",
  rarity: "ALL",
  name: "",
  catSearch: "",
  selectedCats: new Set()
};

function norm(s) {
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

// Official category list + custom additions
const MASTER_CATEGORIES = [
  "DB Saga", "Saiyan Saga", "Planet Namek Saga", "Androids/Cell Saga",
  "Majin Buu Saga", "Future Saga", "Universe Survival Saga",
  "Shadow Dragon Saga", "DAIMA",
  "Pure Saiyans", "Hybrid Saiyans", "Earthlings", "Namekians",
  "Androids", "Artificial Life Forms",
  "Goku's Family", "Vegeta's Family", "Wicked Bloodline",
  "Youth", "Peppy Gals",
  "Super Saiyans", "Super Saiyan 2", "Super Saiyan 3",
  "Power Beyond Super Saiyan", "Fusion", "Potara", "Fused Fighters",
  "Giant Form", "Transformation Boost", "Power Absorption",
  "Kamehameha", "Realm of Gods", "Full Power", "Giant Ape Power",
  "Majin Power", "Uncontrollable Power", "Powerful Comeback",
  "Power of Wishes", "Demonic Power", "Miraculous Awakening",
  "Corroded Body and Mind", "Rapid Growth", "Mastered Evolution",
  "Time Limit", "Final Trump Card",
  "Worthy Rivals", "Sworn Enemies", "Joined Forces",
  "Bond of Parent and Child", "Siblings' Bond", "Bond of Friendship",
  "Bond of Master and Disciple",
  "Ginyu Force", "Team Bardock", "Universe 6",
  "Representatives of Universe 7", "Universe 11",
  "GT Heroes", "GT Bosses", "Super Heroes", "Super Bosses",
  "Movie Heroes", "Movie Bosses",
  "Turtle School", "World Tournament", "Tournament Participants",
  "Earth-Bred Fighters", "Low-Class Warrior", "Gifted Warriors",
  "Otherworld Warriors", "Resurrected Warriors", "Space-Traveling Warriors",
  "Time Travelers", "Dragon Ball Seekers", "Successors",
  "Storied Figures", "Legendary Existence", "Saviors",
  "Defenders of Justice", "Earth-Protecting Heroes",
  "Revenge", "Mission Execution", "Target: Goku",
  "Terrifying Conquerors", "Inhuman Deeds", "Planetary Destruction",
  "Exploding Rage", "Connected Hope", "Entrusted Will",
  "All-Out Struggle", "Battle of Wits", "Accelerated Battle",
  "Battle of Fate", "Heavenly Events", "Special Pose",
  "Worldwide Chaos", "Crossover", "Dragon Ball Heroes",
  // Custom categories
  "Hyperdimension Neptunia", "RWBY"
];

// Normalized key \u2192 canonical display name
const MASTER_CAT_MAP = new Map(MASTER_CATEGORIES.map(c => [norm(c), c]));

// Split on " - " (with spaces), newlines, or commas \u2014 NOT on bare "-"
// so "All-Out Struggle" stays intact
function parseCategories(text) {
  return (text || "")
    .split(/\s+-\s+|\n|,/g)
    .map(x => x.trim())
    .filter(Boolean);
}

function buildCategoryIndex(cards) {
  const found = new Map(); // normalized key \u2192 canonical display label

  for (const card of cards) {
    const raw = card?.data?.binds?.categoriesText || "";
    for (const c of parseCategories(raw)) {
      const key = norm(c);
      if (!key || found.has(key)) continue;
      // Use canonical name from master list, fall back to the card's own label
      found.set(key, MASTER_CAT_MAP.get(key) || c.trim());
    }
  }

  return Array.from(found.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
}

function decorateCards(cards) {
  for (const card of cards) {
    const raw = card?.data?.binds?.categoriesText || "";
    const cats = parseCategories(raw);
    card._catKeys = new Set(cats.map(norm).filter(Boolean));
  }
  return cards;
}

function renderCategoryList() {
  const list = document.getElementById("categoryList");
  if (!list) return;

  const q = norm(state.catSearch);
  list.innerHTML = "";

  const visible = CATEGORY_INDEX.filter(c => !q || norm(c.label).includes(q) || c.key.includes(q));

  for (const cat of visible) {
    const row = document.createElement("label");
    row.className = "category-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = state.selectedCats.has(cat.key);
    cb.addEventListener("change", () => {
      if (cb.checked) state.selectedCats.add(cat.key);
      else state.selectedCats.delete(cat.key);
      renderGrid();
    });

    const span = document.createElement("span");
    span.textContent = cat.label;

    row.append(cb, span);
    list.appendChild(row);
  }
}

function setupFiltersUI() {
  const typeSel    = document.getElementById("filterType");
  const alignSel   = document.getElementById("filterAlign");
  const raritySel  = document.getElementById("filterRarity");
  const nameSearch = document.getElementById("nameSearch");
  const clearBtn   = document.getElementById("clearFiltersBtn");
  const catSearch  = document.getElementById("categorySearch");

  if (typeSel)    typeSel.addEventListener("change",  () => { state.type  = typeSel.value;  renderGrid(); });
  if (alignSel)   alignSel.addEventListener("change", () => { state.align = alignSel.value; renderGrid(); });
  if (raritySel)  raritySel.addEventListener("change",() => { state.rarity= raritySel.value;renderGrid(); });

  if (nameSearch) {
    nameSearch.addEventListener("input", () => {
      state.name = nameSearch.value.trim();
      renderGrid();
    });
  }

  if (catSearch) {
    catSearch.addEventListener("input", () => {
      state.catSearch = catSearch.value;
      renderCategoryList();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      state.type = "ALL";
      state.align = "ALL";
      state.rarity = "ALL";
      state.name = "";
      state.catSearch = "";
      state.selectedCats.clear();

      if (typeSel)    typeSel.value = "ALL";
      if (alignSel)   alignSel.value = "ALL";
      if (raritySel)  raritySel.value = "ALL";
      if (nameSearch) nameSearch.value = "";
      if (catSearch)  catSearch.value = "";

      renderCategoryList();
      renderGrid();
    });
  }
}

async function initGallery() {
  ALL_CARDS = decorateCards(await loadAllCardsFromDB());
  CATEGORY_INDEX = buildCategoryIndex(ALL_CARDS);

  setupFiltersUI();
  renderCategoryList();
  renderGrid(); // first render
}

function renderGrid() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  // --- filter cards ---
  const filtered = ALL_CARDS.filter(card => {
    const parts = (card.type || "").toUpperCase().split("_");
    const align = parts[0] || "";
    const type = parts[1] || "";

    if (state.type !== "ALL" && type !== state.type) return false;
    if (state.align !== "ALL" && align !== state.align) return false;
    if (state.rarity !== "ALL" && (card.rarity || "").toUpperCase() !== state.rarity) return false;

    if (state.name) {
      const q = norm(state.name);
      const fullName = norm((card.titleMain || "") + " " + (card.titleSub || ""));
      if (!fullName.includes(q)) return false;
    }

    // AND categories
    for (const needed of state.selectedCats) {
      if (!card._catKeys || !card._catKeys.has(needed)) return false;
    }
    return true;
  });

  // --- sort (your order) ---
  const TYPE_ORDER = { AGL: 0, TEQ: 1, INT: 2, STR: 3, PHY: 4 };
  const ALIGN_ORDER = { SUPER: 0, EXTREME: 1 };
  const RARITY_ORDER = { LR: 0, UR: 1 };

  function splitType(t) {
    const parts = (t || "").toUpperCase().split("_");
    return { align: parts[0] || "", type: parts[1] || "" };
  }

  function cleanName(s) {
    return (s || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  filtered.sort((a, b) => {
    const at = splitType(a.type);
    const bt = splitType(b.type);
  
    // 1) Type
    const ta = TYPE_ORDER[at.type] ?? 99;
    const tb = TYPE_ORDER[bt.type] ?? 99;
    if (ta !== tb) return ta - tb;
  
    // 2) Class (Super then Extreme)
    const aa = ALIGN_ORDER[at.align] ?? 99;
    const ba = ALIGN_ORDER[bt.align] ?? 99;
    if (aa !== ba) return aa - ba;
  
    // 3) Rarity inside each class/type
    const ra = RARITY_ORDER[(a.rarity || "").toUpperCase()] ?? 99;
    const rb = RARITY_ORDER[(b.rarity || "").toUpperCase()] ?? 99;
    if (ra !== rb) return ra - rb;
  
    // 4) Name
    const nameA = cleanName(a.titleMain);
    const nameB = cleanName(b.titleMain);
    return nameA.localeCompare(nameB, "en", { sensitivity: "base" });
  });
  
  // --- draw grid ---
  grid.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-msg";
    empty.textContent = ALL_CARDS.length === 0
      ? "No cards saved yet. Create a card in the editor and click \"Save to Gallery\"."
      : "No cards match the current filters.";
    grid.appendChild(empty);
    return;
  }

  for (const card of filtered) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.style.borderColor = TYPE_COLORS[card.type] || "#666";

    const art = document.createElement("img");
    art.className = "art";
    art.src = card.artBlob
      ? URL.createObjectURL(card.artBlob)
      : "https://via.placeholder.com/400x560?text=No+Art";

    const rarity = document.createElement("img");
    rarity.className = "badge rarity";
    rarity.src = rarityIconPath(card.rarity || "UR");

    const typeIcon = document.createElement("img");
    typeIcon.className = "badge type";
    typeIcon.src = typeIconPath(card.type || "SUPER_AGL");

    const title = document.createElement("div");
    title.className = "title";
    title.innerHTML = `
      ${card.titleMain || "Untitled"}
      <span class="sub">${card.titleSub || ""}</span>
    `;

    // Hover overlay
    const overlay = document.createElement("div");
    overlay.className = "tile-overlay";
    overlay.innerHTML = `
      <span class="overlay-name">${card.titleMain || "Untitled"}</span>
      <span class="overlay-sub">${card.titleSub || ""}</span>
    `;

    // Delete button (two-click confirm)
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "tile-delete";
    deleteBtn.textContent = "✕";
    deleteBtn.title = "Delete card";
    let deleteConfirm = false;
    let deleteTimer = null;

    deleteBtn.addEventListener("click", async e => {
      e.stopPropagation();
      if (!deleteConfirm) {
        deleteConfirm = true;
        deleteBtn.textContent = "Sure?";
        deleteBtn.classList.add("confirm");
        deleteTimer = setTimeout(() => {
          deleteConfirm = false;
          deleteBtn.textContent = "✕";
          deleteBtn.classList.remove("confirm");
        }, 2000);
      } else {
        clearTimeout(deleteTimer);
        try {
          await deleteCardFromDB(card.id);
          ALL_CARDS = ALL_CARDS.filter(c => c.id !== card.id);
          CATEGORY_INDEX = buildCategoryIndex(ALL_CARDS);
          renderCategoryList();
          renderGrid();
          showToast("Card deleted.", "info");
        } catch (err) {
          console.error(err);
          showToast("Failed to delete card.", "error");
        }
      }
    });

    tile.addEventListener("mouseleave", () => {
      clearTimeout(deleteTimer);
      deleteConfirm = false;
      deleteBtn.textContent = "✕";
      deleteBtn.classList.remove("confirm");
    });

    tile.append(art, rarity, typeIcon, title, overlay, deleteBtn);
    tile.addEventListener("click", () => {
      window.location.href = `index.html?id=${encodeURIComponent(card.id)}`;
    });

    grid.appendChild(tile);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await openDB();
    await initGallery();
  } catch (e) {
    console.error("Gallery failed:", e);
    alert("Gallery failed to load. Check console for details.");
  }
});
