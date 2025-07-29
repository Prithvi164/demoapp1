import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { z } from "zod";

// Validation schema for the reset password form
const resetPasswordSchema = z.object({
  password: z.string().min(6, {
    message: "Password must be at least 6 characters",
  }),
  confirmPassword: z.string().min(1, {
    message: "Please confirm your password",
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const form = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Extract token from URL on component mount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tokenParam = searchParams.get("token");
    
    if (!tokenParam) {
      toast({
        title: "Error",
        description: "Reset token is missing. Please use the link provided in the email.",
        variant: "destructive",
      });
      setIsValidating(false);
      return;
    }
    
    setToken(tokenParam);
    
    // Validate the token with the backend
    const validateToken = async () => {
      try {
        const response = await fetch(`/api/validate-reset-token/${tokenParam}`);
        const data = await response.json();
        
        if (response.ok && data.valid) {
          setIsTokenValid(true);
        } else {
          toast({
            title: "Invalid Token",
            description: data.message || "The password reset link is invalid or has expired.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Token validation error:", error);
        // Create a more user-friendly error message
        let errorMessage = "Failed to validate reset token. Please try again.";
        
        if (error instanceof Error) {
          if (error.message.includes("network") || error.message.includes("connection")) {
            errorMessage = "Unable to connect to the server. Please check your internet connection and try again.";
          } else if (error.message.includes("timeout")) {
            errorMessage = "The request timed out. The server might be experiencing high traffic. Please try again later.";
          }
        }
        
        toast({
          title: "Link Verification Failed",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsValidating(false);
      }
    };
    
    validateToken();
  }, [toast]);

  const onSubmit = async (data: ResetPasswordSchema) => {
    if (!token) {
      toast({
        title: "Error",
        description: "Reset token is missing. Please use the link provided in the email.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccessMessage("Your password has been successfully reset. You can now login with your new password.");
        form.reset();
      } else {
        // Create a user-friendly error message based on the response
        let errorMessage = result.message || "Failed to reset password. Please try again.";
        let errorTitle = "Password Reset Failed";
        
        if (errorMessage.includes("expired") || errorMessage.includes("invalid token")) {
          errorMessage = "The password reset link has expired or is no longer valid. Please request a new password reset link.";
          errorTitle = "Invalid or Expired Link";
        } else if (errorMessage.includes("password") && errorMessage.includes("strength")) {
          errorMessage = "Your new password doesn't meet the strength requirements. Please choose a stronger password with a mix of letters, numbers, and special characters.";
          errorTitle = "Password Too Weak";
        } else if (errorMessage.includes("match")) {
          errorMessage = "The passwords you entered don't match. Please make sure both passwords are identical.";
          errorTitle = "Passwords Don't Match";
        } else if (errorMessage.includes("minimum") || errorMessage.includes("length")) {
          errorMessage = "Your password must be at least 6 characters long. Please choose a longer password.";
          errorTitle = "Password Too Short";
        }
        
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Password reset error:", error);
      
      // Create user-friendly error message for unexpected errors
      let errorMessage = "An unexpected error occurred. Please try again later.";
      let errorTitle = "Password Reset Error";
      
      if (error instanceof Error) {
        if (error.message.includes("network") || error.message.includes("connection")) {
          errorMessage = "Unable to connect to the server. Please check your internet connection and try again.";
          errorTitle = "Connection Error";
        } else if (error.message.includes("timeout")) {
          errorMessage = "The request timed out. The server might be experiencing high traffic. Please try again later.";
          errorTitle = "Request Timeout";
        } else if (error.message.includes("server") || error.message.includes("503") || error.message.includes("500")) {
          errorMessage = "The server is currently experiencing issues. Please try again later or contact support if the problem persists.";
          errorTitle = "Server Error";
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Validating Reset Link</CardTitle>
            <CardDescription>
              Please wait while we validate your password reset link...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center p-6">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          {successMessage ? (
            <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">
              {successMessage}
            </div>
          ) : isTokenValid ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter your new password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Confirm your new password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Processing..." : "Reset Password"}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
              The password reset link is invalid or has expired.
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-center text-sm">
            <Link href="/auth" className="text-blue-600 hover:text-blue-800">
              Back to Login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}