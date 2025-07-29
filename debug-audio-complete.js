// Complete audio debugging script - Run in browser console on conduct-evaluation page
console.log("=== Complete Audio Element Debug ===");

// Function to get latest SAS URL from the most recent network request
function getLatestSasUrl() {
  // Get the latest SAS URL from most recent request (visible in logs)
  return "https://cptcogent.blob.core.windows.net/test20072025/agent-2007-1750314948-5499-HSIL_Inbound-2025_06_19_12_05_49-919929202855.mp3?sv=2025-05-05&spr=https&st=2025-07-26T10%3A13%3A16Z&se=2025-07-26T14%3A18%3A16Z&sr=b&sp=r&sig=8QhPp4gcOxm76%2B6tEIFkRjeo1C8OnZPBCooP9vkA89U%3D&rscc=no-cache&rscd=inline&rsct=audio%2Fmpeg";
}

// Step 1: Test URL accessibility
async function testUrlAccess() {
  const url = getLatestSasUrl();
  console.log("Testing URL access...");
  
  try {
    const response = await fetch(url, { method: 'HEAD' });
    console.log("✓ URL accessible:", {
      status: response.status,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      cacheControl: response.headers.get('cache-control')
    });
    return true;
  } catch (error) {
    console.error("✗ URL not accessible:", error);
    return false;
  }
}

// Step 2: Test basic audio element
function testAudioElement() {
  console.log("Testing basic audio element...");
  
  const audio = new Audio();
  const url = getLatestSasUrl();
  
  // Add all event listeners
  audio.addEventListener('loadstart', () => console.log("✓ loadstart"));
  audio.addEventListener('loadedmetadata', () => console.log("✓ loadedmetadata", { duration: audio.duration }));
  audio.addEventListener('loadeddata', () => console.log("✓ loadeddata"));
  audio.addEventListener('canplay', () => console.log("✓ canplay"));
  audio.addEventListener('canplaythrough', () => console.log("✓ canplaythrough"));
  audio.addEventListener('error', (e) => console.error("✗ error:", e.target.error));
  audio.addEventListener('abort', () => console.log("✗ abort"));
  audio.addEventListener('stalled', () => console.log("⚠ stalled"));
  audio.addEventListener('suspend', () => console.log("⚠ suspend"));
  audio.addEventListener('waiting', () => console.log("⚠ waiting"));
  
  // Set source and load
  audio.src = url;
  audio.load();
  
  return audio;
}

// Step 3: Test existing audio element on page
function testPageAudioElement() {
  console.log("Testing page audio element...");
  
  // Find audio elements on the page
  const audioElements = document.getElementsByTagName('audio');
  console.log("Found audio elements:", audioElements.length);
  
  if (audioElements.length > 0) {
    const audio = audioElements[0];
    console.log("First audio element:", {
      src: audio.src,
      readyState: audio.readyState,
      networkState: audio.networkState,
      paused: audio.paused,
      currentTime: audio.currentTime,
      duration: audio.duration
    });
    
    // Try to set new URL
    const url = getLatestSasUrl();
    audio.src = url;
    audio.load();
    
    setTimeout(() => {
      console.log("After setting new URL:", {
        src: audio.src,
        readyState: audio.readyState,
        networkState: audio.networkState
      });
    }, 2000);
  }
}

// Run all tests
async function runAllTests() {
  console.log("Starting complete audio debug...");
  
  const urlWorks = await testUrlAccess();
  if (!urlWorks) {
    console.log("❌ URL test failed - stopping here");
    return;
  }
  
  console.log("\n--- Testing new audio element ---");
  const newAudio = testAudioElement();
  
  console.log("\n--- Testing page audio element ---");
  testPageAudioElement();
  
  // Test playing after 3 seconds
  setTimeout(() => {
    console.log("\n--- Testing playback ---");
    newAudio.play()
      .then(() => {
        console.log("✓ New audio element can play");
        setTimeout(() => newAudio.pause(), 2000);
      })
      .catch(err => console.error("✗ New audio element cannot play:", err));
  }, 3000);
}

// Run the test
runAllTests();