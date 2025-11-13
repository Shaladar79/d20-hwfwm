// ============================================================================
// HWFWM-D20 | System JS
// - Registers PC ActorSheet and generic ItemSheet
// - Preloads all sheet templates (tabs + subtabs)
// - Adds Handlebars helpers used by the sheets
// ============================================================================

/* --------------------------- Template Preloading --------------------------- */

async function preloadHWFWMTemplates() {
  const paths = [
    // Main tab partials
    "systems/hwfwm-d20/templates/parts/tabs/stats.hbs",
    "systems/hwfwm-d20/templates/parts/tabs/skills.hbs",
    "systems/hwfwm-d20/templates/parts/tabs/abilities.hbs",
    "systems/hwfwm-d20/templates/parts/tabs/inventory.hbs",
    "systems/hwfwm-d20/templates/parts/tabs/notes.hbs",

    // Stats subtabs
    "systems/hwfwm-d20/templates/parts/subtabs/stats/attributes.hbs",
    "systems/hwfwm-d20/templates/parts/subtabs/stats/status.hbs",

    // Inventory subtabs (adjust names here if your files differ)
    "systems/hwfwm-d20/templates/parts/subtabs/inventory/items.hbs",
    "systems/hwfwm-d20/templates/parts/subtabs/inventory/weapons.hbs",
    "systems/hwfwm-d20/templates/parts/subtabs/inventory/gear.hbs"
  ];

  return loadTemplates(paths);
}

/* --------------------------- Handlebars Helpers --------------------------- */

function registerHWFWMHandlebarsHelpers() {
  // {{array "Combat" "Power" ...}}
  Handlebars.registerHelper("array", function () {
    const args = Array.from(arguments);
    args.pop(); // handlebars options
    return args;
  });

  // {{#if (eq a b)}} ... {{/if}}
  Handlebars.registerHelper("eq", function (a, b) {
    return a === b;
  });

  // {{#each (sortBy itemTypes.skill "name") as |skill|}}
  Handlebars.registerHelper("sortBy", function (collection, field) {
    if (!Array.isArray(collection)) return [];
    const path = (field || "").split(".");

    const getValue = (obj) => {
      return path.reduce((v, key) => (v && v[key] !== undefined ? v[key] : undefined), obj);
    };

    const cloned = collection.slice();
    cloned.sort((a, b) => {
      const av = getValue(a) ?? "";
      const bv = getValue(b) ?? "";
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return cloned;
  });
}

/* ----------------------------- PC Actor Sheet ----------------------------- */

class HWFWMPCSheet extends ActorSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["hwfwm", "sheet", "actor", "pc"],
      template: "systems/hwfwm-d20/templates/actors/actor-sheet.hbs",
      width: 960,
      height: "auto",
      tabs: [
        {
          navSelector: ".sheet-tabs[data-group='primary']",
          contentSelector: ".sheet-content",
          initial: "stats"
        },
        {
          // inner group for the Stats subtabs (Attributes / Status)
          navSelector: ".sheet-tabs[data-group='stats']",
          contentSelector: ".tab-body",
          initial: "attributes"
        }
      ]
    });
  }

  getData(options) {
    const data = super.getData(options);
    const sys = this.actor.system ?? {};

    // Rank-based Willpower visibility (for Status subtab)
    const rank = (sys.details?.rank ?? "").toString().toLowerCase();
    data.showWillpower = rank.includes("gold") || rank.includes("diamond");

    // Expose itemTypes for Skills / Inventory tabs
    data.itemTypes = this.actor.itemTypes ?? {};

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // ---- Create embedded Item (with default category/attribute) ----
    html.find(".item-create").on("click", async (ev) => {
      const btn = ev.currentTarget;
      const type = btn.dataset.type;
      if (!type) return;

      const category = btn.dataset.category ?? "";
      const attr = btn.dataset.attr ?? "";

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

    // ---- Edit embedded Item ----
    html.find(".item-edit").on("click", (ev) => {
      const li = ev.currentTarget.closest("[data-item-id]");
      if (!li) return;
      const item = this.actor.items.get(li.dataset.itemId);
      if (item) item.sheet.render(true);
    });

    // ---- Delete embedded Item ----
    html.find(".item-delete").on("click", async (ev) => {
      const li = ev.currentTarget.closest("[data-item-id]");
      if (!li) return;
      await this.actor.deleteEmbeddedDocuments("Item", [li.dataset.itemId]);
    });

    // ---- Toggle trained on Skill row ----
    html.find(".skill-trained").on("change", async (ev) => {
      const cb = ev.currentTarget;
      const id = cb.dataset.itemId;
      const item = this.actor.items.get(id);
      if (!item) return;
      await item.update({ "system.trained": cb.checked });
    });
  }
}

/* ------------------------------ Item Sheet -------------------------------- */

class HWFWMItemSheet extends ItemSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
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

/* --------------------------- Register everything --------------------------- */

Hooks.once("init", () => {
  console.log("HWFWM-D20 | init");
  registerHWFWMHandlebarsHelpers();
  preloadHWFWMTemplates();

  // Actor sheet (PC)
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, {
    makeDefault: true,
    types: ["pc"]
  });

  // Item sheet (generic)
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hwfwm-d20", HWFWMItemSheet, {
    makeDefault: true
  });

  console.log("HWFWM-D20 | sheets registered");
});

Hooks.once("ready", () => {
  console.log("HWFWM-D20 | ready");
});
