// systems/hwfwm-d20/scripts/hwfwm-d20.js
// ============================================================================
// HWFWM-D20 | Actor & Item sheet registration + Tabs/Subtabs support
// ============================================================================

/* ------------------ Confluence combo loader (JSON file) ------------------ */
async function loadConfluenceCombos() {
  // Cache on the system object so we only fetch once
  if (game.system.hwfwmConfluenceCombos) {
    return game.system.hwfwmConfluenceCombos;
  }

  const path = "systems/hwfwm-d20/templates/actors/parts/abilities/confluence-combos.hbs";

  try {
    const res = await fetch(path);
    if (!res.ok) {
      console.error("HWFWM-D20 | Failed to load confluence-combos.hbs:", res.status, res.statusText);
      game.system.hwfwmConfluenceCombos = { byCombination: {}, byConfluence: {} };
      return game.system.hwfwmConfluenceCombos;
    }

    const text = await res.text();
    // File is pure JSON text: { "byCombination": {...}, "byConfluence": {...} }
    const data = JSON.parse(text);
    game.system.hwfwmConfluenceCombos = data;
    return data;
  } catch (err) {
    console.error("HWFWM-D20 | Error loading confluence-combos.hbs:", err);
    game.system.hwfwmConfluenceCombos = { byCombination: {}, byConfluence: {} };
    return game.system.hwfwmConfluenceCombos;
  }
}

/* ----------------------------- PC Actor Sheet ----------------------------- */
class HWFWMPCSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hwfwm", "sheet", "actor", "pc"],
      template: "systems/hwfwm-d20/templates/actors/actor-sheet.hbs",
      width: 960,
      height: "auto",
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-content",
          initial: "stats"
        }
      ]
    });
  }

  /** Inject extra data into the sheet */
  async getData(options) {
    const data = await super.getData(options);
    const sys  = this.actor.system ?? {};

    const rank = (sys.details?.rank ?? "").toString().toLowerCase();
    data.showWillpower = rank.includes("gold") || rank.includes("diamond");

    // Expose itemTypes for easy use on tabs (skills, etc.)
    data.itemTypes = this.actor.itemTypes ?? {};

    // GM flag for locking Essence / Confluence edits
    data.isGM = game.user.isGM;

    // ----- Essence + Confluence suggestion logic -----
    const ess = sys.essences ?? {};
    const e1 = ess.e1?.key || "";
    const e2 = ess.e2?.key || "";
    const e3 = ess.e3?.key || "";

    const combos = await loadConfluenceCombos();
    const byComb = combos.byCombination ?? {};
    const byConf = combos.byConfluence ?? {};

    // All known confluence keys, sorted
    const allConfluences = Object.keys(byConf).sort();
    data.allConfluences = allConfluences;

    // Suggested confluence(s) based on the three normal Essences
    let suggestions = [];
    if (e1 && e2 && e3) {
      const key = [e1, e2, e3].sort().join("+"); // we store combo keys sorted
      const confKey = byComb[key];
      if (confKey) suggestions = [confKey];
    }
    data.confluenceSuggestions = suggestions;

    return data;
  }

  /** Activate listeners for sheet controls */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // ---------------- Subtabs (Stats, Skills, Inventory, etc.) -------------
    html.find(".subtabs").each((_, elem) => {
      const $block   = $(elem);
      const $buttons = $block.find(".subtab-btn");

      $buttons.on("click", ev => {
        const $btn   = $(ev.currentTarget);
        const target = $btn.data("subtab");
        if (!target) return;

        // Update buttons
        $buttons.removeClass("active");
        $btn.addClass("active");

        // Subtab containers are within the same .card
        const $card = $block.closest(".card");
        const $tabs = $card.find(".subtab");

        $tabs.removeClass("active");
        $card.find(`.subtab[data-subtab='${target}']`).addClass("active");
      });
    });

    // ---------------- Embedded Item Controls (skills, etc.) -----------------
    html.find(".item-create").on("click", async ev => {
      const btn = ev.currentTarget;
      const type = btn.dataset.type;
      if (!type) return;

      const category = btn.dataset.category ?? "";
      const attr     = btn.dataset.attr ?? "";

      await this.actor.createEmbeddedDocuments("Item", [
        {
          name: `New ${category || type}`,
          type,
          system: {
            category,
            associatedAttribute: attr
          }
        }
      ]);
    });

    html.find(".item-edit").on("click", ev => {
      const li = ev.currentTarget.closest("[data-item-id]");
      if (!li) return;
      const item = this.actor.items.get(li.dataset.itemId);
      if (item) item.sheet.render(true);
    });

    html.find(".item-delete").on("click", async ev => {
      const li = ev.currentTarget.closest("[data-item-id]");
      if (!li) return;
      await this.actor.deleteEmbeddedDocuments("Item", [li.dataset.itemId]);
    });

    html.find(".skill-trained").on("change", async ev => {
      const cb   = ev.currentTarget;
      const id   = cb.dataset.itemId;
      const item = this.actor.items.get(id);
      if (!item) return;
      await item.update({ "system.trained": cb.checked });
    });
  }
}

/* ------------------------------ Item Sheet -------------------------------- */
class HWFWMItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hwfwm", "sheet", "item"],
      template: "systems/hwfwm-d20/templates/items/item-sheet.hbs",
      width: 640,
      height: "auto"
    });
  }

  getData(options) {
    const data = super.getData(options);
    return data;
  }
}

/* --------------------------- System Initialisation ------------------------ */
Hooks.once("init", async function () {
  console.log("HWFWM-D20 | init");

  // ---------- Handlebars helpers ----------
  Handlebars.registerHelper("eq", function (a, b) {
    return a === b;
  });

  Handlebars.registerHelper("array", function (...args) {
    // Last arg is Handlebars options object
    return args.slice(0, -1);
  });

  Handlebars.registerHelper("sortBy", function (collection, field) {
    if (!Array.isArray(collection)) return [];
    return collection.slice().sort((a, b) => {
      const av = foundry.utils.getProperty(a, field) ?? "";
      const bv = foundry.utils.getProperty(b, field) ?? "";
      return String(av).localeCompare(String(bv), "en", { sensitivity: "base" });
    });
  });

  // Simple increment helper (used for ability slot labels, etc.)
  Handlebars.registerHelper("inc", function (value) {
    return Number(value) + 1;
  });

  // ---------- Register sheets ----------
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, {
    makeDefault: true,
    types: ["pc"]
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hwfwm-d20", HWFWMItemSheet, {
    makeDefault: true
  });

  // ---------- Preload templates ----------
  const templatePaths = [
    // Main actor sheet
    "systems/hwfwm-d20/templates/actors/actor-sheet.hbs",

    // Tabs
    "systems/hwfwm-d20/templates/actors/parts/tabs/stats.hbs",
    "systems/hwfwm-d20/templates/actors/parts/tabs/skills.hbs",
    "systems/hwfwm-d20/templates/actors/parts/tabs/abilities.hbs",
    "systems/hwfwm-d20/templates/actors/parts/tabs/inventory.hbs",
    "systems/hwfwm-d20/templates/actors/parts/tabs/notes.hbs",

    // Stats subtabs
    "systems/hwfwm-d20/templates/actors/parts/subtabs/stats/attributes.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/stats/status.hbs",

    // Inventory subtabs
    "systems/hwfwm-d20/templates/actors/parts/subtabs/inventory/weapons.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/inventory/armor.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/inventory/gear.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/inventory/consumables.hbs",

    // Skills subtabs
    "systems/hwfwm-d20/templates/actors/parts/subtabs/skills/combat-skills.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/skills/power-skills.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/skills/speed-skills.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/skills/spirit-skills.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/skills/recovery-skills.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/skills/crafting-skills.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/skills/knowledge-skills.hbs",

    // Abilities partials (Essence dropdown list)
    "systems/hwfwm-d20/templates/actors/parts/abilities/essence-options.hbs"
  ];

  await loadTemplates(templatePaths);

  console.log("HWFWM-D20 | templates preloaded");
});

Hooks.once("ready", () => {
  console.log("HWFWM-D20 | ready");
});
