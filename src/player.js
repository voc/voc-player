import Clappr from "clappr";
import DashShakaPlayback from "@c3voc/dash-shaka-playback";
import LevelSelector from "@c3voc/clappr-level-selector";
import AudioTrackSelector from "@c3voc/clappr-audio-track-selector";

const selectSources = (stream) => {
  // WebM fallback
  const sources = [{
    source: `//cdn.c3voc.de/${stream}_native_hd.webm`,
  }];

  // HLS playlist
  const hasMSE = "MediaSource" in window;
  if (hasMSE || document.createElement('video').canPlayType('application/vnd.apple.mpegURL') != "") {
    sources.unshift({
      source: `//cdn.c3voc.de/hls/${stream}_native_hd.m3u8`
    });
  }

  // VP9 dash player
  if (hasMSE && MediaSource.isTypeSupported('video/webm; codecs="vp9,vorbis"')) {
    sources.unshift({
      source: `//cdn.c3voc.de/dash/${stream}/manifest.mpd`
    });
  }
  return sources;
}

const buildOpts = (opts) => {
  if (!opts.vocStream) {
    throw new Error("Player: vocStream is a required option");
  }

  // Allow custom plugins
  let plugins = [DashShakaPlayback, AudioTrackSelector, LevelSelector];
  if (opts.plugins && opts.plugins.length) {
    plugins = plugins.concat(opts.plugins);
  }

  return Object.assign({}, opts, {
    sources: selectSources(opts.vocStream),
    width: "100%",
    plugins: plugins,
    shakaConfiguration: {
      abr: {
        defaultBandwidthEstimate: 1000000,
      },
      streaming: {
        jumpLargeGaps: true,

        // TODO: handle streaming failure
        failureCallback: function(event) {
         console.log("streaming failure", event)
        }
      },
      manifest: {
        // TODO: investigate why this is necessary to enable fast start of playback
        // The presentationdelay in our manifest is set to the same value
        // which suggests that shaka parses the value incorrectly
        dash: {
          defaultPresentationDelay: 3,
          ignoreSuggestedPresentationDelay: true
        }
      }
    },
    levelSelectorConfig: {
      labelCallback: function(playbackLevel, customLabel) {
        // playbackLevel.videoBandwidth is set for DASH
        // playbackLevel.level.bitrate is set for HLS
        var bw = playbackLevel.videoBandwidth || playbackLevel.level.bitrate;

        if(bw <= 100000) {
          return 'Slides';
        }
        else if(bw <= 800000) {
          return 'SD';
        }
        else {
          return 'HD'
        }
      },
    }
  });
}

export default class Player extends Clappr.Player {
  constructor(opts) {
    const clapprConfig = buildOpts(opts);
    console.log("clappr config", clapprConfig)
    super(clapprConfig);
  }
}