document.addEventListener('DOMContentLoaded', function() {
    updateStats();
    
    // Reset button functionality
    document.getElementById('resetStats').addEventListener('click', resetStatistics);
    
    // Listen for real-time updates
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'sync' && (changes.adsSkipped)) {
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
    chrome.storage.sync.get(['adCounter'], function(items) {
        const adsSkipped = items.adsSkipped || 0;
        
        // Update ads skipped display
        document.getElementById('adCounter').textContent = formatNumber(adsSkipped);
    });
}

function resetStatistics() {
    if (confirm('Are you sure you want to reset stats?')) {
        chrome.storage.sync.set({ 
            'adsSkipped': 0,
        }, function() {
            updateStats();
        });
    }
}