const HtmlWebpackPlugin = require("html-webpack-plugin");

class DynamicLoadHtmlWebpackPlugin {
  constructor(options = {}) {
    const {publicPathTemplate} = options;
    this.callbackName = 'asyncAppendNode';
    this.cdnVariableName = 'window.publicPath';
    this.publicPathTemplate = publicPathTemplate;
  }

  rewriteData(node, nodeList, fnName, publicPath) {
    if (node === "link") {
      const fileNames = nodeList.map(item => item.attributes.href.split("/").pop());
      const scriptInnerHtml = fileNames
        .map(item => `${fnName}('${node}','${item}');`)
        .join("\n");
      return [{tagName: "script", voidTag: false, innerHTML: scriptInnerHtml}];
    }
    if(node === "script"){
      const inlineScript = [];
      const srcScript = [];
      nodeList.forEach(item => {
        if (item.innerHTML) {
          if (typeof publicPath === "string" && this.cdnVariableName) {
            const html = item.innerHTML;
            // TODO 内联script的处理可能存在问题，replace使用正则匹配可能更好
            const newHtml = html.replace(
              `="${publicPath}"`,
              `=${this.cdnVariableName}`
            );
            item.innerHTML = newHtml;
          }
          inlineScript.push(item);
        } else {
          srcScript.push(item.attributes.src.split("/").pop());
        }
      });
      const scriptInnerHtml = srcScript
        .map(item => `${fnName}('${node}','${item}');`)
        .join("\n");
      return [
        ...inlineScript,
        {tagName: "script", closeTag: true, innerHTML: scriptInnerHtml}
      ];
    }
  }

  apply(compiler) {
    compiler.hooks.compilation.tap(
      "DynamicLoadHtmlWebpackPlugin",
      compilation => {
        HtmlWebpackPlugin.getHooks(
          compilation
        ).beforeAssetTagGeneration.tapAsync(
          "DynamicLoadHtmlWebpackPlugin",
          (data, cb) => {
            this.publicPath = data.assets.publicPath;
            cb(null, data);
          }
        );
        HtmlWebpackPlugin.getHooks(compilation).afterTemplateExecution.tapAsync(
          "DynamicLoadHtmlWebpackPlugin",
          (data, cb) => {
            if (data.headTags.length) {
              const newStyleData = this.rewriteData(
                "link",
                data.headTags,
                this.callbackName
              );
              data.headTags = newStyleData;
            }
            if (data.bodyTags.length) {
              const newScriptData = this.rewriteData(
                "script",
                data.bodyTags,
                this.callbackName,
                this.publicPath
              );
              data.bodyTags = newScriptData;
            }

            const topScript = `
            <script>
              var host = window.location.host;
              var publicPathTemplate = ${this.publicPathTemplate.toString()}
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
              }
            </script>
            `
            data.html = data.html.replace('<!--SetGlobalPublicPath inset script-->', topScript)

            cb(null, data);
          }
        );
      }
    );
  }
}

module.exports = DynamicLoadHtmlWebpackPlugin;
