import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BrandingProvider } from "./contexts/BrandingContext";
import { IndustryProvider } from "./contexts/IndustryContext";
import { paintingConfig } from "./config/industryConfig";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import EmailAutomation from "./pages/EmailAutomation";
import Communications from "./pages/Communications";
import Docs from "./pages/Docs";
import Settings from "./pages/Settings";
import Schedule from "./pages/Schedule";
import Invoices from "./pages/Invoices";
import CustomerPortal from "./pages/CustomerPortal";
import Crew from "./pages/Crew";
import Blog from "./pages/Blog";
import BlogEditor from "./pages/BlogEditor";
import BlogList from "./pages/BlogList";
import BlogPost from "./pages/BlogPost";
import AIAssistant from "./pages/AIAssistant";
import Templates from "./pages/Templates";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import Contact from "./pages/Contact";

function Router() {
  return (
    <Switch>
      {/* Public routes — no auth, no sidebar */}
      <Route path="/" component={Landing} />
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
      <Route path="/contact" component={Contact} />
      <Route path="/portal/:token" component={CustomerPortal} />
      <Route path="/blog" component={BlogList} />
      <Route path="/blog/:slug" component={BlogPost} />
      {/* Admin dashboard routes — wrapped in DashboardLayout (handles auth redirect) */}
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/pipeline" component={Pipeline} />
            <Route path="/leads" component={Leads} />
            <Route path="/leads/:id" component={LeadDetail} />
            <Route path="/email-automation" component={EmailAutomation} />
            <Route path="/schedule" component={Schedule} />
            <Route path="/crew" component={Crew} />
            <Route path="/blog-manage" component={Blog} />
            <Route path="/blog-manage/new" component={BlogEditor} />
            <Route path="/blog-manage/edit/:id" component={BlogEditor} />
            <Route path="/communications" component={Communications} />
            <Route path="/invoices" component={Invoices} />
            <Route path="/ai-assistant" component={AIAssistant} />
            <Route path="/templates" component={Templates} />
            <Route path="/docs" component={Docs} />
            <Route path="/settings" component={Settings} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <IndustryProvider config={paintingConfig}>
        <ThemeProvider defaultTheme="light">
          <BrandingProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </BrandingProvider>
        </ThemeProvider>
      </IndustryProvider>
    </ErrorBoundary>
  );
}

export default App;
