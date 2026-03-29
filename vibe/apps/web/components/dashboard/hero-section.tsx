"use client"

import { Sparkles } from "lucide-react"

export function HeroSection() {
  return (
    <div className="relative overflow-hidden rounded-2xl mx-6 mt-6">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#4F8EFF] via-[#A855F7] to-[#EC4899] opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.2),transparent_60%)]" />

      {/* Dot Pattern */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative px-8 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span className="text-xs font-medium text-white">AI-Powered Development</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight text-balance">
          What do you want to build?
        </h1>
        <p className="text-white/70 text-base md:text-lg max-w-lg mx-auto leading-relaxed">
          Describe your idea and let VIBE turn it into a working application in minutes.
        </p>
      </div>
    </div>
  )
}
