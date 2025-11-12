// ============================================================================
// HWFWM-D20 SYSTEM | Foundry VTT v13
// ============================================================================

const { DocumentSheetV2 } = foundry.applications.api;

/**
 * PC Actor Sheet (ApplicationV2 + Handlebars)
 */
class HWFWMPCSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    id: "hwfwm-pc-sheet",
    classes: ["hwfwm", "sheet", "actor", "pc"],
    window: {
      title: "HWFWM PC Sheet",
      resizable: true
    },
    position: {
      width: 960
    }
  };

  /** The main template for this sheet */
  static PARTS = {
    form: {
      template: "systems/hwfwm-d20/templates/actors/actor-sheet.hbs"
    }
  };

  get title() {
    return this.document?.name ?? "HWFWM Character";
  }

  /**
   * Supply additional data for the template.
   * For ApplicationV2 + Handlebars, _prepareContext is the right hook.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Safely read rank and compute Willpower visibility
    const sys = this.document.system ?? {};
    const rank = (sys.details?.rank ?? "").toString().trim().toLowerCase();
    context.showWillpower = rank.includes("gold") || rank.includes("diamond");

    // Optional: expose itemTypes if you use them in other tabs
    context.itemTypes = this.document.itemTypes ?? {};

    return context;
  }

  /**
   * Wire any listeners you want (kept minimal here).
   */
  activateListeners(html) {
    super.activateListeners(html);
    // Example future hook:
    // html.find("[data-action='roll-attr']").on("click", this._onRollAttr.bind(this));
  }
}

/* ----------------------------------------------------------------------------
 * System Init: register our sheet for type "pc"
 * ------------------------------------------------------------------------- */
Hooks.once("init", () => {
  console.log("HWFWM-D20 | init");

  // Register our sheet for only the "pc" type and make it default for that type.
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, {
    types: ["pc"],
    makeDefault: true
  });
});

/* ----------------------------------------------------------------------------
 * Ready (for quick sanity logging)
 * ------------------------------------------------------------------------- */
Hooks.once("ready", () => {
  console.log("HWFWM-D20 | ready");
});
