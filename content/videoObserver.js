'use strict';

const MediaObserver = (() => {
    let domWatcher = null;
    let isWatching = false;

    const eventHandlers = {
        onPlaybackRateChange: () => {
            const currentMedia = window.PlayerManager?.getMediaElement();
            if (currentMedia) {
                console.log("Media playback rate modified to:", currentMedia.playbackRate);
            } else {
                console.error("Failed to get current media element on rate change.");
            }
        }
    };

    const mediaManager = {
        attachRateListener: () => {
            const currentMedia = window.PlayerManager?.getMediaElement();
            if (currentMedia) {
                currentMedia.addEventListener('ratechange', eventHandlers.onPlaybackRateChange, true);
            } else {
                console.error("Failed to attach rate listener: media element not found.");
            }
        },

        handleMediaChange: () => {
            try {
                window.PlayerManager?.refresh();
                if (window.PlayerManager?.isPlayerReady()) {
                    mediaManager.attachRateListener();
                } else {
                    console.warn("Player not ready during media change handling.");
                }
            } catch (error) {
                console.error("Error handling media change:", error);
            }
        }
    };

    const adDetectionManager = {
        hasAdElements: (node) => {
            if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
            
            if (node.classList?.contains('ad-showing') || node.classList?.contains('ad-interrupting')) {
                return true;
            }
            
            return node.querySelector?.('.ad-showing, .ad-interrupting') !== null;
        },

        hasAdBlockerWarning: (node) => {
            if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
            
            const warningSelectors = [
                'ytd-enforcement-message-view-model',
                'ytd-enforcement-message-view-model #container'
            ];
            
            for (const selector of warningSelectors) {
                if (node.matches?.(selector)) {
                    return true;
                }
            }
            
            for (const selector of warningSelectors) {
                if (node.querySelector?.(selector)) {
                    return true;
                }
            }
            
            return false;
        },

        triggerAdDetection: () => {
            try {
                window.AdSpeedHandler?.processor?.cycle();
            } catch (error) {
                console.error("Error triggering ad detection:", error);
            }
        }
    };

    const domObserver = {
        onDomChange: (changeList) => {
            let hasVideoChanges = false;
            let hasAdChanges = false;
            let hasWarningChanges = false;
            
            for (const change of changeList) {
                if (change.type === 'childList') {
                    // Video element changes
                    const videoChanges = Array.from(change.addedNodes).some(node => 
                        node.nodeType === Node.ELEMENT_NODE && 
                        (node.tagName === 'VIDEO' || node.querySelector?.('video'))
                    );
                    if (videoChanges) hasVideoChanges = true;

                    // Ad elements being added/removed
                    const adElementsChanged = Array.from([...change.addedNodes, ...change.removedNodes]).some(node => 
                        adDetectionManager.hasAdElements(node)
                    );
                    if (adElementsChanged) {
                        hasAdChanges = true;
                        console.log('🎯 Ad element change detected via childList');
                    }

                    // Warning elements
                    const warningElementsAdded = Array.from(change.addedNodes).some(node => 
                        adDetectionManager.hasAdBlockerWarning(node)
                    );
                    if (warningElementsAdded) {
                        hasWarningChanges = true;
                        console.log("Ad blocker warning detected via MutationObserver");
                    }
                } 
                else if (change.type === 'attributes' && change.attributeName === 'class') {
                    const target = change.target;
                    
                    // Check if element got/lost ad classes
                    if (target.classList?.contains('ad-showing') || target.classList?.contains('ad-interrupting')) {
                        hasAdChanges = true;
                        console.log('🎯 Ad class added:', target.className);
                    } else {
                        // Check if class was removed (element might still be in DOM)
                        const hadAdClass = change.oldValue?.includes('ad-showing') || change.oldValue?.includes('ad-interrupting');
                        if (hadAdClass) {
                            hasAdChanges = true;
                            console.log('🎯 Ad class removed from:', target.tagName);
                        }
                    }
                }
            }
            
            if (hasVideoChanges) {
                mediaManager.handleMediaChange();
            }
            
            if (hasAdChanges || hasWarningChanges) {
                // Immediate detection
                adDetectionManager.triggerAdDetection();
                
                // Additional check after brief delay for rapid changes
                setTimeout(() => {
                    adDetectionManager.triggerAdDetection();
                }, 100);
                
                // Extra safety check for class removal events
                if (hasAdChanges) {
                    setTimeout(() => {
                        adDetectionManager.triggerAdDetection();
                    }, 500);
                }
            }
        },

        startWatching: () => {
            if (!isWatching && typeof MutationObserver !== 'undefined') {
                domWatcher = new MutationObserver(domObserver.onDomChange);
                domWatcher.observe(document.documentElement, { 
                    childList: true,              // Watch for elements being added/removed
                    subtree: true,                // Watch all descendants
                    attributes: true,             // Watch for attribute changes
                    attributeFilter: ['class'],   // Only watch class changes (YouTube's method)
                    attributeOldValue: true       // Track old values to detect removals
                });
                isWatching = true;
                console.log("🛡️ Enhanced MediaObserver started - comprehensive ad detection");
            } else if (isWatching) {
                console.warn("MediaObserver is already watching.");
            } else {
                console.error("MutationObserver is not supported.");
            }
        }
    };

    const speedController = {
        adjustPlaybackVelocity: (newRate) => {
            try {
                const success = window.PlayerManager?.setVelocity(newRate);
                if (success) {
                    console.log("Media velocity adjusted to:", newRate);
                } else {
                    console.warn("Failed to adjust media velocity");
                }
            } catch (error) {
                console.error("Error adjusting playback velocity:", error);
            }
        }
    };

    const initialize = () => {
        try {
            window.PlayerManager?.onReady(() => {
                mediaManager.attachRateListener();
                console.log("MediaObserver connected to PlayerManager");
            });
            
            domObserver.startWatching();
            
            window.changeSpeed = speedController.adjustPlaybackVelocity;
        } catch (error) {
            console.error("Error during MediaObserver initialization:", error);
        }
    };

    initialize();

    return {
        mediaManager,
        speedController,
        adDetectionManager,
        isWatching: () => isWatching
    };
})();