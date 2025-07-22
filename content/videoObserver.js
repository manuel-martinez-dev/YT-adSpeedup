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

    const adDetectionManager = {
        // Check if a node or its children contain ad elements
        hasAdElements: (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            
            // Check if the node itself has ad classes
            if (node.classList?.contains('ad-showing') || 
                node.classList?.contains('ad-interrupting')) {
                return true;
            }
            
            // Check if any child elements have ad classes
            return node.querySelector?.('.ad-showing, .ad-interrupting') !== null;
        },

        // Check if a node contains ad blocker warning elements
        hasAdBlockerWarning: (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            
            // Check for ad blocker warning selectors
            const warningSelectors = [
                'ytd-enforcement-message-view-model',
                'ytd-enforcement-message-view-model #container'
            ];
            
            // Check if the node itself matches warning selectors
            for (const selector of warningSelectors) {
                if (node.matches?.(selector)) {
                    return true;
                }
            }
            
            // Check if any child elements match warning selectors
            for (const selector of warningSelectors) {
                if (node.querySelector?.(selector)) {
                    return true;
                }
            }
            
            return false;
        },

        // Trigger ad detection cycle
        triggerAdDetection: () => {
            if (window.AdSpeedHandler?.processor?.cycle) {
                window.AdSpeedHandler.processor.cycle();
            }
        }
    };

    const domObserver = {
        onDomChange: (changeList) => {
            let hasVideoChanges = false;
            let hasAdChanges = false;
            let hasWarningChanges = false;
            
            for (const change of changeList) {
                // Handle childList changes (elements added/removed)
                if (change.type === 'childList') {
                    // Check for video element changes
                    const videoChanges = Array.from(change.addedNodes).some(node => 
                        node.nodeType === Node.ELEMENT_NODE && 
                        (node.tagName === 'VIDEO' || node.querySelector?.('video'))
                    );
                    
                    if (videoChanges) {
                        hasVideoChanges = true;
                    }

                    // Check for ad elements being added/removed
                    const adElementsChanged = Array.from([...change.addedNodes, ...change.removedNodes]).some(node => 
                        adDetectionManager.hasAdElements(node)
                    );
                    
                    // Check for ad blocker warning elements being added
                    const warningElementsAdded = Array.from(change.addedNodes).some(node => 
                        adDetectionManager.hasAdBlockerWarning(node)
                    );
                    
                    if (adElementsChanged) {
                        hasAdChanges = true;
                    }
                    
                    if (warningElementsAdded) {
                        hasWarningChanges = true;
                        console.log("Ad blocker warning detected via MutationObserver");
                    }
                }
                
                // Handle attribute changes (class modifications)
                else if (change.type === 'attributes' && change.attributeName === 'class') {
                    const target = change.target;
                    if (target.classList?.contains('ad-showing') || 
                        target.classList?.contains('ad-interrupting')) {
                        hasAdChanges = true;
                    }
                }
            }
            
            // Handle video changes
            if (hasVideoChanges) {
                mediaManager.handleMediaChange();
            }
            
            // Handle ad or warning changes - trigger detection immediately
            if (hasAdChanges || hasWarningChanges) {
                // Small delay to ensure DOM is settled
                setTimeout(() => {
                    adDetectionManager.triggerAdDetection();
                }, 10);
            }
        },

        startWatching: () => {
            if (!isWatching) {
                domWatcher = new MutationObserver(domObserver.onDomChange);
                domWatcher.observe(document.documentElement, { 
                    childList: true,          // Watch for elements being added/removed
                    subtree: true,            // Watch all descendants
                    attributes: true,         // Watch for attribute changes
                    attributeFilter: ['class'] // Only watch class attribute changes
                });
                isWatching = true;
                console.log("MediaObserver started watching for video and ad changes");
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
        adDetectionManager,
        isWatching: () => isWatching
    };
})();