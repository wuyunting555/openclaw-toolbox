const DEFAULT_SETTINGS = {
  autoTranslateEnabled: true
};

chrome.runtime.onInstalled.addListener(async () => {
  const storedSettings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  const normalizedSettings = {};

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const storedValue = storedSettings[key];
    if (typeof storedValue === typeof value && storedValue !== null) {
      continue;
    }

    normalizedSettings[key] = value;
  }

  if (Object.keys(normalizedSettings).length > 0) {
    await chrome.storage.sync.set(normalizedSettings);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type !== "TRANSLATE_TEXT") {
    return;
  }

  translateWithConfiguredProvider(message.text)
    .then((translation) => {
      sendResponse({
        success: true,
        translation
      });
    })
    .catch((error) => {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "翻译请求失败"
      });
    });

  return true;
});

async function translateWithConfiguredProvider(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("缺少待翻译内容");
  }

  // 这里使用一个免费可直接访问的翻译接口。
  // 优点是：不需要 API Key，技术小白也能直接跑起来。
  // 缺点是：这是公共接口，稳定性不如正式付费服务。
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", "zh-CN");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url.toString(), {
    method: "GET"
  });

  if (!response.ok) {
    const errorText = await safeReadErrorText(response);
    throw new Error(`接口返回 ${response.status}${errorText ? `: ${errorText}` : ""}`);
  }

  const data = await response.json();
  const translation = extractGoogleTranslation(data);

  if (!translation) {
    throw new Error("接口返回中未找到译文");
  }

  return translation;
}

function extractGoogleTranslation(data) {
  // 这个接口返回的是嵌套数组，大致结构类似：
  // [
  //   [
  //     ["译文片段", "原文片段", ...],
  //     ...
  //   ],
  //   ...
  // ]
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    return "";
  }

  return data[0]
    .map((segment) => {
      if (!Array.isArray(segment)) {
        return "";
      }

      return typeof segment[0] === "string" ? segment[0] : "";
    })
    .join("")
    .trim();
}

async function safeReadErrorText(response) {
  try {
    const text = await response.text();
    return text.slice(0, 200).trim();
  } catch (_error) {
    return "";
  }
}
