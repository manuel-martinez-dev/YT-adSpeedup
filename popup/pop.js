document.addEventListener('DOMContentLoaded', function() {
    updateStats();
    
    // Reset button functionality
    document.getElementById('resetStats').addEventListener('click', resetStatistics);
    
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