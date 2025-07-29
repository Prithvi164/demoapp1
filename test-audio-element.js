// Test script to validate audio element loading in browser console
// Usage: Copy and paste this into the browser console on the conduct-evaluation page

function testAudioElement() {
  console.log("=== Testing Audio Element ===");
  
  // Get the current SAS URL from the most recent request
  const testUrl = "https://cptcogent.blob.core.windows.net/test20072025/agent-261-1702639821-7026-HSIL_Inbound-2023_12_15_17_00_21-918317567741.wav?sv=2025-05-05&spr=https&st=2025-07-26T10%3A03%3A43Z&se=2025-07-26T14%3A08%3A43Z&sr=b&sp=r&sig=dLysHt1ulAW7aksbMfHkTeEQfkF7OyW%2FnWpaWz84GG0%3D&rscc=no-cache&rscd=inline&rsct=audio%2Fwav";
  
  console.log("Testing URL:", testUrl.substring(0, 120) + "...");
  
  // Test 1: Direct fetch
  console.log("Test 1: Direct fetch");
  fetch(testUrl, { method: 'HEAD' })
    .then(response => {
      console.log("✓ Direct fetch successful:", {
        status: response.status,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      });
      
      // Test 2: Create audio element
      console.log("Test 2: Create audio element");
      const audio = new Audio();
      
      audio.addEventListener('loadstart', () => console.log("✓ Audio loadstart"));
      audio.addEventListener('loadedmetadata', () => {
        console.log("✓ Audio metadata loaded:", {
          duration: audio.duration,
          readyState: audio.readyState
        });
      });
      audio.addEventListener('canplay', () => console.log("✓ Audio can play"));
      audio.addEventListener('error', (e) => {
        console.error("✗ Audio error:", {
          code: e.target.error?.code,
          message: e.target.error?.message
        });
      });
      
      // Set source and load
      audio.src = testUrl;
      audio.load();
      
      // Test 3: Try to play a small portion
      setTimeout(() => {
        audio.play()
          .then(() => {
            console.log("✓ Audio play successful");
            setTimeout(() => {
              audio.pause();
              console.log("✓ Audio paused");
            }, 2000);
          })
          .catch(err => console.error("✗ Audio play failed:", err));
      }, 3000);
      
    })
    .catch(error => {
      console.error("✗ Direct fetch failed:", error);
    });
}

// Run the test
testAudioElement();