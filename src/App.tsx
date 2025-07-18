import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { CalendarWidget } from "@/components/CalendarWidget";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { WorkoutLog } from "./pages/WorkoutLog";
import { CurrentMesocycle } from "./pages/CurrentMesocycle";
import { AllWorkouts } from "./pages/AllWorkouts";
import { MyStats } from "./pages/MyStats";
import { MyAccount } from "./pages/MyAccount";
import { CustomPlanBuilder } from "./pages/CustomPlanBuilder";
import { CustomPlanPreview } from "./pages/CustomPlanPreview";

const queryClient = new QueryClient();

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading RepForge...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-12 flex items-center justify-end border-b px-4">
            <CalendarWidget />
          </header>
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/current-mesocycle" element={<CurrentMesocycle />} />
              <Route path="/workouts" element={<AllWorkouts />} />
              <Route path="/stats" element={<MyStats />} />
              <Route path="/account" element={<MyAccount />} />
              <Route path="/custom-plan-builder" element={<CustomPlanBuilder selectedProgram="" selectedDuration={6} onBack={() => {}} onPlanCreated={() => {}} />} />
              <Route path="/custom-plan-preview/:workoutId" element={<CustomPlanPreview />} />
              <Route path="/workout-log/:workoutId" element={<WorkoutLog />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
