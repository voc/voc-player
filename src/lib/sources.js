import {getMediaLectureSources} from "lib/util";

/**
 * Determines config specifig to C3VOC streaming
 * @param {string} stream stream name on CDN
 * @param {boolean} audioOnly
 * @param {function} errorHandler
 */
export const getStreamConfig = (stream, audioOnly, preferredAudioLanguage, errorHandler) => {
  // Keep a tab on whether there are still browsers where we need vp9,vorbis vs vp9,opus
  const hasMSE = "MediaSource" in window;

  // Stream specific config
  const config = {
    poster: `//cdn.c3voc.de/thumbnail/${stream}/poster.jpeg`,
    levelSelectorConfig: {
      labelCallback: function(playbackLevel) {
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
    disableErrorScreen: true,
    errorPlugin: {
      onError: errorHandler
    },
  };

  // VP9 dash player (avoid in firefox, because track-switching is broken there)
  const isFirefox = navigator.userAgent.indexOf("Firefox") != -1;
  if (!isFirefox && hasMSE && MediaSource.isTypeSupported('video/webm; codecs="vp9,opus"')) {
    config.source = {
      source: `//cdn.c3voc.de/dash/${stream}/manifest.mpd`,
    };
    config.shakaConfiguration = {
      preferredAudioLanguage: preferredAudioLanguage,
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
    };

  // HLS playlist (doesn't work for audio only)
  } else if (!audioOnly &&
      (hasMSE || document.createElement('video').canPlayType('application/vnd.apple.mpegURL') != "")) {
    config.source = {
      source: `//cdn.c3voc.de/hls/${stream}/native_hd.m3u8`,
      mimeType: "application/vnd.apple.mpegURL"
    };

    // MP3 Audio fallback
  } else if (audioOnly) {
    config.source = {
      source: `//cdn.c3voc.de/${stream}_native.mp3`,
      mimeType: "audio/mp3"
    };

  // WebM fallback
  } else {
    config.source = {
      source: `//cdn.c3voc.de/${stream}_native_hd.webm`,
      mimeType: "video/webm"
    };
  }

  return Promise.resolve(config);
}

/**
 * Determines config specific to media.ccc.de lecture
 * @param {string} slug
 */
export const getLectureConfig = function(slug, reliveOffset) {
  return getMediaLectureSources(slug).then(data => {
    return {
      sources: data.videos || data.relive?.playlist,
      poster: data.images?.posterUrl,
      timelens: data.timelens,
      playback: {
        externalTracks: data.playerConfig?.subtitles
      },
      levelSelectorConfig: {
        labelCallback: function(playbackLevel, customLabel) {
          console.log("labelCallback", arguments);
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
    };
  }).catch(err => {
    console.log("Failed to fetch media sources", err);
    return {
      playbackNotSupportedMessage: `${err.message}`,
    }
  });
}
