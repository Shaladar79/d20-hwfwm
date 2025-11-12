// ============================================================================
// HWFWM-D20 SYSTEM | Foundry VTT v13 Compatible
// Author: Scott Anderson (Shaladar)
// Description: Custom d20-based system using Power, Speed, Spirit, and Recovery
// ============================================================================

const { DocumentSheetV2 } = foundry.applications.api;

// ============================================================================
// PC SHEET CLASS
// ============================================================================
class HWFWMPCSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  /** Default sheet settings */
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    id: "hwfwm-pc-sheet",
    classes: ["hwfwm", "sheet", "actor", "pc"],
    window: {
      title: "HWFWM PC Sheet",
      resizable: true,
    },
    position: {
      width: 960,
      height: "auto",
    },
  };

  /** Template parts */
  static PARTS = {
    form: {
      template: "systems/hwfwm-d20/templates/actors/actor-sheet.hbs",
    },
  };

  /** Dynamic window title */
  get title() {
    return this.document.name || "HWFWM Character";
  }

  /** Prepare context for Handlebars template */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Access actor data safely
    const sys = this.document.system ?? {};
    const rankStr = (sys.details?.rank ?? "").toString().toLowerCase();

    // Show Willpower only for Gold and Diamond rank characters
    context.showWillpower =
      rankStr.includes("gold") || rankStr.includes("diamond");

    // Expose item collections (skills, etc.)
    context.itemTypes = this.document.itemTypes ?? {};

    return context;
  }

  /** Optional event listeners */
  activateListeners(html) {
    super.activateListeners(html);

    // Example: Rollable attributes (future feature)
    html.find(".attribute-roll").on("click", (ev) => {
      const attr = ev.currentTarget.dataset.attr;
      ui.notifications.info(`Rolling for ${attr} (Coming soon!)`);
    });
  }
}

// ============================================================================
// SYSTEM INITIALIZATION
// ============================================================================
Hooks.once("init", () => {
  console.log("Initializing HWFWM-D20 System for Foundry VTT v13");

  // Register Actor Sheet
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("hwfwm-d20", HWFWMPCSheet, {
    types: ["pc"],
    makeDefault: true,
  });

  // Define custom document classes (if needed later)
  CONFIG.Actor.documentClass = Actor;
  CONFIG.Item.documentClass = Item;

  console.log("✅ HWFWM-D20 System Loaded Successfully");
});

// ============================================================================
// FUTURE HOOKS & UTILITY REGISTRATION
// ============================================================================
Hooks.once("ready", () => {
  console.log("🎲 HWFWM-D20 System Ready");
});

// Optional: Add hot reload for development
Hooks.on("hotReload", (module) => {
  if (module === "hwfwm-d20") {
    ui.notifications.info("♻️ HWFWM-D20 system reloaded.");
  }
});
