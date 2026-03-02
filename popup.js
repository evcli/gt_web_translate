const TARGET_LANG = "zh-CN";
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const sourceEl = document.getElementById("source");
const panelRowEl = document.getElementById("panelRow");
let retryHooked = false;
const MIN_WIDTH = 360;
const MAX_WIDTH = 800;

document.addEventListener("DOMContentLoaded", () => translateClipboard(false));

async function translateClipboard(triggeredByUser) {
  setStatus("Reading clipboard...");
  setResult("");
  setSource("");
  setPanelsVisible(false);
  let text = "";
  try {
    text = (await navigator.clipboard.readText()).trim();
  } catch (err) {
    if (err.name === "NotAllowedError" && !triggeredByUser && !retryHooked) {
      retryHooked = true;
      setStatus("需要点击弹窗一次以授权读取剪贴板。");
      document.addEventListener(
        "click",
        () => translateClipboard(true),
        { once: true }
      );
      return;
    }
    setStatus("无法读取剪贴板，请在地址栏输入 chrome://settings/content/clipboard 检查权限后，点击弹窗重试。");
    return;
  }

  if (!text) {
    setStatus("剪贴板为空或无文本。");
    return;
  }

  setSource(text);
  adjustWidth(text);
  setStatus("Translating...");
  setPanelsVisible(true);
  chrome.runtime.sendMessage({ type: "TRANSLATE", text, targetLang: TARGET_LANG }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus(`Error: ${chrome.runtime.lastError.message}`);
      return;
    }
    if (!response || response.error) {
      setStatus(`Error: ${response?.error || "Unknown error"}`);
      return;
    }
    const { translation, detectedLang } = response;
    const header = detectedLang ? `[${detectedLang}]` : "";
    setStatus("Done");
    setResult(`${header} ${translation}`.trim());
  });
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setResult(text) {
  resultEl.textContent = text;
}

function setSource(text) {
  sourceEl.textContent = text;
}

function adjustWidth(text) {
  const len = text.length;
  // heuristic: grow width every ~80 chars, within bounds
  const desired = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, 360 + Math.floor(len / 80) * 120));
  document.documentElement.style.width = `${desired}px`;
  document.body.style.width = `${desired}px`;
}

function setPanelsVisible(show) {
  if (!panelRowEl) return;
  if (show) {
    panelRowEl.classList.remove("hidden");
  } else {
    panelRowEl.classList.add("hidden");
  }
}
