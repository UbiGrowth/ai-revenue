"use client"

import { AppShell } from "@/components/app-shell"
import { BillingDashboard } from "@/components/billing/billing-dashboard"
import { CreditCard } from "lucide-react"

export default function BillingPage() {
  return (
    <AppShell>
      <div className="min-h-screen">
        {/* Page Header */}
        <div className="px-6 pt-8 pb-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4F8EFF] to-[#A855F7] flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Billing</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Plan details, usage statistics, and feature comparison
              </p>
            </div>
          </div>
        </div>

        {/* Billing Content */}
        <div className="px-6 py-8 max-w-4xl">
          <BillingDashboard />
        </div>
      </div>
    </AppShell>
  )
}
