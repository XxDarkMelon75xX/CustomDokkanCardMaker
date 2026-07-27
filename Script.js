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

// ===== UNSAVED INDICATOR =====
let _isDirty = false;

function setDirty() {
  if (_isDirty) return;
  _isDirty = true;
  document.getElementById("unsavedDot")?.classList.add("visible");
}

function clearDirty() {
  _isDirty = false;
  document.getElementById("unsavedDot")?.classList.remove("visible");
}

function setupDirtyTracking() {
  const form = document.getElementById("cardForm");
  if (form) {
    form.addEventListener("input", setDirty);
    form.addEventListener("change", setDirty);
  }
}

// ===== DRAG & DROP =====
function setupDragAndDrop() {
  const artArea = document.querySelector(".card-art");
  if (!artArea) return;

  artArea.addEventListener("dragover", e => {
    e.preventDefault();
    artArea.classList.add("drag-over");
  });

  artArea.addEventListener("dragleave", () => {
    artArea.classList.remove("drag-over");
  });

  artArea.addEventListener("drop", e => {
    e.preventDefault();
    artArea.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const isTransformed = document.querySelector(".dokkan-card")?.classList.contains("form-transformed");
    const img = document.getElementById(isTransformed ? "cardArtImgTrans" : "cardArtImg");
    if (!img) return;
    const reader = new FileReader();
    reader.onload = ev => { img.src = ev.target.result; setDirty(); };
    reader.readAsDataURL(file);
  });
}

// ===== KEYBOARD SHORTCUTS =====
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      document.getElementById("saveToGalleryBtn")?.click();
    }
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&")
    .replace(/</g, "&")
    .replace(/>/g, "&");
}

document.getElementById("openGalleryBtn").addEventListener("click", () => {
  window.location.href = "gallery.html";
});

// Make everything between " " blue using .category-name
function formatQuotedText(text) {
  const escaped = escapeHtml(text);
  const parts = escaped.split('"');

  let html = "";
  let insideQuotes = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (insideQuotes) {
      html += '<span class="category-name">"' + part + '"</span>';
    } else {
      html += part;
    }

    insideQuotes = !insideQuotes; // flip each time we pass a "
  }

  return html;
}

const STORAGE_KEY = "dokkan_cards_v1";

function getGalleryCards() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setGalleryCards(cards) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

function makeId() {
  return "c_" + Date.now() + "_" + Math.random().toString(16).slice(2, 6);
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

function saveCardToDB(card) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cards", "readwrite");
    const store = tx.objectStore("cards");
    store.put(card);
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e);
  });
}

function loadCardFromDB(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cards", "readonly");
    const store = tx.objectStore("cards");
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e);
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

function formatPassiveInline(text) {
  let escaped = escapeHtml(text);

  // first: turn "quotes" blue
  let html = formatQuotedText(escaped);

  // then replace icon codes
  html = html.replace(/\[ONCE\]/g, '<span class="icon-once">!1</span>');
  html = html.replace(/\[INF\]/g, '<span class="icon-inf">∞</span>');
  html = html.replace(/\[UP\]/g, '<span class="icon-up">▲</span>');
  html = html.replace(/\[DOWN_SELF\]/g, '<span class="icon-down-self">▼</span>');
  html = html.replace(/\[DOWN_ENEMY\]/g, '<span class="icon-down-enemy">▼</span>');

  return html;
}


function formatPassiveText(text) {
  const lines = text.split(/\r?\n/);

  let html = "";
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // blank line
    if (!line) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += "<br>";
      continue;
    }

    // bullet lines: "- something"
    if (line.startsWith("- ")) {
      if (!inList) {
        html += '<ul class="passive-list">';
        inList = true;
      }
      const content = line.slice(2);
      html += "<li>" + formatPassiveInline(content) + "</li>";
    }

    // heading/condition line
    else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += '<p class="passive-heading">' + formatPassiveInline(line) + "</p>";
    }
  }

  if (inList) html += "</ul>";

  return html;
}

function formatLinks(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
  let html = "";

  for (const line of lines) {
    const escaped = escapeHtml(line);
    html += `<div class="link-line">${escaped}</div>`;
  }

  return html;
}

function formatCategories(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
  let html = "";

  for (const line of lines) {
    const escaped = escapeHtml(line);
    html += `<div class="category-line">${escaped}</div>`;
  }

  return html;
}


// Binds every input/textarea with [data-bind] to the matching element ID
function setupBindings() {
  const bindableInputs = document.querySelectorAll("[data-bind]");

  bindableInputs.forEach(input => {
    const id = input.dataset.bind;
    const target = document.getElementById(id);
    if (!target) return;

    const update = () => {
      let value = input.value;
      if (input.type === "number" && value === "") {
        value = "0";
      }

      // special formatting for fields that support quoted categories
      if (
        id === "leaderText" ||
        id === "superAtkText" ||
        id === "ultraSuperAtkText"
      ) {
        // simple quoted text (no icons)
        target.innerHTML = formatQuotedText(value);
      }
      else if (
        id === "activeText"  || id === "activeCond"  ||
        id === "t_activeText"|| id === "t_activeCond"||
        id === "exSAEffect"  || id === "exSACond"    ||
        id === "t_exSAEffect"|| id === "t_exSACond"
      ) {
        // Active / EX SA condition + effect: quotes + icons
        target.innerHTML = formatPassiveInline(value);
      }
      else if (id === "passiveText" || id === "t_passiveText") {
        target.innerHTML = formatPassiveText(value);
      }
      else if (id === "linksText" || id === "linksTextA" || id === "linksTextB") {
        target.innerHTML = formatLinks(value);
      }
      else if (id === "categoriesText") {
        target.innerHTML = formatCategories(value);
      }
      else {
        target.textContent = value;
      }
    };

    input.addEventListener("input", update);
    update(); // initial
  });
}

// Simple image preview from file input
function setupImageUpload() {
  const setups = [
    { inputId: "artInput",      imgId: "cardArtImg",      btnId: "loadImageBtn" },
    { inputId: "artInputTrans", imgId: "cardArtImgTrans",  btnId: "loadImageTransBtn" }
  ];

  setups.forEach(({ inputId, imgId, btnId }) => {
    const fileInput = document.getElementById(inputId);
    const img = document.getElementById(imgId);
    const btn = document.getElementById(btnId);

    if (!fileInput || !img) return;

    if (btn) btn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = e => { img.src = e.target.result; };
      reader.readAsDataURL(file);
    });
  });
}


function setupTypeSelector() {
  const select = document.getElementById("typeSelect");
  const icon = document.getElementById("typeIcon");
  const card = document.querySelector(".dokkan-card");

  const updateTypeIcon = () => {
    const value = select.value; // e.g. SUPER_AGL
    const label = select.options[select.selectedIndex].text;
    const iconPath = `img/${value}.png`;

    icon.src = iconPath;
    icon.alt = label;

    // Remove old type classes
    card.classList.forEach(cls => {
      if (cls.startsWith("type-")) {
        card.classList.remove(cls);
      }
    });

    // Add the new type class
    card.classList.add(`type-${value}`);
  };

  select.addEventListener("change", updateTypeIcon);
  updateTypeIcon();
}


function setupRaritySelector() {
  const select = document.getElementById("raritySelect");
  const icon = document.getElementById("rarityIcon");
  const ultraSection = document.getElementById("ultraSuperSection");
  const ultraFormGroup = document.getElementById("ultraSuperFormGroup");

  if (!select || !icon) return;

  const rarityDefaults = {
    UR: { maxLv: 120, saLv: 10, cost: 58 },
    LR: { maxLv: 150, saLv: 20, cost: 77 }
  };

  const updateRarity = () => {
    const rarity = select.value;
    const defaults = rarityDefaults[rarity];

    icon.src = `img/${rarity}.png`;
    icon.alt = rarity;

    // Auto stats
    const maxLvInput = document.querySelector('[data-bind="maxLv"]');
    const saLvInput  = document.querySelector('[data-bind="saLv"]');
    const costInput  = document.querySelector('[data-bind="cost"]');

    if (defaults) {
      if (maxLvInput) { maxLvInput.value = defaults.maxLv; maxLvInput.dispatchEvent(new Event("input")); }
      if (saLvInput)  { saLvInput.value  = defaults.saLv;  saLvInput.dispatchEvent(new Event("input")); }
      if (costInput)  { costInput.value  = defaults.cost;  costInput.dispatchEvent(new Event("input")); }
    }

    // 🔹 Show Ultra Super only for LR
    const showUltra = (rarity === "LR");
    if (ultraSection) ultraSection.style.display = showUltra ? "block" : "none";
    if (ultraFormGroup) ultraFormGroup.style.display = showUltra ? "block" : "none";
  };

  select.addEventListener("change", updateRarity);
  updateRarity(); // initial setup
}

function setupFormToggle() {
  const card = document.querySelector(".dokkan-card");
  const formRoot = document.querySelector(".creator-panel");
  const radios = document.querySelectorAll('input[name="formMode"]');
  const transformCheckbox = document.getElementById("hasTransform");
  const toggleGroup = document.getElementById("formToggleGroup");

  if (!card || !formRoot || !radios.length || !transformCheckbox) return;

  const apply = () => {
    const exchangeCheckbox = document.getElementById("hasReversibleExchange");
    const standbyCheckbox  = document.getElementById("hasStandby");
    const isExchange = exchangeCheckbox?.checked ?? false;
    const isStandby  = standbyCheckbox?.checked  ?? false;
    const enabled = transformCheckbox.checked || isExchange || isStandby;

    // Show/hide the "Form preview" fieldset
    if (toggleGroup) {
      toggleGroup.style.display = enabled ? "" : "none";
    }

    // Determine which mode is active
    let mode = "base";

    if (enabled) {
      const checked = Array.from(radios).find(r => r.checked) || radios[0];
      if (checked) {
        mode = checked.value;
      }
    } else {
      // force base when transformation is disabled
      radios.forEach(radio => {
        radio.checked = (radio.value === "base");
      });
    }

    // --- PREVIEW: base vs transformed ---
    if (enabled && mode === "transformed") {
      card.classList.add("form-transformed");
    } else {
      card.classList.remove("form-transformed");
    }

    // --- FORM: show base/transformed blocks ---
    formRoot.querySelectorAll('[data-form="base"]').forEach(el => {
      // base fields are always visible when transformation is disabled,
      // or when mode === "base"
      el.style.display = (!enabled || mode === "base") ? "" : "none";
    });

    formRoot.querySelectorAll('[data-form="transformed"]').forEach(el => {
      // transformed fields only when transformation is enabled AND mode === "transformed"
      el.style.display = (enabled && mode === "transformed") ? "" : "none";
    });

    // Exchange: title + links preview visibility per partner
    if (isExchange) {
      const isBase = (!enabled || mode === "base");
      document.getElementById("titleMainA")?.style.setProperty("display", isBase ? "" : "none");
      document.getElementById("titleSubA") ?.style.setProperty("display", isBase ? "" : "none");
      document.getElementById("titleMainB")?.style.setProperty("display", isBase ? "none" : "");
      document.getElementById("titleSubB") ?.style.setProperty("display", isBase ? "none" : "");

      const linksTextA = document.getElementById("linksTextA");
      const linksTextB = document.getElementById("linksTextB");
      if (linksTextA) linksTextA.style.display = isBase ? "" : "none";
      if (linksTextB) linksTextB.style.display = isBase ? "none" : "";
    }
  };

  radios.forEach(r => r.addEventListener("change", apply));
  transformCheckbox.addEventListener("change", apply);

  const exchangeCheckbox = document.getElementById("hasReversibleExchange");
  if (exchangeCheckbox) exchangeCheckbox.addEventListener("change", apply);
  const standbyCheckbox = document.getElementById("hasStandby");
  if (standbyCheckbox) standbyCheckbox.addEventListener("change", apply);

  apply(); // initial state
}

function setupReversibleExchange() {
  const checkbox = document.getElementById("hasReversibleExchange");
  if (!checkbox) return;

  const apply = () => {
    const isExchange = checkbox.checked;

    // Update form toggle labels
    const legend = document.getElementById("formToggleLegend");
    const labelBase = document.getElementById("formLabelBase");
    const labelTrans = document.getElementById("formLabelTransformed");
    if (legend)     legend.textContent      = isExchange ? "Exchange preview"  : "Form preview";
    if (labelBase)  labelBase.textContent   = isExchange ? "Partner A"         : "Base form";
    if (labelTrans) labelTrans.textContent  = isExchange ? "Partner B"         : "Transformed form";

    // Toggle title fields in form
    const titleSharedGroup   = document.getElementById("titleSharedGroup");
    const titleExchangeGroup = document.getElementById("titleExchangeGroup");
    if (titleSharedGroup)   titleSharedGroup.style.display   = isExchange ? "none" : "";
    if (titleExchangeGroup) titleExchangeGroup.style.display = isExchange ? ""     : "none";

    // Toggle shared title in preview
    const titleMain = document.getElementById("titleMain");
    const titleSub  = document.getElementById("titleSub");
    if (titleMain) titleMain.style.display = isExchange ? "none" : "";
    if (titleSub)  titleSub.style.display  = isExchange ? "none" : "";

    // If exchange is turned off, hide exchange preview titles
    if (!isExchange) {
      ["titleMainA","titleSubA","titleMainB","titleSubB"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
      });
    }

    // Toggle links in form
    const linksSharedGroup   = document.getElementById("linksSharedGroup");
    const linksExchangeGroup = document.getElementById("linksExchangeGroup");
    if (linksSharedGroup)   linksSharedGroup.style.display   = isExchange ? "none" : "";
    if (linksExchangeGroup) linksExchangeGroup.style.display = isExchange ? ""     : "none";

    // Toggle shared links in preview
    const linksText = document.getElementById("linksText");
    if (linksText) linksText.style.display = isExchange ? "none" : "";

    // If exchange is turned off, hide exchange preview links
    if (!isExchange) {
      const linksTextA = document.getElementById("linksTextA");
      const linksTextB = document.getElementById("linksTextB");
      if (linksTextA) linksTextA.style.display = "none";
      if (linksTextB) linksTextB.style.display = "none";
    }
  };

  checkbox.addEventListener("change", apply);
  apply();
}

function setupStandbySkill() {
  const checkbox = document.getElementById("hasStandby");
  if (!checkbox) return;

  const apply = () => {
    const isStandby = checkbox.checked;

    // Labels
    const legend    = document.getElementById("formToggleLegend");
    const labelBase = document.getElementById("formLabelBase");
    const labelTrans= document.getElementById("formLabelTransformed");
    if (!document.getElementById("hasReversibleExchange")?.checked) {
      if (legend)     legend.textContent     = isStandby ? "Standby preview"  : "Form preview";
      if (labelBase)  labelBase.textContent  = isStandby ? "Normal"           : "Base form";
      if (labelTrans) labelTrans.textContent = isStandby ? "Standby mode"     : "Transformed form";
    }

    // Standby fields in form
    const standbyFields = document.getElementById("standbyFields");
    if (standbyFields) standbyFields.style.display = isStandby ? "" : "none";

    // Standby section in preview
    const standbySection = document.getElementById("standbySection");
    if (standbySection) standbySection.style.display = isStandby ? "" : "none";

    // Rename the "Load Transformed Image" button
    const loadTransBtn = document.getElementById("loadImageTransBtn");
    if (loadTransBtn) loadTransBtn.textContent = isStandby ? "Load Standby Image" : "Load Transformed Image";
  };

  checkbox.addEventListener("change", apply);
  apply();
}

function setupExSA() {
  const checkbox = document.getElementById("hasExSA");
  if (!checkbox) return;

  const apply = () => {
    const on = checkbox.checked;
    const fields  = document.getElementById("exSAFields");
    const section = document.getElementById("exSASection");
    if (fields)  fields.style.display  = on ? "" : "none";
    if (section) section.style.display = on ? "" : "none";
  };

  checkbox.addEventListener("change", apply);
  apply();
}

// Insert helper tags into the active textarea/input
document.querySelectorAll(".helper-tags button").forEach(btn => {
  btn.addEventListener("click", () => {
    const tag = btn.dataset.tag;
    const active = document.activeElement;

    // Only insert into text inputs or textareas
    if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) {
      const start = active.selectionStart;
      const end = active.selectionEnd;

      // Insert text at cursor position
      active.value =
        active.value.substring(0, start) +
        tag +
        active.value.substring(end);

      // Move cursor after inserted tag
      active.selectionStart = active.selectionEnd = start + tag.length;

      // Trigger input event so preview updates immediately
      active.dispatchEvent(new Event("input"));
    }
  });
});

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function setupExportButton() {
  const btn = document.getElementById("exportPngBtn");
  const card = document.getElementById("dokkanCard");

  if (!btn || !card || typeof html2canvas === "undefined") return;

  btn.addEventListener("click", async () => {
    // we still use the “real” card to know form state + title
    const isTransformed = card.classList.contains("form-transformed");
    const modeLabel = isTransformed ? "transformed" : "base";

    const titleMain = document.getElementById("titleMain")?.textContent || "card";
    const titleSub = document.getElementById("titleSub")?.textContent || "";
    const fullTitle = (titleMain + " " + titleSub).trim();
    const fileBase = slugify(fullTitle) || "card";

    try {
      // 🔹 CLONE the card OUTSIDE the scrollable preview so nothing is cropped
      const clone = card.cloneNode(true);
      clone.id = "dokkanCardExportClone";
      clone.style.position = "fixed";
      clone.style.left = "-9999px";   // off-screen
      clone.style.top = "0";
      clone.style.margin = "0";
      document.body.appendChild(clone);

      // PNG EXPORT using the clone
      const canvas = await html2canvas(clone, {
        backgroundColor: null,
        scale: 2,
        useCORS: true
      });

      // remove clone after rendering
      document.body.removeChild(clone);

      // download PNG
      const dataUrl = canvas.toDataURL("image/png");
      const linkPng = document.createElement("a");
      linkPng.href = dataUrl;
      linkPng.download = `${fileBase}_${modeLabel}.png`;
      document.body.appendChild(linkPng);
      linkPng.click();
      document.body.removeChild(linkPng);

      // JSON EXPORT (same as before)
      const jsonData = collectCardData();
      const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], {
        type: "application/json"
      });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const linkJson = document.createElement("a");
      linkJson.href = jsonUrl;
      linkJson.download = `${fileBase}_${modeLabel}.json`;
      document.body.appendChild(linkJson);
      linkJson.click();
      document.body.removeChild(linkJson);
      URL.revokeObjectURL(jsonUrl);

    } catch (err) {
      console.error("Export failed:", err);
      showToast("PNG/JSON export failed. Check the console.", "error");
    }
  });
}



const hasActiveSkill = document.getElementById("hasActiveSkill");

const activeSkillSection = document.getElementById("activeSkillSection");
const activeSkillFormFields = document.getElementById("activeSkillFormFields");
const activeSkillFormFieldsTrans = document.getElementById("activeSkillFormFieldsTrans");

function updateActiveSkillVisibility() {
  const enabled = hasActiveSkill.checked;

  // Show / hide preview
  activeSkillSection.style.display = enabled ? "block" : "none";

  // Show / hide form fields
  activeSkillFormFields.style.display = enabled ? "block" : "none";

  if (activeSkillFormFieldsTrans) {
    activeSkillFormFieldsTrans.style.display = enabled ? "block" : "none";
  }
}

hasActiveSkill.addEventListener("change", updateActiveSkillVisibility);

// Run at startup
updateActiveSkillVisibility();

// --JSON Functions-- //

function collectCardData() {
  const data = {
    version: 1,
    binds: {},
    rarity: null,
    type: null,
    hasTransform: false,
    hasActiveSkill: true,
    hasReversibleExchange: false,
    hasStandby: false,
    hasExSA: false,
    formMode: "base"
  };

  // All [data-bind] fields (inputs + textareas)
  document.querySelectorAll("[data-bind]").forEach(input => {
    const key = input.dataset.bind;
    if (!key) return;
    data.binds[key] = input.value;
  });

  // Type & rarity selectors (if present)
  const typeSelect = document.getElementById("typeSelect");
  if (typeSelect) data.type = typeSelect.value;

  const raritySelect = document.getElementById("raritySelect");
  if (raritySelect) data.rarity = raritySelect.value;

  // Transformation toggle
  const hasTransform = document.getElementById("hasTransform");
  if (hasTransform) data.hasTransform = !!hasTransform.checked;

  // Active Skill toggle
  const hasActiveSkill = document.getElementById("hasActiveSkill");
  if (hasActiveSkill) data.hasActiveSkill = !!hasActiveSkill.checked;

  // Reversible Exchange toggle
  const hasReversibleExchange = document.getElementById("hasReversibleExchange");
  if (hasReversibleExchange) data.hasReversibleExchange = !!hasReversibleExchange.checked;

  const hasStandby = document.getElementById("hasStandby");
  if (hasStandby) data.hasStandby = !!hasStandby.checked;

  const hasExSA = document.getElementById("hasExSA");
  if (hasExSA) data.hasExSA = !!hasExSA.checked;

  // Current form mode (base / transformed)
  const fm = document.querySelector('input[name="formMode"]:checked');
  if (fm) data.formMode = fm.value;

  return data;
}

function applyCardData(data) {
  if (!data || typeof data !== "object") return;

  // Type & rarity first (so icons/colors update)
  if (data.type && document.getElementById("typeSelect")) {
    const typeSelect = document.getElementById("typeSelect");
    typeSelect.value = data.type;
    typeSelect.dispatchEvent(new Event("change"));
  }

  if (data.rarity && document.getElementById("raritySelect")) {
    const raritySelect = document.getElementById("raritySelect");
    raritySelect.value = data.rarity;
    raritySelect.dispatchEvent(new Event("change"));
  }

  // Transform toggle
  if (typeof data.hasTransform === "boolean") {
    const hasTransform = document.getElementById("hasTransform");
    if (hasTransform) {
      hasTransform.checked = data.hasTransform;
      hasTransform.dispatchEvent(new Event("change"));
    }
  }

  // Active Skill toggle
  if (typeof data.hasActiveSkill === "boolean") {
    const hasActiveSkill = document.getElementById("hasActiveSkill");
    if (hasActiveSkill) {
      hasActiveSkill.checked = data.hasActiveSkill;
      hasActiveSkill.dispatchEvent(new Event("change"));
    }
  }

  // Reversible Exchange toggle
  if (typeof data.hasReversibleExchange === "boolean") {
    const hasReversibleExchange = document.getElementById("hasReversibleExchange");
    if (hasReversibleExchange) {
      hasReversibleExchange.checked = data.hasReversibleExchange;
      hasReversibleExchange.dispatchEvent(new Event("change"));
    }
  }

  if (typeof data.hasStandby === "boolean") {
    const hasStandby = document.getElementById("hasStandby");
    if (hasStandby) {
      hasStandby.checked = data.hasStandby;
      hasStandby.dispatchEvent(new Event("change"));
    }
  }

  if (typeof data.hasExSA === "boolean") {
    const hasExSA = document.getElementById("hasExSA");
    if (hasExSA) {
      hasExSA.checked = data.hasExSA;
      hasExSA.dispatchEvent(new Event("change"));
    }
  }

  // Form mode
  if (data.formMode) {
    const radio = document.querySelector(`input[name="formMode"][value="${data.formMode}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event("change"));
    }
  }

  // Restore all [data-bind] values (this also updates preview via your bindings)
  if (data.binds && typeof data.binds === "object") {
    Object.entries(data.binds).forEach(([key, value]) => {
      const input = document.querySelector(`[data-bind="${key}"]`);
      if (!input) return;
      input.value = value;
      input.dispatchEvent(new Event("input"));
    });
  }
}

function setupNewCardButton() {
  const btn = document.getElementById("newCardBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    // remove ?id from URL so next save creates a new entry
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.replaceState({}, "", url.toString());

    // optional: reload page to fully reset everything
    location.reload();
  });
}

function setupImportJson() {
  const btn = document.getElementById("importJsonBtn");
  const fileInput = document.getElementById("importJsonFile");
  if (!btn || !fileInput) return;

  btn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        applyCardData(data);
      } catch (err) {
        console.error("Invalid JSON file:", err);
        showToast("Invalid JSON file.", "error");
      }
    };
    reader.readAsText(file);
  });
}

function setupSaveToGallery() {
  const btn = document.getElementById("saveToGalleryBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      const data = collectCardData();
      const titleMain = document.getElementById("titleMain").textContent;
      const titleSub = document.getElementById("titleSub").textContent;
      const rarity = document.getElementById("raritySelect")?.value;
      const type = document.getElementById("typeSelect")?.value;
      const hasTransform = document.getElementById("hasTransform")?.checked;

      const artImg = document.getElementById("cardArtImg");
      let artBlob = null;
      try {
        artBlob = await fetch(artImg.src).then(r => r.blob());
      } catch (e) {
        console.warn("Could not fetch card art, saving without image:", e);
      }

      const artImgTrans = document.getElementById("cardArtImgTrans");
      let artBlobTrans = null;
      try {
        artBlobTrans = await fetch(artImgTrans.src).then(r => r.blob());
      } catch (e) {
        console.warn("Could not fetch transformed art, saving without image:", e);
      }

      const url = new URL(window.location.href);
      let id = url.searchParams.get("id");
      if (!id) {
        id = "c_" + Date.now() + "_" + Math.random().toString(16).slice(2);
        url.searchParams.set("id", id);
        window.history.replaceState({}, "", url.toString());
      }

      await saveCardToDB({
        id,
        titleMain,
        titleSub,
        rarity,
        type,
        hasTransform,
        artBlob,
        artBlobTrans,
        data,
        updatedAt: Date.now()
      });

      clearDirty();
      showToast("Saved to gallery!");
    } catch (e) {
      console.error("Save to gallery failed:", e);
      showToast("Save failed: " + e.message, "error");
    }
  });
}

async function loadFromGalleryByIdIfPresent() {
  const url = new URL(window.location.href);
  const id = url.searchParams.get("id");
  if (!id) return;

  const card = await loadCardFromDB(id);
  if (!card) return;

  applyCardData(card.data);

  if (card.artBlob) {
    const imgURL = URL.createObjectURL(card.artBlob);
    document.getElementById("cardArtImg").src = imgURL;
  }

  if (card.artBlobTrans) {
    const imgURL = URL.createObjectURL(card.artBlobTrans);
    document.getElementById("cardArtImgTrans").src = imgURL;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await openDB();

  setupBindings();
  setupImageUpload();
  setupTypeSelector();
  setupRaritySelector();
  setupFormToggle();
  setupReversibleExchange();
  setupStandbySkill();
  setupExSA();
  setupExportButton();
  setupUnityExportButton();
  setupImportJson();
  setupSaveToGallery();
  loadFromGalleryByIdIfPresent();
  setupNewCardButton();
  setupDirtyTracking();
  setupDragAndDrop();
  setupKeyboardShortcuts();
});