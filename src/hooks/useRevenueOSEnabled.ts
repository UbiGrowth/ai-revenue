import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TenantFlags {
  revenue_os_enabled: boolean;
  cfo_expansion_enabled: boolean;
  loading: boolean;
  tenantId: string | null;
}

export function useRevenueOSEnabled(): TenantFlags {
  const [flags, setFlags] = useState<TenantFlags>({
    revenue_os_enabled: false,
    cfo_expansion_enabled: false,
    loading: true,
    tenantId: null,
  });

  useEffect(() => {
    const fetchFlags = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFlags(f => ({ ...f, loading: false }));
        return;
      }

      // Get user's tenant
      const { data: userTenant } = await supabase
        .from("user_tenants")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!userTenant) {
        setFlags(f => ({ ...f, loading: false }));
        return;
      }

      // Get tenant flags
      const { data: tenant } = await supabase
        .from("tenants")
        .select("revenue_os_enabled, cfo_expansion_enabled")
        .eq("id", userTenant.tenant_id)
        .single();

      setFlags({
        revenue_os_enabled: tenant?.revenue_os_enabled ?? false,
        cfo_expansion_enabled: tenant?.cfo_expansion_enabled ?? false,
        loading: false,
        tenantId: userTenant.tenant_id,
      });
    };

    fetchFlags();
  }, []);

  return flags;
}
