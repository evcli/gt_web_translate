const TRANSLATE_ENDPOINT = "https://translate.googleapis.com/translate_a/single";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "TRANSLATE") return;

  const { text, targetLang } = message;
  if (!text || !targetLang) {
    sendResponse({ error: "Missing text or target language." });
    return;
  }

  translateText(text, targetLang)
    .then((translation) => sendResponse({ translation }))
    .catch((error) => sendResponse({ error: error.message || "Translation failed." }));

  return true; // keep the channel open for async response
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "gt-context-translate",
    title: "GT",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "gt-context-translate") return;
  if (!info.selectionText || !tab?.id) return;
  chrome.tabs.sendMessage(tab.id, {
    type: "CONTEXT_TRANSLATE",
    text: info.selectionText,
  });
});

async function translateText(text, targetLang) {
  const url = `${TRANSLATE_ENDPOINT}?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const translated = Array.isArray(data?.[0])
    ? data[0].map((part) => part?.[0]).join("")
    : "";
  if (!translated) throw new Error("Empty translation result.");

  return translated;
}
