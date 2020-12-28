// serialize flat url params
export function serialize(obj) {
  let str = [];
  for(var p in obj)
    if (obj.hasOwnProperty(p) && obj[p] != undefined) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  return str.join("&");
}

// deserialize url params
export function deserialize(str) {
  const result = {};
  if (str && typeof str === "string") {
    const parts = str.split(/&|\?/);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].split("=");
      if (part.length !== 2)
        continue

      const key = decodeURIComponent(part[0]);
      const value = decodeURIComponent(part[1]);
      if (typeof result[key] == "string") {
        result[key] = [result[key], value];
      } else if(typeof result[key] == "object" && Array.isArray(result[key])) {
        result[key].push(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}