# dynamic-source-public-path-plugin 

A plugin that supports obtaining the runtime domain name and modifying the runtime publicPath

## install
```js
npm i --save-dev dynamic-source-public-path-plugin
```
## usage
`dynamic-source-public-path-plugin` depends on `html-webpack-plugin`, so you must install `html-webpack-plugin`. You can use it in your plugins like this:
```js
// webpack.config.js

const HtmlWebpackPlugin = require('html-webpack-plugin');
const DynamicSourcePublicPathPlugin = require("dynamic-source-public-path-plugin");

module.exports = {
  ...,
  plugins: [
    new HtmlWebpackPlugin(),
    new DynamicSourcePublicPathPlugin({
      publicPathTemplate:(host)=>{
        if(host){
          // __RUNTIME_HOST__ is a placeholder replace the runtime domain
          // it will be replaced once get the real domain 
          return '__RUNTIME_HOST__/hello/';
        }
      }
    }),
  ]
}


```
This will generate a file dist/index.html containing the following:
```html
<!doctype html>
<html lang="">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script>
    var host = window.location.host;
    var publicPathTemplate = (host) => {
      if (host) {
        return '__RUNTIME_HOST__/hello/';
      }
    }
    window.publicPath = publicPathTemplate(host).replace('__RUNTIME_HOST__', host)

    function asyncAppendNode(tagName, fileName) {
      var node = document.createElement(tagName);
      if (tagName === "link") {
        node.type = "text/css";
        node.rel = "stylesheet";
        node.href = window.publicPath + fileName;
        document.head.appendChild(node);
      } else {
        node.src = window.publicPath + fileName;
        document.body.appendChild(node);
      }
    }</script>
  <script>
    asyncAppendNode('link', 'your styleFileName');
  </script>
</head>
<body>
<div id="app"></div>
<script>
  asyncAppendNode('script', 'your chunkName');
</script>
</body>
</html>

```
In your chrome develop tool, you'll find new link/script element at the end of head/body.

## options
|   Name    |   Type    |   Default |   Description |
|:---------:|:---------:|:---------:|:---------:|
|publicPathTemplate|(host:string)=>string|undefined|the first arg is runtime domain, you can set up different mapping relationships according to requirements|


