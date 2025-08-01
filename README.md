# YT-adSpeedup

A Chrome extension that speeds up YouTube ads.

## Features

- **Ad Speed Control**: Automatically speeds up YouTube ads to depending on browser limit
- **Skip Button Automation**: Automatically clicks skip buttons when available
- **Enhanced Skip Click (Optional)**: More reliable skip button clicking using browser debugger API with user consent
- **Temporary Muting**: Mutes ads while they're playing
- **Statistics Tracking**: Tracks ads skipped
- **Lightweight**: Minimal resource usage

## How It Works

1. Monitors YouTube pages for video ads
2. When an ad is detected, speeds it up and mutes the tab
3. Automatically clicks skip buttons when they appear
4. Restores normal playback speed when the ad finishes
5. Tracks ads skipped

## Installation

### From Source

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension will be active on YouTube

## Usage

1. **Install** the extension following the steps above
2. **Visit** any YouTube video or YouTube Music
3. **Ads are automatically sped up** when detected (you'll barely notice them)
4. **Click the extension icon** to view statistics
5. **Use "Reset Stats"** to clear the counter if needed

## Enhanced Skip Click Feature
The extension includes an optional "Enhanced Skip Click" feature that uses the browser's debugger API for more reliable skip button clicking.

- **Default**: Uses standard click simulation (no extra permissions)
- **Enhanced**: Uses debugger API for improved reliability (requires user consent)
- **Privacy-first**: Feature is disabled by default and requires explicit user consent
- **Transparent**: Clear explanation of what permissions are used

## To enable:

1. Click the extension icon
2. Toggle "Enhanced Skip Click"
3. Confirm in the dialog that appears
4. Feature can be disabled anytime

## Technical Details

- **Manifest Version**: 3
- **Permissions**: Storage, tabs
- **Content Script**: Runs on YouTube pages only
- **Background Script**: Handles tab muting and stats

## Browser Compatibility

- **Chrome**: Fully supported (Manifest V3)
- **Edge**: Fully supported (Chromium-based)
- **Other browsers**: Not supported

## Privacy & Security

- **No data collection**: All statistics stored locally
- **No external connections**: Works entirely offline
- **YouTube-only**: Runs exclusively on YouTube domains
- **No personal information**: Only counts ad interactions
- **Consent-based permissions**: Debugger API only used with explicit user consent
- **Privacy-first design**: Enhanced features are opt-in only

## Known Limitations

- **Browser speed limits**: Maximum speed depends on browser capabilities
- **YouTube updates**: May need updates if YouTube changes ad structure
- **Performance**: Very high speeds may impact older devices
- **Debugger permissions**: Enhanced skip clicking requires additional browser permissions

## Contributing

This is a personal project. Feel free to fork and modify for your own use.

## License

MIT License - see LICENSE file for details.

---

**Made for educational purposes. Use responsibly.**

