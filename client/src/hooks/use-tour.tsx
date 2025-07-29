import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';

type TourName = 'locationManagement' | 'batchManagement' | 'userManagement' | 'dashboard';

interface TourOptions {
  // Whether to auto-start the tour on component mount if it hasn't been completed
  autoStart?: boolean;
  // Whether to show tours only for specific users (by email)
  userEmails?: string[];
  // Whether to reset the tour (show again even if previously completed)
  forceReset?: boolean;
}

export function useTour(tourName: TourName, options: TourOptions = {}) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  
  // Check if this user should see the tour based on email
  const isUserAllowed = useCallback(() => {
    if (!options.userEmails || options.userEmails.length === 0) {
      return true; // No restriction, show to all users
    }
    
    if (!user?.email) {
      return false; // No user email available
    }
    
    return options.userEmails.includes(user.email);
  }, [options.userEmails, user?.email]);
  
  // Generate a user-specific key for storing completion status
  const getTourKey = useCallback(() => {
    const userPart = user?.email ? `-${user.email.split('@')[0]}` : '';
    return `${tourName}TourComplete${userPart}`;
  }, [tourName, user?.email]);

  // Check if tour was previously completed
  const hasTourBeenCompleted = useCallback(() => {
    return !!localStorage.getItem(getTourKey());
  }, [getTourKey]);

  // Initialize tour on mount
  useEffect(() => {
    if (options.forceReset) {
      localStorage.removeItem(getTourKey());
    }
    
    // Auto-start tour if configured and user is allowed
    if (options.autoStart && isUserAllowed() && !hasTourBeenCompleted()) {
      setIsOpen(true);
    }
  }, [options.autoStart, options.forceReset, getTourKey, hasTourBeenCompleted, isUserAllowed]);

  const startTour = useCallback(() => {
    if (isUserAllowed()) {
      setIsOpen(true);
    }
  }, [isUserAllowed]);

  const completeTour = useCallback(() => {
    localStorage.setItem(getTourKey(), 'true');
    setIsOpen(false);
  }, [getTourKey]);

  const skipTour = useCallback(() => {
    localStorage.setItem(getTourKey(), 'true');
    setIsOpen(false);
  }, [getTourKey]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(getTourKey());
  }, [getTourKey]);

  return {
    isOpen,
    startTour,
    completeTour,
    skipTour,
    resetTour,
    hasTourBeenCompleted,
    isAllowed: isUserAllowed()
  };
}