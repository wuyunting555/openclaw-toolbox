# x-translator-extension

这是一个基于 Chrome Extension Manifest V3 的浏览器插件项目，用于在 X（Twitter）网页中自动给非中文推文插入中文译文。当前版本已经改成免费可运行方案，不需要 OpenAI API Key，也不需要购买 token。

## 项目结构说明

```text
x-translator-extension/
├── manifest.json    # 插件清单，声明权限、popup、background、content script
├── background.js    # 后台脚本，初始化默认设置并调用免费翻译接口
├── content.js       # 页面注入脚本，识别推文、插入译文、监听动态加载
├── popup.html       # 插件弹窗页面结构
├── popup.css        # 插件弹窗样式
├── popup.js         # 弹窗交互逻辑：开关、立即翻译、恢复页面
└── README.md        # 使用说明
```

## 如何在 Chrome 里加载“已解压的扩展程序”

1. 打开 Chrome 浏览器，进入 `chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前项目目录：`/home/baiwan/x-translator-extension`
5. 加载成功后，你会在扩展列表中看到 `x-translator-extension`

## 如何在 x.com 测试

1. 确认插件已经加载成功
2. 打开 `https://x.com/` 或 `https://twitter.com/`
3. 保持 popup 中“启用自动翻译”为开启状态
4. 浏览首页或任意推文列表页面
5. 当页面中出现非中文推文时，插件会在原文上方插入一个中文翻译块
6. 继续向下滚动，后面动态加载出来的新推文也会继续被处理

你也可以点击插件图标打开 popup：

- 使用“立即翻译当前页面”手动处理当前已加载推文
- 使用“恢复当前页面原始显示”移除当前页面已经插入的翻译块

## 当前翻译链路

当前版本的调用方式如下：

1. `content.js` 扫描页面中的推文正文
2. 对非中文推文插入“翻译中”占位块
3. 通过 `chrome.runtime.sendMessage` 把原文发给 `background.js`
4. `background.js` 直接调用免费翻译接口
5. 收到译文后回传给页面脚本，替换占位内容

这样做的原因是：

- 不需要 API Key
- 页面上保留原文，同时异步插入译文
- 后面如果免费接口不稳定，只需要改后台请求层

## 当前免费方案说明

当前默认使用：

- 接口地址：`https://translate.googleapis.com/translate_a/single`
- 请求方式：`GET`
- 参数：自动识别原文语言，目标语言固定为 `zh-CN`
- 优点：免费、不需要 key、配置成本低
- 缺点：这是公共接口，稳定性不能和正式商用服务相比

如果以后你发现这个免费接口在你网络环境下不可用，再考虑加一个很简单的本地中转层也不迟。当前版本先优先保证“开箱即用”。

## 常见问题排查

### 1. 为什么 popup 点击后没有效果？

先确认当前标签页是不是：

- `https://x.com/*`
- `https://twitter.com/*`

如果不是这两个域名，content script 不会注入，自然也无法操作页面。

### 2. 为什么显示“翻译失败”？

优先检查：

- 当前网络是否能访问 `translate.googleapis.com`
- 浏览器里是否已经重新加载了扩展
- 当前页面是否真的是 `x.com` / `twitter.com`
- 这条推文是不是已经被处理过

如果你在某些网络环境下无法访问这个免费接口，下一步再把 `background.js` 改成走本地中转服务即可，但这不是当前版本的前置要求。

### 3. 为什么有些文本没有被翻译？

当前实现是“尽量只处理推文正文”，所以只会查找推文卡片内的 `div[data-testid="tweetText"]`。这样做是为了尽量避免误处理导航栏、按钮文字、输入框等区域。

### 4. 为什么中文推文没有插入翻译块？

这是预期行为。代码里会先做一个简单的中文占比判断，中文内容默认跳过，不再重复插入“中文翻译”块。

### 5. 为什么恢复后页面不再自动翻译？

“恢复当前页面原始显示”会让当前页面进入恢复状态，避免刚移除翻译后又马上被自动翻译重新插回去。你可以：

- 点击“立即翻译当前页面”重新处理
- 或刷新页面，让插件重新按当前开关状态工作

### 6. 为什么关闭浏览器后设置还能保留？

因为插件使用了 `chrome.storage.sync` 保存 `autoTranslateEnabled` 设置，所以浏览器关闭后仍然会记住开关状态。

## 当前实现说明

- 只匹配 `x.com` 和 `twitter.com`
- 使用 content script 操作页面
- 使用 `MutationObserver` 监听动态加载
- 使用 `chrome.storage` 保存设置
- 使用 `background.js` 调用免费翻译接口
- 使用 `data-*` 标记避免重复处理同一条推文
- 保留原文，并把“中文翻译”块显示在原文上方
