// 关键词放大镜 - Content Script
// 功能: 放大 / 演示模式(大鼠标+备注) / 注释 / 马赛克

// ============ 全局状态 ============
let state = {
  enlargeEnabled: true,
  presentationMode: false,
  annotationMode: false,
  mosaicMode: false,
  showAnnotations: true,
};

let cursorOverlay = null;
let modeHint = null;
let cursorListeners = { move: null, down: null, up: null };

// 加载状态
chrome.storage.sync.get({
  enlargeEnabled: true,
  presentationMode: false,
  annotationMode: false,
  mosaicMode: false,
  showAnnotations: true,
}, (data) => {
  Object.assign(state, data);
  if (state.presentationMode) enablePresentationMode();
  else disablePresentationMode();
  if (state.annotationMode) showModeBar('annotation');
  if (state.mosaicMode) showModeBar('mosaic');
  applyAnnotationVisibility();
});

// 监听变化
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enlargeEnabled !== undefined) state.enlargeEnabled = changes.enlargeEnabled.newValue;
  if (changes.annotationMode !== undefined) {
    state.annotationMode = changes.annotationMode.newValue;
    state.annotationMode ? showModeBar('annotation') : hideModeBar('annotation');
  }
  if (changes.mosaicMode !== undefined) {
    state.mosaicMode = changes.mosaicMode.newValue;
    state.mosaicMode ? showModeBar('mosaic') : hideModeBar('mosaic');
    updateCursorStyle();
  }
  if (changes.showAnnotations !== undefined) {
    state.showAnnotations = changes.showAnnotations.newValue;
    applyAnnotationVisibility();
  }
  if (changes.presentationMode !== undefined) {
    state.presentationMode = changes.presentationMode.newValue;
    state.presentationMode ? enablePresentationMode() : disablePresentationMode();
  }
});

// ============ 核心放大逻辑 ============

function doEnlarge() {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const text = sel.toString().trim();
  if (!text || text.length > 200) return;

  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.className = 'enlarged-selection';
  span.title = `${text.length} 字符`;

  try { range.surroundContents(span); }
  catch (e) {
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
  sel.removeAllRanges();
}

// ============ 统一点击派发 ============

document.addEventListener('click', (e) => {
  // 忽略注释/马赛克 UI 元素
  if (e.target.closest('.annotation-input-popup')) return;

  // 1) 注释模式: Alt+Click
  if (state.annotationMode && e.altKey) {
    handleAnnotationClick(e);
    return;
  }

  // 2) 马赛克模式: 点击文字 → 打码 / 取消打码
  if (state.mosaicMode && handleMosaicClick(e)) {
    e.preventDefault();
    return;
  }

  // 3) 放大: Ctrl/Cmd+Click
  if (state.enlargeEnabled && (e.ctrlKey || e.metaKey)) {
    handleEnlargeClick(e);
    return;
  }
  // 否则 → 正常点击行为
}, true);

// ============ 拖选放大 ============

document.addEventListener('mouseup', () => {
  if (!state.enlargeEnabled) return;
  doEnlarge();
});

// ============ Ctrl/Cmd+Click 放大单词 ============

function handleEnlargeClick(e) {
  if (e.target.closest('.annotation-badge') || e.target.closest('.annotation-input-popup')) return;
  if (e.target.closest('a')) return;

  const range = document.caretRangeFromPoint(e.clientX, e.clientY);
  if (!range) return;
  const tn = range.startContainer;
  if (!tn || tn.nodeType !== Node.TEXT_NODE) return;

  const text = tn.textContent, off = range.startOffset;
  let s = off; while (s > 0 && /\S/.test(text[s - 1])) s--;
  let en = off; while (en < text.length && /\S/.test(text[en])) en++;
  if (s === en) return;

  const wr = document.createRange();
  wr.setStart(tn, s); wr.setEnd(tn, en);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(wr);
  e.preventDefault();
  doEnlarge();
}

// ============ 演示模式 ============

function enablePresentationMode() {
  enableBigCursor();
  // 给已有注释加上删除按钮
  document.querySelectorAll('.annotation-badge').forEach(addDeleteBtn);
  // 右下角提示
  if (!modeHint) {
    modeHint = document.createElement('div');
    modeHint.className = 'presentation-mode-hint';
    modeHint.textContent = '🖥️ 演示模式';
    document.body.appendChild(modeHint);
  }
}

function disablePresentationMode() {
  disableBigCursor();
  document.querySelectorAll('.annotation-delete').forEach(el => el.remove());
  if (modeHint) { modeHint.remove(); modeHint = null; }
}

// ============ 大鼠标 ============

function enableBigCursor() {
  if (cursorOverlay) return;
  document.body.classList.add('presentation-mode');

  cursorOverlay = document.createElement('div');
  cursorOverlay.className = 'presentation-cursor';
  document.body.appendChild(cursorOverlay);
  updateCursorStyle();

  cursorListeners.move = (e) => {
    if (cursorOverlay) { cursorOverlay.style.left = e.clientX + 'px'; cursorOverlay.style.top = e.clientY + 'px'; }
  };
  cursorListeners.down = () => cursorOverlay?.classList.add('active');
  cursorListeners.up = () => cursorOverlay?.classList.remove('active');

  document.addEventListener('mousemove', cursorListeners.move);
  document.addEventListener('mousedown', cursorListeners.down);
  document.addEventListener('mouseup', cursorListeners.up);
}

function disableBigCursor() {
  document.body.classList.remove('presentation-mode');
  if (cursorOverlay) { cursorOverlay.remove(); cursorOverlay = null; }
  if (cursorListeners.move) document.removeEventListener('mousemove', cursorListeners.move);
  if (cursorListeners.down) document.removeEventListener('mousedown', cursorListeners.down);
  if (cursorListeners.up) document.removeEventListener('mouseup', cursorListeners.up);
}

function updateCursorStyle() {
  if (!cursorOverlay) return;
  cursorOverlay.className = 'presentation-cursor';
  if (state.mosaicMode) cursorOverlay.classList.add('mosaic-mode-cursor');
  else if (state.annotationMode) cursorOverlay.classList.add('annotation-mode-cursor');
}

// ============ 注释模式 Alt+Click ============

function handleAnnotationClick(e) {
  e.preventDefault();
  e.stopPropagation();

  if (e.target.closest('.annotation-badge') || e.target.closest('.annotation-input-popup')) return;

  // 删除已有输入框
  document.querySelector('.annotation-input-popup')?.remove();

  const popup = document.createElement('div');
  popup.className = 'annotation-input-popup';
  popup.innerHTML = `
    <input type="text" class="annotation-input" placeholder="输入中文注释..." autofocus>
    <div class="annotation-input-actions">
      <button class="annotation-btn-cancel">取消</button>
      <button class="annotation-btn-save">保存</button>
    </div>
  `;
  document.body.appendChild(popup);

  const rect = e.target.getBoundingClientRect();
  let left = rect.right + 10;
  if (left + 260 > window.innerWidth) left = Math.max(4, rect.left - 260);
  popup.style.left = left + 'px';
  popup.style.top = (rect.top + window.scrollY - 5) + 'px';

  const input = popup.querySelector('.annotation-input');
  input.focus();

  const save = () => {
    const txt = input.value.trim();
    if (txt) addAnnotation(e.target, txt);
    popup.remove();
  };
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') save(); if (ev.key === 'Escape') popup.remove(); });
  popup.querySelector('.annotation-btn-save').addEventListener('click', save);
  popup.querySelector('.annotation-btn-cancel').addEventListener('click', () => popup.remove());
}

function addAnnotation(element, text) {
  let badge = element.querySelector('.annotation-badge');
  if (badge) {
    badge.textContent = '📌 ' + text;
    badge.dataset.annotation = text;
    badge.title = text;
    if (state.presentationMode) addDeleteBtn(badge);
    return;
  }

  badge = document.createElement('span');
  badge.className = 'annotation-badge';
  badge.textContent = '📌 ' + text;
  badge.dataset.annotation = text;
  badge.title = text;

  if (state.presentationMode) addDeleteBtn(badge);
  badge.style.display = state.showAnnotations ? 'inline-block' : 'none';

  element.parentNode?.insertBefore(badge, element.nextSibling);
  element.classList.add('has-annotation');
}

function addDeleteBtn(badge) {
  if (badge.querySelector('.annotation-delete')) return;
  const btn = document.createElement('button');
  btn.className = 'annotation-delete';
  btn.textContent = '✕';
  btn.title = '擦除此备注';
  btn.addEventListener('click', (ev) => { ev.stopPropagation(); badge.remove(); });
  badge.appendChild(btn);
}

function clearAllAnnotations() {
  document.querySelectorAll('.annotation-badge').forEach(el => el.remove());
  document.querySelectorAll('.has-annotation').forEach(el => el.classList.remove('has-annotation'));
}

function applyAnnotationVisibility() {
  document.querySelectorAll('.annotation-badge').forEach(el => {
    el.style.display = state.showAnnotations ? 'inline-block' : 'none';
  });
}

// ============ 马赛克模式 ============

let mosaicBars = [];

function showModeBar(type) {
  hideModeBar(type);
  const bar = document.createElement('div');
  bar.id = type + '-mode-bar';
  if (type === 'annotation') {
    bar.innerHTML = `📝 注释模式 — <strong>Alt+点击</strong> 添加中文备注`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭';
    closeBtn.style.cssText = 'margin-left:12px; padding:2px 10px; border:none; border-radius:4px; background:rgba(255,255,255,0.3); color:white; cursor:pointer; font-size:12px;';
    closeBtn.addEventListener('click', () => chrome.storage.sync.set({ annotationMode: false }));
    bar.appendChild(closeBtn);
  } else {
    bar.innerHTML = `🫥 马赛克模式 — 点击文字打码 · 再次点击取消 · 悬停可预览`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭';
    closeBtn.style.cssText = 'margin-left:12px; padding:2px 10px; border:none; border-radius:4px; background:rgba(255,255,255,0.3); color:white; cursor:pointer; font-size:12px;';
    closeBtn.addEventListener('click', () => chrome.storage.sync.set({ mosaicMode: false }));
    bar.appendChild(closeBtn);
  }
  document.body.prepend(bar);
  mosaicBars.push(bar);
  updateCursorStyle();
}

function hideModeBar(type) {
  const bar = document.getElementById(type + '-mode-bar');
  if (bar) { bar.remove(); }
  mosaicBars = mosaicBars.filter(b => b.id !== type + '-mode-bar');
}

// 处理马赛克点击
function handleMosaicClick(e) {
  // 忽略交互元素
  if (e.target.closest('a') || e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea')) return false;
  if (e.target.closest('.annotation-badge') || e.target.closest('.annotation-input-popup') || e.target.closest('.annotation-mode-bar')) return false;

  // 检查是否点击了已有马赛克
  const existing = e.target.closest('.mosaic-span');
  if (existing) {
    // 取消马赛克: 展开内容，删除包裹
    const parent = existing.parentNode;
    while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
    parent.removeChild(existing);
    parent.normalize();
    return true;
  }

  // 选中文字 → 马赛克选中部分
  const sel = window.getSelection();
  if (!sel.isCollapsed) {
    const txt = sel.toString().trim();
    if (txt && txt.length <= 200) {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.className = 'mosaic-span';
      span.addEventListener('click', () => {
        // 点击已打码文字 → 取消马赛克（由上面的 existing 处理）
      });
      try { range.surroundContents(span); }
      catch (ex) {
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
      }
      sel.removeAllRanges();
      return true;
    }
  }

  // 没有选中 → 马赛克光标下的单词
  const range = document.caretRangeFromPoint(e.clientX, e.clientY);
  if (!range) return false;
  const tn = range.startContainer;
  if (!tn || tn.nodeType !== Node.TEXT_NODE) return false;
  const text = tn.textContent, off = range.startOffset;
  let s = off; while (s > 0 && /\S/.test(text[s - 1])) s--;
  let en = off; while (en < text.length && /\S/.test(text[en])) en++;
  if (s === en) return false;

  const wr = document.createRange();
  wr.setStart(tn, s); wr.setEnd(tn, en);
  const span = document.createElement('span');
  span.className = 'mosaic-span';
  try { wr.surroundContents(span); }
  catch (ex) {
    const frag = wr.extractContents();
    span.appendChild(frag);
    wr.insertNode(span);
  }
  sel.removeAllRanges();
  return true;
}

// ============ 接收 popup 消息 ============

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'clearAllAnnotations') {
    clearAllAnnotations();
    return Promise.resolve({ ok: true });
  }
});
