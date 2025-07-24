'use strict';

// Global player management system
window.PlayerManager = (() => {
    const SELECTORS = {
        PLAYER_CONTAINER: '#movie_player',
        VIDEO_ELEMENT:  'video, .video-stream, video.html5-main-video'
    };

    const RETRY_INTERVAL = 250;

    let playerContainer = null;
    let mediaElement = null;
    let setupComplete = false;
    let retryTimer = null;
    let callbacks = [];

    const state = {
        isPlayerReady: () => setupComplete,
        getPlayerContainer: () => playerContainer,
        getMediaElement: () => mediaElement,
        getPlaybackVelocity: () => mediaElement ? mediaElement.playbackRate : 1
    };

    const elementLocator = {
        findElements: () => {
            if (setupComplete) return true;

            try {
                playerContainer = document.querySelector(SELECTORS.PLAYER_CONTAINER);
                if (playerContainer) {
                    mediaElement = playerContainer.querySelector(SELECTORS.VIDEO_ELEMENT);
                    if (mediaElement) {
                        setupComplete = true;
                        elementLocator.notifyCallbacks();
                        return true;
                    }
                }
            } catch (error) {
                console.error(`Player element location failed for selector "${SELECTORS.PLAYER_CONTAINER}" or "${SELECTORS.VIDEO_ELEMENT}":`, error);
            }

            return false;
        },

        notifyCallbacks: () => {
            const callbacksToNotify = callbacks.slice();
            callbacks = []; // Clear callbacks before execution to avoid issues with re-entrancy
            callbacksToNotify.forEach(callback => {
                try {
                    callback(playerContainer, mediaElement);
                } catch (error) {
                    console.error("Callback execution failed:", error);
                }
            });
        }
    };

    const velocityController = {
        setPlaybackVelocity: (velocity) => {
            if (!mediaElement) return false;

            // Validate velocity: must be a number between 0.1 and 100
            if (typeof velocity !== 'number' || isNaN(velocity) || velocity < 0.1 || velocity > 100) {
                console.error("Invalid velocity value. Must be a number between 0.1 and 100.");
                return false;
            }

            try {
                mediaElement.playbackRate = velocity;
                return true;
            } catch (error) {
                console.error("Velocity adjustment failed:", error);
                return false;
            }
        },

        getCurrentVelocity: () => {
            return mediaElement ? mediaElement.playbackRate : 1;
        }
    };

    const initialization = {
        startSetupProcess: () => { 
            if (retryTimer) {
                clearInterval(retryTimer);
            }
            retryTimer = setInterval(() => {
                if (elementLocator.findElements()) {
                    clearInterval(retryTimer);
                    // console.log("Player management system ready");
                }
            }, RETRY_INTERVAL);
        },

        registerCallback: (callback) => {
            if (setupComplete) {
                callback(playerContainer, mediaElement);
            } else {
                callbacks.push(callback);
            }
        }
    };

    // Public API
    const publicAPI = {
        ...state,
        setVelocity: velocityController.setPlaybackVelocity,
        getVelocity: velocityController.getCurrentVelocity,
        onReady: initialization.registerCallback,
        refresh: elementLocator.findElements
    };

    // Start the system
    initialization.startSetupProcess();

    return publicAPI;
})();