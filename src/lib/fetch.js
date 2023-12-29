// Example POST method implementation:
export const postData = async (url = "", data = {}) => {
  await fetch(url, {
    method: "POST",
    mode: "cors",
    cache: "no-cache",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
    },
    redirect: "follow",
    referrerPolicy: "no-referrer",
    body: JSON.stringify(data),
  });
};

/**
 * Checks status of http media file
 * @param {*} url
 */
export const checkMedia = async (url) => {
  // timeout after 3s
  const abort = new AbortController();
  const timeout = setTimeout(() => {
    abort.abort();
  }, 3000);
  await fetch(url + `?t=${Date.now()}`, {
    signal: abort.signal,
    method: "HEAD",
    mode: "cors",
    cache: "no-cache",
    redirect: "follow",
    referrerPolicy: "no-referrer",
  });
  clearTimeout(timeout);
};
