'use strict';

const AdSpeedHandler = (() => {
    // Configuration constants - removed POLLING_DELAY
    const CONFIG = {
        TARGET_VELOCITY: 32,
        BACKUP_VELOCITIES: [50, 32, 16, 8],
        AD_SELECTOR: '.ad-showing, .ad-interrupting',
        BLOCKER_WARNING_SELECTOR: 'ytd-enforcement-message-view-model #container'
    };

    // State management
    const state = {
        currentVelocity: 16,
        originalRate: 1,
        adActive: false,
        velocityTested: false,
        playerReady: false
    };

    // Utilities that use PlayerManager
    const utils = {
        getVideoElement: () => window.PlayerManager.getMediaElement(),
        
        getCurrentRate: () => window.PlayerManager.getVelocity(),
        
        applyVelocity: (velocity) => window.PlayerManager.setVelocity(velocity),
        
        sendCommand: (command) => {
            chrome.runtime.sendMessage({ action: command });
        }
    };

    // Speed optimization system
    const velocityManager = {
        calibrateMaxVelocity: () => {
            // Test primary target first
            if (utils.applyVelocity(CONFIG.TARGET_VELOCITY)) {
                state.currentVelocity = CONFIG.TARGET_VELOCITY;
                console.log(`Using target velocity: ${CONFIG.TARGET_VELOCITY}x`);
                return;
            }

            // Try backup velocities
            for (const velocity of CONFIG.BACKUP_VELOCITIES) {
                if (utils.applyVelocity(velocity)) {
                    state.currentVelocity = velocity;
                    console.log(`Using fallback velocity: ${velocity}x`);
                    return;
                }
            }

            // Fallback to safe velocity
            state.currentVelocity = 2;
            console.log(`Using safe fallback velocity: 2x`);
        },

        adjustPlaybackRate: (targetRate) => {
            return utils.applyVelocity(targetRate);
        }
    };

    // Ad detection and handling
    const adDetector = {
        checkForAds: () => {
            const adElement = document.querySelector(CONFIG.AD_SELECTOR);
            const videoEl = utils.getVideoElement();
            const warningEl = document.querySelector(CONFIG.BLOCKER_WARNING_SELECTOR);

            return {
                adPresent: !!(adElement && videoEl),
                videoAvailable: !!videoEl,
                warningDetected: !!warningEl
            };
        },

        handleWarning: () => {
            console.log("Ad blocker warning detected, reloading page");
            utils.sendCommand("unmute");
            window.location.reload();
        },

        processAdStart: () => {
            if (!state.adActive) {
                console.log("Ad detected - starting speed control");
                state.adActive = true;
                state.originalRate = utils.getCurrentRate();
                
                // Calibrate on first ad if not done
                if (!state.velocityTested) {
                    velocityManager.calibrateMaxVelocity();
                    state.velocityTested = true;
                }
            }
            
            velocityManager.adjustPlaybackRate(state.currentVelocity);
            utils.sendCommand("mute");
        },

        processAdEnd: () => {
            if (state.adActive) {
                console.log("Ad finished - restoring normal playback");
                state.adActive = false;
                velocityManager.adjustPlaybackRate(state.originalRate);
                utils.sendCommand("unmute");
                utils.sendCommand("adCounter");
            }
        }
    };

    // Main processing cycle 
    const processor = {
        cycle: () => {
            // Only process if player is ready
            if (!window.PlayerManager.isPlayerReady()) {
                return;
            }

            const detection = adDetector.checkForAds();

            if (detection.warningDetected) {
                adDetector.handleWarning();
                return;
            }

            if (detection.adPresent) {
                adDetector.processAdStart();
            } else if (state.adActive) {
                adDetector.processAdEnd();
            }
        },

        initialize: () => {
            // Wait for PlayerManager to be ready
            window.PlayerManager.onReady(() => {
                state.playerReady = true;
                state.originalRate = utils.getCurrentRate();
                console.log("AdSpeedHandler initialized with PlayerManager");
                
                // Run initial check in case ad is already present
                processor.cycle();
            });
        }
    };

    // Auto-start when DOM is ready
    const bootstrap = () => {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            processor.initialize();
        } else {
            document.addEventListener('DOMContentLoaded', processor.initialize);
        }
        
        // Expose processor globally so MutationObserver can call it
        window.AdSpeedHandler = { 
            processor, 
            state,
            utils 
        };
    };

    bootstrap();
    
    return { 
        processor, 
        utils, 
        state,
        velocityManager,
        adDetector
    };
})();