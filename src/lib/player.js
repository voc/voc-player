import "public/style.scss";
import {Player, Events, BaseObject} from "clappr";
import DashShakaPlayback from "@c3voc/dash-shaka-playback";
import LevelSelector from "@c3voc/clappr-level-selector";
import AudioTrackSelector from "@c3voc/clappr-audio-track-selector";

import ErrorPlugin from "lib/error";
import {checkMedia} from "lib/util";

const selectSource = (stream, audioOnly) => {
  const hasMSE = "MediaSource" in window;

  console.log("vp9/vorbis", MediaSource.isTypeSupported('video/webm; codecs="vp9,vorbis"'),
    "vp9/opus", MediaSource.isTypeSupported('video/webm; codecs="vp9,opus"'));

  // VP9 dash player (preferred in any case)
  if (hasMSE && MediaSource.isTypeSupported('video/webm; codecs="vp9,opus"')) {
    return {
      source: `//cdn.c3voc.de/dash/${stream}/manifest.mpd`
    }
  }

  // HLS playlist (doesn't work for audio only)
  if (!audioOnly &&
      (hasMSE || document.createElement('video').canPlayType('application/vnd.apple.mpegURL') != "")) {
    return {
      source: `//cdn.c3voc.de/hls/${stream}_native_hd.m3u8`,
      mimeType: "application/vnd.apple.mpegURL"
    };
  }

  // MP3 Audio fallback
  if (audioOnly) {
    return {
      source: `//cdn.c3voc.de/${stream}_native.mp3`,
      mimeType: "audio/mp3"
    }

  // WebM fallback
  } else {
    return {
      source: `//cdn.c3voc.de/${stream}_native_hd.webm`,
      mimeType: "video/webm"
    };
  }
}

const DEFAULT_TIMEOUT = 5;
const MAX_TIMEOUT = 15;

/**
 * Shaka-Player wrapper
 */
export default class VOCPlayer extends BaseObject {
  constructor(options) {
    super();
    this.timeout = DEFAULT_TIMEOUT;
    this.maxTimeout = MAX_TIMEOUT;
    const config = this._options = this._buildConfig(options);
    const player = this._player = new Player(config);

    this.attachTo = player.attachTo.bind(player);

    if (player.core && player.core.isReady) {
      this._addEventListeners();
    } else {
      this.listenToOnce(player, Events.PLAYER_READY, this._addEventListeners.bind(this));
    }
  }

  /**
   * Create config for the shaka-player
   * @param {*} options User defined custom options
   */
  _buildConfig(options) {

    // Allow custom plugins
    let plugins = [AudioTrackSelector, LevelSelector, DashShakaPlayback, ErrorPlugin];
    if (options.plugins && options.plugins.length) {
      plugins = plugins.concat(options.plugins);
      console.log("loading plugins")
      plugins.forEach((plugin) => console.log(plugin.name, plugin.type))
    }

    let source;
    if (options.vocStream) {
      source = selectSource(options.vocStream, options.audioOnly);
      delete options.vocStream;
    }

    return Object.assign({
      source: source,
      width: "100%",
      height: "100%",
      disableErrorScreen: true,
      shakaConfiguration: {
        abr: {
          defaultBandwidthEstimate: 1000000,
        },
        streaming: {
          jumpLargeGaps: true,
        },
        manifest: {
          // TODO: investigate why this is necessary to enable fast start of playback
          // The presentationdelay in our manifest is set to the same value
          // which suggests that shaka parses the value incorrectly
          dash: {
            defaultPresentationDelay: 3,
            ignoreSuggestedPresentationDelay: true,
          }
        }
      },
      audioTrackSelectorConfig: {
        title: "Language",
      },
      levelSelectorConfig: {
        labelCallback: function(playbackLevel, customLabel) {
          // playbackLevel.videoBandwidth is set for DASH
          // playbackLevel.level.bitrate is set for HLS
          var bw = playbackLevel.videoBandwidth || playbackLevel.level.bitrate;

          if (bw <= 100000) {
            return "Slides";
          }
          else if(bw <= 800000) {
            return "SD";
          }
          else {
            return "HD";
          }
        },
        title: "Quality"
      },
      errorPlugin: {
        text: "Stream offline",
        onError: this._handleError.bind(this)
      },
    }, options, {
      plugins: plugins
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
    this.listenTo(this._container, Events.CONTAINER_OPTIONS_CHANGE, () => {console.log("options changed")})
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
    console.log("got error", error.code, `retrying in ${Math.round(timeout)}s`);
    this._recovery = {
      clearOverlay,
      state: "restarting",
      timeout: setTimeout(this._waitForMedia.bind(this), timeout * 1000),
    }
    return true;
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
    // TODO: avoid for non-live content
    if (this._recovery) {
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
   * Try to check
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