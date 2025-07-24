'use strict';

const VelocityController = (() => {
    let controllerReady = false;

    const elementManager = {
        isReady: () => controllerReady && window.PlayerManager.isPlayerReady(),
        
        getMediaTarget: () => window.PlayerManager.getMediaElement(),
        
        waitForPlayerManager: (callback) => {
            if (window.PlayerManager.isPlayerReady()) {
                callback();
            } else {
                window.PlayerManager.onReady(callback);
            }
        }
    };

    const rateController = {
        modifyPlaybackRate: (targetRate) => {
            if (!elementManager.isReady()) {
                // console.log("VelocityController not ready, cannot modify rate");
                return false;
            }
            
            // console.log("VelocityController modifying playback rate to:", targetRate);
            return window.PlayerManager.setVelocity(targetRate);
        },

        getCurrentRate: () => {
            if (elementManager.isReady()) {
                return window.PlayerManager.getVelocity();
            }
            return 1;
        },

        validateRate: (rate) => {
            return typeof rate === 'number' && rate > 0 && rate <= 100;
        }
    };

    const publicAPI = {
        setVelocity: (velocity) => {
            if (!rateController.validateRate(velocity)) {
                console.warn("VelocityController: Invalid velocity value:", velocity);
                return false;
            }
            return rateController.modifyPlaybackRate(velocity);
        },

        getVelocity: () => rateController.getCurrentRate(),
        
        isControllerReady: () => elementManager.isReady(),
        
        refresh: () => {
            // Refresh through PlayerManager
            window.PlayerManager.refresh();
            return elementManager.isReady();
        }
    };

    const initialize = () => {
        elementManager.waitForPlayerManager(() => {
            controllerReady = true;
            // console.log("VelocityController initialized with PlayerManager");
        });
    };

    // Expose alternative global method
    window.changeSpeed = publicAPI.setVelocity;

    // Initialize
    initialize();

    return publicAPI;
})();