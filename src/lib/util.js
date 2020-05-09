/**
 * Checks status of http media file
 * @param {*} url
 * @param {*} callback
 */
export const checkMedia = function(url, callback) {
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
 * Perfoms query against media.ccc.de GraphQL API
 * @param {*} operationName
 * @param {*} query
 * @param {*} variables
 */
const queryGraph = function(operationName, query, variables={}) {
  const headers = new Headers();

  // Do fetch
  return fetch("https://media.ccc.de/graphql", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({operationName, query, variables})

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
export const getMediaLectureSources = function(slug) {
  return queryGraph("LectureBySlug", `
    query LectureBySlug {
      lectureBySlug(slug: "${slug}") {
        originalLanguage
        videos {
          label
          url
          mimeType
        }
      }
    }
  `).then(res => {
    if (!res.data.lectureBySlug)
      throw new Error("Lecture could not be found");

    return res.data.lectureBySlug.videos.map(({label, url, mimeType}) => ({
      label,
      mimeType,
      source: url
    }))
  });
}

