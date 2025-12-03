import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import ContentCalendar from "@/components/ContentCalendar";
import AutomationDashboard from "@/components/AutomationDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Zap } from "lucide-react";

export default function Automation() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <main className="flex-1 container py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Automation Hub</h1>
            <p className="text-muted-foreground mt-2">
              Schedule content, automate workflows, and let AI handle your daily marketing
            </p>
          </div>

          <Tabs defaultValue="automation" className="space-y-6">
            <TabsList>
              <TabsTrigger value="automation" className="gap-2">
                <Zap className="h-4 w-4" />
                Automation Engine
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2">
                <Calendar className="h-4 w-4" />
                Content Calendar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="automation">
              <AutomationDashboard />
            </TabsContent>

            <TabsContent value="calendar">
              <ContentCalendar />
            </TabsContent>
          </Tabs>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
