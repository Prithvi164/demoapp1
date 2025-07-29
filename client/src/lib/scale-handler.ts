// Handle DPI scaling for better compatibility with Windows display scaling
// This helps ensure consistent UI rendering across different scaling factors

export function setupScaleHandling() {
  // Function to set the app height variable correctly for mobile devices
  const setAppHeight = () => {
    document.documentElement.style.setProperty(
      "--app-height", 
      `${window.innerHeight}px`
    );
  };

  // Function to calculate and handle device pixel ratio
  const handleDevicePixelRatio = () => {
    const scaleFactor = window.devicePixelRatio;
    
    // Apply scaling correction only if needed (when not at 100% scaling)
    if (scaleFactor !== 1) {
      // Add scale-handling class to document for specific CSS targeting if needed
      document.documentElement.classList.add('scaled-display');
      document.documentElement.style.setProperty('--scale-factor', scaleFactor.toString());
    } else {
      document.documentElement.classList.remove('scaled-display');
      document.documentElement.style.removeProperty('--scale-factor');
    }
    
    // Set app height correctly
    setAppHeight();
  };

  // Set initial values
  handleDevicePixelRatio();
  setAppHeight();

  // Set up event listeners for resize and orientation change
  window.addEventListener('resize', handleDevicePixelRatio);
  window.addEventListener('orientationchange', handleDevicePixelRatio);

  // Return a cleanup function to remove event listeners
  return () => {
    window.removeEventListener('resize', handleDevicePixelRatio);
    window.removeEventListener('orientationchange', handleDevicePixelRatio);
  };
}