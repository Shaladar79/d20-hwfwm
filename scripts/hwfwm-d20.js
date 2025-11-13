// ============================================================================
// HWFWM-D20 | Actor & Item sheet registration + Skills + Essences
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
      ]
      // NOTE: we let ActorSheet's default dragDrop handle everything.
      // We only specialize behavior inside _onDropItem.
    });
  }

  /* ----------------------------- Get Data ----------------------------- */
  getData(options) {
    const data = super.getData(options);
    const sys = data.system ?? this.actor.system ?? {};
    const rank = (sys.details?.rank ?? "").toString().toLowerCase();

    // Willpower toggle
    data.showWillpower = rank.includes("gold") || rank.includes("diamond");

    // ---------- Build VIEW-ONLY essencesView for the template ----------
    const essRaw = this.actor.system.essences ?? {};
    const view = {};
    const essenceKeys = ["e1", "e2", "e3", "confluence"];

    for (const key of essenceKeys) {
      const raw = foundry.utils.duplicate(essRaw[key] ?? {});
      const eView = {
        itemId: raw.itemId || "",
        attribute: raw.attribute || "",
        name: "",
        img: "",
        abilities: []
      };

      // Essence item info
      if (eView.itemId) {
        const item = this.actor.items.get(eView.itemId);
        if (item) {
          eView.name = item.name;
          eView.img = item.img;
        }
      }

      const abilitiesRaw = raw.abilities ?? {};
      const abilArr = [];

      for (let i = 0; i < 5; i++) {
        const slotRaw =
          (Array.isArray(abilitiesRaw)
            ? abilitiesRaw[i]
            : abilitiesRaw[i] ?? abilitiesRaw[String(i)]) || {};

        const slotView = {
          itemId: slotRaw.itemId || "",
          score: slotRaw.score ?? 0,
          isActive: !!slotRaw.isActive,
          isAttack: !!slotRaw.isAttack,
          name: "",
          img: ""
        };

        if (slotView.itemId) {
          const aItem = this.actor.items.get(slotView.itemId);
          if (aItem) {
            slotView.name = aItem.name;
            slotView.img = aItem.img;
          }
        }

        abilArr[i] = slotView;
      }

      eView.abilities = abilArr;
      view[key] = eView;
    }

    sys.essencesView = view;
    data.system = sys;

    // Skills helper
    data.itemTypes = this.actor.itemTypes ?? {};
    return data;
  }

  /* ----------------------------- Drop Handling ----------------------------- */
  async _onDropItem(event, data) {
    // Look for one of our custom slots anywhere under the cursor.
    const dropTarget = event.target.closest(".essence-drop, .ability-drop");

    // Helper for various Foundry versions
    const fromDrop =
      Item.implementation?.fromDropData ||
      Item.fromDropData ||
      foundry.documents.Item.fromDropData;

    // ---------- If no special slot -> normal skill/item behavior ----------
    if (!dropTarget) {
      const item = await fromDrop.call(Item, data);
      if (!item) return false;

      // If it's a skill, normalize its fields
      if (item.type === "skill") {
        const s = foundry.utils.duplicate(item.system ?? {});
        if (s.skillType && !s.category) s.category = s.skillType;
        if (s.attribute && !s.associatedAttribute) s.associatedAttribute = s.attribute;
        if (s.category && !s.skillType) s.skillType = s.category;
        if (s.associatedAttribute && !s.attribute) s.attribute = s.associatedAttribute;
        try {
          await item.update({ system: s }, { diff: false, recursive: false });
        } catch (e) {
          console.warn("HWFWM-D20 | Could not normalize dropped skill fields:", e);
        }
      }

      return super._onDropItem(event, data);
    }

    // ---------- We *do* have an Essence or Ability slot ----------
    const dropped = await fromDrop.call(Item, data);
    if (!dropped) return false;

    // Ensure the dropped doc is embedded on this actor
    const ensureEmbedded = async (doc) => {
      if (doc.parent === this.actor) return doc;
      const docData = doc.toObject();
      delete docData._id;
      const [created] = await this.actor.createEmbeddedDocuments("Item", [docData]);
      return created;
    };

    // Essence item dropped into an Essence slot
    if (dropTarget.classList.contains("essence-drop")) {
      const essenceKey = dropTarget.dataset.essenceKey;
      if (!essenceKey) return false;

      if (dropped.type !== "essence") {
        ui.notifications?.warn?.("Only Essence items can be dropped in Essence slots.");
        return false;
      }

      const embedded = await ensureEmbedded(dropped);

      // Enforce distinct Essences in e1/e2/e3
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

    // Essence Ability dropped into an Ability slot
    if (dropTarget.classList.contains("ability-drop")) {
      const essenceKey = dropTarget.dataset.essenceKey;
      const slotIndex = Number(dropTarget.dataset.slotIndex ?? 0);
      if (!essenceKey || Number.isNaN(slotIndex)) return false;

      // NOTE: no strict type check here so test abilities always work.
      const embedded = await ensureEmbedded(dropped);

      await this.actor.update({
        [`system.essences.${essenceKey}.abilities.${slotIndex}.itemId`]: embedded.id
      });
      return true;
    }

    return false;
  }

  /* --------------------------- Activate Listeners --------------------------- */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // ---- SKILLS: create embedded Item ----
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

    // ---- SKILLS: edit / delete ----
    html.find(".item-edit").on("click", (ev) => {
      const li = ev.currentTarget.closest("[data-item-id]");
      if (!li) return;
      const item = this.actor.items.get(li.dataset.itemId);
      if (item) item.sheet.render(true);
    });

    html.find(".item-delete").on("click", async (ev) => {
      const li = ev.currentTarget.closest("[data-item-id]");
      if (!li) return;
      await this.actor.deleteEmbeddedDocuments("Item", [li.dataset.itemId]);
    });

    // ---- SKILLS: toggle trained ----
    html.find(".skill-trained").on("change", async (ev) => {
      const cb = ev.currentTarget;
      const id = cb.dataset.itemId;
      const item = this.actor.items.get(id);
      if (!item) return;
      await item.update({ "system.trained": cb.checked });
    });

    // ===================== Essence-specific listeners =====================

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
        updates[`system.essences.${essenceKey}.abilities.${i}.score`] = 0;
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
      const abilities = ess?.abilities ?? {};
      const slot =
        Array.isArray(abilities)
          ? abilities[slotIndex]
          : abilities[slotIndex] ?? abilities[String(slotIndex)];
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
        [`system.essences.${essenceKey}.abilities.${slotIndex}.isAttack`]: false,
        [`system.essences.${essenceKey}.abilities.${slotIndex}.score`]: 0
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

      const abilities = ess.abilities ?? {};
      const slot =
        Array.isArray(abilities)
          ? abilities[slotIndex]
          : abilities[slotIndex] ?? abilities[String(slotIndex)];
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

    // Build a normalized, non-destructive view for the template
    const s = foundry.utils.duplicate(data.item.system ?? {});
    if (s.skillType && !s.category) s.category = s.skillType;
    if (s.attribute && !s.associatedAttribute) s.associatedAttribute = s.attribute;
    if (s.category && !s.skillType) s.skillType = s.category;
    if (s.associatedAttribute && !s.attribute) s.attribute = s.associatedAttribute;

    data.systemView = s;
    return data;
  }

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

  preloadHWFWMTemplates();

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

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, { makeDefault: true, types: ["pc"] });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hwfwm-d20", HWFWMSkillSheet, { types: ["skill"], makeDefault: true });
  Items.registerSheet("hwfwm-d20", HWFWMItemSheet, { types: [], makeDefault: false });

  console.log("HWFWM-D20 | sheets registered");
});

Hooks.once("ready", () => {
  console.log("HWFWM-D20 | ready");
});
