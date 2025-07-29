import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  GraduationCap, 
  Users,
  ClipboardCheck,
  LogOut,
  BookOpen,
  FileCheck,
  CheckSquare,
  FileSpreadsheet,
  Cloud,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Menu,
  MessageSquare,
  FileAudio,
  BarChart,
  Download
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useRef } from 'react';
import { ZencxLogo } from '@/components/ui/zencx-logo';

export function SidebarNav() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [logoBackground, setLogoBackground] = useState<string>('bg-transparent');
  
  // Load collapsed state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState !== null) {
      setIsCollapsed(savedState === 'true');
    }
  }, []);
  
  // Determine section context based on current location
  const [sectionClass, setSectionClass] = useState<string>('section-dashboard');
  const [shimmerEffect, setShimmerEffect] = useState<boolean>(false);
  const prevLocationRef = useRef<string>(location);
  
  useEffect(() => {
    // Only apply shimmer effect when location changes (not on initial render)
    if (prevLocationRef.current !== location && prevLocationRef.current !== '') {
      setShimmerEffect(true);
      // Remove the effect after animation completes
      const timer = setTimeout(() => {
        setShimmerEffect(false);
      }, 1200); // Match animation duration
      
      return () => clearTimeout(timer);
    }
    
    prevLocationRef.current = location;
    
    // Set section class based on current route
    if (location.startsWith('/batch-management') || location.startsWith('/trainee-management')) {
      setSectionClass('section-trainee');
    } else if (location.startsWith('/quiz-management') || location.startsWith('/my-quizzes')) {
      setSectionClass('section-quiz');
    } else if (location.startsWith('/evaluation')) {
      setSectionClass('section-evaluation');
    } else if (location.startsWith('/audio-') || location.startsWith('/azure-')) {
      setSectionClass('section-audio');
    } else if (location.startsWith('/reports')) {
      setSectionClass('section-reports');
    } else if (location === '/') {
      setSectionClass('section-dashboard');
    } else {
      setSectionClass('');
    }
  }, [location]);
  
  // Save collapsed state to localStorage
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', String(newState));
  };

  // Query organization settings to get feature type
  const { data: settings, isLoading: isSettingsLoading } = useQuery<{ featureType?: string }>({
    queryKey: [`/api/organizations/${user?.organizationId}/settings`],
    enabled: !!user?.organizationId
  });

  const featureType = settings?.featureType || 'BOTH'; // Default to BOTH if not set
  console.log('Current feature type:', featureType);
  console.log('Current user category:', user?.category);

  const isTrainee = user?.category === 'trainee';
  const { hasPermission, isLoading: isPermissionsLoading } = usePermissions();
  
  // Loading state that combines all async operations
  const isNavLoading = isSettingsLoading || isPermissionsLoading || !user;

  // Define which features belong to which category with permission checks
  const lmsFeatures = [
    { href: '/batch-management', label: 'Batch Management', icon: Users, 
      permission: 'manage_batches' },
    { href: '/trainee-management', label: 'Trainee Management', icon: ClipboardCheck, 
      permission: 'view_trainee_management' },
    { href: '/quiz-management', label: 'Quiz Management', icon: BookOpen, 
      permission: 'view_quiz' },
  ];
  
  // Define QMS features with permission checks
  const qmsFeatures = [
    { href: '/evaluation-templates', label: 'Evaluation Forms', icon: CheckSquare,
      permission: 'view_evaluation_form' },
    { href: '/conduct-evaluation', label: 'Conduct Evaluation', icon: FileSpreadsheet,
      permission: 'manage_conduct_form' },
    { href: '/evaluation-feedback', label: 'Evaluation Feedback', icon: MessageSquare,
      permission: 'manage_evaluation_feedback' },
    { href: '/audio-assignment-dashboard', label: 'Assignment Dashboard', icon: CalendarDays,
      permission: 'view_allocation' },
    { href: '/azure-storage-browser', label: 'Browse Storage', icon: Cloud,
      permission: 'view_allocation' },
    { href: '/azure-storage-management', label: 'Manage Storage', icon: FileAudio,
      permission: 'view_allocation' },
    { href: '/reports', label: 'Reports', icon: BarChart,
      permission: 'view_reports' },
  ];

  // Define the type for navigation items
  type NavItem = {
    href: string;
    label: string;
    icon: React.ComponentType<any>;
    permission?: string;
  };

  // Filter non-trainee navigation items based on feature type setting AND permissions
  const getNonTraineeItems = () => {
    // First get the features based on feature type
    let features: NavItem[] = [];
    switch (featureType) {
      case 'LMS': 
        features = lmsFeatures;
        break;
      case 'QMS': 
        features = qmsFeatures;
        break;
      case 'BOTH':
      default:
        features = [...lmsFeatures, ...qmsFeatures];
        break;
    }
    
    // Then filter based on permissions
    return features.filter(item => {
      // If no permission specified, always show
      if (!item.permission) return true;
      // Otherwise, only show if user has the permission
      return hasPermission(item.permission);
    });
  };

  const navItems: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    ...(isTrainee ? [
      { href: '/my-quizzes', label: 'My Quizzes', icon: FileCheck }
    ] : getNonTraineeItems()),
  ];

  // Render the collapsed sidebar header with logo and toggle button
  const renderCollapsedHeader = () => (
    <div className="flex flex-col items-center w-full">
      <Button 
        variant="ghost" 
        size="sm"
        className="text-sidebar-foreground hover:bg-sidebar-accent/50 p-1 h-8 w-8 mb-2 self-end"
        onClick={toggleSidebar}
        aria-label="Expand sidebar"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Link href="/">
        <div className={`flex items-center justify-center logo-container hover:scale-105 rounded-md ${logoBackground} ${shimmerEffect ? 'animate-shimmer' : ''}`}>
          <ZencxLogo width={40} height={40} />
        </div>
      </Link>
    </div>
  );

  // Render the expanded sidebar header with logo and toggle button
  const renderExpandedHeader = () => (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <Link href="/" className="flex-1">
          <div className={`flex items-center justify-center overflow-hidden logo-container hover:scale-105 rounded-md ${logoBackground} ${shimmerEffect ? 'animate-shimmer' : ''}`}>
            <ZencxLogo width={100} height={40} />
          </div>
        </Link>
        <Button 
          variant="ghost" 
          size="sm"
          className="text-sidebar-foreground hover:bg-sidebar-accent/50 p-1 h-8 w-8 ml-2"
          onClick={toggleSidebar}
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className={cn(
      "h-screen bg-sidebar border-r border-sidebar-border p-4 flex flex-col transition-all duration-300 ease-in-out overflow-hidden",
      isCollapsed ? "w-[70px]" : "w-64",
      sectionClass
    )}>
      <div className="mb-4">
        {isNavLoading ? (
          // Logo loading skeleton
          <div className={cn(
            "bg-gray-100 rounded-md animate-pulse",
            isCollapsed ? "h-14 w-14 mx-auto" : "h-16 w-32"
          )} />
        ) : (
          isCollapsed ? renderCollapsedHeader() : renderExpandedHeader()
        )}
      </div>

      <nav className="space-y-2 flex-1">
        {isNavLoading ? (
          // Loading skeleton UI - show placeholders while loading
          Array(6).fill(0).map((_, i) => (
            <div key={i} className={cn(
              "w-full h-10 bg-gray-100 rounded-md animate-pulse mb-2",
              isCollapsed ? "px-2" : "px-4"
            )} />
          ))
        ) : (
          // Render all navigation items at once when data is fully loaded
          navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.startsWith(item.href) || (item.href === '/' && location === '/');
  
            // Determine active color based on route for enhanced contextual experience
            let activeClasses = "bg-sidebar-accent text-sidebar-accent-foreground";
            if (isActive) {
              if (item.href.startsWith('/batch-management') || item.href.startsWith('/trainee-management')) {
                activeClasses = "bg-blue-100/40 text-blue-700";
              } else if (item.href.startsWith('/quiz-management') || item.href === '/my-quizzes') {
                activeClasses = "bg-green-100/40 text-green-700";
              } else if (item.href.startsWith('/evaluation')) {
                activeClasses = "bg-purple-100/40 text-purple-700";
              } else if (item.href.startsWith('/audio-') || item.href.startsWith('/azure-')) {
                activeClasses = "bg-cyan-100/40 text-cyan-700";
              } else if (item.href.startsWith('/reports')) {
                activeClasses = "bg-indigo-100/40 text-indigo-700";
              } else if (item.href === '/') {
                activeClasses = "bg-orange-100/40 text-orange-700";
              }
            }
  
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start transition-all duration-300",
                    isActive 
                      ? activeClasses
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                    isCollapsed && "px-2 justify-center"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={cn("h-4 w-4", isCollapsed ? "mr-0" : "mr-3")} />
                  {!isCollapsed && item.label}
                </Button>
              </Link>
            );
          })
        )}
      </nav>

      {isNavLoading ? (
        // Loading skeleton for logout button
        <div className={cn(
          "w-full h-10 bg-gray-100 rounded-md animate-pulse mt-2",
          isCollapsed ? "px-2" : "px-4"
        )} />
      ) : (
        <Button 
          variant="ghost" 
          className={cn(
            "text-sidebar-foreground hover:bg-sidebar-accent/50",
            isCollapsed ? "px-2 justify-center w-full" : "w-full justify-start"
          )}
          onClick={() => logout()}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className={cn("h-4 w-4", isCollapsed ? "mr-0" : "mr-3")} />
          {!isCollapsed && "Logout"}
        </Button>
      )}
    </div>
  );
}