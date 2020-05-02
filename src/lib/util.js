
/**
 * Checks status of http media file
 * @param {*} url
 * @param {*} callback 
 */
export const checkMedia = (url, callback) => {
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