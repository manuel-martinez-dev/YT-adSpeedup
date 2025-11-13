'use strict';

const AdSpeedHandler = (() => {
    // Configuration constants
    const CONFIG = {
        TARGET_VELOCITY: 32,
        BACKUP_VELOCITIES: [50, 32, 16, 8],
        AD_SELECTOR: '.ad-showing, .ad-interrupting',
        BLOCKER_WARNING_SELECTOR: 'ytd-enforcement-message-view-model #container',
        // Smart refresh prevention config
        MAX_RELOADS_BEFORE_COOLDOWN: 3, // After 3 warnings in short time, enter cooldown
        RELOAD_WINDOW_MS: 600000, // 10 minutes - time window to count reloads
        COOLDOWN_DURATION_MS: 1800000, // 30 minutes cooldown
        MIN_RELOAD_DELAY_MS: 2000, // Minimum 2 seconds between reloads
        MAX_RELOAD_DELAY_MS: 60000, // Maximum 60 seconds between reloads
        EXPONENTIAL_BASE: 2 // Base for exponential backoff
    };

    // State management
    const state = {
        currentVelocity: 16,
        originalRate: 1,
        adActive: false,
        velocityTested: false,
        playerReady: false,
        adStartTime: null,
        lastAdCheck: null,
        warningInProgress: false,
        debuggerConsent: false,
        // Smart refresh prevention state
        reloadHistory: [],
        cooldownUntil: null,
        consecutiveWarnings: 0,
        inCooldownMode: false
    };

    // Utilities that use PlayerManager
    const utils = {
        getVideoElement: () => window.PlayerManager?.getMediaElement(),

        getCurrentRate: () => {
            // Use detection evasion API if available to get real rate
            if (window.__adSpeedupExtensionAPI) {
                window.__adSpeedupExtensionAPI.beginExtensionCall();
            }
            const rate = window.PlayerManager?.getVelocity();
            if (window.__adSpeedupExtensionAPI) {
                window.__adSpeedupExtensionAPI.endExtensionCall();
            }
            return rate;
        },

        applyVelocity: (velocity) => {
            // Use detection evasion API if available
            if (window.__adSpeedupExtensionAPI) {
                window.__adSpeedupExtensionAPI.beginExtensionCall();
            }
            const result = window.PlayerManager?.setVelocity(velocity);
            if (window.__adSpeedupExtensionAPI) {
                window.__adSpeedupExtensionAPI.endExtensionCall();
            }
            return result;
        },
        
        sendCommand: (command, data = {}) => {
            try {
                // Only expect response for commands that actually send one
                const expectsResponse = command === "trustedSkipClick";
                
                if (expectsResponse) {
                    chrome.runtime.sendMessage({ action: command, ...data }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error(`Runtime message error ${command}:`, chrome.runtime.lastError);
                        } else {
                            console.log(`${command} click response:`, response);
                        }
                    });
                } else {
                    // Fire and forget for commands that don't need responses
                    chrome.runtime.sendMessage({ action: command, ...data });
                }
            } catch (error) {
                console.error('Error sending command:', command, error);
            }
        },
             // Load debugger consent from storage
        loadDebuggerConsent: () => {
            chrome.storage.sync.get(['debuggerConsent'], (items) => {
                state.debuggerConsent = items.debuggerConsent || false;
            });
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

    // Skip button manager system
    const skipButtonManager = {
        processedButton: new WeakSet(),

        clickLikeHuman: (element) => { 
            if (!element || !element.click) return false;

            try { 
                // Try to make click seem more realistic
                const mouseEvent = [ 'mousedown', 'mouseup', 'click'];

                mouseEvent.forEach((eventype, index) => {
                    setTimeout(() => { 
                        const event = new MouseEvent(eventype, {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            buttons: 1
                        });
                        element.dispatchEvent(event);

                        if (index === mouseEvent.length - 1) {
                            console.log('skip button clicked');
                        }
                    }, index * 50); // Slight delay between events
                    });

                    console.log('skip button clicked');
                    return true;
            } catch (error) {
                console.error('Error clicking skip button:', error);
                return false;
            }
        },

        // Click method via debugger API
        clickWithTrustedEvent: (element) => {
            if (!element) return false;

              if (!state.debuggerConsent) {
                console.log('Debugger not given fallback running');
                return skipButtonManager.clickLikeHuman(element);
            }
            try {

                // Get element position
                const rect = element.getBoundingClientRect();
                const x = Math.round(rect.left + rect.width /2);
                const y = Math.round(rect.top + rect.height /2);

                // Check if position is valid
                if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
                    console.warn('Skip button is out of bounds, using fallback click');
                    return skipButtonManager.clickLikeHuman(element);
                }
                console.log(`Trusted click at (${x}, ${y})`);

                // Send click to background script
                utils.sendCommand("trustedSkipClick", { x, y });
                return true;
            } catch (error) {
                console.error('Error with trusted click:', error);
                // Fallback to human-like click
                return skipButtonManager.clickLikeHuman(element);
            }
        },

        // check if button is present and clickable
        isClicked: (button) => {
            if (!button) return false;

            // is button visible and enabled?
            const style = window.getComputedStyle(button);
            const isVisible = style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0';
            const isEnabled = !button.disabled && 
                               !button.hasAttribute('disabled');
                               
            return isVisible && isEnabled;                   
        },

        // Main skip button handler
        handleSkipButton: (button) => {
            if (skipButtonManager.processedButton.has(button)) {
                return;
            }
            skipButtonManager.processedButton.add(button);
            setTimeout(() => {
                if (skipButtonManager.isClicked(button)) {
                    skipButtonManager.clickWithTrustedEvent(button);
                }
            }, 500);
        },

        // Skip button checker
        checkSkipButton: () => {
            const skipButton = document.querySelectorAll('button.ytp-skip-ad-button');

            skipButton.forEach(button => {
                // run if button is not processed
                if (!skipButtonManager.processedButton.has(button)) {
                    skipButtonManager.handleSkipButton(button);
                }
            });
        }
    };

    // Smart reload management system with exponential backoff
    const reloadManager = {
        // Load reload history from storage
        loadReloadHistory: () => {
            return new Promise((resolve) => {
                chrome.storage.local.get(['reloadHistory', 'cooldownUntil'], (result) => {
                    state.reloadHistory = result.reloadHistory || [];
                    state.cooldownUntil = result.cooldownUntil || null;

                    // Check if still in cooldown
                    if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
                        state.inCooldownMode = true;
                        console.log(`In cooldown mode until ${new Date(state.cooldownUntil).toLocaleTimeString()}`);
                    } else if (state.cooldownUntil) {
                        // Cooldown expired, clear it
                        state.cooldownUntil = null;
                        state.inCooldownMode = false;
                        chrome.storage.local.set({ cooldownUntil: null });
                    }

                    resolve();
                });
            });
        },

        // Clean old reload entries outside the time window
        cleanReloadHistory: () => {
            const now = Date.now();
            const cutoff = now - CONFIG.RELOAD_WINDOW_MS;
            state.reloadHistory = state.reloadHistory.filter(timestamp => timestamp > cutoff);
        },

        // Record a reload attempt
        recordReload: () => {
            const now = Date.now();
            state.reloadHistory.push(now);
            reloadManager.cleanReloadHistory();

            // Save to storage
            chrome.storage.local.set({
                reloadHistory: state.reloadHistory
            });

            state.consecutiveWarnings = state.reloadHistory.length;
        },

        // Calculate exponential backoff delay
        calculateBackoffDelay: () => {
            const numReloads = state.reloadHistory.length;

            if (numReloads === 0) {
                return CONFIG.MIN_RELOAD_DELAY_MS;
            }

            // Exponential backoff: base^(numReloads-1) * MIN_DELAY
            const delay = Math.pow(CONFIG.EXPONENTIAL_BASE, numReloads - 1) * CONFIG.MIN_RELOAD_DELAY_MS;

            // Cap at maximum delay
            return Math.min(delay, CONFIG.MAX_RELOAD_DELAY_MS);
        },

        // Check if should enter cooldown mode
        shouldEnterCooldown: () => {
            reloadManager.cleanReloadHistory();
            return state.reloadHistory.length >= CONFIG.MAX_RELOADS_BEFORE_COOLDOWN;
        },

        // Enter cooldown mode
        enterCooldown: () => {
            const now = Date.now();
            state.cooldownUntil = now + CONFIG.COOLDOWN_DURATION_MS;
            state.inCooldownMode = true;

            chrome.storage.local.set({
                cooldownUntil: state.cooldownUntil,
                reloadHistory: [] // Clear history when entering cooldown
            });

            state.reloadHistory = [];

            console.log(`Entering cooldown mode for ${CONFIG.COOLDOWN_DURATION_MS / 60000} minutes`);
            console.log('Extension will operate in stealth mode (minimal speed increase) during cooldown');
        },

        // Handle warning with smart reload logic
        handleSmartReload: () => {
            // Check if should enter cooldown
            if (reloadManager.shouldEnterCooldown()) {
                reloadManager.enterCooldown();

                // Don't reload, just notify user and switch to stealth mode
                console.warn('Too many warnings detected. Entering stealth mode - ads will play at 2x speed only.');
                utils.sendCommand("warningDetected");
                utils.sendCommand("cooldownActivated", {
                    duration: CONFIG.COOLDOWN_DURATION_MS,
                    until: state.cooldownUntil
                });

                // Switch to minimal speed increase
                state.currentVelocity = 2;

                return false; // Don't reload
            }

            // Calculate backoff delay
            const delay = reloadManager.calculateBackoffDelay();

            console.log(`Reload scheduled in ${delay}ms (attempt ${state.reloadHistory.length + 1})`);

            // Record this reload
            reloadManager.recordReload();

            // Wait for backoff delay before reloading
            setTimeout(() => {
                utils.sendCommand("warningDetected");
                utils.sendCommand("unmute");
                utils.sendCommand("pageReload");

                // Small additional delay to ensure commands are processed
                setTimeout(() => {
                    window.location.reload();
                }, 150);
            }, delay);

            return true; // Will reload after delay
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
            // Prevent multiple warning handling in quick succession
            if (state.warningInProgress) {
                return;
            }

            // Mark warning as being handled
            state.warningInProgress = true;

            // Use smart reload manager instead of immediate reload
            console.log("Ad blocker warning detected - using smart reload strategy");

            // If in cooldown mode, just hide warning element instead of reloading
            if (state.inCooldownMode) {
                console.log("In cooldown mode - attempting to hide warning without reload");
                const warningEl = document.querySelector(CONFIG.BLOCKER_WARNING_SELECTOR);
                if (warningEl) {
                    warningEl.style.display = 'none';
                    warningEl.remove();
                }
                state.warningInProgress = false;
                return;
            }

            // Use smart reload with exponential backoff
            reloadManager.handleSmartReload();
        },

        processAdStart: () => {
            if (!state.adActive) {
                // console.log("Ad detected - starting speed control");
                state.adActive = true;
                state.adStartTime = Date.now();
                state.originalRate = utils.getCurrentRate();

                // Calibrate on first ad if not done and not in cooldown
                if (!state.velocityTested && !state.inCooldownMode) {
                    velocityManager.calibrateMaxVelocity();
                    state.velocityTested = true;
                } else if (state.inCooldownMode && state.currentVelocity !== 2) {
                    // In cooldown mode, use minimal speed
                    state.currentVelocity = 2;
                }
            }

            // Use lower speed in cooldown mode
            const targetVelocity = state.inCooldownMode ? 2 : state.currentVelocity;
            velocityManager.adjustPlaybackRate(targetVelocity);
            utils.sendCommand("mute");

            // Start skip button checker after delay
            setTimeout(() => {
                skipButtonManager.checkSkipButton();
            }, 1000);
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
            // Load reload history first
            reloadManager.loadReloadHistory().then(() => {
                // Wait for PlayerManager to be ready
                window.PlayerManager?.onReady(() => {
                    state.playerReady = true;
                    state.originalRate = utils.getCurrentRate();

                    // Load debugger consent from storage
                    utils.loadDebuggerConsent();

                    // Listen for consent changes
                    chrome.storage.onChanged.addListener((changes, namespace) => {
                        if (namespace === 'sync' && changes.debuggerConsent) {
                            state.debuggerConsent = changes.debuggerConsent.newValue || false;
                            console.log('Debugger consent updated:', state.debuggerConsent);
                        }
                    });

                    // Initialize defensive systems
                    defensiveSystem.initialize();

                    // Run initial check
                    processor.cycle();
                });
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
            adDetector,
            reloadManager
        };

        // Skip button manager gloabally - might change in the future
        window.SkipButtonManage = skipButtonManager;
    };

    bootstrap();

    return {
        processor,
        utils,
        state,
        velocityManager,
        adDetector,
        defensiveSystem,
        skipButtonManager,
        reloadManager
    };
})();