# voc-player
C3VOC HTML5-Webplayer based on clappr. Can be used to embed C3VOC streams into your own webpages.

## Usage
### With an IFrame-Embed
This is the easiest method, but not very flexible and not recommended for more than one embed per page.

Copy the embed folder to your webpage and embed the player as follows:
```html
...
<div class="playerWrap">
  <iframe class="player" src="embed/index.html?stream=mystream"></iframe>
</div>
...
```

We recommend to use a like CSS the following, to keep the player at a constant 16:9 aspect ratio:
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

See *examples/iframe/index.html* for a working example.

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
  new VOCPlayer({
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
```

See *examples/staticJs/index.html* for a working example.