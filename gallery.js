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

let ALL_CARDS = [];
let CATEGORY_INDEX = []; // [{key,label}]
const state = {
  type: "ALL",
  align: "ALL",
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

function parseCategories(text) {
  return (text || "")
    .split(/[-\n,]/g)
    .map(x => x.trim())
    .filter(Boolean);
}

function buildCategoryIndex(cards) {
  const map = new Map(); // normalized -> display label

  for (const card of cards) {
    const raw = card?.data?.binds?.categoriesText || "";
    for (const c of parseCategories(raw)) {
      const key = norm(c);
      if (!key) continue;
      if (!map.has(key)) map.set(key, c.trim());
    }
  }

  return Array.from(map.entries())
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
  const typeSel = document.getElementById("filterType");
  const alignSel = document.getElementById("filterAlign");
  const clearBtn = document.getElementById("clearFiltersBtn");
  const catSearch = document.getElementById("categorySearch");

  if (typeSel) {
    typeSel.addEventListener("change", () => {
      state.type = typeSel.value;
      renderGrid();
    });
  }

  if (alignSel) {
    alignSel.addEventListener("change", () => {
      state.align = alignSel.value;
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
      state.catSearch = "";
      state.selectedCats.clear();

      if (typeSel) typeSel.value = "ALL";
      if (alignSel) alignSel.value = "ALL";
      if (catSearch) catSearch.value = "";

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

    // AND categories
    for (const needed of state.selectedCats) {
      if (!card._catKeys || !card._catKeys.has(needed)) return false;
    }
    return true;
  });

  // --- sort (your order) ---
  const RARITY_ORDER = { LR: 0, UR: 1 };
  const TYPE_ORDER = { AGL: 0, TEQ: 1, INT: 2, STR: 3, PHY: 4 };
  const ALIGN_ORDER = { SUPER: 0, EXTREME: 1 };

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
    // rarity
    const ra = RARITY_ORDER[a.rarity] ?? 99;
    const rb = RARITY_ORDER[b.rarity] ?? 99;
    if (ra !== rb) return ra - rb;

    // type first (AGL->TEQ->INT->STR->PHY)
    const at = splitType(a.type);
    const bt = splitType(b.type);

    const ta = TYPE_ORDER[at.type] ?? 99;
    const tb = TYPE_ORDER[bt.type] ?? 99;
    if (ta !== tb) return ta - tb;

    // then super before extreme
    const aa = ALIGN_ORDER[at.align] ?? 99;
    const ba = ALIGN_ORDER[bt.align] ?? 99;
    if (aa !== ba) return aa - ba;

    // then alphabetical by real name
    const nameA = cleanName(a.titleMain);
    const nameB = cleanName(b.titleMain);
    return nameA.localeCompare(nameB, "en", { sensitivity: "base" });
  });

  // --- draw grid ---
  grid.innerHTML = "";

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

    tile.append(art, rarity, typeIcon, title);
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
