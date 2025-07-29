import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
} from "@tanstack/react-query";
import { type User, type InsertUser } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type LoginData = Pick<InsertUser, "username" | "password">;

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (data: LoginData) => Promise<void>;
  register: (data: InsertUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/user", { credentials: "include" });
        if (res.status === 401) return null;
        if (!res.ok) throw new Error("Failed to fetch user");
        return res.json();
      } catch (err) {
        throw err;
      }
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        const res = await apiRequest("POST", "/api/login", credentials);
        // Since apiRequest already checks for errors and clones the response, we can safely call json()
        return await res.json();
      } catch (error) {
        console.error("Login error:", error);
        throw error;
      }
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      // Create user-friendly error messages for login failures
      let errorMessage = error.message;
      let errorTitle = "Login failed";
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("401")) {
        errorMessage = "Your username or password is incorrect. Please try again.";
      } else if (errorMessage.includes("account") && errorMessage.includes("inactive")) {
        errorMessage = "Your account is inactive. Please contact your administrator.";
      } else if (errorMessage.includes("locked")) {
        errorMessage = "Your account has been locked due to too many failed attempts. Please contact your administrator.";
      } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
        errorMessage = "Unable to connect to the server. Please check your internet connection and try again.";
      } else if (error.message.length > 100) {
        // If the error message is too long, it's probably a technical message
        errorMessage = "Something went wrong. Please try again later or contact support.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      try {
        const res = await apiRequest("POST", "/api/register", data);
        // Since apiRequest already checks for errors and clones the response, we can safely call json()
        return await res.json();
      } catch (error) {
        console.error("Registration error:", error);
        throw error;
      }
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      // Create user-friendly error messages for registration failures
      let errorMessage = error.message;
      let errorTitle = "Registration failed";
      
      if (errorMessage.includes("duplicate") || errorMessage.includes("already exists") || errorMessage.includes("unique constraint")) {
        errorMessage = "This email or username is already registered. Please try a different one.";
      } else if (errorMessage.includes("validation")) {
        errorMessage = "Please check your information and make sure all required fields are filled correctly.";
      } else if (errorMessage.includes("password")) {
        errorMessage = "Your password does not meet the requirements. Please choose a stronger password.";
      } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
        errorMessage = "Unable to connect to the server. Please check your internet connection and try again.";
      } else if (error.message.length > 100) {
        // If the error message is too long, it's probably a technical message
        errorMessage = "Something went wrong. Please try again later or contact support.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        // Using fetch directly instead of apiRequest to avoid body stream issues
        const response = await fetch("/api/logout", {
          method: "POST",
          credentials: "include"
        });
        
        // Special case for 503 Service Unavailable - force logout on client side
        if (response.status === 503) {
          console.warn("Server unavailable during logout, forcing client-side logout");
          return { forced: true };
        }
        
        if (!response.ok) {
          let errorMessage: string;
          try {
            const data = await response.json();
            errorMessage = data.message || response.statusText;
          } catch {
            errorMessage = response.statusText;
          }
          throw new Error(`${response.status}: ${errorMessage}`);
        }
        
        return { success: true }; // Return something to indicate success
      } catch (error) {
        console.error("Logout error:", error);
        // If the error is a network error or the server is unreachable,
        // we'll force a client-side logout
        if (error instanceof Error && 
            (error.message.includes("Failed to fetch") || 
             error.message.includes("NetworkError") ||
             error.message.includes("503"))) {
          console.warn("Network error during logout, forcing client-side logout");
          return { forced: true };
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      // Clear the user data from the cache regardless of how logout happened
      queryClient.setQueryData(["/api/user"], null);
      
      // Clear all queries from cache to ensure fresh data on next login
      queryClient.clear();
      
      // Show a toast for forced logout if needed
      if (result.forced) {
        toast({
          title: "Logged out",
          description: "You've been logged out. The server may be temporarily unavailable.",
          duration: 5000,
        });
      }
    },
    onError: (error: Error) => {
      console.error("Logout mutation error:", error);
      
      // Create user-friendly error messages for logout failures
      let errorMessage = "You've been logged out, but there was a problem with the server.";
      
      // Still provide a simple error message, but focus on the fact that the logout succeeded client-side
      toast({
        title: "Partial logout",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Force client-side logout even when there's an error on the server
      queryClient.setQueryData(["/api/user"], null);
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        login: async (data) => {
          await loginMutation.mutateAsync(data);
        },
        register: async (data) => {
          await registerMutation.mutateAsync(data);
        },
        logout: async () => {
          await logoutMutation.mutateAsync();
        },
        updateUser: (updatedUser: User) => {
          queryClient.setQueryData(["/api/user"], updatedUser);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}