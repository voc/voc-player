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
  console.log(
    "vp9/vorbis", hasMSE && MediaSource.isTypeSupported('video/webm; codecs="vp9,vorbis"'),
    "vp9/opus", hasMSE && MediaSource.isTypeSupported('video/webm; codecs="vp9,opus"')
  );

  // Stream specific config
  const config = {
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
      text: "Stream offline",
      onError: errorHandler
    },
  };

  // VP9 dash player (preferred in any case)
  if (hasMSE && MediaSource.isTypeSupported('video/webm; codecs="vp9,opus"')) {
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
      source: `//cdn.c3voc.de/hls/${stream}_native_hd.m3u8`,
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
export const getLectureConfig = function(slug) {
  return getMediaLectureSources(slug).then(sources => {
    return {
      sources: sources,
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