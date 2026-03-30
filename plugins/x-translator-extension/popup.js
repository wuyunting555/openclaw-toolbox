const STORAGE_KEYS = {
  autoTranslateEnabled: "autoTranslateEnabled"
};

const autoTranslateToggle = document.getElementById("autoTranslateToggle");
const translateNowButton = document.getElementById("translateNowButton");
const restoreButton = document.getElementById("restoreButton");
const statusText = document.getElementById("statusText");

initializePopup();

async function initializePopup() {
  const settings = await chrome.storage.sync.get({
    [STORAGE_KEYS.autoTranslateEnabled]: true
  });

  autoTranslateToggle.checked = Boolean(settings[STORAGE_KEYS.autoTranslateEnabled]);
  updateStatus(autoTranslateToggle.checked ? "自动翻译已开启" : "自动翻译已关闭");
}

autoTranslateToggle.addEventListener("change", async () => {
  const enabled = autoTranslateToggle.checked;

  await chrome.storage.sync.set({
    [STORAGE_KEYS.autoTranslateEnabled]: enabled
  });

  updateStatus(enabled ? "已开启自动翻译" : "已关闭自动翻译");
});

translateNowButton.addEventListener("click", async () => {
  const sent = await sendMessageToCurrentTab({ type: "TRANSLATE_CURRENT_PAGE" });
  updateStatus(sent ? "已尝试翻译当前页面已加载的推文" : "当前标签页不是 X / Twitter 页面");
});

restoreButton.addEventListener("click", async () => {
  const sent = await sendMessageToCurrentTab({ type: "RESTORE_CURRENT_PAGE" });
  updateStatus(sent ? "已恢复当前页面原始显示" : "当前标签页不是 X / Twitter 页面");
});

async function sendMessageToCurrentTab(message) {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id || !isSupportedUrl(tab.url)) {
    return false;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, message);
    return true;
  } catch (_error) {
    return false;
  }
}

function isSupportedUrl(url) {
  return typeof url === "string" && (url.startsWith("https://x.com/") || url.startsWith("https://twitter.com/"));
}

function updateStatus(message) {
  statusText.textContent = message;
}
