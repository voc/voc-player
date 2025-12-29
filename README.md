# voc-player
C3VOC HTML5 web player based on [clappr](https://github.com/clappr/clappr). Can be used to embed C3VOC streams into your own webpages.

## Usage
You can embed the player using a variety of methods. We support the following configurations:
  - UMD: Using standard javascript and a global object
  - ES: Using javascript modules

Continue reading for detailed descriptions of each method.

### With UMD js
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Document</title>
</head>
<body>
  <div id="player"></div>
</body>
<script src="player.umd.js"></script>
<script>
  // expose Clappr to load additional plugins
  window.Clappr = window.VOCPlayer
</script>
<script src="myplugin.js"></script>
<script>
  new VOCPlayer.Player({
    // C3VOC specific options
    vocStream: "mystream",

    // Standard clappr.io Options
    parentId: "#player",
    plugins: [MyPlugin],
    MyPlugin: {
      ...
    }
  });
</script>
</html>
```

We recommend the following CSS for correct 16:9 player ratio:
```css
#player > [data-player] {
  padding-bottom: 56.25%;
  height: auto !important;
}
#player > .fullscreen[data-player] {
  padding-bottom: 0;
  height: 100% !important;
}
```

You can take a look at [examples/umdEmbed/index.html](./examples/umdEmbed/index.html) for a working example.

### Using CommonJS
Install the player
```bash
npm install --save voc-player
```

And import it into your js/ts
```js
import {Player} from "voc-player";
Player({
  // C3VOC specific options
  vocStream: "mystream",

  // Standard clappr.io Options
  parentId: "#player",
  plugins: [MyPlugin],
  MyPlugin: {
    ...
  }
});
```


## Configuration
The voc-player extends the Clappr configuration with custom options and includes some additional plugins per default.
You can override all of those options, however doing so may break the player unexpectedly.

### voc-player custom options
#### Stream sources
Add ```vocStream: "$stream"``` to play a C3VOC livestream with name $stream.

You can query <https://streaming.media.ccc.de/streams/v2.json> to find out which stream name a conference room may be using.

#### Lecture sources
Add ```vocLectureGuid: "$guid"``` or ```vocLecture: "$slug"``` to play a lecture from media.ccc.de with the guid $guid or slug $slug.

### standard clappr options

A list of possible Clappr configuration options is available under <https://github.com/clappr/clappr/blob/dev/doc/BUILTIN_PLUGINS.md>.

## Build
Install dependencies
```
npm ci
```

For a dev build
```bash
npm run dev
```

For a production build
```bash
npm run build
```
