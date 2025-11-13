// ============================================================================
// HWFWM-D20 | Actor & Item sheet registration + Skills + Essences
// ============================================================================

async function preloadHWFWMTemplates() {
  const paths = [
    "systems/hwfwm-d20/templates/partials/tabs/stats.hbs",
    "systems/hwfwm-d20/templates/partials/tabs/skills.hbs",
    "systems/hwfwm-d20/templates/partials/tabs/abilities.hbs",
    "systems/hwfwm-d20/templates/partials/tabs/inventory.hbs",
    "systems/hwfwm-d20/templates/partials/tabs/notes.hbs",
    "systems/hwfwm-d20/templates/partials/subtabs/inventory/weapons.hbs",
    "systems/hwfwm-d20/templates/partials/subtabs/inventory/armor.hbs",
    "systems/hwfwm-d20/templates/partials/subtabs/inventory/gear.hbs"
  ];
  return loadTemplates(paths);
}

Hooks.once("init", async () => {
  console.log("HWFWM-D20 | init");

  // Helpers for templates (you already added these; keep them)
  Handlebars.registerHelper("array", (...args) => args.slice(0, -1));
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("sortBy", (arr, key) => {
    if (!Array.isArray(arr)) return [];
    const get = (o, k) => k.split(".").reduce((p, c) => p?.[c], o) ?? "";
    return [...arr].sort((a, b) => get(a, key).toString().localeCompare(get(b, key).toString(), undefined, { sensitivity: "base" }));
  });

  await preloadHWFWMTemplates();

  // Register sheets (your existing code)
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, { makeDefault: true, types: ["pc"] });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hwfwm-d20", HWFWMItemSheet, { makeDefault: true });

  console.log("HWFWM-D20 | sheets registered");
});

}

/* ============================================================================ */
/*                               PC Actor Sheet                                 */
/* ============================================================================ */

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
      // NOTE: we use default dragDrop; custom logic handled in _onDropItem
    });
  }

  /* ----------------------------- Get Data ----------------------------- */
  getData(options) {
    const data = super.getData(options);
    const sys = data.system ?? this.actor.system;

    const rank = (sys.details?.rank ?? "").toString().toLowerCase();
    data.showWillpower = rank.includes("gold") || rank.includes("diamond");

    /* ---------------- ESSENCES VIEW (clean template-safe data) ---------------- */
    const essRaw = sys.essences ?? {};
    const view = {};
    const keys = ["e1", "e2", "e3", "confluence"];

    for (const key of keys) {
      const raw = foundry.utils.duplicate(essRaw[key] ?? {});
      const eView = {
        itemId: raw.itemId || "",
        attribute: raw.attribute || "",
        name: "",
        img: "",
        abilities: []
      };

      if (eView.itemId) {
        const item = this.actor.items.get(eView.itemId);
        if (item) {
          eView.name = item.name;
          eView.img = item.img;
        }
      }

      const abilRaw = raw.abilities ?? {};
      const abilArr = [];

      for (let i = 0; i < 5; i++) {
        const slotRaw =
          Array.isArray(abilRaw)
            ? abilRaw[i]
            : abilRaw[i] ?? abilRaw[String(i)] ?? {};

        const aView = {
          itemId: slotRaw.itemId || "",
          score: slotRaw.score ?? 0,
          isActive: !!slotRaw.isActive,
          isAttack: !!slotRaw.isAttack,
          name: "",
          img: ""
        };

        if (aView.itemId) {
          const item = this.actor.items.get(aView.itemId);
          if (item) {
            aView.name = item.name;
            aView.img = item.img;
          }
        }

        abilArr[i] = aView;
      }

      eView.abilities = abilArr;
      view[key] = eView;
    }

    sys.essencesView = view;
    data.system = sys;

    data.itemTypes = this.actor.itemTypes ?? {};
    return data;
  }

  /* ====================================================================== */
  /*                               DROP HANDLING                             */
  /* ====================================================================== */
  async _onDropItem(event, data) {

    /* --------- FIX: Find drop target reliably --------- */

    // Step 1: normal event target
    let dropTarget =
      event.target?.closest?.(".essence-drop, .ability-drop") ?? null;

    // Step 2: mouse pointer fallback (fixes your issue)
    if (!dropTarget && event.clientX != null && event.clientY != null) {
      const el = document.elementFromPoint(event.clientX, event.clientY);
      if (el) dropTarget = el.closest(".essence-drop, .ability-drop");
    }

    // Helper for Foundry version differences
    const fromDrop =
      Item.implementation?.fromDropData ||
      Item.fromDropData ||
      foundry.documents.Item.fromDropData;

    // If we did NOT detect a special target → fallback to default (skills etc.)
    if (!dropTarget) {
      const item = await fromDrop.call(Item, data);
      if (!item) return false;

      if (item.type === "skill") {
        const s = foundry.utils.duplicate(item.system ?? {});
        if (s.skillType && !s.category) s.category = s.skillType;
        if (s.attribute && !s.associatedAttribute) s.associatedAttribute = s.attribute;
        if (s.category && !s.skillType) s.skillType = s.category;
        if (s.associatedAttribute && !s.attribute) s.attribute = s.associatedAttribute;
        try {
          await item.update({ system: s }, { diff: false, recursive: false });
        } catch (e) {
          console.warn("HWFWM-D20 | Skill drop normalization failed:", e);
        }
      }

      return super._onDropItem(event, data);
    }

    // We DO have a valid slot now → process essence/ability drop.
    const dropped = await fromDrop.call(Item, data);
    if (!dropped) return false;

    const ensureEmbedded = async (doc) => {
      if (doc.parent === this.actor) return doc;
      const clone = doc.toObject();
      delete clone._id;
      const [created] = await this.actor.createEmbeddedDocuments("Item", [clone]);
      return created;
    };

    /* ---------------------------------------------------------------------- */
    /*                           ESSENCE DROP                                 */
    /* ---------------------------------------------------------------------- */
    if (dropTarget.classList.contains("essence-drop")) {
      const essenceKey = dropTarget.dataset.essenceKey;
      if (!essenceKey) return false;

      if (dropped.type !== "essence") {
        ui.notifications?.warn?.("Only Essence items can be dropped in Essence slots.");
        return false;
      }

      const embedded = await ensureEmbedded(dropped);

      // Ensure e1/e2/e3 are distinct
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

    /* ---------------------------------------------------------------------- */
    /*                           ABILITY DROP                                 */
    /* ---------------------------------------------------------------------- */
    if (dropTarget.classList.contains("ability-drop")) {
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

  /* ====================================================================== */
  /*                           ACTIVATE LISTENERS                            */
  /* ====================================================================== */

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    /* ---------------- Ability Active / Attack / Score ---------------- */

    html.find(".ability-active").on("change", async (ev) => {
      const cb = ev.currentTarget;
      const key = cb.dataset.essenceKey;
      const slot = Number(cb.dataset.slotIndex);
      if (!key || Number.isNaN(slot)) return;

      await this.actor.update({
        [`system.essences.${key}.abilities.${slot}.isActive`]: cb.checked
      });
    });

    html.find(".ability-attack").on("change", async (ev) => {
      const cb = ev.currentTarget;
      const key = cb.dataset.essenceKey;
      const slot = Number(cb.dataset.slotIndex);
      if (!key || Number.isNaN(slot)) return;

      await this.actor.update({
        [`system.essences.${key}.abilities.${slot}.isAttack`]: cb.checked
      });
    });

    html.find(".ability-score").on("change", async (ev) => {
      const el = ev.currentTarget;
      const key = el.dataset.essenceKey;
      const slot = Number(el.dataset.slotIndex);
      if (!key || Number.isNaN(slot)) return;

      await this.actor.update({
        [`system.essences.${key}.abilities.${slot}.score`]: Number(el.value) || 0
      });
    });

    /* ---------------- Clear / Edit Ability ---------------- */

    html.find(".ability-clear").on("click", async (ev) => {
      const key = ev.currentTarget.dataset.essenceKey;
      const slot = Number(ev.currentTarget.dataset.slotIndex ?? 0);
      if (!key || Number.isNaN(slot)) return;

      await this.actor.update({
        [`system.essences.${key}.abilities.${slot}.itemId`]: "",
        [`system.essences.${key}.abilities.${slot}.isActive`]: false,
        [`system.essences.${key}.abilities.${slot}.isAttack`]: false,
        [`system.essences.${key}.abilities.${slot}.score`]: 0
      });
    });

    html.find(".ability-edit").on("click", (ev) => {
      const key = ev.currentTarget.dataset.essenceKey;
      const slot = Number(ev.currentTarget.dataset.slotIndex ?? 0);
      if (!key || Number.isNaN(slot)) return;

      const entry = this.actor.system.essences[key].abilities[slot];
      if (!entry?.itemId) return;

      const item = this.actor.items.get(entry.itemId);
      if (item) item.sheet.render(true);
    });

    /* ---------------- Essence Clear / Edit ---------------- */

    html.find(".essence-edit").on("click", (ev) => {
      const key = ev.currentTarget.dataset.essenceKey;
      const id = this.actor.system.essences[key]?.itemId;
      const item = this.actor.items.get(id);
      if (item) item.sheet.render(true);
    });

    html.find(".essence-clear").on("click", async (ev) => {
      const key = ev.currentTarget.dataset.essenceKey;
      if (!key) return;

      const updates = {
        [`system.essences.${key}.itemId`]: ""
      };

      for (let i = 0; i < 5; i++) {
        updates[`system.essences.${key}.abilities.${i}.itemId`] = "";
        updates[`system.essences.${key}.abilities.${i}.isActive`] = false;
        updates[`system.essences.${key}.abilities.${i}.isAttack`] = false;
        updates[`system.essences.${key}.abilities.${i}.score`] = 0;
      }

      await this.actor.update(updates);
    });

  }
}

/* ============================================================================ */
/*                               ITEM SHEETS                                    */
/* ============================================================================ */

class HWFWMItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hwfwm", "sheet", "item"],
      template: "systems/hwfwm-d20/templates/items/item-sheet.hbs",
      width: 640,
      height: "auto"
    });
  }
}

/* Dedicated Skill Sheet */
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
    data.editable = this.isEditable && !this.item.pack;

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

/* ============================================================================ */
/*                               REGISTER                                       */
/* ============================================================================ */

Hooks.once("init", () => {
  console.log("HWFWM-D20 | init");

  preloadHWFWMTemplates();

  Handlebars.registerHelper("array", (...args) => args.slice(0, -1));
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("sortBy", (arr, key) => {
    if (!Array.isArray(arr)) return [];
    return [...arr].sort((a, b) =>
      (getProperty(a, key) ?? "").toString()
        .localeCompare((getProperty(b, key) ?? "").toString())
    );
  });

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, {
    makeDefault: true,
    types: ["pc"]
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hwfwm-d20", HWFWMSkillSheet, { types: ["skill"], makeDefault: true });
  Items.registerSheet("hwfwm-d20", HWFWMItemSheet, { makeDefault: false });

  console.log("HWFWM-D20 | sheets registered");
});

Hooks.once("ready", () => {
  console.log("HWFWM-D20 | ready");
});

