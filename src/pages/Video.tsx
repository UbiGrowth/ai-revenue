import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent } from "@/components/ui/card";
import { Video as VideoIcon } from "lucide-react";

const Video = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-background">
        <NavBar />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
                <VideoIcon className="h-8 w-8" />
                Create Video
              </h1>
              <p className="text-muted-foreground">
                AI-powered marketing videos for your campaigns
              </p>
            </div>

            <Card className="border-primary/20">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-primary/10 p-6 mb-6">
                  <VideoIcon className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">Coming Soon</h2>
                <p className="text-muted-foreground max-w-md">
                  AI-powered video generation will be available after platform approval. 
                  Stay tuned for automatic video creation with Veo 3.1.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default Video;
