const STORAGE_KEYS = {
  autoTranslateEnabled: "autoTranslateEnabled"
};

const DATA_KEYS = {
  processed: "xTranslatorProcessed",
  translationId: "xTranslatorTranslationId"
};

const TRANSLATION_CLASS = "x-translator-translation";
const STYLE_ID = "x-translator-style";
const translationCache = new Map();

let autoTranslateEnabled = true;
let pageRestoreMode = false;
let observer = null;

initialize();

async function initialize() {
  injectStyles();
  await loadSettings();
  startObserver();

  if (autoTranslateEnabled) {
    scanAndTranslateTweets();
  }
}

async function loadSettings() {
  const result = await chrome.storage.sync.get({
    [STORAGE_KEYS.autoTranslateEnabled]: true
  });

  autoTranslateEnabled = Boolean(result[STORAGE_KEYS.autoTranslateEnabled]);
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${TRANSLATION_CLASS} {
      margin: 0 0 8px;
      padding: 8px 10px;
      border-left: 3px solid rgb(29, 155, 240);
      border-radius: 10px;
      background: rgba(29, 155, 240, 0.08);
      color: rgb(15, 20, 25);
      font-size: 0.95em;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .${TRANSLATION_CLASS} strong {
      display: inline-block;
      margin-right: 4px;
      color: rgb(29, 155, 240);
    }

    .${TRANSLATION_CLASS}[data-state="loading"] {
      opacity: 0.75;
    }

    .${TRANSLATION_CLASS}[data-state="error"] {
      border-left-color: rgb(244, 33, 46);
      background: rgba(244, 33, 46, 0.08);
    }

    .${TRANSLATION_CLASS}[data-state="error"] strong {
      color: rgb(244, 33, 46);
    }
  `;

  document.documentElement.appendChild(style);
}

function startObserver() {
  if (observer) {
    observer.disconnect();
  }

  // X 的时间线是动态加载的，所以需要持续监听新增的推文节点。
  observer = new MutationObserver((mutations) => {
    if (!autoTranslateEnabled || pageRestoreMode) {
      return;
    }

    let shouldScan = false;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }

        if (node.matches?.('article[data-testid="tweet"]') || node.querySelector?.('article[data-testid="tweet"]')) {
          shouldScan = true;
          break;
        }
      }

      if (shouldScan) {
        break;
      }
    }

    if (shouldScan) {
      scanAndTranslateTweets();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function scanAndTranslateTweets() {
  // 这里只扫描推文卡片中的正文区域，尽量避免误处理导航、按钮、输入框等文本。
  const tweetTextNodes = document.querySelectorAll('article[data-testid="tweet"] div[data-testid="tweetText"]');

  tweetTextNodes.forEach((tweetTextNode) => {
    processTweetTextNode(tweetTextNode);
  });
}

async function processTweetTextNode(tweetTextNode) {
  if (!(tweetTextNode instanceof HTMLElement)) {
    return;
  }

  if (tweetTextNode.dataset[DATA_KEYS.processed] === "true") {
    return;
  }

  const article = tweetTextNode.closest('article[data-testid="tweet"]');
  if (!article) {
    return;
  }

  const originalText = extractTweetText(tweetTextNode);
  if (!originalText) {
    return;
  }

  if (isChineseText(originalText)) {
    // 中文内容直接标记为已检查，避免后续重复扫描。
    tweetTextNode.dataset[DATA_KEYS.processed] = "true";
    return;
  }

  const translationBlock = createTranslationBlock();
  tweetTextNode.insertAdjacentElement("beforebegin", translationBlock);
  tweetTextNode.dataset[DATA_KEYS.processed] = "true";
  tweetTextNode.dataset[DATA_KEYS.translationId] = translationBlock.dataset.translationId;

  try {
    const translation = await translateText(originalText);
    updateTranslationBlock(translationBlock, "success", translation);
  } catch (error) {
    const message = error instanceof Error ? error.message : "翻译失败";
    updateTranslationBlock(translationBlock, "error", message);
  }
}

function extractTweetText(tweetTextNode) {
  return (tweetTextNode.innerText || "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function isChineseText(text) {
  const simplified = text.replace(/\s/g, "");
  if (!simplified) {
    return true;
  }

  const chineseCharCount = (simplified.match(/[\u3400-\u9fff]/g) || []).length;
  return chineseCharCount / simplified.length >= 0.35;
}

function createTranslationBlock() {
  const wrapper = document.createElement("div");
  wrapper.className = TRANSLATION_CLASS;
  wrapper.dataset.translationId = createTranslationId();
  wrapper.dataset.state = "loading";

  const label = document.createElement("strong");
  label.textContent = "『翻译中：』";

  const content = document.createElement("span");
  content.textContent = "正在请求翻译接口...";

  wrapper.append(label, content);
  return wrapper;
}

function createTranslationId() {
  return `x-translator-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function translateText(text) {
  const cacheKey = text.trim();

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const response = await chrome.runtime.sendMessage({
    type: "TRANSLATE_TEXT",
    text: cacheKey
  });

  if (!response?.success) {
    throw new Error(response?.error || "翻译失败");
  }

  const translation = String(response.translation || "").trim();
  if (!translation) {
    throw new Error("没有拿到有效译文");
  }

  translationCache.set(cacheKey, translation);
  return translation;
}

function updateTranslationBlock(translationBlock, state, text) {
  if (!(translationBlock instanceof HTMLElement) || !translationBlock.isConnected) {
    return;
  }

  translationBlock.dataset.state = state;

  const label = translationBlock.querySelector("strong");
  const content = translationBlock.querySelector("span");

  if (!(label instanceof HTMLElement) || !(content instanceof HTMLElement)) {
    return;
  }

  if (state === "error") {
    label.textContent = "『翻译失败：』";
    content.textContent = text;
    return;
  }

  label.textContent = "『中文翻译：』";
  content.textContent = text;
}

function restoreCurrentPage() {
  // 进入恢复模式后，当前页面不会立刻重新插回翻译块。
  pageRestoreMode = true;
  translationCache.clear();

  document.querySelectorAll(`.${TRANSLATION_CLASS}`).forEach((node) => {
    node.remove();
  });

  document.querySelectorAll('article[data-testid="tweet"] div[data-testid="tweetText"]').forEach((tweetTextNode) => {
    if (!(tweetTextNode instanceof HTMLElement)) {
      return;
    }

    delete tweetTextNode.dataset[DATA_KEYS.processed];
    delete tweetTextNode.dataset[DATA_KEYS.translationId];
  });
}

function resumeAutoTranslation() {
  pageRestoreMode = false;

  if (autoTranslateEnabled) {
    scanAndTranslateTweets();
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes[STORAGE_KEYS.autoTranslateEnabled]) {
    return;
  }

  autoTranslateEnabled = Boolean(changes[STORAGE_KEYS.autoTranslateEnabled].newValue);

  if (autoTranslateEnabled) {
    resumeAutoTranslation();
    return;
  }

  pageRestoreMode = true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "TRANSLATE_CURRENT_PAGE") {
    pageRestoreMode = false;
    scanAndTranslateTweets();
    sendResponse({ success: true });
    return;
  }

  if (message.type === "RESTORE_CURRENT_PAGE") {
    restoreCurrentPage();
    sendResponse({ success: true });
    return;
  }

  if (message.type === "PING") {
    sendResponse({ success: true });
  }
});
