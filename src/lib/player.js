import { Player, Events, BaseObject, Loader } from "@clappr/core";
import HLSPlayback from "@clappr/hlsjs-playback";
import { Plugins } from "@clappr/plugins";
import ErrorPlugin from "plugins/error";
import AudioTrackSelector from "plugins/audioTrackSelector/audioTrackSelector";
import LevelSelector from "plugins/levelSelector/levelSelector";
import { postData, checkMedia } from "lib/fetch";
import { getBaseConfig, getLectureConfig, getStreamConfig } from "lib/config";
import "public/style.scss";

const DEFAULT_TIMEOUT = 5;
const MAX_TIMEOUT = 15;

const {
  ClickToPause,
  ClosedCaptions,
  DVRControls,
  EndVideo,
  ErrorScreen,
  Favicon,
  MediaControl,
  Poster,
  SeekTime,
  SpinnerThreeBounce,
  Stats,
  WaterMark,
} = Plugins;

Loader.registerPlayback(HLSPlayback);
for (let plugin of [
  ClickToPause,
  ClosedCaptions,
  DVRControls,
  EndVideo,
  ErrorScreen,
  Favicon,
  MediaControl,
  Poster,
  SeekTime,
  SpinnerThreeBounce,
  Stats,
  WaterMark,
  ErrorPlugin,
  AudioTrackSelector,
  LevelSelector,
]) {
  Loader.registerPlugin(plugin);
}

const isShakaError = (error, code) => {
  return (
    error.origin == "dash_shaka_playback" &&
    (error.raw.code == code ||
      (error.raw.detail && error.raw.detail.code == code))
  );
};

const isHlsError = (error, code) => {
  return error.origin == "hls" && error.raw.response.code == code;
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Shaka-Player wrapper
 */
export default class VOCPlayer extends BaseObject {
  constructor(options) {
    super();
    this.timeout = DEFAULT_TIMEOUT;
    this.maxTimeout = MAX_TIMEOUT;
    this._events = [];
    this._buffering = false;
    this._lastSeek = 0;
    this._vocStream = options.vocStream;

    // Async configuration
    this._playerPromise = this._getConfig(options).then((config) => {
      // console.log("got config", config)
      this._options = config;
      this._player = new Player(this._options);
      if (this._player.core && this._player.core.isReady) {
        this._addEventListeners();
      } else {
        this.listenToOnce(
          this._player,
          Events.PLAYER_READY,
          this._addEventListeners.bind(this)
        );
      }
      if (config.vocConfigUpdate) {
        setInterval(() => config.vocConfigUpdate(this._player), 30000);
      }
      return this._player;
    });
  }

  /**
   * Attach player to new container
   * @param {*} element HTML element
   */
  attachTo() {
    console.log("will attach", ...arguments);
    this._playerPromise.then((player) => {
      console.log("attach", ...arguments);
      player.attachTo.apply(player, arguments);
    });
  }

  /**
   * Create basic config for the shaka-player
   * @param {*} options User defined custom options
   */
  _getConfig(options) {
    let configPromise = Promise.resolve({});
    if (options.vocStream) {
      configPromise = getStreamConfig(
        options.vocStream,
        options.audioOnly,
        options.h264Only,
        options.preferredAudioLanguage,
        this._handleError.bind(this)
      );
    } else if (options.vocLecture) {
      configPromise = getLectureConfig(options.vocLecture);
    }

    // Combine configs
    return configPromise.then((sourceConfig) => {
      return Object.assign(getBaseConfig(), sourceConfig, options);
    });
  }

  /**
   * Redo event handlers when the player container changes
   */
  _containerChanged() {
    this.stopListening();
    this._addEventListeners();
  }

  /**
   * Setup event handlers depending on the player
   */
  _addEventListeners() {
    const core = this._player.core;
    this._container = core.activeContainer;

    this.listenTo(this._player, Events.PLAYER_PLAY, this._handlePlay);
    this.listenTo(this._player, Events.PLAYER_STOP, this._handleStop);
    this.listenTo(this._player, Events.PLAYER_SEEK, this._handleSeek);
    this.listenTo(
      core,
      Events.CORE_ACTIVE_CONTAINER_CHANGED,
      this._containerChanged
    );
    this.listenTo(
      this._container,
      Events.CONTAINER_STATE_BUFFERFULL,
      this._handleBufferFull
    );
    this.listenTo(
      this._container,
      Events.CONTAINER_MEDIACONTROL_HIDE,
      this._handleMediaControlHide
    );
    this.listenTo(
      this._container,
      Events.CONTAINER_MEDIACONTROL_SHOW,
      this._handleMediaControlShow
    );
    this.listenTo(
      core.getCurrentPlayback(),
      Events.PLAYBACK_BUFFERING,
      this._handleBuffering
    );
    this.listenTo(
      core.getCurrentPlayback(),
      Events.PLAYBACK_BITRATE,
      this._handleBitrate
    );

    const playback = core.getCurrentPlayback();
    if (playback._hls) {
      playback._hls.on("hlsManifestLoaded", (event, data) => {
        if (!data.url) return;
        const url = new URL(data.url);
        this._relay = url.hostname;
        console.log("got relay", this._relay)
      })
    }
  }

  /**
   * Hide watermark together with media control
   */
  _handleMediaControlHide() {
    const watermark = this._container.$el.find(
      ".clappr-watermark[data-watermark]"
    );
    watermark.addClass("clappr-watermark-hide");
  }

  /**
   * Show watermark together with media control
   */
  _handleMediaControlShow() {
    const watermark = this._container.$el.find(
      ".clappr-watermark[data-watermark]"
    );
    watermark.removeClass("clappr-watermark-hide");
  }

  // Partially random delay
  _getTimeout() {
    const timeout = 0.6 * this.timeout + 0.4 * this.timeout * Math.random();
    // Increase timeout for next fail
    this.timeout = Math.min(this.timeout * 2, this.maxTimeout);
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
    this._appendEvent({
      type: "error",
    });
    if (this._recovery) {
      // already recovering
      return;
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
    };

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
      console.log("soft recovery: play");
      this._recovery.clearOverlay();
      clearTimeout(this._recovery.timeout);
      this._recovery = null;
      this._appendEvent({
        type: "recovery",
      });
    }

    this._resetTimeout();
  }

  /**
   * Handles stop events, if recovering we want to play again after stop
   */
  _handleStop(time) {
    if (this._recovery && this._container) {
      console.log("soft recovery: stop");
      this._container.playback.play.call(this._container.playback);
    }
  }

  _handleSeek(time) {
    this._lastSeek = Date.now();
  }

  /**
   * Skips to the live-edge after recovery
   */
  _handleBufferFull() {
    this._buffering = false;
    if (!this._recovery)
      return;

    console.log(`recovered? playbackType=${this._container.playback.getPlaybackType()}`)
    if (
      this._container.playback.getPlaybackType() == "live"
    ) {
      console.log("seeking to end for recovery");
      const seekTo = Math.max(this._player.getDuration() - 6, 0);
      this._player.seek(seekTo);
    }
  }

  _handleBuffering() {
    this._buffering = true;
    if (Date.now() - this._lastSeek > 1000) {
      this._appendEvent({
        type: "buffering",
      });
    }
  }

  _handleBitrate(bitrate) {
    if (!this._lastBitrate) {
      this._lastBitrate = bitrate;
      return;
    }

    if (!bitrate.bitrate || !this._lastBitrate.bitrate) {
      this._lastBitrate = bitrate;
      return;
    }

    // same bitrate
    if (bitrate.bitrate === this._lastBitrate.bitrate) return;

    // if we changed quality up
    const isUp = bitrate.bitrate - this._lastBitrate.bitrate > 0;
    this._lastBitrate = bitrate;

    // If we are buffering already, the player is probably just rotating through its qualities
    if (this._buffering) return;

    this._appendEvent({
      type: "quality_switch",
      isUp: isUp,
    });
  }

  _appendEvent(event) {
    // we are only interested in live
    if (this._container.playback.getPlaybackType() !== "live") return;
    console.log("player event", event);
    event.time = Date.now();
    if (this._vocStream) event.slug = this._vocStream;
    if (this._relay) event.relay = this._relay;
    this._events.push(event);
    this._sendStats();
  }

  async _sendStats() {
    // send already queued
    if (this._statsTimeout) return;

    this._statsTimeout = setTimeout(
      this._doSendStats.bind(this),
      Math.random() * 5000
    );
  }

  async _doSendStats() {
    let retry = 3000;
    // retry sending with backoff
    while (true) {
      try {
        const data = [];
        const now = Date.now();
        // push events with relative offset (in case our clocks are not synced)
        for (const ev of this._events) {
          data.push({ ...ev, offset: (now - ev.time) / 1000, time: undefined });
        }
        await postData("https://cdn.c3voc.de/stats/", data);
        this._events = [];
        this._statsTimeout = undefined;
        return;
      } catch (err) {
        console.error("failed to report stats", err);
      }
      await sleep(retry*0.5 + Math.random()*0.5*retry);
      retry *= 2;
    }
  }

  /**
   * Try to check and wait for upstream media file
   */
  async _waitForMedia() {
    let source = this._player.options.source;
    if (source && source.source) {
      source = source.source;
    }

    if (typeof source !== "string") {
      this.reset();
      return;
    }

    console.log("waiting for media", source);
    try {
      await checkMedia(source);
      console.log("try playing again, media should be available");
      this._player.play();
    } catch (err) {
      const timeout = this._getTimeout();
      console.log(
        `test for media failed, retrying in ~${Math.round(timeout)}s`,
        err
      );
      setTimeout(this._waitForMedia.bind(this), timeout * 1000);
    }
  }

  /**
   * Tries to bring the player to a functioning state
   * This is the last resort if soft recovery doesn't work
   */
  reset() {
    console.log("performing hard reset");
    this._recovery = null;

    const isMuted = this._player.getVolume() == 0;
    if (!isMuted) this._player.mute();

    this._player.configure({
      source: this._player.options.source,
      autoPlay: true,
    });

    if (!isMuted) this._player.unmute();
  }
}
