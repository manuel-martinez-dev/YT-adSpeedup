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
    console.log("Background received warningDetected message");
    chrome.storage.sync.get("warningCounter", (items) => {
      const currentCount = items.warningCounter || 0;
      console.log(`Warning counter: ${currentCount} → ${currentCount + 1}`);
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

// Handle page reload increment
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "pageReload") {
    console.log("Background received pageReload message");
    chrome.storage.sync.get("reloadCounter", (items) => {
      const currentCount = items.reloadCounter || 0;
      console.log(`Reload counter: ${currentCount} → ${currentCount + 1}`);
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

// handle trusted clicks via debugger API
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "trustedSkipClick") {
    const target = { tabId: sender.tab.id };

    chrome.debugger.attach(target, "1.2", function() { 
      if (chrome.runtime.lastError) {
        console.error('Debugger attach failed:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      console.log('Debugger attached - processing click');

      // Mouse interaction sequence for trusted click
      chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: message.x,
        y: message.y,
      }, () => {
        chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mousePressed",
          button: "left",
          x: message.x,
          y: message.y,
          clickCount: 1,
        }, () => {
          setTimeout(() => {
            chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
              type: "mouseReleased",
              button: "left",
              x: message.x,
              y: message.y,
              clickCount: 1,
            }, () => {
              chrome.debugger.detach(target);
              console.log('Trusted click completed');
              sendResponse({ success: true });

            });
          }, 50);
        });
      });
  });

      return true;
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