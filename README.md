# voc-player
C3VOC HTML5-Webplayer based on [clappr](https://github.com/clappr/clappr). Can be used to embed C3VOC streams into your own webpages.

## Usage
You can embed the player using a variety of methods. We support the following configurations:
  - iFrame: Easiest but also least configurable option
  - Static Javascript: Allows you to pass custom parameters to the Clappr player
  - CommonJS: Allows you to bundle the player as a library with your own web application

Continue reading for detailed descriptions of each method.

### With an IFrame-Embed
This is the easiest method, but not very flexible and not recommended for more than one embed per page.

Copy the embed folder to your webpage and embed the player as follows:
```html
...
<div class="playerWrap">
  <iframe class="player" src="embed/index.html?stream=mystream" frameborder="0" allowfullscreen></iframe>
</div>
...
```

We recommend to use a like CSS the following, to keep the player iframe at a constant 16:9 aspect ratio:
```css
.playerWrap{
  position: relative;
  padding-bottom: 56.25%;
}
.player {
  position: absolute;
  width: 100%;
  height: 100%;
}
```

#### Query Parameters
##### stream
C3VOC stream name

#### Example
You can take a look at <examples/iframe/index.html> for a working example.

### With static js
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
<script src="player.js"></script>
<script src="myplugin.js"></script>
<script>
  new VOCPlayer.default({
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
#player > .fullscreen {
  padding-bottom: 0;
}
```

You can take a look at <examples/iframe/index.html> for a working example.

### Using CommonJS (Coming soon)
Install the player
```bash
npm install --save voc-player
```

And import it into your js/ts
```
var VOCPlayer = require("voc-player");
VOCPlayer({
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
Add ```vocStream: s1``` to automatically choose the correct source URLs for a C3VOC livestream with name s1.

You can query <https://streaming.media.ccc.de/streams/v2.json> to find out which stream name a conference room may be using.

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