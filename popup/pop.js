document.addEventListener('DOMContentLoaded', function() {
    updateStats();
    loadDebuggerConsent();
    
    // Reset button functionality
    document.getElementById('resetStats').addEventListener('click', resetStatistics);

     // Debugger consent toggle
    document.getElementById('debuggerConsent').addEventListener('change', handleDebuggerConsentChange);
    
    // Listen for real-time updates
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'sync' && (changes.adCounter)) {
            updateStats();
        }
    });
});

function formatNumber(num) {
    if (num >= 1e6) {
        return `${(num / 1e6).toFixed(1)}M`;
    }
    if (num >= 1e3) {
        return `${(num / 1e3).toFixed(1)}K`;
    }
    return String(num);
}

function updateStats() {
    chrome.storage.sync.get(['adCounter', 'warningCounter', 'reloadCounter'], function(items) {
        const adCountered = items.adCounter || 0;
        const warningHit = items.warningCounter || 0;
        const reloadCount = items.reloadCounter || 0;
        
        // Update ads skipped display
        document.getElementById('adCounter').textContent = formatNumber(adCountered);
        document.getElementById('warningCounter').textContent = formatNumber(warningHit);
        document.getElementById('refreshCount').textContent = formatNumber(reloadCount);

        // Debugging output
        console.log('stats updated:', { adCountered, warningHit, reloadCount });
    });
}

function loadDebuggerConsent() {
    chrome.storage.sync.get(['debuggerConsent'], function(items) {
        const consent = items.debuggerConsent || false;
        document.getElementById('debuggerConsent').checked = consent;
        console.log('Loaded debugger consent:', consent);
    });
}

function handleDebuggerConsentChange(event) {
    const isEnabled = event.target.checked;
    
    if (isEnabled) {
        // Show confirmation dialog
        const confirmed = confirm(
            'Enhanced Skip Click uses the browser debugger API to provide more reliable clicking.\n\n' +
            'This requires additional permissions but can improve ad skipping effectiveness.\n\n' +
            'Do you want to enable this feature?'
        );
        
        if (confirmed) {
            chrome.storage.sync.set({ 'debuggerConsent': true }, function() {
                if (chrome.runtime.lastError) {
                    console.error('Error saving debugger consent:', chrome.runtime.lastError);
                    event.target.checked = false;
                } else {
                    // Notify background script
                    chrome.runtime.sendMessage({ action: 'debuggerConsentChanged', enabled: true });
                }
            });
        } else {
            // User declined, keep toggle off
            event.target.checked = false;
        }
    } else {
        // Disable the feature
        chrome.storage.sync.set({ 'debuggerConsent': false }, function() {
            if (chrome.runtime.lastError) {
                console.error('Error saving debugger consent:', chrome.runtime.lastError);
            } else {
                // Notify background script
                chrome.runtime.sendMessage({ action: 'debuggerConsentChanged', enabled: false });
            }
        });
    }
}


function resetStatistics() {
    if (confirm('Are you sure you want to reset stats?')) {
        chrome.storage.sync.set({ 
            'adCounter': 0,
            'warningCounter': 0,
            'reloadCounter': 0
        }, function() {
            if (chrome.runtime.lastError) {
                console.error('Error resetting statistics:', chrome.runtime.lastError);
            } else {
                console.log('Statistics reset successfully');
                updateStats();
            }
        });
    }
}