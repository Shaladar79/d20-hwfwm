// ============================================================================
// HWFWM-D20 | Actor & Item sheet registration + Template Preloading
// ============================================================================

/* ----------------------------- PC Actor Sheet ----------------------------- */
class HWFWMPCSheet extends ActorSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["hwfwm", "sheet", "actor", "pc"],
      template: "systems/hwfwm-d20/templates/actors/actor-sheet.hbs",
      width: 960,
      height: "auto",

      tabs: [
        // Primary sheet tabs (Stats, Skills, Inventory, Abilities, Notes)
        {
          navSelector: ".sheet-tabs[data-group='primary']",
          contentSelector: ".sheet-content",
          initial: "stats"
        },

        // --- Subtabs for Stats: Attributes / Status
        {
          navSelector: ".sheet-tabs[data-group='stats']",
          contentSelector: ".stats-subtabs",
          initial: "attributes"
        },

        // --- Subtabs for Inventory: Weapons / Armor / Gear / Consumables
        {
          navSelector: ".sheet-tabs[data-group='inventory']",
          contentSelector: ".inventory-subtabs",
          initial: "weapons"
        }
      ]
    });
  }

  /* ---------------------------- Sheet Data ---------------------------- */
  getData(options) {
    const data = super.getData(options);
    const sys = this.actor.system ?? {};
    const rank = (sys.details?.rank ?? "").toString().toLowerCase();

    // Show Willpower only for Gold or Diamond rank
    data.showWillpower = rank.includes("gold") || rank.includes("diamond");

    // Expose item types (skills, weapons, etc.)
    data.itemTypes = this.actor.itemTypes ?? {};

    return data;
  }

  /* ------------------------- Sheet Listeners -------------------------- */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // CREATE item
    html.find(".item-create").on("click", async (ev) => {
      const { type, category, attr } = ev.currentTarget.dataset;

      await this.actor.createEmbeddedDocuments("Item", [{
        name: `New ${category || type}`,
        type,
        system: {
          category: category ?? "",
          associatedAttribute: attr ?? ""
        }
      }]);
    });

    // EDIT item
    html.find(".item-edit").on("click", (ev) => {
      const li = ev.currentTarget.closest("[data-item-id]");
      const item = this.actor.items.get(li?.dataset.itemId);
      if (item) item.sheet.render(true);
    });

    // DELETE item
    html.find(".item-delete").on("click", async (ev) => {
      const li = ev.currentTarget.closest("[data-item-id]");
      await this.actor.deleteEmbeddedDocuments("Item", [li.dataset.itemId]);
    });

    // Toggle Skill Trained
    html.find(".skill-trained").on("change", async (ev) => {
      const id = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(id);
      await item?.update({ "system.trained": ev.currentTarget.checked });
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
    return super.getData(options);
  }
}

/* ------------------------- TEMPLATE PRELOADING ---------------------------- */
async function preloadHWFWMTemplates() {
  const paths = [

    // === TABS ===
    "systems/hwfwm-d20/templates/actors/parts/tabs/stats.hbs",
    "systems/hwfwm-d20/templates/actors/parts/tabs/skills.hbs",
    "systems/hwfwm-d20/templates/actors/parts/tabs/inventory.hbs",
    "systems/hwfwm-d20/templates/actors/parts/tabs/abilities.hbs",
    "systems/hwfwm-d20/templates/actors/parts/tabs/notes.hbs",

    // === SUBTABS: Stats ===
    "systems/hwfwm-d20/templates/actors/parts/subtabs/stats/attributes.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/stats/status.hbs",

    // === SUBTABS: Inventory ===
    "systems/hwfwm-d20/templates/actors/parts/subtabs/inventory/weapons.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/inventory/armor.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/inventory/gear.hbs",
    "systems/hwfwm-d20/templates/actors/parts/subtabs/inventory/consumables.hbs"
  ];

  return loadTemplates(paths);
}

/* ------------------------------ SYSTEM INIT ------------------------------- */
Hooks.once("init", () => {
  console.log("HWFWM-D20 | Initializing…");

  preloadHWFWMTemplates();

  // Register PC Sheet
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, { makeDefault: true, types: ["pc"] });

  // Register Base Item Sheet
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hwfwm-d20", HWFWMItemSheet, { makeDefault: true });

  console.log("HWFWM-D20 | Sheets Registered.");
});

/* ------------------------------ SYSTEM READY ------------------------------ */
Hooks.once("ready", () => {
  console.log("HWFWM-D20 | System Ready.");
});
