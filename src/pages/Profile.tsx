import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import NavBar from "@/components/NavBar";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import BusinessProfileTab from "@/components/BusinessProfileTab";
import { useAuth } from "@/hooks/useAuth";

const Profile = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <PageBreadcrumbs items={[
        { label: "Settings", href: "/settings" },
        { label: "Business Profile" }
      ]} />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Business Profile</h1>
        <p className="text-muted-foreground mb-8">
          Manage your business profile and brand settings. This information is used to personalize AI-generated campaigns.
        </p>
        <BusinessProfileTab />
      </main>
    </div>
  );
};

export default Profile;
