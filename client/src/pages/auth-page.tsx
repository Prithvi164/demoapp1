import { useLocation, Link } from "wouter";
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ZencxLogo } from "@/components/ui/zencx-logo";
import { BarChart2, Users, GraduationCap, ClipboardCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { type InsertUser } from "@shared/schema";

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { login, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Preload the logo image
  useEffect(() => {
    const img = new Image();
    img.src = '/images/zencx-logo.png';
    img.onload = () => setImageLoaded(true);
  }, []);
  
  // No animations as requested
  const isAnimating = true;
  const showForm = true;

  // Redirect if already logged in
  if (user) {
    navigate("/");
    return null;
  }

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);

    try {
      // Get form data properly
      const username = formData.get("username") as string;
      const password = formData.get("password") as string;
      
      if (username && password) {
        // Add slight delay for animation effect
        setTimeout(async () => {
          try {
            // Login expects a LoginData object with username and password
            const loginData: Pick<InsertUser, "username" | "password"> = {
              username, 
              password
            };
            await login(loginData);
            navigate("/");
          } catch (error: any) {
            toast({
              title: "Login failed",
              description: error.message,
              variant: "destructive"
            });
            setIsLoading(false);
          }
        }, 600);
      } else {
        throw new Error("Username and password are required");
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute rounded-full w-96 h-96 bg-blue-100/20 -top-24 -left-24 opacity-40"></div>
        <div className="absolute rounded-full w-64 h-64 bg-blue-100/20 -bottom-12 -right-12 opacity-30"></div>
        <div className="absolute rounded-full w-32 h-32 bg-blue-100/20 top-1/2 right-1/4 opacity-30"></div>
      </div>
      
      {/* Main content area */}
      <div className="flex-grow grid lg:grid-cols-2 px-4 py-8 relative z-10">
        <div className="flex items-center justify-center p-4 lg:p-8">
          <div className="flex flex-col justify-center w-full max-w-[400px]">
            <Card className="shadow-md overflow-hidden border border-slate-100">
              <CardHeader className="pb-2 pt-6">
                <CardTitle className="text-center">Welcome</CardTitle>
                <CardDescription className="text-center">
                  Login to your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAuth}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input 
                        id="username" 
                        name="username" 
                        required 
                        placeholder="Enter your username"
                        disabled={isLoading}
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input 
                        id="password" 
                        name="password" 
                        type="password" 
                        required 
                        placeholder="Enter your password"
                        disabled={isLoading}
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className={`w-full ${isLoading ? 'bg-opacity-80' : ''}`}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Logging in...
                        </div>
                      ) : "Login"}
                    </Button>
                    <div className="text-center mt-2">
                      <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                        Forgot your password?
                      </Link>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="hidden lg:flex bg-white items-center justify-center px-6 py-8 rounded-lg shadow-sm mx-6 mb-8">
          <div className="flex flex-col justify-center w-full">
            <div className="w-full space-y-6">
              {/* Added logo above heading in right panel with more space */}
              <div className="flex justify-center mb-4 p-0">
                {imageLoaded ? (
                  <div className="rounded-md">
                    <ZencxLogo 
                      width={300} 
                      height={110} 
                      className="p-0 m-0"
                    />
                  </div>
                ) : (
                  <div className="skeleton-image w-[300px] h-[110px] bg-gray-100 animate-pulse rounded-md flex items-center justify-center text-gray-400">
                    Loading...
                  </div>
                )}
              </div>
              
              <div className="text-center mb-4 mt-6">
                {/* Reduced font size for the heading */}
                <h1 className="text-3xl font-bold mb-0 text-gray-800">
                  Transform Your Contact Center Quality and Training
                </h1>
              </div>

              {/* 2x2 matrix for feature cards */}
              <div className="grid grid-cols-2 gap-4 justify-center">
                <div className="text-center p-3 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100 transition-all duration-500 hover:shadow-md hover:-translate-y-1">
                  <Users className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                  <h3 className="font-medium text-sm text-gray-700">Team Management</h3>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100 transition-all duration-500 hover:shadow-md hover:-translate-y-1">
                  <GraduationCap className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                  <h3 className="font-medium text-sm text-gray-700">Training Paths</h3>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100 transition-all duration-500 hover:shadow-md hover:-translate-y-1">
                  <ClipboardCheck className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                  <h3 className="font-medium text-sm text-gray-700">Quality Monitoring</h3>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100 transition-all duration-500 hover:shadow-md hover:-translate-y-1">
                  <BarChart2 className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                  <h3 className="font-medium text-sm text-gray-700">Analytics</h3>
                </div>
              </div>
              
              {/* Moved description to a single line at the end */}
              <p className="text-sm text-gray-600 text-center mt-4">
                ZenCX Studio helps you create personalized training paths, track agent performance, and ensure compliance with ease.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}