import "./style.scss";
import url from "url"
import {Player, Events, BaseObject} from "clappr";
import DashShakaPlayback from "@c3voc/dash-shaka-playback";
import LevelSelector from "@c3voc/clappr-level-selector";
import AudioTrackSelector from "@c3voc/clappr-audio-track-selector";


import ErrorPlugin from "plugins/error";

const selectSource = (stream) => {
  const hasMSE = "MediaSource" in window;

  // VP9 dash player
  if (hasMSE && MediaSource.isTypeSupported('video/webm; codecs="vp9,vorbis"')) {
    return {
      source: `//cdn.c3voc.de/dash/${stream}/manifest.mpd`
    }
  }

  // HLS playlist
  if (hasMSE || document.createElement('video').canPlayType('application/vnd.apple.mpegURL') != "") {
    return {
      source: `//cdn.c3voc.de/hls/${stream}_native_hd.m3u8`
    };
  }

  // WebM fallback
  return {
    source: `//cdn.c3voc.de/${stream}_native_hd.webm`,
  };
}

// normalize source protocol
const normalizeSource = (source) => {
  return source.replace(/^(https?:|)\/\//, "");
}

const DEFAULT_TIMEOUT = 5;

export default class VOCPlayer extends BaseObject {
  constructor(options) {
    if (!options.vocStream) {
      throw new Error("Player: vocStream is a required option");
    }

    super();
    this.timeout = DEFAULT_TIMEOUT;
    this.maxTimeout = 10;
    const source = this._source = selectSource(options.vocStream);
    const config = this._options = this._buildConfig(options);
    const player = this._player = new Player(config);

    this._addEventListeners();
    player.load(source)
  }

  _buildConfig(options) {

    // Allow custom plugins
    let plugins = [AudioTrackSelector, LevelSelector, DashShakaPlayback, ErrorPlugin];
    if (options.plugins && options.plugins.length) {
      plugins = plugins.concat(options.plugins);
    }

    return Object.assign({}, options, {
      disableErrorScreen: true,
      width: "100%",
      height: "100%",
      plugins: plugins,
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
        text: 'Stream offline',
        onError: this._handleError.bind(this)
      },
    });
  }


  // Event handlers
  _containerChanged() {
    this.stopListening()
    this._addEventListeners()
  }

  _addEventListeners() {
    const core = this._player.core;
    if (!core.isReady)
      this.listenToOnce(core, Events.CORE_READY, this._handleContainer)
    else
      this._handleContainer()

    this.listenTo(this._player, Events.PLAYER_PLAY, this._handlePlay);
    this.listenTo(this._player, Events.PLAYER_STOP, this._handleStop);
    this.listenTo(core, Events.CORE_ACTIVE_CONTAINER_CHANGED, this._containerChanged);
  }

  _handleContainer() {
    this._container = this._player.core.activeContainer
  }


  // Error handling
  _handleError(err, clearOverlay) {
    if (this._recovery) {
      if (this._recovery.state == "waiting") {
        return;
      }

      clearTimeout(this._recovery.timeout);
    }

    console.log("got error", err.code, `retry in ~${this.timeout}s`);

    // Partially random delay
    const timeout = 0.6 * this.timeout + 0.4 * this.timeout * Math.random();

    this._recovery = {
      clearOverlay,
      state: "waiting",
      timeout: setTimeout(this._handleRetry.bind(this), timeout * 1000),
    }

    // Increase timeout for next fail
    this.timeout = Math.min(this.timeout*2, this.max_timeout);
  }

  _handleRetry() {
    // The Playback plugin may have recovered on it's own already
    // This is caught by the play handler below.
    if (!this._recovery) {
      console.log("already recovered \o/");
      return;
    }

    // Try soft reset
    if (this._container) {
      console.log("soft restarting");

      // Do a hard reset if this does not play or error again
      this._recovery.timeout = setTimeout(this.reset.bind(this), 3000);
      this._recovery.state = "restarting";
      this._container.playback.stop();

    // Fallback to hard reset
    } else {
      this.reset();
    }
  }

  // Watch for play events, if we are playing the stream must be working
  _handlePlay() {
    if (this._recovery) {
      console.log("soft recovery: play")
      this._recovery.clearOverlay();
      clearTimeout(this._recovery.timeout);
      this._recovery = null;
    }

    // Reset timeout to default
    this.timeout = DEFAULT_TIMEOUT;
  }

  // Watch for stop events, on soft recovery we want to stop and then play again
  _handleStop(time) {
    if (this._recovery) {
      console.log("soft recovery: stop")
      this._container.playback.play.bind(this._container.playback);
    }
  }

  reset() {
    console.log("performing hard reset")
    this._recovery = null;

    const isMuted = this._player.getVolume() == 0;
    if (!isMuted)
      this._player.mute();

    this._player.configure({
      source: this._source,
      autoPlay: true,
    });

    if (!isMuted)
      this._player.unmute();
  }
}