import { Switch, Route, useRoute } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { TimezoneProvider } from "@/hooks/use-timezone";
import { useAuth } from "@/hooks/use-auth";
import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import ApiDocsPage from "@/pages/api-docs";
import ReportsPage from "@/pages/reports";
import ServerLogsPage from "@/pages/server-logs";
import BlockListPage from "@/pages/block-list";
import FacebookAdsPage from "@/pages/facebook-ads";
import MetaConversionsPage from "@/pages/meta-conversions";
import UsersPage from "@/pages/users";
import PrivacyPage from "@/pages/privacy";
import NotFound from "@/pages/not-found";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { CsvExportButton } from "@/components/csv-export-button";

function AuthenticatedLayout() {
  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-50 flex items-center justify-between gap-2 h-12 px-3 border-b bg-background/80 backdrop-blur-md flex-wrap">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <CsvExportButton query="" />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/reports" component={ReportsPage} />
              <Route path="/docs" component={ApiDocsPage} />
              <Route path="/logs" component={ServerLogsPage} />
              <Route path="/block-list" component={BlockListPage} />
              <Route path="/facebook-ads" component={FacebookAdsPage} />
              <Route path="/meta-conversions" component={MetaConversionsPage} />
              <Route path="/users" component={UsersPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background" data-testid="access-denied-page">
      <div className="text-center max-w-md p-8">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m5-7V7a5 5 0 00-10 0v4a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">
          Your account has not been approved for access to this dashboard. Please contact an administrator to request access.
        </p>
        <a href="/api/logout" className="text-sm text-primary underline" data-testid="link-logout">
          Sign out and try a different account
        </a>
      </div>
    </div>
  );
}

function Router() {
  const [isPrivacy] = useRoute("/page/privacy");
  const { user, isLoading, accessDenied } = useAuth();

  if (isPrivacy) {
    return <PrivacyPage />;
  }

  if (isLoading) {
    return null;
  }

  if (accessDenied) {
    return <AccessDenied />;
  }

  if (!user) {
    return <LandingPage />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TimezoneProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </TimezoneProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
