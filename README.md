# YT-adSpeedup

A Chrome extension that speeds up YouTube ads.

## Features

- **Ad Speed Control**: Automatically speeds up YouTube ads to depending on browser limit
- **Temporary Muting**: Mutes ads while they're playing
- **Statistics Tracking**: Tracks ads skipped
- **Lightweight**: Minimal resource usage

## How It Works

1. Monitors YouTube pages for video ads
2. When an ad is detected, speeds it up and mutes the tab
3. Restores normal playback speed when the ad finishes
4. Tracks ads skipped

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

## Known Limitations

- **Browser speed limits**: Maximum speed depends on browser capabilities
- **YouTube updates**: May need updates if YouTube changes ad structure
- **Performance**: Very high speeds may impact older devices

## Contributing

This is a personal project. Feel free to fork and modify for your own use.

## License

MIT License - see LICENSE file for details.

---

**Made for educational purposes. Use responsibly.**

