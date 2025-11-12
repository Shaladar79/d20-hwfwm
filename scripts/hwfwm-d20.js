// ============================================================================
// HWFWM-D20 | Actor & Item sheet registration + Skills tab actions
// ============================================================================

/* ----------------------------- PC Actor Sheet ----------------------------- */
class HWFWMPCSheet extends ActorSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["hwfwm", "sheet", "actor", "pc"],
      template: "systems/hwfwm-d20/templates/actors/actor-sheet.hbs",
      width: 960,
      height: "auto",
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-content", initial: "stats" }]
    });
  }

  getData(options) {
    const data = super.getData(options);
    const sys = this.actor.system ?? {};
    const rank = (sys.details?.rank ?? "").toString().toLowerCase();

    // Show Willpower only for Gold/Diamond
    data.showWillpower = rank.includes("gold") || rank.includes("diamond");

    // Expose itemTypes for easy tab rendering (skills, etc.)
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

      await this.actor.createEmbeddedDocuments("Item", [{
        name: `New ${category || type}`,
        type,
        system: {
          category,
          associatedAttribute: attr,
          rank: "",
          mod: 0,
          specialization: "",
          trained: false,
          description: ""
        }
      }]);
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

    // ---- Toggle trained ----
    html.find(".skill-trained").on("change", async (ev) => {
      const cb = ev.currentTarget;
      const id = cb.dataset.itemId;
      const item = this.actor.items.get(id);
      if (!item) return;
      await item.update({ "system.trained": cb.checked });
    });
  } // <--- CLOSES HWFWMPCSheet.activateListeners
}   // <--- CLOSES HWFWMPCSheet CLASS

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

   // Helpers for Handlebars templates
  Handlebars.registerHelper("array", (...args) => args.slice(0, -1)); // Allows (array "a" "b" "c") in HBS
  Handlebars.registerHelper("eq", (a, b) => a === b); // Simple equality check

  // Actor sheet (PC)
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, { makeDefault: true, types: ["pc"] });

  // Item sheet (generic for now; we can specialize later per type)
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hwfwm-d20", HWFWMItemSheet, { makeDefault: true });

  console.log("HWFWM-D20 | sheets registered");
});

Hooks.once("ready", () => {
  console.log("HWFWM-D20 | ready");
});

