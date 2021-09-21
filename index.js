class DynamicSourcePublicPathPlugin {
  constructor(options) {
    const { publicPathTemplate } = options;
    this.callbackName = 'asyncAppendNode';
    this.cdnVariableName = 'window.publicPath';
    this.publicPathTemplate = publicPathTemplate;

    this.extractHtmlWebpackPluginModule = (compiler) => {
      const htmlWebpackPlugin = (compiler.options.plugins || []).find(plugin => {
        return plugin.constructor.name === 'HtmlWebpackPlugin';
      });
      if (!htmlWebpackPlugin) {
        return null;
      }
      const HtmlWebpackPlugin = htmlWebpackPlugin.constructor;
      if (!HtmlWebpackPlugin || !('getHooks' in HtmlWebpackPlugin)) {
        return null;
      }
      return HtmlWebpackPlugin;
    };
  }

  rewriteData(node, nodeList, fnName, publicPath) {
    if (node === 'link') {
      const fileNames = nodeList.map((item) => item?.attributes?.href?.split('/').pop());
      const scriptInnerHtml = fileNames.map((item) => `${fnName}('${node}','${item}');`).join('');
      return { tagName: 'script', voidTag: false, innerHTML: scriptInnerHtml };
    }
    if (node === 'script') {
      const inlineScript = [];
      const srcScript = [];
      nodeList.forEach((item) => {
        if (item.innerHTML) {
          if (typeof publicPath === 'string') {
            item.innerHTML = item.innerHTML.replace(`="${publicPath}"`, `=${this.cdnVariableName}`);
          }
          inlineScript.push(item);
        } else {
          srcScript.push(item?.attributes?.src?.split('/').pop());
        }
      });
      const scriptInnerHtml = srcScript.map((item) => `${fnName}('${node}','${item}');`).join('');
      return [...inlineScript, { tagName: 'script', closeTag: true, innerHTML: scriptInnerHtml }];
    }
  }

  apply(compiler) {
    compiler.hooks.compilation.tap('DynamicSourcePublicPathPlugin', (compilation) => {
      const HtmlWebpackPlugin = this.extractHtmlWebpackPluginModule(compiler);
      if (!HtmlWebpackPlugin) {
        throw new Error('HtmlWebpackInjectPreload needs to be used with html-webpack-plugin 4 or 5');
      }
      const hooks = HtmlWebpackPlugin.getHooks(compilation);
      hooks.beforeAssetTagGeneration.tapAsync('DynamicSourcePublicPathPlugin', (data, cb) => {
        this.publicPath = data.assets.publicPath;
        cb(null, data);
      });
      hooks.afterTemplateExecution.tapAsync('DynamicSourcePublicPathPlugin', (data, cb) => {
        if (data.headTags.length) {
          const notLinkHeadTags = data.headTags.filter(item => item.tagName !== 'link');
          const linkHeadTags = this.rewriteData('link', data.headTags.filter(item => item.tagName === 'link'), this.callbackName);
          data.headTags = [].concat(notLinkHeadTags, linkHeadTags);
        }
        if (data.bodyTags.length) {
          data.bodyTags = this.rewriteData('script', data.bodyTags, this.callbackName, this.publicPath);
        }

        const topScript = `
            <script>
              var host = window.location.origin;
              var publicPathTemplate = ${this.publicPathTemplate.toString()}
              window.publicPath = publicPathTemplate(host).replace('__RUNTIME_HOST__', host)
              function asyncAppendNode(tagName, fileName) {
                var node = document.createElement(tagName);
                if (tagName === "link") {
                  node.type = "text/css";
                  node.rel = "stylesheet";
                  node.href = window.publicPath + 'css/'+ fileName;
                  document.head.appendChild(node);
                } else {
                  node.src = window.publicPath +'js/'+  fileName;
                  document.body.appendChild(node);
                }
              }
            </script>
            `;
        data.html = data.html.replace('<!--SetGlobalPublicPath inset script-->', topScript);

        cb(null, data);
      });
    });
  }
}

module.exports = DynamicSourcePublicPathPlugin;
