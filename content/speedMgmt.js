'use strict';

const AdSpeedHandler = (() => {
    // Configuration constants
    const CONFIG = {
        POLLING_DELAY: 250,
        TARGET_VELOCITY: 32,
        BACKUP_VELOCITIES: [50, 32, 16, 8], // Using the working version's velocities
        AD_SELECTOR: '.ad-showing, .ad-interrupting', // Check both selectors
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
                return;
            }

            // Try backup velocities
            for (const velocity of CONFIG.BACKUP_VELOCITIES) {
                if (utils.applyVelocity(velocity)) {
                    state.currentVelocity = velocity;
                    return;
                }
            }

            // Fallback to safe velocity
            state.currentVelocity = 2;
        },

        adjustPlaybackRate: (targetRate) => {
            utils.applyVelocity(targetRate);
        }
    };

    // Ad detection and handling - simplified like working version
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
            utils.sendCommand("unmute");
            window.location.reload();
        },

        processAdStart: () => {
            if (!state.adActive) {
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
            // Simplified like working version - no complex timing
            state.adActive = false;
            velocityManager.adjustPlaybackRate(state.originalRate);
            utils.sendCommand("unmute");
            utils.sendCommand("adCounter"); // Send the counter increment
        }
    };

    // Main processing cycle - simplified like working version
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
            });
            
            // Start processing cycle
            setInterval(processor.cycle, CONFIG.POLLING_DELAY);
        }
    };

    // Auto-start when DOM is ready
    const bootstrap = () => {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            processor.initialize();
        } else {
            document.addEventListener('DOMContentLoaded', processor.initialize);
        }
    };

    bootstrap();
    return { processor, utils, state };
})();