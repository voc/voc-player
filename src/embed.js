import Player from "lib/player";
import {deserialize} from "lib/url";

/* Parse url params */
const params = deserialize(location.href);
const opts = {
  parentId: "#player",
  vocStream: params.stream,
  poster: params.poster
}

console.info("site params", params);
console.info("player opts", opts);
new Player(opts);