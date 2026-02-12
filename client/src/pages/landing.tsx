import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BarChart3, Shield, Zap, TrendingUp, Activity, Eye } from "lucide-react";
import logoLandscape from "@assets/Tracking_junction_logo_(new)_16-9_1770929129062.png";

const features = [
  {
    icon: BarChart3,
    title: "Funnel Analytics",
    description: "Visualize drop-off rates between quiz steps and identify where visitors leave your landing pages.",
  },
  {
    icon: Activity,
    title: "Real-Time Tracking",
    description: "Lightweight event tracking that captures every interaction without slowing down your ad-driven pages.",
  },
  {
    icon: TrendingUp,
    title: "Conversion Insights",
    description: "See conversion ratios at every step with breakdowns by page type, domain, and date range.",
  },
  {
    icon: Eye,
    title: "Step Breakdowns",
    description: "Understand which options visitors select at each step to optimize your quiz funnels.",
  },
  {
    icon: Shield,
    title: "Privacy-First",
    description: "Anonymous session tracking with no personal data stored. Compliant and respectful by design.",
  },
  {
    icon: Zap,
    title: "Blazing Fast API",
    description: "Non-blocking event ingestion designed for high-traffic ad campaigns with sub-50ms response times.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5" data-testid="text-logo">
            <img src={logoLandscape} alt="TrackingJunction" className="h-12" />
          </div>
          <a href="/api/login">
            <Button data-testid="button-login">Sign In</Button>
          </a>
        </div>
      </nav>

      <section className="pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Activity className="w-3.5 h-3.5" />
              Landing Page Analytics
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6" data-testid="text-hero-title">
              Know exactly where
              <span className="text-primary"> visitors drop off</span>
            </h1>
            <p className="text-muted-foreground text-lg sm:text-xl leading-relaxed mb-8 max-w-xl mx-auto">
              Track every quiz step on your landing pages. See funnel drop-offs, conversion rates, and visitor choices in a clean dashboard.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="/api/login">
                <Button size="lg" data-testid="button-get-started">
                  Get Started
                </Button>
              </a>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Internal analytics tool for your team</p>
          </div>
        </div>
      </section>

      <section className="pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-3">Everything you need to optimize</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Purpose-built for tracking multi-step quiz funnels on ad-driven landing pages.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <Card key={feature.title} className="p-5 hover-elevate">
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center mb-3">
                  <feature.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1.5">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap text-sm text-muted-foreground">
          <span>TrackingJunction.com</span>
          <span>Internal analytics dashboard</span>
        </div>
      </footer>
    </div>
  );
}
