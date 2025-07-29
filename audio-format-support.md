# Audio Format Support Documentation

## Supported Audio Formats

The CloudLMS/ZenithCXI system supports the following audio formats for evaluation purposes:

### Primary Supported Formats
- **WAV** (.wav) - Recommended for best quality
  - MIME Types: `audio/wav`, `audio/wave`, `audio/x-wav`
  - Browser Support: Universal
  - Notes: Uncompressed, high quality

- **MP3** (.mp3) - Most common format
  - MIME Types: `audio/mpeg`, `audio/mp3`
  - Browser Support: Universal
  - Notes: Compressed, good balance of quality and file size

### Additional Supported Formats
- **MP4 Audio** (.m4a, .mp4)
  - MIME Types: `audio/mp4`, `audio/x-m4a`
  - Browser Support: Most modern browsers

- **AAC** (.aac)
  - MIME Type: `audio/aac`
  - Browser Support: Most modern browsers

- **WebM Audio** (.webm)
  - MIME Type: `audio/webm`
  - Browser Support: Chrome, Firefox, Opera

- **OGG** (.ogg)
  - MIME Type: `audio/ogg`
  - Browser Support: Firefox, Chrome, Opera

### Experimental/Limited Support
- **FLAC** (.flac)
  - MIME Type: `audio/flac`
  - Browser Support: Chrome, Firefox (limited)
  - Notes: Lossless compression, large file sizes

- **WMA** (.wma)
  - MIME Type: `audio/x-ms-wma`
  - Browser Support: Limited (IE/Edge only)
  - Notes: Not recommended for cross-browser compatibility

## Browser Compatibility

### Chrome
- Supports: WAV, MP3, MP4, AAC, WebM, OGG, FLAC
- Recommended: WAV, MP3

### Firefox  
- Supports: WAV, MP3, OGG, WebM, FLAC (partial)
- Recommended: WAV, MP3

### Safari
- Supports: WAV, MP3, MP4, AAC
- Recommended: WAV, MP3

### Edge
- Supports: WAV, MP3, MP4, AAC, WMA
- Recommended: WAV, MP3

## File Size and Quality Guidelines

### For Call Center Recordings
- **Recommended**: MP3 at 128kbps or higher
- **File Size**: 1-5 MB for typical 2-5 minute calls
- **Sample Rate**: 44.1kHz or 48kHz
- **Channels**: Mono (sufficient for voice) or Stereo

### For Training Content
- **Recommended**: WAV for master files, MP3 for distribution
- **Quality**: 192kbps+ for MP3, 16-bit for WAV
- **Duration**: Up to 30 minutes supported

## Common Issues and Solutions

### Playback Error: "Audio file not loaded or unavailable"
**Possible Causes:**
1. **SAS Token Expired**: Azure storage tokens expire after 4 hours
2. **Network Issues**: Poor internet connection
3. **Unsupported Format**: Browser doesn't support the audio codec
4. **File Corruption**: Audio file is damaged

**Solutions:**
1. Refresh the page to get new SAS tokens
2. Check internet connection
3. Try a different browser
4. Contact admin if file appears corrupted

### Format Not Supported Errors
**Solution**: Convert audio files to MP3 or WAV format using:
- Audacity (free)
- FFmpeg command line
- Online converters (for non-sensitive content)

### Large File Upload Issues
**Recommendations:**
- Compress files to MP3 before upload
- Keep files under 50MB for best performance
- Use batch upload for multiple files

## Azure Storage Configuration

The system stores audio files in Azure Blob Storage with:
- **Container**: Organized by date and batch
- **SAS Tokens**: 4-hour expiry for security
- **Content Types**: Properly set for each format
- **Access**: Read-only for evaluation users

## Performance Optimization

### For Better Playback Experience:
1. **Use MP3 format** for most use cases
2. **Limit file size** to under 20MB
3. **Ensure stable internet** connection
4. **Use modern browsers** (Chrome, Firefox, Safari)
5. **Clear browser cache** if experiencing issues

## Technical Implementation

The audio player supports:
- **Multiple source tags** for format fallback
- **Preloading** for faster playback
- **Error recovery** with automatic retries
- **SAS token refresh** when needed
- **Progress tracking** and seeking
- **Volume controls**

## Troubleshooting Checklist

If audio won't play:
1. ✅ Check browser console for errors
2. ✅ Verify internet connection
3. ✅ Try refreshing the page
4. ✅ Test with a different audio file
5. ✅ Try a different browser
6. ✅ Check file format compatibility
7. ✅ Contact support with error details

## Contact Support

For persistent audio issues:
- Include browser version and OS
- Provide error messages from console
- Specify audio file format and size
- Describe steps taken before the error