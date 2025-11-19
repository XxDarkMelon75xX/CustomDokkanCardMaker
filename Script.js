function escapeHtml(str) {
  return str
    .replace(/&/g, "&")
    .replace(/</g, "&;")
    .replace(/>/g, "&");
}

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
      else if (id === "activeText" || id === "activeCond") {
        // Active Skill condition + effect: quotes + icons
        target.innerHTML = formatPassiveInline(value);
      }
      else if (id === "passiveText" || id === "t_passiveText") {
        target.innerHTML = formatPassiveText(value);
      }
      else if (id === "linksText") {
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
    { inputId: "artInput", imgId: "cardArtImg" },
    { inputId: "artInputTrans", imgId: "cardArtImgTrans" }
  ];

  setups.forEach(({ inputId, imgId }) => {
    const fileInput = document.getElementById(inputId);
    const img = document.getElementById(imgId);

    if (!fileInput || !img) return;

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = e => {
        img.src = e.target.result;
      };
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
    const enabled = transformCheckbox.checked;

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
  };

  radios.forEach(r => r.addEventListener("change", apply));
  transformCheckbox.addEventListener("change", apply);

  apply(); // initial state
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
      alert("PNG/JSON export failed. Check the console for details.");
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
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  });
}


document.addEventListener("DOMContentLoaded", () => {
  setupBindings();
  setupImageUpload();
  setupTypeSelector();
  setupRaritySelector();
  setupFormToggle();
  setupExportButton();
  setupImportJson();   // 🔹 NEW
});
