// 关键词放大镜 - Popup
const $ = (id) => document.getElementById(id);

function sendToTab(msg) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
  });
}

function save(key, value) { chrome.storage.sync.set({ [key]: value }); }

// Load state
chrome.storage.sync.get({
  enlargeEnabled: true,
  presentationMode: false,
  annotationMode: false,
  mosaicMode: false,
  drawMode: false,
  showAnnotations: true,
}, (data) => {
  $('toggle-enlarge').checked = data.enlargeEnabled;
  $('toggle-presentation').checked = data.presentationMode;
  $('toggle-annotation').checked = data.annotationMode;
  $('toggle-mosaic').checked = data.mosaicMode;
  $('toggle-draw').checked = data.drawMode;
  $('toggle-show-annotations').checked = data.showAnnotations;
});

// 选中放大
$('toggle-enlarge').addEventListener('change', () => save('enlargeEnabled', $('toggle-enlarge').checked));

// 演示模式
$('toggle-presentation').addEventListener('change', () => save('presentationMode', $('toggle-presentation').checked));

// 画笔模式
$('toggle-draw').addEventListener('change', () => save('drawMode', $('toggle-draw').checked));

// 注释模式
$('toggle-annotation').addEventListener('change', () => {
  save('annotationMode', $('toggle-annotation').checked);
  if ($('toggle-annotation').checked) {
    $('toggle-show-annotations').checked = true;
    save('showAnnotations', true);
  }
});

// 马赛克
$('toggle-mosaic').addEventListener('change', () => save('mosaicMode', $('toggle-mosaic').checked));

// 显示备注
$('toggle-show-annotations').addEventListener('change', () => save('showAnnotations', $('toggle-show-annotations').checked));

// 擦除全部
$('btn-clear-all').addEventListener('click', () => {
  if (confirm('确定擦除本页全部备注？')) sendToTab({ action: 'clearAllAnnotations' });
});
