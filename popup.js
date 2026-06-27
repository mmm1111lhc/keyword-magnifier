// 关键词放大镜 - Popup
const $ = (id) => document.getElementById(id);

// 获取当前标签页，发送消息到 content script
function sendToTab(msg) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
    }
  });
}

// 保存并同步状态到 storage
function save(key, value) {
  chrome.storage.sync.set({ [key]: value });
}

// 加载状态
chrome.storage.sync.get({
  enlargeEnabled: true,
  presentationMode: false,
  annotationMode: false,
  mosaicMode: false,
  showAnnotations: true,
}, (data) => {
  $('toggle-enlarge').checked = data.enlargeEnabled;
  $('toggle-presentation').checked = data.presentationMode;
  $('toggle-annotation').checked = data.annotationMode;
  $('toggle-mosaic').checked = data.mosaicMode;
  $('toggle-show-annotations').checked = data.showAnnotations;
});

// 切换：选中放大
$('toggle-enlarge').addEventListener('change', () => {
  save('enlargeEnabled', $('toggle-enlarge').checked);
});

// 切换：演示模式
$('toggle-presentation').addEventListener('change', () => {
  save('presentationMode', $('toggle-presentation').checked);
});

// 切换：注释模式
$('toggle-annotation').addEventListener('change', () => {
  save('annotationMode', $('toggle-annotation').checked);
  // 开启注释时自动显示注释
  if ($('toggle-annotation').checked) {
    $('toggle-show-annotations').checked = true;
    save('showAnnotations', true);
  }
});

// 切换：马赛克模式
$('toggle-mosaic').addEventListener('change', () => {
  save('mosaicMode', $('toggle-mosaic').checked);
});

// 切换：显示注释
$('toggle-show-annotations').addEventListener('change', () => {
  save('showAnnotations', $('toggle-show-annotations').checked);
});

// 擦除全部备注
$('btn-clear-all').addEventListener('click', () => {
  if (confirm('确定擦除本页全部备注？')) {
    sendToTab({ action: 'clearAllAnnotations' });
  }
});
