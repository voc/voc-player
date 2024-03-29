import { Events, Styler, UICorePlugin, template } from "@clappr/core";
import pluginHtml from "./levelSelector.html?raw";
import pluginStyle from "./levelSelector.scss?inline";

const AUTO = -1;

export default class LevelSelector extends UICorePlugin {
  static get version() {
    return VERSION;
  }

  get name() {
    return "level_selector";
  }
  
  get template() {
    return template(pluginHtml);
  }

  get attributes() {
    return {
      class: this.name,
      "data-level-selector": "",
    };
  }

  get events() {
    return {
      "click [data-level-selector-select]": "onLevelSelect",
      "click [data-level-selector-button]": "onShowLevelSelectMenu",
    };
  }

  bindEvents() {
    this.listenTo(this.core, Events.CORE_READY, this.bindPlaybackEvents);
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_CONTAINERCHANGED,
      this.reload
    );
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_RENDERED,
      this.render
    );
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_HIDE,
      this.hideSelectLevelMenu
    );
  }

  unBindEvents() {
    this.stopListening(this.core, Events.CORE_READY);
    this.stopListening(
      this.core.mediaControl,
      Events.MEDIACONTROL_CONTAINERCHANGED
    );
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_RENDERED);
    this.stopListening(this.core.mediaControl, Events.MEDIACONTROL_HIDE);
    this.stopListening(
      this.core.getCurrentPlayback(),
      Events.PLAYBACK_LEVELS_AVAILABLE
    );
    this.stopListening(this.core.getCurrentPlayback(), Events.PLAYBACK_BITRATE);
  }

  bindPlaybackEvents() {
    var currentPlayback = this.core.getCurrentPlayback();

    this.listenTo(
      currentPlayback,
      Events.PLAYBACK_LEVELS_AVAILABLE,
      this.fillLevels
    );
    this.listenTo(
      currentPlayback,
      Events.PLAYBACK_BITRATE,
      this.handleAdaptation
    );

    var playbackLevelsAvailableWasTriggered =
      currentPlayback.levels && currentPlayback.levels.length > 0;
    playbackLevelsAvailableWasTriggered &&
      this.fillLevels(currentPlayback.levels);
  }

  reload() {
    this.unBindEvents();
    this.bindEvents();
    this.bindPlaybackEvents();
  }

  shouldRender() {
    if (!this.core.getCurrentContainer()) return false;

    var currentPlayback = this.core.getCurrentPlayback();
    if (!currentPlayback) return false;

    var respondsToCurrentLevel = currentPlayback.currentLevel !== undefined;
    // Only care if we have at least 2 to choose from
    var hasLevels = !!(this.levels && this.levels.length > 1);

    return respondsToCurrentLevel && hasLevels;
  }

  render() {
    if (this.shouldRender()) {
      var style = Styler.getStyleFor(pluginStyle, {
        baseUrl: this.core.options.baseUrl,
      });

      this.$el.html(
        this.template({ levels: this.levels, title: this.getTitle() })
      );
      this.$el.append(style);
      this.core.mediaControl.$(".media-control-right-panel").append(this.el);
      this.highlightCurrentLevel();
    }
    return this;
  }

  fillLevels(levels, initialLevel = AUTO) {
    console.log("got levels", levels, initialLevel)
    if (this.selectedLevelId === undefined) this.selectedLevelId = initialLevel;

    this.levels = levels;
    this.configureLevelsLabels();
    this.render();
  }

  configureLevelsLabels() {
    // set default labels
    this.levels.forEach((level) => {
      level.label = `${level.height ? level.height : level.level.height}p`;
    });

    if (this.core.options.levelSelectorConfig === undefined) return;

    var labelCallback = this.core.options.levelSelectorConfig.labelCallback;
    if (labelCallback && typeof labelCallback !== "function")
      throw new TypeError("labelCallback must be a function");

    var hasLabels = this.core.options.levelSelectorConfig.labels;
    var labels = hasLabels ? this.core.options.levelSelectorConfig.labels : {};

    if (labelCallback || hasLabels) {
      var level, label;
      for (var levelId in this.levels) {
        level = this.levels[levelId];
        label = labels[level.id];
        if (labelCallback) {
          level.label = labelCallback(level, label);
        } else if (label) {
          level.label = label;
        }
      }
    }
  }

  findLevelBy(id) {
    var foundLevel;
    this.levels.forEach((level) => {
      if (level.id === id) {
        foundLevel = level;
      }
    });
    return foundLevel;
  }

  onLevelSelect(event) {
    this.selectedLevelId = parseInt(
      event.target.dataset.levelSelectorSelect,
      10
    );
    if (this.core.getCurrentPlayback().currentLevel == this.selectedLevelId)
      return false;
    this.core.getCurrentPlayback().currentLevel = this.selectedLevelId;

    this.toggleContextMenu();

    event.stopPropagation();
    return false;
  }

  onShowLevelSelectMenu(event) {
    this.toggleContextMenu();
  }

  hideSelectLevelMenu() {
    this.$(".level_selector ul").hide();
  }

  toggleContextMenu() {
    this.$(".level_selector ul").toggle();
  }

  buttonElement() {
    return this.$(".level_selector button");
  }

  levelElement(id) {
    return this.$(
      ".level_selector ul a" +
        (!isNaN(id) ? '[data-level-selector-select="' + id + '"]' : "")
    ).parent();
  }

  getTitle() {
    return (this.core.options.levelSelectorConfig || {}).title;
  }

  updateText(level) {
    if (level === AUTO) {
      this.buttonElement().text(
        this.currentLevel ? "AUTO (" + this.currentLevel.label + ")" : "AUTO"
      );
    } else {
      this.buttonElement().text(this.findLevelBy(level).label);
    }
  }

  handleAdaptation(info) {
    var level = this.findLevelBy(info.level);
    this.currentLevel = level ? level : null;
    this.highlightCurrentLevel();
  }

  highlightCurrentLevel() {
    // update title text
    this.updateText(this.selectedLevelId);

    // update current level
    this.levelElement().removeClass("current");
    this.currentLevel &&
      this.levelElement(this.currentLevel.id).addClass("current");

    // hide levels with other languages
    var currentLanguage = this.currentLevel && this.currentLevel.language;
    if (currentLanguage) {
      this.levelElement().removeClass("hidden");
      this.levels.forEach((level) => {
        if (level.language != currentLanguage)
          this.levelElement(level.id).addClass("hidden");
      });
    }
  }
}
