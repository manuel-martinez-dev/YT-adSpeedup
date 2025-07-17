'use strict';

// Initialize storage on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install') return;
  chrome.storage.sync.set({ adsSkipped: 0 });
});

// Handle ad count increment
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== "adCounter") return;
  chrome.storage.sync.get("adsSkipped", (items) => {
    const currentCount = items.adsSkipped || 0;
    chrome.storage.sync.set({ 
      "adsSkipped": currentCount + 1 
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error updating adsSkipped:', chrome.runtime.lastError);
      }
    });
  });
});

// Handle tab muting for ads
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "mute") {
    chrome.tabs.update(sender.tab.id, { muted: true }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error muting:', chrome.runtime.lastError);
      }
    });
  }
  if (message.action === "unmute") {
    chrome.tabs.update(sender.tab.id, { muted: false }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error unmuting:', chrome.runtime.lastError);
      }
    });
  }
});