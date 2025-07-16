# YT-adSpeedup

A Chrome extension that speeds up YouTube ads.

## Features

- **Ad Speed Control**: Automatically speeds up YouTube ads to 16x speed
- **Temporary Muting**: Mutes ads while they're playing
- **Statistics Tracking**: Tracks ads skipped
- **Lightweight**: Minimal resource usage

## How It Works

1. Monitors YouTube pages for ad content
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

1. Visit any YouTube video
2. Ads will automatically be sped up when detected
3. Click the extension icon to view how many ads sped up.
4. Use the reset button to clear stats if needed

## Technical Details

- **Manifest Version**: 3
- **Permissions**: Storage, Active Tab
- **Content Script**: Runs on YouTube pages only
- **Background Script**: Handles tab muting and stats

