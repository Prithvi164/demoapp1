// Audio debugging test script
// Run this in browser console to test audio URLs directly

async function testAudioUrl(sasUrl) {
  console.log("Testing audio URL:", sasUrl.substring(0, 100) + "...");
  
  const audio = new Audio();
  
  // Set up event listeners for debugging
  audio.addEventListener('loadstart', () => console.log('Audio: loadstart'));
  audio.addEventListener('loadedmetadata', () => console.log('Audio: loadedmetadata'));
  audio.addEventListener('loadeddata', () => console.log('Audio: loadeddata'));
  audio.addEventListener('canplay', () => console.log('Audio: canplay'));
  audio.addEventListener('canplaythrough', () => console.log('Audio: canplaythrough'));
  audio.addEventListener('error', (e) => {
    console.error('Audio error:', {
      code: e.target.error?.code,
      message: e.target.error?.message,
      readyState: e.target.readyState,
      networkState: e.target.networkState
    });
  });
  
  // Test CORS and basic connectivity
  try {
    const response = await fetch(sasUrl, { method: 'HEAD' });
    console.log('HEAD request response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
  } catch (error) {
    console.error('HEAD request failed:', error);
  }
  
  // Set the source and try to load
  audio.src = sasUrl;
  audio.load();
  
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Audio state after 3 seconds:', {
        readyState: audio.readyState,
        networkState: audio.networkState,
        error: audio.error,
        duration: audio.duration,
        currentSrc: audio.currentSrc
      });
      resolve();
    }, 3000);
  });
}

// Usage: 
// 1. Get the SAS URL from the network tab or console logs
// 2. Run: testAudioUrl("paste_sas_url_here")