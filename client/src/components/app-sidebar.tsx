import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, BarChart3, FileText, LogOut, GitBranch, Server } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-md bg-primary"
      style={{ width: size, height: size }}
    >
      <GitBranch className="text-primary-foreground" style={{ width: size * 0.6, height: size * 0.6 }} />
    </div>
  );
}

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, testId: "nav-dashboard" },
  { title: "Reports", url: "/reports", icon: BarChart3, testId: "nav-reports" },
  { title: "API Docs", url: "/docs", icon: FileText, testId: "nav-api-docs" },
  { title: "Server Logs", url: "/logs", icon: Server, testId: "nav-server-logs" },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("") || "U";

  return (
    <Sidebar collapsible="icon" data-testid="sidebar-nav">
      <SidebarHeader className="p-3">
        <Link href="/">
          <div className="flex items-center gap-2.5 cursor-pointer" data-testid="sidebar-logo">
            <LogoMark size={collapsed ? 28 : 32} />
            {!collapsed && (
              <div className="flex flex-col leading-tight">
                <span className="text-base font-bold tracking-tight">
                  <span className="text-foreground">Tracking</span>
                  <span className="text-primary">Junction</span>
                </span>
              </div>
            )}
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.url} data-testid={item.testId}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage
              src={user?.profileImageUrl || undefined}
              alt={user?.firstName || "User"}
            />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" data-testid="text-sidebar-user">
                {user?.firstName} {user?.lastName}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            data-testid="button-logout"
            className="shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
