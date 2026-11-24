export default defineBackground(() => {
  console.log('[Recare] Background service worker initialized.');

  // Open side panel when extension action icon is clicked
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn('[Recare] Failed to configure side panel behavior:', err);
    });
  }

  // Handle keyboard shortcut (e.g. Ctrl+Shift+U / Command+Shift+U)
  if (chrome.commands?.onCommand) {
    chrome.commands.onCommand.addListener(async (command) => {
      if (command === '_execute_action') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && chrome.sidePanel?.open) {
          chrome.sidePanel.open({ tabId: tab.id }).catch((err) => {
            console.warn('[Recare] Could not open side panel via shortcut:', err);
          });
        }
      }
    });
  }

  // Forward tab updates / reload notifications to sidepanel if connected
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      chrome.runtime.sendMessage({
        type: 'TAB_UPDATED',
        tabId,
        url: tab.url,
        title: tab.title,
      }).catch(() => {
        // Sidepanel may not be open, ignore harmless port closed error
      });
    }
  });
});
