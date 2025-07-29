import { InfoIcon, AlertTriangle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

export const AudioFormatInfo = () => {
  const [isOpen, setIsOpen] = useState(false);

  const supportedFormats = [
    { 
      name: "WAV", 
      extension: ".wav", 
      compatibility: "Universal", 
      quality: "Lossless", 
      recommended: true,
      mimeTypes: ["audio/wav", "audio/wave", "audio/x-wav"]
    },
    { 
      name: "MP3", 
      extension: ".mp3", 
      compatibility: "Universal", 
      quality: "Compressed", 
      recommended: true,
      mimeTypes: ["audio/mpeg", "audio/mp3"]
    },
    { 
      name: "MP4/M4A", 
      extension: ".mp4, .m4a", 
      compatibility: "Most browsers", 
      quality: "Compressed", 
      recommended: false,
      mimeTypes: ["audio/mp4", "audio/x-m4a"]
    },
    { 
      name: "AAC", 
      extension: ".aac", 
      compatibility: "Most browsers", 
      quality: "Compressed", 
      recommended: false,
      mimeTypes: ["audio/aac"]
    },
    { 
      name: "WebM", 
      extension: ".webm", 
      compatibility: "Chrome, Firefox", 
      quality: "Compressed", 
      recommended: false,
      mimeTypes: ["audio/webm"]
    },
    { 
      name: "OGG", 
      extension: ".ogg", 
      compatibility: "Firefox, Chrome", 
      quality: "Compressed", 
      recommended: false,
      mimeTypes: ["audio/ogg"]
    },
  ];

  const commonIssues = [
    {
      issue: "Audio file not loaded or unavailable",
      causes: [
        "SAS token expired (auto-expires after 4 hours)",
        "Network connection issues",
        "File format not supported by browser"
      ],
      solutions: [
        "Refresh the page to get new access tokens",
        "Check internet connection",
        "Try a different browser"
      ]
    },
    {
      issue: "Playback error or format not supported",
      causes: [
        "Browser doesn't support the audio codec",
        "Corrupted audio file",
        "Unsupported file format"
      ],
      solutions: [
        "Convert file to WAV or MP3 format",
        "Try using Chrome or Firefox browser",
        "Contact support if file appears corrupted"
      ]
    }
  ];

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-blue-900 dark:text-blue-100">
                  Audio Format Support & Troubleshooting
                </CardTitle>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                {isOpen ? "Hide" : "Show"} details
              </div>
            </div>
            <CardDescription className="text-blue-700 dark:text-blue-300">
              Click to view supported audio formats and common playback issues
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Supported Formats */}
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Supported Audio Formats
              </h4>
              <div className="grid gap-2">
                {supportedFormats.map((format, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded border bg-white dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm">{format.name}</strong>
                        <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">
                          {format.extension}
                        </code>
                        {format.recommended && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                            Recommended
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{format.compatibility}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-muted-foreground">{format.quality}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Common Issues */}
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Common Playback Issues
              </h4>
              <div className="space-y-3">
                {commonIssues.map((issue, index) => (
                  <Alert key={index} className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium text-orange-900 dark:text-orange-100">
                          {issue.issue}
                        </p>
                        <div className="grid md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="font-medium text-orange-800 dark:text-orange-200">Possible Causes:</p>
                            <ul className="list-disc list-inside space-y-1 text-orange-700 dark:text-orange-300">
                              {issue.causes.map((cause, i) => (
                                <li key={i}>{cause}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="font-medium text-orange-800 dark:text-orange-200">Solutions:</p>
                            <ul className="list-disc list-inside space-y-1 text-orange-700 dark:text-orange-300">
                              {issue.solutions.map((solution, i) => (
                                <li key={i}>{solution}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>

            {/* Quick Tips */}
            <Alert className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Quick Tips for Best Performance:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-700 dark:text-green-300">
                    <li><strong>Use MP3 or WAV</strong> for maximum compatibility</li>
                    <li><strong>Keep files under 50MB</strong> for faster loading</li>
                    <li><strong>Chrome or Firefox</strong> browsers work best</li>
                    <li><strong>Refresh the page</strong> if audio stops working after 4 hours</li>
                    <li><strong>Check console</strong> (F12) for detailed error messages</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};