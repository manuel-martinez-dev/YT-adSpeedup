'use strict';

const AdSpeedHandler = (() => {
    // Configuration constants
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
        playerReady: false,
        adStartTime: null,
        lastAdCheck: null
    };

    // Utilities that use PlayerManager
    const utils = {
        getVideoElement: () => window.PlayerManager?.getMediaElement(),
        
        getCurrentRate: () => window.PlayerManager?.getVelocity(),
        
        applyVelocity: (velocity) => window.PlayerManager?.setVelocity(velocity),
        
        sendCommand: (command) => {
            try {
                chrome.runtime.sendMessage({ action: command });
            } catch (error) {
                console.error('Error sending command:', command, error);
            }
        }
    };

    // Speed optimization system
    const velocityManager = {
        calibrateMaxVelocity: () => {
            // Test primary target first
            if (utils.applyVelocity(CONFIG.TARGET_VELOCITY)) {
                state.currentVelocity = CONFIG.TARGET_VELOCITY;
                // console.log(`Using target velocity: ${CONFIG.TARGET_VELOCITY}x`);
                return;
            }

            // Try backup velocities
            for (const velocity of CONFIG.BACKUP_VELOCITIES) {
                if (utils.applyVelocity(velocity)) {
                    state.currentVelocity = velocity;
                    // console.log(`Using fallback velocity: ${velocity}x`);
                    return;
                }
            }

            // Fallback to safe velocity
            state.currentVelocity = 2;
            // console.log(`Using safe fallback velocity: 2x`);
        },

        adjustPlaybackRate: (targetRate) => {
            return utils.applyVelocity(targetRate);
        }
    };

    // Enhanced ad detection with multiple methods
    const adDetector = {
        checkForAds: () => {
            const videoEl = utils.getVideoElement();
            if (!videoEl) return { adPresent: false, videoAvailable: false, warningDetected: false };

            // Primary ad detection
            const adElement = document.querySelector(CONFIG.AD_SELECTOR);
            
            // Additional ad indicators for reliability
            const additionalAdIndicators = [
                document.querySelector('.ytp-ad-player-overlay-layout'),
                document.querySelector('.ytp-skip-ad-button'),
            ].some(el => el !== null);

            // Warning detection
            const warningEl = document.querySelector(CONFIG.BLOCKER_WARNING_SELECTOR);

            // Update last check time
            state.lastAdCheck = Date.now();

            return {
                adPresent: !!(adElement || additionalAdIndicators) && !!videoEl,
                videoAvailable: !!videoEl,
                warningDetected: !!warningEl
            };
        },

        validateState: () => {
            const detection = adDetector.checkForAds();
            
            // Check for inconsistent state
            if (state.adActive && !detection.adPresent) {
                console.warn('State inconsistency: adActive=true but no ad found');
                return false;
            }
            
            if (!state.adActive && detection.adPresent) {
                console.warn('State inconsistency: adActive=false but ad found');
                return false;
            }
            
            return true;
        },

        forceStateSync: () => {
            // console.log('Forcing state synchronization');
            const detection = adDetector.checkForAds();
            
            if (detection.adPresent && !state.adActive) {
                // console.log('Syncing: Starting ad state');
                adDetector.processAdStart();
            } else if (!detection.adPresent && state.adActive) {
                // console.log('Syncing: Ending ad state');
                adDetector.processAdEnd();
            }
        },

        handleWarning: () => {
            // console.log("Ad blocker warning detected - reloading page");
            utils.sendCommand("unmute");
            
            // Small delay to ensure unmute command is processed
            setTimeout(() => {
                window.location.reload();
            }, 150);
        },

        processAdStart: () => {
            if (!state.adActive) {
                // console.log("Ad detected - starting speed control");
                state.adActive = true;
                state.adStartTime = Date.now();
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
                // console.log("Ad finished - restoring normal playback");
                state.adActive = false;
                state.adStartTime = null;
                velocityManager.adjustPlaybackRate(state.originalRate);
                utils.sendCommand("unmute");
                utils.sendCommand("adCounter");
            }
        }
    };

    // Defensive systems to prevent stuck muting
    const defensiveSystem = {
        // Check for stuck state on tab visibility
        handleVisibilityChange: () => {
            if (!document.hidden) { // Tab became visible
                setTimeout(() => {
                    if (!adDetector.validateState()) {
                        console.warn('Fixed state inconsistency on tab focus');
                        adDetector.forceStateSync();
                    }
                }, 1000);
            }
        },

        // Video event handlers for additional safety
        handleVideoEvents: () => {
            const video = utils.getVideoElement();
            if (video) {
                // When video plays normally, ensure we're not stuck muted
                video.addEventListener('play', () => {
                    setTimeout(() => {
                        if (state.adActive && !adDetector.checkForAds().adPresent) {
                            console.warn('Video playing but stuck in ad state - fixing');
                            adDetector.processAdEnd();
                        }
                    }, 1000);
                });

                // Check state consistency when video pauses
                video.addEventListener('pause', () => {
                    if (!adDetector.validateState()) {
                        console.warn('State inconsistency on pause - fixing');
                        adDetector.forceStateSync();
                    }
                });
            }
        },

        // Timeout protection for ads that run too long
        handleAdTimeout: () => {
            if (state.adStartTime) {
                const adDuration = Date.now() - state.adStartTime;
                // If ad has been "playing" for more than 3 minutes, force cleanup
                if (adDuration > 180000) { // 3 minutes
                    console.warn('Ad timeout detected - forcing cleanup');
                    adDetector.processAdEnd();
                }
            }
        },

        // Periodic state validation (lightweight, only when ad is supposed to be active)
        periodicCheck: () => {
            // Only check if we think an ad is active (not continuous polling)
            if (state.adActive) {
                // Validate that ad is actually still there
                const detection = adDetector.checkForAds();
                if (!detection.adPresent) {
                    console.warn('Periodic check found no ad but state is active - fixing');
                    adDetector.processAdEnd();
                }
                
                // Check for timeout
                defensiveSystem.handleAdTimeout();
            }
        },

        // Initialize all defensive mechanisms
        initialize: () => {
            // Page visibility handler
            document.addEventListener('visibilitychange', defensiveSystem.handleVisibilityChange);
            
            // Video event handlers
            window.PlayerManager?.onReady(() => {
                defensiveSystem.handleVideoEvents();
            });

            // Periodic validation - only runs when we think ad is active
            setInterval(() => {
                defensiveSystem.periodicCheck();
            }, 5000); // Check every 5 seconds, only when needed

            // console.log('Defensive systems initialized');
        }
    };

    // Main processing cycle
    const processor = {
        cycle: () => {
            // Only process if player is ready
            if (!window.PlayerManager?.isPlayerReady()) {
                return;
            }

            // Validate current state first
            if (!adDetector.validateState()) {
                adDetector.forceStateSync();
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
            window.PlayerManager?.onReady(() => {
                state.playerReady = true;
                state.originalRate = utils.getCurrentRate();                
                // Initialize defensive systems
                defensiveSystem.initialize();
                
                // Run initial check
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
            utils,
            adDetector
        };
    };

    bootstrap();
    
    return { 
        processor, 
        utils, 
        state,
        velocityManager,
        adDetector,
        defensiveSystem
    };
})();