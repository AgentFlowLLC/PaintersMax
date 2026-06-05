import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
// getLoginUrl removed — replaced by email/password /login route
import { useIsMobile } from "@/hooks/useMobile";
import { useBranding } from "@/contexts/BrandingContext";
import { useIndustry } from "@/contexts/IndustryContext";
import { BarChart3, BookOpen, CalendarDays, FileText, HardHat, LayoutDashboard, LayoutTemplate, LogOut, Mail, MessageSquare, PanelLeft, Receipt, Settings, Sparkles, Users } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

/**
 * BrandedCTAButton — a primary Button that uses the secondary brand color
 * from BrandingContext as its background, overriding the default primary color.
 * Falls back to the default Button style when branding is not loaded.
 */
function BrandedCTAButton({
  children,
  style,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { branding } = useBranding();
  const brandStyle = branding.secondaryColor
    ? {
        backgroundColor: branding.secondaryColor,
        borderColor: branding.secondaryColor,
        ...style,
      }
    : style;
  return (
    <Button style={brandStyle} {...props}>
      {children}
    </Button>
  );
}

function useMenuItems() {
  const { teamGroupName } = useIndustry();
  return [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: BarChart3, label: "Pipeline", path: "/pipeline" },
    { icon: Users, label: "Leads", path: "/leads" },
    { icon: CalendarDays, label: "Schedule", path: "/schedule" },
    { icon: HardHat, label: teamGroupName, path: "/crew" },
    { icon: Mail, label: "Email Automation", path: "/email-automation" },
    { icon: MessageSquare, label: "Communication Log", path: "/communications" },
    { icon: Receipt, label: "Invoices", path: "/invoices" },
    { icon: FileText, label: "Blog / Articles", path: "/blog-manage" },
    { icon: Sparkles, label: "AI Assistant", path: "/ai-assistant" },
    { icon: LayoutTemplate, label: "Templates", path: "/templates" },
    { icon: BookOpen, label: "Documentation", path: "/docs" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];
}

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const { branding } = useBranding();
  const gaId = (branding as unknown as { googleAnalyticsId?: string | null }).googleAnalyticsId;

  // Inject Google Analytics gtag.js when a Measurement ID is configured
  useEffect(() => {
    if (!gaId) return;
    const scriptId = "ga-gtag-script";
    if (document.getElementById(scriptId)) return; // already injected
    const s1 = document.createElement("script");
    s1.id = scriptId;
    s1.async = true;
    s1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(s1);
    const s2 = document.createElement("script");
    s2.id = "ga-gtag-config";
    s2.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
    document.head.appendChild(s2);
  }, [gaId]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <BrandedCTAButton
            onClick={() => {
              window.location.href = "/login";
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </BrandedCTAButton>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const menuItems = useMenuItems();
  const activeMenuItem = menuItems.find(item => item.path === location || (item.path !== '/' && location.startsWith(item.path)));
  const isMobile = useIsMobile();

  // Fetch unread conversation count
  const { data: unreadCount = 0 } = trpc.sms.getUnreadCount.useQuery();
  const markAllAsReadMutation = trpc.sms.markAsRead.useMutation();
  // Fetch overdue invoice count for sidebar badge
  const { data: overdueCount = 0 } = trpc.invoices.getOverdueCount.useQuery();

  // Apply primary color as CSS variable on the sidebar element
  const sidebarStyle: CSSProperties = branding.primaryColor
    ? { "--sidebar-background": branding.primaryColor } as CSSProperties
    : {};

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  {branding.logoUrl ? (
                    <img
                      src={branding.logoUrl}
                      alt={branding.businessName}
                      className="h-7 w-7 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: branding.primaryColor }}
                    >
                      <span className="text-white text-xs font-bold">
                        {branding.businessName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="font-semibold tracking-tight truncate text-sidebar-foreground">
                    {branding.businessName}
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                // Show unread badge for Communication Log
                const showSmsBadge = item.path === "/communications" && unreadCount > 0;
                // Show overdue badge for Invoices
                const showOverdueBadge = item.path === "/invoices" && overdueCount > 0;
                const badgeCount = showSmsBadge ? unreadCount : showOverdueBadge ? overdueCount : 0;
                const showBadge = showSmsBadge || showOverdueBadge;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        setLocation(item.path);
                      }}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {showBadge && (
                        <span className="ml-auto inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold">
                          {badgeCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
