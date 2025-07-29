import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle, Play, Pause, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AudioDebugPanelProps {
  audioUrl: string | null;
  selectedAudioFile: number | null;
  onRefreshToken: () => void;
}

export function AudioDebugPanel({ audioUrl, selectedAudioFile, onRefreshToken }: AudioDebugPanelProps) {
  const { toast } = useToast();
  const debugAudioRef = useRef<HTMLAudioElement>(null);
  const [debugInfo, setDebugInfo] = useState<{
    urlValid: boolean;
    audioLoadable: boolean;
    corsIssue: boolean;
    networkError: boolean;
    formatSupported: boolean;
    readyState: number;
    lastError: string | null;
  }>({
    urlValid: false,
    audioLoadable: false,
    corsIssue: false,
    networkError: false,
    formatSupported: false,
    readyState: 0,
    lastError: null,
  });
  const [isTestingPlayback, setIsTestingPlayback] = useState(false);

  const testAudioUrl = async () => {
    if (!audioUrl) {
      setDebugInfo(prev => ({ ...prev, lastError: "No audio URL provided" }));
      return;
    }

    setIsTestingPlayback(true);
    const newDebugInfo = { ...debugInfo };

    try {
      // Test 1: Check if URL is properly formatted
      try {
        const url = new URL(audioUrl);
        newDebugInfo.urlValid = true;
        console.log("✓ URL is valid:", url.origin + url.pathname);
      } catch (e) {
        newDebugInfo.urlValid = false;
        newDebugInfo.lastError = "Invalid URL format";
        setDebugInfo(newDebugInfo);
        return;
      }

      // Test 2: Test network accessibility with HEAD request
      try {
        const response = await fetch(audioUrl, { 
          method: 'HEAD',
          mode: 'cors'
        });
        
        if (response.ok) {
          newDebugInfo.networkError = false;
          console.log("✓ Network request successful");
          console.log("Content-Type:", response.headers.get('content-type'));
          console.log("Content-Length:", response.headers.get('content-length'));
          
          // Check content type
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.startsWith('audio/')) {
            newDebugInfo.formatSupported = true;
          }
        } else {
          newDebugInfo.networkError = true;
          newDebugInfo.lastError = `Network error: ${response.status} ${response.statusText}`;
        }
      } catch (fetchError) {
        newDebugInfo.networkError = true;
        if (fetchError instanceof TypeError && fetchError.message.includes('CORS')) {
          newDebugInfo.corsIssue = true;
          newDebugInfo.lastError = "CORS policy blocking access";
        } else {
          newDebugInfo.lastError = `Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`;
        }
      }

      // Test 3: Test actual audio loading
      if (debugAudioRef.current && !newDebugInfo.networkError) {
        try {
          // Clear any previous errors
          debugAudioRef.current.onerror = null;
          debugAudioRef.current.onloadeddata = null;
          debugAudioRef.current.oncanplay = null;

          // Set up event listeners
          const loadPromise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Audio loading timeout"));
            }, 10000);

            debugAudioRef.current!.onerror = (e) => {
              clearTimeout(timeout);
              const error = debugAudioRef.current?.error;
              reject(new Error(`Audio error: ${error?.code} ${error?.message}`));
            };

            debugAudioRef.current!.oncanplay = () => {
              clearTimeout(timeout);
              resolve();
            };

            debugAudioRef.current!.onloadeddata = () => {
              console.log("✓ Audio data loaded");
            };
          });

          // Set the source and load
          debugAudioRef.current.src = audioUrl;
          debugAudioRef.current.load();

          await loadPromise;
          newDebugInfo.audioLoadable = true;
          newDebugInfo.readyState = debugAudioRef.current.readyState;
          console.log("✓ Audio loaded successfully");
          
        } catch (audioError) {
          newDebugInfo.audioLoadable = false;
          newDebugInfo.lastError = `Audio loading failed: ${audioError instanceof Error ? audioError.message : 'Unknown error'}`;
          console.error("✗ Audio loading failed:", audioError);
        }
      }

    } finally {
      setDebugInfo(newDebugInfo);
      setIsTestingPlayback(false);
    }
  };

  const testPlayback = async () => {
    if (!debugAudioRef.current || !audioUrl) return;

    try {
      if (debugAudioRef.current.paused) {
        await debugAudioRef.current.play();
        toast({
          title: "Playback Test",
          description: "Audio playback started successfully",
        });
      } else {
        debugAudioRef.current.pause();
        toast({
          title: "Playback Test", 
          description: "Audio playback paused",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Playback Test Failed",
        description: error instanceof Error ? error.message : "Unknown playback error",
      });
    }
  };

  useEffect(() => {
    if (audioUrl) {
      // Debounce the test to prevent excessive API calls
      const timeoutId = setTimeout(() => {
        testAudioUrl();
      }, 500); // Wait 500ms before testing
      
      return () => clearTimeout(timeoutId);
    }
  }, [audioUrl]);

  // Prevent continuous testing by adding a ref to track the last tested URL  
  const lastTestedUrl = useRef<string | null>(null);
  
  const debouncedTestAudioUrl = () => {
    if (audioUrl && audioUrl !== lastTestedUrl.current) {
      lastTestedUrl.current = audioUrl;
      testAudioUrl();
    }
  };

  if (!selectedAudioFile) {
    return null;
  }

  return (
    <Card className="w-full mb-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Audio Debug Panel - File ID: {selectedAudioFile}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-2">
            {debugInfo.urlValid ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span>URL Valid</span>
          </div>
          
          <div className="flex items-center gap-2">
            {!debugInfo.networkError ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span>Network OK</span>
          </div>
          
          <div className="flex items-center gap-2">
            {debugInfo.formatSupported ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span>Format OK</span>
          </div>
          
          <div className="flex items-center gap-2">
            {debugInfo.audioLoadable ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span>Audio Loads</span>
          </div>
          
          <div className="flex items-center gap-2">
            {!debugInfo.corsIssue ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span>CORS OK</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Ready: {debugInfo.readyState}
            </Badge>
          </div>
        </div>

        {debugInfo.lastError && (
          <div className="p-2 bg-red-100 dark:bg-red-900 rounded text-sm text-red-800 dark:text-red-200">
            <strong>Error:</strong> {debugInfo.lastError}
          </div>
        )}

        {audioUrl && (
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono break-all">
            URL: {audioUrl.substring(0, 100)}...
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={debouncedTestAudioUrl}
            disabled={isTestingPlayback || !audioUrl}
          >
            {isTestingPlayback ? (
              <>
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Audio URL"
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={testPlayback}
            disabled={!audioUrl || !debugInfo.audioLoadable}
          >
            <Play className="w-3 h-3 mr-1" />
            Test Playback
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onRefreshToken}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh Token
          </Button>
        </div>

        {/* Hidden audio element for testing */}
        <audio
          ref={debugAudioRef}
          style={{ display: 'none' }}
          preload="none"
        />
      </CardContent>
    </Card>
  );
}