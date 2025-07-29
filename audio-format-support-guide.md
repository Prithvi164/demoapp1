# Audio Format Support & Troubleshooting Guide

This document provides comprehensive information about supported audio formats and troubleshooting for the audio evaluation system.

## Supported Audio Formats

The system supports the following audio formats:

### Primary Formats (Recommended)
- **WAV**: Universal support, lossless quality
- **MP3**: Universal support, compressed format

### Secondary Formats (Supported)
- **MP4/M4A**: Most modern browsers
- **AAC**: Most modern browsers  
- **WebM**: Chrome, Firefox
- **OGG**: Firefox, Chrome

## Common Issues and Solutions

### Issue: "Audio file not loaded or unavailable"

**Possible Causes:**
- SAS token expired (auto-expires after 4 hours)
- Network connection issues
- File format not supported by browser
- CORS (Cross-Origin Resource Sharing) restrictions

**Solutions:**
1. **Refresh the page** to get new access tokens
2. Check internet connection
3. Try a different browser (Chrome or Firefox recommended)
4. **Use the debug tools** (see Debugging section below)

### Issue: "Playback error or format not supported"

**Possible Causes:**
- Browser doesn't support the audio codec
- Corrupted audio file
- Unsupported file format
- Azure Blob Storage access issues

**Solutions:**
1. Convert file to WAV or MP3 format
2. Try using Chrome or Firefox browser
3. **Click the debug button** (? icon) in development mode
4. Contact support if file appears corrupted

## Debugging Tools (Development Mode)

In development mode, you'll see additional debugging tools:

### Debug Button (? icon)
Click the debug button next to the play controls to:
- Check the SAS URL validity
- Test direct audio file access
- View detailed audio element state
- Run HEAD request to verify file accessibility

### Console Debugging
Open browser console (F12) and look for:
- Audio element ready state (0-4)
- Network state information
- Detailed error codes and messages
- SAS URL and response headers

### Manual Testing
Use the provided debug script in the console:
```javascript
// Copy the SAS URL from console logs and test it
testAudioUrl("paste_sas_url_here");
```

## Technical Details

### MIME Types Supported
- audio/wav, audio/wave, audio/x-wav
- audio/mpeg, audio/mp3
- audio/mp4, audio/x-m4a
- audio/aac
- audio/webm
- audio/ogg

### Audio Element States
- **Ready State 0**: HAVE_NOTHING - no information available
- **Ready State 1**: HAVE_METADATA - metadata loaded
- **Ready State 2**: HAVE_CURRENT_DATA - data for current position available
- **Ready State 3**: HAVE_FUTURE_DATA - data for current and future position
- **Ready State 4**: HAVE_ENOUGH_DATA - enough data to start playing

### Browser Compatibility
- **Chrome**: All formats supported
- **Firefox**: All formats supported  
- **Safari**: WAV, MP3, MP4, AAC supported
- **Edge**: All formats supported

## Best Practices

1. **Use MP3 or WAV** for maximum compatibility
2. **Keep files under 50MB** for faster loading
3. **Chrome or Firefox** browsers work best
4. **Refresh the page** if audio stops working after 4 hours
5. **Check console** (F12) for detailed error messages
6. **Use debug tools** in development mode for troubleshooting

## Troubleshooting Steps

1. **Check the debug info** - Look for the collapsible blue info card
2. **Use debug tools** - Click the ? button in development mode
3. **Check browser console** - Look for detailed error messages
4. **Verify file format** - Ensure it's in the supported list
5. **Test direct URL** - Use the HEAD request test in debug mode
6. **Try different browser** - Chrome/Firefox recommended
7. **Refresh the page** - Get new SAS tokens
8. **Contact support** - If issues persist after troubleshooting

## Error Code Reference

### Audio Error Codes
- **1**: MEDIA_ERR_ABORTED - User aborted playback
- **2**: MEDIA_ERR_NETWORK - Network error occurred
- **3**: MEDIA_ERR_DECODE - Error decoding audio
- **4**: MEDIA_ERR_SRC_NOT_SUPPORTED - Audio format not supported

### Network State Codes
- **0**: NETWORK_EMPTY - No source assigned
- **1**: NETWORK_IDLE - Source assigned but no data loaded
- **2**: NETWORK_LOADING - Data is being loaded
- **3**: NETWORK_NO_SOURCE - No source could be loaded