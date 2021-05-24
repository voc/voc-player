import {serialize} from "lib/url";

/**
 * Checks status of http media file
 * @param {*} url
 * @param {*} callback
 */
export function checkMedia(url, callback) {
  if (!callback || typeof(callback) !== "function") {
    throw new Error(`Excepted function, got '${callback}'`)
  }
  const xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (this.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
      if (this.status === 200) {
        callback(true);
      } else {
        callback(false);
      }
      xhr.abort();
    }
  }
  xhr.open("GET", url, true);
  xhr.send(null);
};

/**
 * Load image in the background.
 * @param {*} url image url
 * @returns Promise Fulfilled when image has finished loading
 */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const imageElement = new Image();
    imageElement.onload = () => { resolve(); };
    imageElement.onerror = () => { reject(); };
    imageElement.src = url;
  });
}

/**
 * Perfoms query against media.ccc.de GraphQL API
 * @param {*} operationName
 * @param {*} query
 * @param {*} variables
 */
const queryGraph = function(operationName, query, variables={}) {
  const headers = new Headers();

  // Do fetch
  const shortened = query.replace(/\s+/g, " ");
  const urlQuery = serialize({
    query: shortened,
    operation: operationName,
    variables: JSON.stringify(variables),
  });
  return fetch(`https://media.ccc.de/graphql?${urlQuery}`, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  // Parse json
  }).then((res) => {
    const reader = res.body.getReader();
    let body = "";
    let decoder = new TextDecoder("utf-8");
    return reader.read().then(function process({done, value}) {
      if (done) {
        return JSON.parse(body);
      }
      body += decoder.decode(value);
      return reader.read().then(process);
    });
  })
};

/**
 * Finds player sources for a media.ccc.de lecture by slug
 * @param {string} slug
 */
export function getMediaLectureSources(slug) {
  return queryGraph("LectureBySlug", `
    query LectureBySlug($slug: ID!) {
      lecture: lectureBySlug(slug: $slug) {
        originalLanguage
        timelens { thumbnailsUrl, timelineUrl }
        videos { label, source: url, mimeType }
        images { posterUrl }
        relive
        playerConfig
      }
    }
  `, { slug }).then(res => {
    if (!res.data.lecture)
      throw new Error("Lecture could not be found");

    return res.data.lecture
  });
}

