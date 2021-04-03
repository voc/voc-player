import {Player, Events, BaseObject} from "clappr";
import DashShakaPlayback from "@c3voc/dash-shaka-playback";
import LevelSelector from "@c3voc/clappr-level-selector";
import AudioTrackSelector from "@c3voc/clappr-audio-track-selector";
import watermark from "public/watermark";
import "public/style.scss";

import ErrorPlugin from "lib/error";
import {checkMedia} from "lib/util";
import {getLectureConfig, getStreamConfig} from "lib/sources";

const DEFAULT_TIMEOUT = 5;
const MAX_TIMEOUT = 15;

const isShakaError = (error, code) => {
  return error.origin == "dash_shaka_playback" && (
    error.raw.code == code ||
    (error.raw.detail && error.raw.detail.code == code))
}

const isHlsError = (error, code) => {
  return error.origin == "hls" && error.raw.response.code == code
}

/**
 * Shaka-Player wrapper
 */
export default class VOCPlayer extends BaseObject {
  constructor(options) {
    super();
    this.timeout = DEFAULT_TIMEOUT;
    this.maxTimeout = MAX_TIMEOUT;

    // Async configuration
    this._playerPromise = this._getConfig(options).then(config => {
      // console.log("got config", config)
      this._options = config;
      this._player = new Player(this._options);
      if (this._player.core && this._player.core.isReady) {
        this._addEventListeners();
      } else {
        this.listenToOnce(this._player, Events.PLAYER_READY, this._addEventListeners.bind(this));
      }
      return this._player;
    })
  }

  attachTo() {
    this._playerPromise.then(player => {
      player.attachTo.apply(player, arguments)
    });
  }

  /**
   * Create basic config for the shaka-player
   * @param {*} options User defined custom options
   */
  _getConfig(options) {
    // Allow custom plugins
    let plugins = [AudioTrackSelector, LevelSelector, DashShakaPlayback, ErrorPlugin];
    if (options.plugins && options.plugins.length) {
      plugins = plugins.concat(options.plugins);
      console.log("loading plugins")
      plugins.forEach((plugin) => console.log(plugin.name, plugin.type))
    }

    let configPromise = Promise.resolve({});
    if (options.vocStream) {
      configPromise = getStreamConfig(options.vocStream, options.audioOnly, options.h264Only, options.preferredAudioLanguage, this._handleError.bind(this));
    } else if (options.vocLecture) {
      configPromise = getLectureConfig(options.vocLecture);
    }

    return configPromise.then((sourceConfig) => {
      return Object.assign({
        width: "100%",
        height: "100%",
        hideMediaControlDelay: 1000,
        position: "top-left",
        watermark: watermark,
        watermarkLink: "https://c3voc.de",
        levelSelectorConfig: {
          labelCallback: function(level) {
            let height = "unknown";
            if (level.height) height = level.height;
            else if (level.level && level.level.height) height = level.level.height;
            return height + "p";
          },
          title: "Quality"
        },
        audioTrackSelectorConfig: {
          title: "Language",
        },
      }, sourceConfig, options, {
        plugins: plugins
      });
    });
  }

  /**
   * Redo event handlers when the player container changes
   */
  _containerChanged() {
    this.stopListening()
    this._addEventListeners()
  }

  /**
   * Setup event handlers depending on the player
   */
  _addEventListeners() {
    const core = this._player.core;
    this._container = core.activeContainer

    this.listenTo(this._player, Events.PLAYER_PLAY, this._handlePlay);
    this.listenTo(this._player, Events.PLAYER_STOP, this._handleStop);
    this.listenTo(core, Events.CORE_ACTIVE_CONTAINER_CHANGED, this._containerChanged);
    this.listenTo(this._container, Events.CONTAINER_STATE_BUFFERFULL, this._handleBufferFull)
    this.listenTo(this._container, Events.CONTAINER_MEDIACONTROL_HIDE, this._handleMediaControlHide);
    this.listenTo(this._container, Events.CONTAINER_MEDIACONTROL_SHOW, this._handleMediaControlShow);
  }

  /**
   * Hide watermark together with media control
   */
  _handleMediaControlHide() {
    const watermark = this._container.$el.find(".clappr-watermark[data-watermark]");
    watermark.addClass("clappr-watermark-hide");
  }

  /**
   * Show watermark together with media control
   */
  _handleMediaControlShow() {
    const watermark = this._container.$el.find(".clappr-watermark[data-watermark]");
    watermark.removeClass("clappr-watermark-hide");
  }

  // Partially random delay
  _getTimeout() {
    const timeout = 0.6 * this.timeout + 0.4 * this.timeout * Math.random();
    // Increase timeout for next fail
    this.timeout = Math.min(this.timeout*2, this.maxTimeout);
    return timeout;
  }

  // Resets timeout to default
  _resetTimeout() {
    this.timeout = DEFAULT_TIMEOUT;
  }

  /**
   * Player error handler
   * @param {*} err Player error
   * @param {*} clearOverlay Function to remove error overlay after recovery
   */
  _handleError(error, clearOverlay) {
    if (this._recovery) {
      clearTimeout(this._recovery.timeout);
    } else {
      this._player.stop();
    }

    const timeout = this._getTimeout();

    // Determine error action
    console.log("got error", error, `retrying in ${Math.round(timeout)}s`);
    this._recovery = {
      clearOverlay,
      state: "restarting",
      timeout: setTimeout(this._waitForMedia.bind(this), timeout * 1000),
    }


    // Provide mighty helpful error message
    if (isShakaError(error, 1001) || isHlsError(error, 404)) {
      return {
        title: "Stream is offline",
        subtitle: "We will be right back",
      };
    } else if (isShakaError(error, 1002) || isHlsError(0)) {
      return {
        title: "A network error ocurred",
        subtitle: "Please check your internet connection",
      };
    }

    return {
      title: "Oh no, an unknown error occured",
      subtitle: "Please try reloading the page",
    };
  }

  /**
   * Handles play events, if we are playing the stream must be working
   */
  _handlePlay() {
    if (this._recovery) {
      console.log("soft recovery: play")
      this._recovery.clearOverlay();
      clearTimeout(this._recovery.timeout);
      this._recovery = null;
    }

    this._resetTimeout();
  }

  /**
   * Handles stop events, if recovering we want to play again after stop
   */
  _handleStop(time) {
    if (this._recovery && this._container) {
      console.log("soft recovery: stop")
      this._container.playback.play.call(this._container.playback);
    }
  }

  /**
   * Skips to the live-edge after recovery
   */
  _handleBufferFull() {
    if (this._recovery && this._container.playback.getPlaybackType() == "live") {
      console.log("seeking to end for recovery");
      const seekTo = Math.max(this._player.getDuration() - 6, 0);
      this._player.seek(seekTo);
    }
  }

  /**
   * Handles media check result, starts playback if check was successful
   * @param {boolean} success
   */
  _handleMediaCheck(success) {
    if (success) {
      console.log("try playing again, media should be available");
      this._player.play();
    } else {
      const timeout = this._getTimeout();
      console.log(`test for media failed, retrying in ~${Math.round(timeout)}s`);
      setTimeout(this._waitForMedia.bind(this), timeout * 1000);
    }
  }

  /**
   * Try to check and wait for upstream media file
   */
  _waitForMedia() {
    let source = this._player.options.source;
    if (source && source.source) {
      source = source.source;
    }
    if (typeof(source) == "string") {
      checkMedia(source, this._handleMediaCheck.bind(this))
    } else {
      this.reset();
    }
  }

  /**
   * Tries to bring the player to a functioning state
   * This is the last resort if soft recovery doesn't work
   */
  reset() {
    console.log("performing hard reset")
    this._recovery = null;

    const isMuted = this._player.getVolume() == 0;
    if (!isMuted)
      this._player.mute();

    this._player.configure({
      source: this._player.options.source,
      autoPlay: true,
    });

    if (!isMuted)
      this._player.unmute();
  }
}