// ============================================================================
// HWFWM-D20 | Actor & Item sheet registration + Skills support
// ============================================================================

/* ------------------------------ Template Preload ------------------------------ */
async function preloadHWFWMTemplates() {
  const paths = [
    "systems/hwfwm-d20/templates/actors/actor-sheet.hbs",
    "systems/hwfwm-d20/templates/items/item-sheet.hbs",
    "systems/hwfwm-d20/templates/items/skill-sheet.hbs"
  ];
  return loadTemplates(paths);
}

/* ----------------------------- PC Actor Sheet ----------------------------- */
class HWFWMPCSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hwfwm", "sheet", "actor", "pc"],
      template: "systems/hwfwm-d20/templates/actors/actor-sheet.hbs",
      width: 960,
      height: "auto",
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-content", initial: "stats" }],
      // Make the whole content area a drop target
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
   * Normalizes skill field names so either schema works.
   */
  async _onDropItem(event, data) {
    // Support different core versions
    const fromDrop = (Item.implementation?.fromDropData || Item.fromDropData || foundry.documents.Item.fromDropData);
    const item = await fromDrop.call(Item, data);
    if (!item) return false;

    if (item.type === "skill") {
      const s = foundry.utils.duplicate(item.system ?? {});
      // Mirror both pairs so sheets & template.json stay happy
      if (s.skillType && !s.category) s.category = s.skillType;
      if (s.attribute && !s.associatedAttribute) s.associatedAttribute = s.attribute;
      if (s.category && !s.skillType) s.skillType = s.category;
      if (s.associatedAttribute && !s.attribute) s.attribute = s.associatedAttribute;
      try {
        await item.update({ system: s }, { diff: false, recursive: false });
      } catch (e) {
        // Compendium items are read-only; ignore update errors from drops
        console.warn("HWFWM-D20 | Could not normalize dropped skill fields:", e);
      }
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
  }
}

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

    // Build a normalized, non-destructive view for the template (compendium-safe)
    const s = foundry.utils.duplicate(data.item.system ?? {});
    if (s.skillType && !s.category) s.category = s.skillType;
    if (s.attribute && !s.associatedAttribute) s.associatedAttribute = s.attribute;
    if (s.category && !s.skillType) s.skillType = s.category;
    if (s.associatedAttribute && !s.attribute) s.attribute = s.associatedAttribute;

    data.systemView = s; // used by the HBS for read-only display
    return data;
  }

  /** On submit, mirror fields so both are always in-sync (for editable docs) */
  async _updateObject(event, formData) {
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

  // Preload templates so compendium items can open immediately
  preloadHWFWMTemplates();

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
  Items.registerSheet("hwfwm-d20", HWFWMSkillSheet, { types: ["skill"], makeDefault: true }); // dedicated Skill sheet
  Items.registerSheet("hwfwm-d20", HWFWMItemSheet, { types: [], makeDefault: false });       // fallback for others

  console.log("HWFWM-D20 | sheets registered");
});

Hooks.once("ready", () => {
  console.log("HWFWM-D20 | ready");
});
