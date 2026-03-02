const TARGET_LANG = "zh-CN";
const MAX_TEXT_LENGTH = 1000;
const SELECTION_DEBOUNCE_MS = 120;

let promptEl = null;
let resultEl = null;
let lastSelection = "";
let lastRect = null;
let selectionTimer = null;

const styles = {
  prompt: "gt-inline-prompt",
  result: "gt-inline-result",
  loading: "gt-inline-loading",
};

document.addEventListener("mouseup", handleSelectionChange);
document.addEventListener("keyup", handleSelectionChange);
document.addEventListener("touchend", handleSelectionChange);
document.addEventListener("selectionchange", handleSelectionChange);
window.addEventListener("scroll", removeUi, { passive: true });
window.addEventListener("resize", removeUi);
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "CONTEXT_TRANSLATE") {
    handleContextTranslate(message.text);
  }
});
document.addEventListener("click", (e) => {
  if (!promptEl && !resultEl) return;
  if (promptEl?.contains(e.target) || resultEl?.contains(e.target)) return;
  removeUi();
});

function handleSelectionChange() {
  if (selectionTimer) clearTimeout(selectionTimer);
  selectionTimer = setTimeout(processSelection, SELECTION_DEBOUNCE_MS);
}

function processSelection() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    removeUi();
    return;
  }

  const text = selection.toString().trim();
  if (!text || text.length > MAX_TEXT_LENGTH) {
    removeUi();
    return;
  }

  const range = selection.getRangeAt(0).cloneRange();
  const rect = getSelectionRect(range);
  if (!rect) {
    removeUi();
    return;
  }

  lastSelection = text;
  lastRect = rect;
  showPrompt(rect);
}

function getSelectionRect(range) {
  const rects = range.getClientRects();
  if (rects?.length) return rects[rects.length - 1];
  const rect = range.getBoundingClientRect();
  if (rect && (rect.width || rect.height)) return rect;
  return null;
}

function getInputSelection(el) {
  if (!el) return "";
  const tag = el.tagName?.toLowerCase();
  const type = (el.type || "text").toLowerCase();
  const isTextInput = tag === "textarea" || (tag === "input" && ["text", "search", "url", "tel", "password", "email"].includes(type));
  if (!isTextInput) return "";
  const start = el.selectionStart;
  const end = el.selectionEnd;
  if (start == null || end == null || start === end) return "";
  return el.value.slice(start, end);
}

function getInputRect(el) {
  if (!el?.getBoundingClientRect) return null;
  const rect = el.getBoundingClientRect();
  if (rect && (rect.width || rect.height)) return rect;
  return null;
}

function showPrompt(rect) {
  removePrompt();

  promptEl = document.createElement("button");
  promptEl.className = styles.prompt;
  promptEl.textContent = "T";
  promptEl.style.top = `${window.scrollY + rect.top - 32}px`;
  promptEl.style.left = `${window.scrollX + rect.left}px`;
  promptEl.addEventListener("click", onTranslateClick);

  document.body.appendChild(promptEl);
}

function onTranslateClick(e) {
  e.stopPropagation();
  if (!lastSelection) return;
  showResult("Translating...");

  requestTranslation(lastSelection);
}

function handleContextTranslate(text) {
  const activeEl = document.activeElement;
  const inputSelectedText = getInputSelection(activeEl);
  const selection = window.getSelection();
  const domSelectedText = selection && !selection.isCollapsed ? selection.toString().trim() : "";
  const clean = (inputSelectedText || domSelectedText || text || "").trim();
  if (!clean) return;
  lastSelection = clean;

  let rect = null;
  if (inputSelectedText) rect = getInputRect(activeEl);
  if (!rect && selection && !selection.isCollapsed && selection.rangeCount) {
    try {
      rect = getSelectionRect(selection.getRangeAt(0).cloneRange());
    } catch (err) {
      rect = null;
    }
  }
  if (!rect && lastRect) rect = lastRect;
  if (!rect) rect = { top: 16, left: 16, height: 0 };

  lastRect = rect;
  showResult("Translating...");
  requestTranslation(clean);
}

function requestTranslation(text) {
  chrome.runtime.sendMessage({ type: "TRANSLATE", text, targetLang: TARGET_LANG }, (response) => {
    if (chrome.runtime.lastError) {
      showResult(`Error: ${chrome.runtime.lastError.message}`);
      return;
    }
    if (!response || response.error) {
      showResult(`Error: ${response?.error || "Unknown error"}`);
      return;
    }
    showResult(response.translation || "");
  });
}

function showResult(text) {
  removeResult();
  resultEl = document.createElement("div");
  resultEl.className = styles.result;
  resultEl.textContent = text;

  const rect = lastRect || { top: 0, left: 0, height: 0 };
  const top = window.scrollY + rect.top + rect.height + 8;
  const left = window.scrollX + rect.left;
  resultEl.style.top = `${top}px`;
  resultEl.style.left = `${left}px`;

  document.body.appendChild(resultEl);
}

function removePrompt() {
  if (promptEl) {
    promptEl.remove();
    promptEl = null;
  }
}

function removeResult() {
  if (resultEl) {
    resultEl.remove();
    resultEl = null;
  }
}

function removeUi() {
  removePrompt();
  removeResult();
}
