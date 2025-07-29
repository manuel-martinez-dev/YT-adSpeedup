'use strict';

// Initialize storage on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install') return;
  chrome.storage.sync.set({ adCounter: 0, warningCounter: 0, reloadCounter: 0 });
});

// Handle ad count increment
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== "adCounter") return;
  chrome.storage.sync.get("adCounter", (items) => {
    const currentCount = items.adCounter || 0;
    chrome.storage.sync.set({ 
      "adCounter": currentCount + 1 
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error updating adCounter:', chrome.runtime.lastError);
      }
    });
  });
});

// Handle warning message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "warningDetected") {
    chrome.storage.sync.get("warningCounter", (items) => {
      const currentCount = items.warningCounter || 0;
      chrome.storage.sync.set({ 
        "warningCounter": currentCount + 1 
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error updating warningCounter:', chrome.runtime.lastError);
        }
      });
    });
  }
});

// Handle page reload icrement
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "pageReload") {
    chrome.storage.sync.get("reloadCounter", (items) => {
      const currentCount = items.reloadCounter || 0;
      chrome.storage.sync.set({ 
        "reloadCounter": currentCount + 1 
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error updating reloadCounter:', chrome.runtime.lastError);
        }
      });
    });
  }
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