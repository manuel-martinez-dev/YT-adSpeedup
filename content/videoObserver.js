'use strict';

const MediaObserver = (() => {
    let domWatcher = null;
    let isWatching = false;

    const eventHandlers = {
        onPlaybackRateChange: () => {
            const currentMedia = window.PlayerManager.getMediaElement();
            if (currentMedia) {
                console.log("Media playback rate modified to:", currentMedia.playbackRate);
            }
        }
    };

    const mediaManager = {
        attachRateListener: () => {
            const currentMedia = window.PlayerManager.getMediaElement();
            if (currentMedia) {
                currentMedia.addEventListener('ratechange', eventHandlers.onPlaybackRateChange, true);
            }
        },

        handleMediaChange: () => {
            // Refresh PlayerManager when DOM changes
            window.PlayerManager.refresh();
            
            // Re-attach event listeners
            if (window.PlayerManager.isPlayerReady()) {
                mediaManager.attachRateListener();
            }
        }
    };

    const domObserver = {
        onDomChange: (changeList) => {
            let shouldRefresh = false;
            
            for (const change of changeList) {
                if (change.type === 'childList') {
                    // Check if video-related elements were added/removed
                    const hasVideoChanges = Array.from(change.addedNodes).some(node => 
                        node.nodeType === Node.ELEMENT_NODE && 
                        (node.tagName === 'VIDEO' || node.querySelector('video'))
                    );
                    
                    if (hasVideoChanges) {
                        shouldRefresh = true;
                        break;
                    }
                }
            }
            
            if (shouldRefresh) {
                mediaManager.handleMediaChange();
            }
        },

        startWatching: () => {
            if (!isWatching) {
                domWatcher = new MutationObserver(domObserver.onDomChange);
                domWatcher.observe(document.documentElement, { 
                    childList: true, 
                    subtree: true 
                });
                isWatching = true;
            }
        }
    };

    const speedController = {
        adjustPlaybackVelocity: (newRate) => {
            const success = window.PlayerManager.setVelocity(newRate);
            if (success) {
                console.log("Media velocity adjusted to:", newRate);
            } else {
                console.log("Failed to adjust media velocity");
            }
        }
    };

    const initialize = () => {
        // Wait for PlayerManager to be ready
        window.PlayerManager.onReady(() => {
            mediaManager.attachRateListener();
            console.log("MediaObserver connected to PlayerManager");
        });
        
        // Start DOM observation
        domObserver.startWatching();
        
        // Expose global speed control
        window.changeSpeed = speedController.adjustPlaybackVelocity;
    };

    // Start the system
    initialize();

    return {
        mediaManager,
        speedController,
        isWatching: () => isWatching
    };
})();