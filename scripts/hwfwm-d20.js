// ============================================================================
// HWFWM-D20 | Actor & Item sheet registration + Skills support + Essences
// ============================================================================

/* ------------------------------ Template Preload ------------------------------ */
async function preloadHWFWMTemplates() {
  const paths = [
    "systems/hwfwm-d20/templates/actors/actor-sheet.hbs",
    "systems/hwfwm-d20/templates/items/item-sheet.hbs",
    "systems/hwfwm-d20/templates/items/skill-sheet.hbs",
    "systems/hwfwm-d20/templates/actors/parts/actor-abilities.hbs"
  ];
  return loadTemplates(paths);
}

/* ----------------------------- Helper: ensureEmbedded ----------------------------- */
async function ensureEmbedded(dropped) {
  // If dropped is already owned by the actor, return as-is
  if (dropped.parent) return dropped;

  // If dropped is a world item or compendium item -> create embedded copy
  return await dropped.constructor.create(
    { ...dropped.toObject(), ownership: { default: 3 } },
    { parent: game.actors.get(dropped._data?.actorId), temporary: false }
  );
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
      dragDrop: [{ dragSelector: ".item", dropSelector: ".sheet-content" }]
    });
  }

  /* ----------------------------- Get Data ----------------------------- */
  getData(options) {
    const data = super.getData(options);
    const sys = this.actor.system ?? {};
    const rank = (sys.details?.rank ?? "").toString().toLowerCase();

    data.showWillpower = rank.includes("gold") || rank.includes("diamond");
    data.itemTypes = this.actor.itemTypes ?? {};

    return data;
  }

  /* ------------------------------- Handle DnD ------------------------------- */
  async _onDropItem(event, data) {
    const fromDrop = (
      Item.implementation?.fromDropData ||
      Item.fromDropData ||
      foundry.documents.Item.fromDropData
    );

    const dropped = await fromDrop.call(Item, data);
    if (!dropped) return false;

    const dropTarget = event.target.closest(".drop-slot");
    if (!dropTarget) return super._onDropItem(event, data);

    // ================= ESSENCE DROP =================
    if (dropTarget.classList.contains("essence-drop")) {
      const essenceKey = dropTarget.dataset.essenceKey;
      if (!essenceKey) return false;

      const embedded = await ensureEmbedded(dropped);

      await this.actor.update({
        [`system.essences.${essenceKey}.itemId`]: embedded.id
      });

      return true;
    }

    // ================= ABILITY DROP =================
    if (dropTarget.classList.contains("ability-drop")) {
      // NOTE → intentionally removed type check so your test items work
      const essenceKey = dropTarget.dataset.essenceKey;
      const slotIndex = Number(dropTarget.dataset.slotIndex ?? 0);
      if (!essenceKey || Number.isNaN(slotIndex)) return false;

      const embedded = await ensureEmbedded(dropped);

      await this.actor.update({
        [`system.essences.${essenceKey}.abilities.${slotIndex}.itemId`]: embedded.id
      });

      return true;
    }

    return super._onDropItem(event, data);
  }

  /* --------------------------- Activate Listeners --------------------------- */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    /* -------- Essence Attribute Binding -------- */
    html.find(".essence-attr-select").on("change", async ev => {
      ev.preventDefault(); ev.stopPropagation();
      const sel = ev.currentTarget;
      const key = sel.dataset.essenceKey;
      const val = sel.value;
      if (!key) return;

      await this.actor.update({
        [`system.essences.${key}.attribute`]: val
      });
    });

    /* -------- Ability Score -------- */
    html.find(".ability-score").on("change", async ev => {
      ev.preventDefault(); ev.stopPropagation();
      const el = ev.currentTarget;
      const key = el.dataset.essenceKey;
      const slot = Number(el.dataset.slotIndex);
      if (!key || Number.isNaN(slot)) return;

      await this.actor.update({
        [`system.essences.${key}.abilities.${slot}.score`]: Number(el.value) || 0
      });
    });

    /* -------- Ability Active (independent checkboxes!) -------- */
    html.find(".ability-active").on("change", async ev => {
      ev.preventDefault(); ev.stopPropagation();
      const cb = ev.currentTarget;
      const key = cb.dataset.essenceKey;
      const slot = Number(cb.dataset.slotIndex);
      if (!key || Number.isNaN(slot)) return;

      await this.actor.update({
        [`system.essences.${key}.abilities.${slot}.isActive`]: cb.checked
      });
    });

    /* -------- Ability Attack -------- */
    html.find(".ability-attack").on("change", async ev => {
      ev.preventDefault(); ev.stopPropagation();
      const cb = ev.currentTarget;
      const key = cb.dataset.essenceKey;
      const slot = Number(cb.dataset.slotIndex);
      if (!key || Number.isNaN(slot)) return;

      await this.actor.update({
        [`system.essences.${key}.abilities.${slot}.isAttack`]: cb.checked
      });
    });

    /* -------- Edit Ability -------- */
    html.find(".ability-edit").on("click", ev => {
      const key = ev.currentTarget.dataset.essenceKey;
      const slot = Number(ev.currentTarget.dataset.slotIndex);
      const entry = this.actor.system.essences[key].abilities[slot];
      if (!entry?.itemId) return;

      const item = this.actor.items.get(entry.itemId);
      if (item) item.sheet.render(true);
    });

    /* -------- Clear Ability -------- */
    html.find(".ability-clear").on("click", async ev => {
      const key = ev.currentTarget.dataset.essenceKey;
      const slot = Number(ev.currentTarget.dataset.slotIndex);
      if (!key || Number.isNaN(slot)) return;

      await this.actor.update({
        [`system.essences.${key}.abilities.${slot}.itemId`]: null,
        [`system.essences.${key}.abilities.${slot}.isActive`]: false,
        [`system.essences.${key}.abilities.${slot}.isAttack`]: false
      });
    });

    /* -------- Clear Essence -------- */
    html.find(".essence-clear").on("click", async ev => {
      const key = ev.currentTarget.dataset.essenceKey;
      if (!key) return;

      await this.actor.update({
        [`system.essences.${key}.itemId`]: null,
        [`system.essences.${key}.attribute`]: ""
      });
    });

    /* -------- Edit Essence -------- */
    html.find(".essence-edit").on("click", ev => {
      const key = ev.currentTarget.dataset.essenceKey;
      const id = this.actor.system.essences[key]?.itemId;
      const item = this.actor.items.get(id);
      if (item) item.sheet.render(true);
    });
  }
}

/* ------------------------- Item Sheets ------------------------- */
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

class HWFWMSkillSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hwfwm", "sheet", "item", "skill"],
      template: "systems/hwfwm-d20/templates/items/skill-sheet.hbs",
      width: 560,
      height: "auto"
    });
  }
}

/* --------------------------- Register Sheets --------------------------- */
Hooks.once("init", () => {
  console.log("HWFWM-D20 | init");

  preloadHWFWMTemplates();

  Handlebars.registerHelper("array", (...args) => args.slice(0, -1));
  Handlebars.registerHelper("eq", (a, b) => a === b);

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, { makeDefault: true, types: ["pc"] });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("hwfwm-d20", HWFWMSkillSheet, { types: ["skill"], makeDefault: true });
  Items.registerSheet("hwfwm-d20", HWFWMItemSheet, { makeDefault: false });

  console.log("HWFWM-D20 | sheets registered");
});

Hooks.once("ready", () => console.log("HWFWM-D20 | ready"));
