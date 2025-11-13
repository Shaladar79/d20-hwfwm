// ============================================================================
// HWFWM-D20 | Actor & Item sheet registration + Skills support
// ============================================================================

/* ------------------------------ Template Preload ------------------------------ */
async function preloadHWFWMTemplates() {
  const paths = [
    "systems/hwfwm-d20/templates/actors/actor-sheet.hbs",
    "systems/hwfwm-d20/templates/actors/parts/actor-abilities.hbs",
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
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-content",
          initial: "stats"
        }
      ],
      // Make the whole content area a drop target
      dragDrop: [{ dragSelector: ".item", dropSelector: ".sheet-content" }]
    });
  }

  getData(options) {
    const data = super.getData(options);
    const sys = data.system ?? this.actor.system ?? {};
    const rank = (sys.details?.rank ?? "").toString().toLowerCase();

    // Show Willpower only for Gold/Diamond
    data.showWillpower = rank.includes("gold") || rank.includes("diamond");

    // Normalize essences + abilities (accept Array or Object) for view
    const essenceKeys = ["e1", "e2", "e3", "confluence"];
    sys.essences = sys.essences || {};
    for (const key of essenceKeys) {
      const raw = sys.essences[key] || {};

      // abilities may be an array OR an object { "0": {...}, "1": {...} }
      let abilitiesRaw = raw.abilities ?? [];
      let abilitiesArr = [];

      if (Array.isArray(abilitiesRaw)) {
        abilitiesArr = abilitiesRaw;
      } else if (abilitiesRaw && typeof abilitiesRaw === "object") {
        // Convert numeric keys into array positions
        for (const [k, v] of Object.entries(abilitiesRaw)) {
          const idx = Number(k);
          if (!Number.isNaN(idx)) abilitiesArr[idx] = v;
        }
      }

      // Ensure 5 slots with defaults
      for (let i = 0; i < 5; i++) {
        abilitiesArr[i] =
          abilitiesArr[i] || {
            itemId: "",
            score: 0,
            isActive: false,
            isAttack: false
          };
      }

      const e = {
        ...raw,
        itemId: raw.itemId || "",
        attribute: raw.attribute || "",
        abilities: abilitiesArr
      };

      // Resolve essence item name/img for display
      if (e.itemId) {
        const item = this.actor.items.get(e.itemId);
        if (item) {
          e.name = item.name;
          e.img = item.img;
        }
      }

      // Resolve each ability slot's name/img for display
      for (let i = 0; i < e.abilities.length; i++) {
        const slot = e.abilities[i];
        if (slot?.itemId) {
          const aItem = this.actor.items.get(slot.itemId);
          if (aItem) {
            slot.name = aItem.name;
            slot.img = aItem.img;
          }
        }
      }

      sys.essences[key] = e;
    }

    data.system = sys;

    // Expose itemTypes for easy tab rendering (skills, etc.)
    data.itemTypes = this.actor.itemTypes ?? {};
    return data;
  }

  /**
   * Accept item drops: skills (default behavior), essences, and essence abilities.
   */
  async _onDropItem(event, data) {
    const dropTarget = event.target.closest?.(".essence-drop, .ability-drop");

    // Helper for fromDropData across versions
    const fromDrop =
      Item.implementation?.fromDropData ||
      Item.fromDropData ||
      foundry.documents.Item.fromDropData;

    // Handle drops into Essence / Ability slots first (custom logic)
    if (dropTarget) {
      const dropped = await fromDrop.call(Item, data);
      if (!dropped) return false;

      // Ensure the dropped doc is embedded on this actor (clone if coming from compendium/world)
      const ensureEmbedded = async (doc) => {
        if (doc.parent === this.actor) return doc;
        const docData = doc.toObject();
        delete docData._id;
        const [created] = await this.actor.createEmbeddedDocuments("Item", [docData]);
        return created;
      };

      // Essence drop
      if (dropTarget.classList.contains("essence-drop")) {
        if (dropped.type !== "essence") {
          ui.notifications?.warn?.("Only Essence items can be dropped in Essence slots.");
          return false;
        }

        const essenceKey = dropTarget.dataset.essenceKey;
        if (!essenceKey) return false;

        const embedded = await ensureEmbedded(dropped);

        // Enforce distinct Essences for e1/e2/e3
        if (["e1", "e2", "e3"].includes(essenceKey)) {
          const ess = this.actor.system.essences ?? {};
          for (const key of ["e1", "e2", "e3"]) {
            if (key === essenceKey) continue;
            if (ess[key]?.itemId === embedded.id) {
              ui.notifications?.warn?.("Each Essence slot (1–3) must be a different Essence.");
              return false;
            }
          }
        }

        await this.actor.update({
          [`system.essences.${essenceKey}.itemId`]: embedded.id
        });

        return true;
      }

      // Essence Ability drop
      if (dropTarget.classList.contains("ability-drop")) {
        if (dropped.type !== "essenceAbility") {
          ui.notifications?.warn?.("Only Essence Ability items can be dropped in Ability slots.");
          return false;
        }

        const essenceKey = dropTarget.dataset.essenceKey;
        const slotIndex = Number(dropTarget.dataset.slotIndex ?? 0);
        if (!essenceKey || Number.isNaN(slotIndex)) return false;

        const embedded = await ensureEmbedded(dropped);

        await this.actor.update({
          [`system.essences.${essenceKey}.abilities.${slotIndex}.itemId`]: embedded.id
        });

        return true;
      }

      return false;
    }

    // ---- Default behavior for other drops (skills, etc.) ----
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

      await this.actor.createEmbeddedDocuments("Item", [
        {
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

    // ---- Toggle trained (inline) ----
    html.find(".skill-trained").on("change", async (ev) => {
      const cb = ev.currentTarget;
      const id = cb.dataset.itemId;
      const item = this.actor.items.get(id);
      if (!item) return;
      await item.update({ "system.trained": cb.checked });
    });

    // ===================== Essence-specific listeners =====================

    // Change bound attribute select
    html.find(".essence-attr-select").on("change", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const select = ev.currentTarget;
      const essenceKey = select.dataset.essenceKey;
      if (!essenceKey) return;
      const value = select.value || "";
      await this.actor.update({
        [`system.essences.${essenceKey}.attribute`]: value
      });
    });

    // Change ability score
    html.find(".ability-score").on("change", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const input = ev.currentTarget;
      const essenceKey = input.dataset.essenceKey;
      const slotIndex = input.dataset.slotIndex;
      if (!essenceKey || slotIndex === undefined) return;
      const value = Number(input.value) || 0;
      await this.actor.update({
        [`system.essences.${essenceKey}.abilities.${slotIndex}.score`]: value
      });
    });

    // Toggle Active
    html.find(".ability-active").on("change", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const cb = ev.currentTarget;
      const essenceKey = cb.dataset.essenceKey;
      const slotIndex = cb.dataset.slotIndex;
      if (!essenceKey || slotIndex === undefined) return;
      const value = cb.checked;
      await this.actor.update({
        [`system.essences.${essenceKey}.abilities.${slotIndex}.isActive`]: value
      });
    });

    // Toggle Attack Ability
    html.find(".ability-attack").on("change", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const cb = ev.currentTarget;
      const essenceKey = cb.dataset.essenceKey;
      const slotIndex = cb.dataset.slotIndex;
      if (!essenceKey || slotIndex === undefined) return;
      const value = cb.checked;
      await this.actor.update({
        [`system.essences.${essenceKey}.abilities.${slotIndex}.isAttack`]: value
      });
    });

    // Essence edit button
    html.find(".essence-edit").on("click", (ev) => {
      const btn = ev.currentTarget;
      const essenceKey = btn.dataset.essenceKey;
      if (!essenceKey) return;
      const ess = this.actor.system.essences?.[essenceKey];
      if (!ess?.itemId) return;
      const item = this.actor.items.get(ess.itemId);
      if (item) item.sheet.render(true);
    });

    // Essence clear button
    html.find(".essence-clear").on("click", async (ev) => {
      const btn = ev.currentTarget;
      const essenceKey = btn.dataset.essenceKey;
      if (!essenceKey) return;

      const updates = {
        [`system.essences.${essenceKey}.itemId`]: ""
      };
      for (let i = 0; i < 5; i++) {
        updates[`system.essences.${essenceKey}.abilities.${i}.itemId`] = "";
        updates[`system.essences.${essenceKey}.abilities.${i}.isActive`] = false;
        updates[`system.essences.${essenceKey}.abilities.${i}.isAttack`] = false;
      }

      await this.actor.update(updates);
    });

    // Ability edit button
    html.find(".ability-edit").on("click", (ev) => {
      const btn = ev.currentTarget;
      const essenceKey = btn.dataset.essenceKey;
      const slotIndex = Number(btn.dataset.slotIndex ?? 0);
      if (!essenceKey || Number.isNaN(slotIndex)) return;

      const ess = this.actor.system.essences?.[essenceKey];
      const slot = ess?.abilities?.[slotIndex];
      if (!slot?.itemId) return;

      const item = this.actor.items.get(slot.itemId);
      if (item) item.sheet.render(true);
    });

    // Ability clear button
    html.find(".ability-clear").on("click", async (ev) => {
      const btn = ev.currentTarget;
      const essenceKey = btn.dataset.essenceKey;
      const slotIndex = Number(btn.dataset.slotIndex ?? 0);
      if (!essenceKey || Number.isNaN(slotIndex)) return;

      await this.actor.update({
        [`system.essences.${essenceKey}.abilities.${slotIndex}.itemId`]: "",
        [`system.essences.${essenceKey}.abilities.${slotIndex}.isActive`]: false,
        [`system.essences.${essenceKey}.abilities.${slotIndex}.isAttack`]: false
      });
    });

    // Ability roll button
    html.find(".ability-roll").on("click", async (ev) => {
      const btn = ev.currentTarget;
      const essenceKey = btn.dataset.essenceKey;
      const slotIndex = Number(btn.dataset.slotIndex ?? 0);
      if (!essenceKey || Number.isNaN(slotIndex)) return;

      const sys = this.actor.system;
      const ess = sys.essences?.[essenceKey];
      if (!ess) return;

      const slot = ess.abilities?.[slotIndex];
      if (!slot) return;

      const attrKey = ess.attribute || "power";
      const attr = sys.attributes?.[attrKey] ?? { mod: 0 };
      const attrMod = Number(attr.mod || 0);
      const abilityScore = Number(slot.score || 0);
      const totalMod = attrMod + abilityScore;

      const abilityName = slot.name || "Essence Ability";
      const essenceName = ess.name || essenceKey;

      const formula = totalMod ? `1d20 + ${totalMod}` : "1d20";
      const roll = await new Roll(formula).evaluate({ async: true });

      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `${abilityName} (${essenceName})`
      });
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

    // Editable for owned/world items; read-only in compendiums
    data.editable = this.isEditable && !this.item.pack;

    // Build a normalized, non-destructive view for the template (compendium-safe)
    const s = foundry.utils.duplicate(data.item.system ?? {});
    if (s.skillType && !s.category) s.category = s.skillType;
    if (s.attribute && !s.associatedAttribute) s.associatedAttribute = s.attribute;
    if (s.category && !s.skillType) s.skillType = s.category;
    if (s.associatedAttribute && !s.attribute) s.attribute = s.associatedAttribute;

    data.systemView = s; // used by the HBS for display
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
      return aVal.toString().localeCompare(bVal.toString(), undefined, {
        sensitivity: "base"
      });
    });
  });

  // Actor sheet (PC)
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, { makeDefault: true, types: ["pc"] });

  // Item sheets
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hwfwm-d20", HWFWMSkillSheet, {
    types: ["skill"],
    makeDefault: true
  }); // dedicated Skill sheet
  Items.registerSheet("hwfwm-d20", HWFWMItemSheet, {
    types: [],
    makeDefault: false
  }); // fallback for others

  console.log("HWFWM-D20 | sheets registered");
});

Hooks.once("ready", () => {
  console.log("HWFWM-D20 | ready");
});
