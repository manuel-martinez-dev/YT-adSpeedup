'use strict';

/**
 * Detection Evasion System
 * Runs at document_start to hook into critical APIs before YouTube's code loads
 *
 * This system intercepts playbackRate queries to hide speed manipulation from detection
 */

(() => {
    // Internal state tracking
    const internalState = {
        realPlaybackRate: new WeakMap(), // Store real rates per video element
        isOurExtension: false, // Flag to identify our extension's calls
        hookingEnabled: true
    };

    // Detection pattern analysis
    const detectionPatterns = {
        // YouTube's detection code often has specific patterns in call stacks
        isLikelyYouTubeDetection: () => {
            try {
                const stack = new Error().stack;
                if (!stack) return false;

                // Patterns that suggest YouTube's own code (not our extension)
                const suspiciousPatterns = [
                    /player[-_]?api/i,
                    /yt[-_]?player/i,
                    /base\.js/i,
                    /www-player/i,
                    /player_ias/i,
                    /playerResponse/i,
                    /enforcement/i, // YouTube's enforcement detection
                    /adblock/i // Ad blocker detection
                ];

                // Patterns that suggest it's our code or trusted sources
                const trustedPatterns = [
                    /speedMgmt\.js/i,
                    /speedSupervisor\.js/i,
                    /playerInit\.js/i,
                    /AdSpeedHandler/i,
                    /PlayerManager/i
                ];

                // If it's our code, not detection
                if (trustedPatterns.some(pattern => pattern.test(stack))) {
                    return false;
                }

                // If it matches suspicious patterns, likely detection
                return suspiciousPatterns.some(pattern => pattern.test(stack));
            } catch (e) {
                // If we can't determine, be cautious
                return true;
            }
        },

        // Check if caller is from an inline script (often used by detection)
        isFromInlineScript: () => {
            try {
                const stack = new Error().stack;
                return stack && (stack.includes('<anonymous>') || stack.includes('eval'));
            } catch (e) {
                return false;
            }
        }
    };

    // Hook playbackRate getter/setter
    const hookPlaybackRate = () => {
        try {
            const originalDescriptor = Object.getOwnPropertyDescriptor(
                HTMLMediaElement.prototype,
                'playbackRate'
            );

            if (!originalDescriptor || !originalDescriptor.get || !originalDescriptor.set) {
                console.warn('Could not hook playbackRate - descriptor not found');
                return;
            }

            const originalGetter = originalDescriptor.get;
            const originalSetter = originalDescriptor.set;

            Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
                get: function () {
                    // If hooking is disabled, return real value
                    if (!internalState.hookingEnabled) {
                        return originalGetter.call(this);
                    }

                    // If it's our extension calling, return real rate
                    if (internalState.isOurExtension) {
                        return originalGetter.call(this);
                    }

                    // Get the real current rate
                    const realRate = originalGetter.call(this);

                    // If rate is normal (1.0 or close to it), no need to hide
                    if (Math.abs(realRate - 1.0) < 0.01) {
                        return realRate;
                    }

                    // Check if this is likely YouTube's detection code
                    const isDetection = detectionPatterns.isLikelyYouTubeDetection() ||
                        detectionPatterns.isFromInlineScript();

                    if (isDetection) {
                        // Return normal speed to hide manipulation
                        return 1.0;
                    }

                    // For other callers, return real rate
                    return realRate;
                },
                set: function (value) {
                    // Always allow setting, but track who's setting it
                    const stack = new Error().stack;
                    const isOurCode = stack && (
                        stack.includes('speedMgmt.js') ||
                        stack.includes('AdSpeedHandler') ||
                        stack.includes('PlayerManager')
                    );

                    // Store the value being set
                    if (isOurCode) {
                        internalState.realPlaybackRate.set(this, value);
                    }

                    // Apply the value using original setter
                    return originalSetter.call(this, value);
                },
                configurable: true,
                enumerable: true
            });

            console.log('[Detection Evasion] playbackRate hook installed successfully');
        } catch (error) {
            console.error('[Detection Evasion] Failed to hook playbackRate:', error);
        }
    };

    // Hook defaultPlaybackRate to be thorough
    const hookDefaultPlaybackRate = () => {
        try {
            const originalDescriptor = Object.getOwnPropertyDescriptor(
                HTMLMediaElement.prototype,
                'defaultPlaybackRate'
            );

            if (!originalDescriptor || !originalDescriptor.get || !originalDescriptor.set) {
                return;
            }

            const originalGetter = originalDescriptor.get;
            const originalSetter = originalDescriptor.set;

            Object.defineProperty(HTMLMediaElement.prototype, 'defaultPlaybackRate', {
                get: function () {
                    const realRate = originalGetter.call(this);

                    // If not our extension and rate is modified, return 1.0
                    if (!internalState.isOurExtension &&
                        Math.abs(realRate - 1.0) > 0.01 &&
                        detectionPatterns.isLikelyYouTubeDetection()) {
                        return 1.0;
                    }

                    return realRate;
                },
                set: function (value) {
                    return originalSetter.call(this, value);
                },
                configurable: true,
                enumerable: true
            });

            console.log('[Detection Evasion] defaultPlaybackRate hook installed');
        } catch (error) {
            console.error('[Detection Evasion] Failed to hook defaultPlaybackRate:', error);
        }
    };

    // Provide API for our extension to bypass hooks
    window.__adSpeedupExtensionAPI = {
        // Call this before reading playbackRate in our code
        beginExtensionCall: () => {
            internalState.isOurExtension = true;
        },
        // Call this after reading playbackRate in our code
        endExtensionCall: () => {
            internalState.isOurExtension = false;
        },
        // Get real playback rate (for debugging)
        getRealRate: (videoElement) => {
            internalState.isOurExtension = true;
            const rate = videoElement.playbackRate;
            internalState.isOurExtension = false;
            return rate;
        },
        // Temporarily disable hooking (for debugging)
        disableHooking: () => {
            internalState.hookingEnabled = false;
        },
        // Re-enable hooking
        enableHooking: () => {
            internalState.hookingEnabled = true;
        }
    };

    // Initialize hooks immediately
    hookPlaybackRate();
    hookDefaultPlaybackRate();

    // Also hook addEventListener to detect when YouTube adds listeners
    const originalAddEventListener = HTMLMediaElement.prototype.addEventListener;
    HTMLMediaElement.prototype.addEventListener = function (type, listener, options) {
        // Monitor for rate change listeners (often used by detection)
        if (type === 'ratechange') {
            const stack = new Error().stack;
            if (stack && detectionPatterns.isLikelyYouTubeDetection()) {
                // YouTube is adding a ratechange listener - likely for detection
                console.log('[Detection Evasion] Detected potential rate monitoring listener');

                // Wrap the listener to filter out events when we're changing the rate
                const wrappedListener = function (event) {
                    const rate = this.playbackRate;

                    // If rate is significantly different from 1.0 and it's during ad speedup
                    // we might want to suppress this event or modify the rate in the event
                    if (Math.abs(rate - 1.0) > 0.01) {
                        // Create a modified event that reports normal speed
                        const modifiedEvent = new Event('ratechange', {
                            bubbles: event.bubbles,
                            cancelable: event.cancelable
                        });

                        // Temporarily override playbackRate for this listener call
                        const originalGet = Object.getOwnPropertyDescriptor(
                            HTMLMediaElement.prototype,
                            'playbackRate'
                        ).get;

                        Object.defineProperty(this, 'playbackRate', {
                            get: () => 1.0,
                            configurable: true
                        });

                        listener.call(this, modifiedEvent);

                        // Restore original
                        Object.defineProperty(this, 'playbackRate', {
                            get: originalGet,
                            configurable: true
                        });

                        return;
                    }

                    // Normal event, pass through
                    listener.call(this, event);
                };

                return originalAddEventListener.call(this, type, wrappedListener, options);
            }
        }

        // Normal listener, pass through
        return originalAddEventListener.call(this, type, listener, options);
    };

    console.log('[Detection Evasion] System initialized at document_start');
})();
