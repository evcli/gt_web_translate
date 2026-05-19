const TARGET_LANG = "zh-CN";
const MAX_TEXT_LENGTH = 1000;
const SELECTION_DEBOUNCE_MS = 120;

let promptEl = null;
let resultEl = null;
let lastSelection = "";
let lastRect = null;
let selectionTimer = null;
let showInlinePrompt = true;
let lastMousePos = null;
let clickTimeout = null;
let promptFadeTimeout = null;

// Load initial setting
chrome.storage.sync.get({ showInlinePrompt: true }, (items) => {
  showInlinePrompt = items.showInlinePrompt;
});

// Listen for setting changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.showInlinePrompt) {
    showInlinePrompt = changes.showInlinePrompt.newValue;
    if (!showInlinePrompt) {
      removeUi();
    }
  }
});


const styles = {
  prompt: "gt-inline-prompt",
  result: "gt-inline-result",
  loading: "gt-inline-loading",
};

document.addEventListener("mousedown", (e) => {
  // Cancel any pending timers immediately on mouse press
  if (clickTimeout) {
    clearTimeout(clickTimeout);
    clickTimeout = null;
  }
  if (selectionTimer) {
    clearTimeout(selectionTimer);
    selectionTimer = null;
  }

  // If clicking outside prompt or result, remove UI immediately
  if (promptEl?.contains(e.target) || resultEl?.contains(e.target)) return;
  removeUi();
});

document.addEventListener("mouseup", (e) => {
  // Ignore mouseup events inside the prompt button or translation panel to avoid resetting selection state
  if (promptEl?.contains(e.target) || resultEl?.contains(e.target)) return;

  lastMousePos = { x: e.pageX, y: e.pageY };

  if (clickTimeout) {
    clearTimeout(clickTimeout);
    clickTimeout = null;
  }

  // If it's a double-click, delay to see if it turns into a triple-click
  if (e.detail === 2) {
    clickTimeout = setTimeout(() => {
      handleSelectionChange();
      clickTimeout = null;
    }, 250); // 250ms window to catch a potential third click (mousedown clears this)
  } else {
    // Single click/drag-select (detail === 1) or triple-click (detail === 3)
    handleSelectionChange();
  }
});
document.addEventListener("keyup", () => {
  lastMousePos = null; // Keyup has no mouse coordinates, fallback to selection rect
  handleSelectionChange();
});
document.addEventListener("touchend", (e) => {
  if (e.changedTouches && e.changedTouches.length > 0) {
    lastMousePos = { x: e.changedTouches[0].pageX, y: e.changedTouches[0].pageY };
  } else {
    lastMousePos = null;
  }
  handleSelectionChange();
});
window.addEventListener("scroll", removeUi, { passive: true });
window.addEventListener("resize", removeUi);
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "CONTEXT_TRANSLATE") {
    handleContextTranslate(message.text);
  }
});
// Note: mousedown event listener already handles removing the UI when clicking outside.

function handleSelectionChange() {
  if (selectionTimer) clearTimeout(selectionTimer);
  selectionTimer = setTimeout(processSelection, SELECTION_DEBOUNCE_MS);
}

function processSelection() {
  if (!showInlinePrompt) return;
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

  if (lastMousePos) {
    // Position slightly offset from the mouse pointer (bottom-right)
    promptEl.style.top = `${lastMousePos.y + 12}px`;
    promptEl.style.left = `${lastMousePos.x + 12}px`;
  } else {
    // Fallback to text selection bounding box
    promptEl.style.top = `${window.scrollY + rect.top - 32}px`;
    promptEl.style.left = `${window.scrollX + rect.left}px`;
  }

  promptEl.addEventListener("click", onTranslateClick);
  promptEl.addEventListener("mouseenter", onTranslateClick); // Hover to translate!

  document.body.appendChild(promptEl);

  // Set a 2.5 seconds auto-fade out timeout to avoid visual clutter
  promptFadeTimeout = setTimeout(() => {
    removePrompt();
  }, 2500);
}

function onTranslateClick(e) {
  e.stopPropagation();
  if (!lastSelection) return;
  removePrompt(); // Remove 'T' button immediately upon click to make way for result panel
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
  if (promptFadeTimeout) {
    clearTimeout(promptFadeTimeout);
    promptFadeTimeout = null;
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
