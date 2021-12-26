import { getMediaLectureSources, loadImage } from "lib/util";
import watermark from "public/watermark";

/**
 * Generate clappr base config
 */
export const getBaseConfig = () => {
  return {
    width: "100%",
    height: "100%",
    hideMediaControlDelay: 1000,
    position: "top-left",
    watermark: watermark,
    watermarkLink: "https://c3voc.de",
    levelSelectorConfig: {
      labelCallback: function (level) {
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
  }
}

/**
 * Determines config specifig to C3VOC streaming
 * @param {string} stream stream name on CDN
 * @param {boolean} audioOnly
 * @param {function} errorHandler
 */
export const getStreamConfig = (stream, audioOnly, h264Only, preferredAudioLanguage, errorHandler) => {
  // Keep a tab on whether there are still browsers where we need vp9,vorbis vs vp9,opus
  const hasMSE = "MediaSource" in window;

  // Stream specific config
  const config = {
    poster: `//cdn.c3voc.de/thumbnail/${stream}/poster.jpeg`,
    levelSelectorConfig: {
      labelCallback: function (playbackLevel) {
        // playbackLevel.videoBandwidth is set for DASH
        // playbackLevel.level.bitrate is set for HLS
        var bw = playbackLevel.videoBandwidth || playbackLevel.level.bitrate;

        if (bw <= 100000) {
          return "Slides";
        }
        else if (bw <= 900000) {
          return "SD";
        }
        else if (bw <= 5000000) {
          return "HD";
        } else {
          return "Source";
        }
      },
      title: "Quality"
    },
    disableErrorScreen: true,
    errorPlugin: {
      onError: errorHandler
    },
    vocConfigUpdate: (player) => {
      if (document.visibilityState !== "visible" || player.isPlaying())
        return;
      const posterUrl = `//cdn.c3voc.de/thumbnail/${stream}/poster.jpeg?t=${Date.now()}`;
      loadImage(posterUrl).then(() => {
        player.configure({
          poster: posterUrl,
        })
      })
    }
  };

  // VP9 dash player (avoid in firefox, because track-switching is broken there)
  const isFirefox = navigator.userAgent.indexOf("Firefox") != -1;
  if (!isFirefox && !h264Only && hasMSE && MediaSource.isTypeSupported('video/webm; codecs="vp9,opus"')) {
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
export const getLectureConfig = function (slug, reliveOffset) {
  return getMediaLectureSources(slug).then(data => {
    return {
      sources: data.videos || data.relive?.playlistCut || data.relive?.playlist,
      poster: data.images?.posterUrl,
      timelens: data.timelens,
      playback: {
        externalTracks: data.playerConfig?.subtitles
      },
      levelSelectorConfig: {
        labelCallback: function (playbackLevel, customLabel) {
          console.log("labelCallback", arguments);
          // playbackLevel.videoBandwidth is set for DASH
          // playbackLevel.level.bitrate is set for HLS
          var bw = playbackLevel.videoBandwidth || playbackLevel.level.bitrate;

          if (bw <= 100000) {
            return "Slides";
          }
          else if (bw <= 800000) {
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
