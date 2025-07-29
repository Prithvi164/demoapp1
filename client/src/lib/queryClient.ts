import { QueryClient, QueryFunction, QueryKey } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorData: any;
    try {
      errorData = await res.json();
    } catch {
      const textError = await res.text() || res.statusText;
      throw new Error(`${res.status}: ${textError}`);
    }
    
    // For validation errors, include the full error object
    if (errorData.errors && Array.isArray(errorData.errors)) {
      const error = new Error(`${res.status}: ${errorData.message || res.statusText}`);
      (error as any).validationErrors = errorData.errors;
      (error as any).title = errorData.title || 'Validation Error';
      throw error;
    }
    
    // For other structured errors
    if (errorData.title) {
      const error = new Error(`${res.status}: ${errorData.message || res.statusText}`);
      (error as any).title = errorData.title;
      throw error;
    }
    
    throw new Error(`${res.status}: ${errorData.message || res.statusText}`);
  }
}

// Exponential backoff retry delay calculator
function getRetryDelay(attemptIndex: number) {
  return Math.min(1000 * Math.pow(2, attemptIndex), 30000); // Max 30 seconds
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const res = await fetch(url, {
      method,
      headers: data instanceof FormData ? {} : { "Content-Type": "application/json" },
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return apiRequest(method, url, data); // Retry after waiting
    }

    // Clone the response before checking if it's ok
    // This way we can still use the original response later
    const resClone = res.clone();
    await throwIfResNotOk(resClone);
    return res;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An unexpected error occurred");
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn = <T>({ on401 }: { on401: UnauthorizedBehavior }): QueryFunction<T, QueryKey> =>
  async ({ queryKey, signal, meta }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
        signal,
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return getQueryFn({ on401 })({ queryKey, signal, meta });
      }

      if (on401 === "returnNull" && res.status === 401) {
        return null;
      }

      // Clone the response before checking if it's ok
      const resClone = res.clone();
      await throwIfResNotOk(resClone);
      return await res.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("An unexpected error occurred");
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000, // Consider data fresh for 30 seconds
      gcTime: 300000, // Keep unused data in cache for 5 minutes
      retry: (failureCount, error) => {
        if (error instanceof Error) {
          // Don't retry auth errors
          if (error.message.includes("401")) return false;
          // Don't retry if explicitly told not to
          if (error.message.includes("do-not-retry")) return false;
        }
        return failureCount < 3;
      },
      retryDelay: getRetryDelay,
    },
    mutations: {
      retry: false,
    },
  },
});