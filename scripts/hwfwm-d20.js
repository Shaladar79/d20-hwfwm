// ============================================================================
// HWFWM-D20 | Actor & Item sheet registration + Skills support
// ============================================================================

/* ----------------------------- PC Actor Sheet ----------------------------- */
class HWFWMPCSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hwfwm", "sheet", "actor", "pc"],
      template: "systems/hwfwm-d20/templates/actors/actor-sheet.hbs",
      width: 960,
      height: "auto",
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-content", initial: "stats" }],
      // Make entire sheet-body a drop target
      dragDrop: [{ dragSelector: ".item", dropSelector: ".sheet-content" }]
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

  /**
   * Accept item drops (skills, etc.) from compendiums or Items directory.
   * Uses the core implementation to create embedded documents,
   * but we normalize skill field names for our template.json.
   */
  async _onDropItem(event, data) {
    const item = await Item.implementation.fromDropData(data);
    if (!item) return false;

    // Normalize skill field names on-the-fly so either schema works
    if (item.type === "skill") {
      const s = foundry.utils.duplicate(item.system ?? {});
      // If compendium uses "skillType"/"attribute", mirror to "category"/"associatedAttribute"
      if (s.skillType && !s.category) s.category = s.skillType;
      if (s.attribute && !s.associatedAttribute) s.associatedAttribute = s.attribute;
      // If world items use legacy fields, mirror forward too
      if (s.category && !s.skillType) s.skillType = s.category;
      if (s.associatedAttribute && !s.attribute) s.attribute = s.associatedAttribute;
      await item.update({ system: s }, { diff: false, recursive: false });
    }

    return super._onDropItem(event, data);
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

      // Mirror both current + legacy keys so either sheet+template works
      await this.actor.createEmbeddedDocuments("Item", [{
        name: `New ${category || type}`,
        type,
        system: {
          // current keys
          skillType: category,
          attribute: attr,
          // legacy aliases
          category,
          associatedAttribute: attr,
          // common fields
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

/* ------------------------------ Item Sheets ------------------------------- */
// Generic Item sheet (fallback)
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
    return super.getData(options);
  }
}

// Dedicated Skill sheet
class HWFWMSkillSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hwfwm", "sheet", "item", "skill"],
      template: "systems/hwfwm-d20/templates/items/skill-sheet.hbs",
      width: 560,
      height: "auto"
    });
  }

  getData(options) {
    const data = super.getData(options);

    // Normalize values for form display (ensure both pairs exist)
    const s = data.item.system ?? {};
    if (s.skillType && !s.category) s.category = s.skillType;
    if (s.attribute && !s.associatedAttribute) s.associatedAttribute = s.attribute;
    if (s.category && !s.skillType) s.skillType = s.category;
    if (s.associatedAttribute && !s.attribute) s.attribute = s.associatedAttribute;

    data.item.updateSource({ system: s }); // only source update (no doc update)
    return data;
  }

  /** On submit, mirror fields so both are always in-sync */
  async _updateObject(event, formData) {
    // Mirror both ways for robustness
    const s = foundry.utils.expandObject(formData).system ?? {};
    if (s.skillType && !s.category) s.category = s.skillType;
    if (s.attribute && !s.associatedAttribute) s.associatedAttribute = s.attribute;
    if (s.category && !s.skillType) s.skillType = s.category;
    if (s.associatedAttribute && !s.attribute) s.attribute = s.associatedAttribute;

    formData = foundry.utils.flattenObject({ system: s });
    return super._updateObject(event, formData);
  }
}

/* --------------------------- Register everything --------------------------- */
Hooks.once("init", () => {
  console.log("HWFWM-D20 | init");

  // Handlebars helpers
  Handlebars.registerHelper("array", (...args) => args.slice(0, -1));
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("sortBy", (array, key) => {
    if (!Array.isArray(array)) return [];
    return [...array].sort((a, b) => {
      const aVal = getProperty(a, key) ?? "";
      const bVal = getProperty(b, key) ?? "";
      return aVal.toString().localeCompare(bVal.toString(), undefined, { sensitivity: "base" });
    });
  });

  // Actor sheet (PC)
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, { makeDefault: true, types: ["pc"] });

  // Item sheets
  Items.unregisterSheet("core", ItemSheet);
  // Dedicated sheet for Skills
  Items.registerSheet("hwfwm-d20", HWFWMSkillSheet, { types: ["skill"], makeDefault: true });
  // Fallback generic sheet for other item types
  Items.registerSheet("hwfwm-d20", HWFWMItemSheet, { types: [], makeDefault: false });

  console.log("HWFWM-D20 | sheets registered");
});

Hooks.once("ready", () => {
  console.log("HWFWM-D20 | ready");
});
