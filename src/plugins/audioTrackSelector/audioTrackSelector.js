import {
  Events,
  Styler,
  UICorePlugin,
  HTML5Video,
  template,
} from "@clappr/core";
import pluginHtml from "./audioTrackSelector.html?raw";
import pluginStyle from "./audioTrackSelector.scss?inline";

export default class AudioTrackSelector extends UICorePlugin {
  static get version() {
    return "0.1.0";
  }

  get name() {
    return "audio_track_selector";
  }
  
  get template() {
    return template(pluginHtml);
  }

  get attributes() {
    return {
      class: this.name,
      "data-audio-track-selector": "",
    };
  }

  get events() {
    return {
      "click [data-audio-track-selector-lang]": "handleLanguageSelect",
      "click [data-audio-track-selector-button]":
        "handleAudioTrackSelectorClick",
    };
  }

  get container() {
    return this.core.activeContainer
      ? this.core.activeContainer
      : this.core.mediaControl.container;
  }

  get playback() {
    return this.core.activePlayback
      ? this.core.activePlayback
      : this.core.getCurrentPlayback();
  }

  bindEvents() {
    if (Events.CORE_ACTIVE_CONTAINER_CHANGED)
      this.listenTo(
        this.core,
        Events.CORE_ACTIVE_CONTAINER_CHANGED,
        this.reload
      );
    else
      this.listenTo(
        this.core.mediaControl,
        Events.MEDIACONTROL_CONTAINERCHANGED,
        this.reload
      );

    this.listenTo(this.core, Events.CORE_READY, this.bindPlaybackEvents);
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_RENDERED,
      this.render
    );
    this.listenTo(
      this.core.mediaControl,
      Events.MEDIACONTROL_HIDE,
      this._hideContextMenu
    );
  }

  bindPlaybackEvents() {
    this.listenTo(
      this.playback,
      Events.PLAYBACK_LEVELS_AVAILABLE,
      this._handleLevels
    );
    this.listenTo(
      this.playback,
      Events.PLAYBACK_BITRATE,
      this._handleAdaptation
    );
    this.listenTo(this.playback, Events.PLAYBACK_PLAY, this._handlePlay);
  }

  reload() {
    this.stopListening();
    this.bindEvents();
    this.bindPlaybackEvents();
  }

  shouldRender() {
    if (!this.container) return false;
    if (!this.playback) return false;

    // Only display if we have at least 2 languages to choose from
    var hasChoice = !!(this.languages && this.languages.size > 1);

    return hasChoice;
  }

  render() {
    if (this.shouldRender()) {
      var style = Styler.getStyleFor(pluginStyle, {
        baseUrl: this.core.options.baseUrl,
      });

      this.$el.html(
        this.template({
          title: this._getTitle(),
          languages: this.languages,
        })
      );
      this.$el.append(style);
      this.core.mediaControl.$(".media-control-right-panel").append(this.el);
      this._highlightCurrentElement();
    }
    return this;
  }

  _setLanguage(language) {
    console.log("setLanguage", language);

    // custom voc dash-shaka-playback
    if (this.playback.selectAudioLanguage) {
      this.nextLanguage = language;
      this.playback.selectAudioLanguage(language);

      // hlsjs playback
    } else if (this.playback._hls) {
      // hlsjs may have multiple audiotracks with the same language
      // this will just switch to the first one
      const track = this.playback._hls.audioTracks.find(
        (track) => track.lang == language || track.name === language
      );
      if (!track) return;

      this.playback._hls.audioTrack = track.id;
      this.activeLanguage = language;
      this._highlightCurrentElement();

      // html5 track change
    } else if (this.playback.el.audioTracks) {
      // also just selects the first track matching the label
      const audioTracks = [...this.playback.el.audioTracks];
      const track = audioTracks.find(
        (track) => track.language == language || track.label === language
      );
      if (!track) return;

      track.enabled = true;
      this.activeLanguage = language;
      this._highlightCurrentElement();
    }
  }

  _fillLanguages() {
    // custom voc dash-shaka-playback
    if (this.playback.audioLanguages) {
      this.languages = new Set(this.playback.audioLanguages);

      // hlsjs playback
    } else if (this.playback._hls) {
      const audioTracks = this.playback._hls.audioTracks;
      const currentId = this.playback._hls.audioTrack;
      const current = audioTracks.find((track) => track.id == currentId);

      this.languages = new Set(
        audioTracks.map((track) => track.lang || track.name)
      );
      if (current) {
        this.activeLanguage = current.lang || current.name;
      }

      // native playback
    } else if (this.playback.el.audioTracks) {
      const audioTracks = [...this.playback.el.audioTracks];
      const current = audioTracks.find((track) => track.enabled);

      this.languages = new Set(
        audioTracks.map((track) => track.language || track.label)
      );
      if (current) {
        this.activeLanguage = current.language || current.label;
      }
    }

    this.render();
  }

  handleLanguageSelect(event) {
    event.preventDefault();
    event.stopPropagation();

    const selected = event.target.dataset.audioTrackSelectorLang;

    if (this.activeLanguage == selected) return false;
    this._setLanguage(selected);
    this._toggleContextMenu();
    return false;
  }

  // Handles adaptation event from shaka-playback
  _handleAdaptation(variant) {
    if (variant.language) {
      this.activeLanguage = variant.language;
      this._highlightCurrentElement();
    }
  }

  // shaka-playback knows languages on level event
  _handleLevels() {
    this._fillLanguages();
  }

  // hlsjs-playback and html5video-playback only know languages on play
  _handlePlay() {
    if (this.playback._hls || this.playback instanceof HTML5Video) {
      this._fillLanguages();
    }
  }

  handleAudioTrackSelectorClick(event) {
    this._toggleContextMenu();
  }

  _toggleContextMenu() {
    this.$(".audio_track_selector ul").toggle();
  }

  _hideContextMenu() {
    this.$(".audio_track_selector ul").hide();
  }

  _getLanguageElement(language = null) {
    if (language)
      return this.$(
        '.audio_track_selector a[data-audio-track-selector-lang="' +
          language +
          '"]'
      ).parent();
    else return this.$(".audio_track_selector a").parent();
  }

  _getButtonElement() {
    return this.$(".audio_track_selector button");
  }

  _getTitle() {
    return (this.core.options.audioTrackSelectorConfig || {}).title;
  }

  _highlightCurrentElement() {
    if (!this.activeLanguage) return;
    this._getLanguageElement().removeClass("current");
    this._getLanguageElement(this.activeLanguage).addClass("current");
    this._getButtonElement().text(this.activeLanguage);
  }
}
