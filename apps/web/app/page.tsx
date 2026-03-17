"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Header from "../components/Header";
import Footer from "../components/Footer";
import HowItWorksStep from "../components/HowItWorksStep";
import FeatureCard from "../components/FeatureCard";
import PricingCard from "../components/PricingCard";

/* ────────────────────────────────────────────
   Icon helpers (inline SVGs for zero deps)
──────────────────────────────────────────── */

const CameraIcon = (
  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
  </svg>
);

const GridIcon = (
  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
);

const ShuffleIcon = (
  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);

const AvatarIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const SparklesIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
  </svg>
);

const WifiOffIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.5 18.75a.75.75 0 001.5 0 .75.75 0 00-1.5 0zM6.396 14.85A6.726 6.726 0 0112 12.75c1.558 0 3.012.53 4.164 1.418M2.76 10.587A11.466 11.466 0 0112 7.5c2.612 0 5.024.874 6.954 2.346" />
  </svg>
);

const BoltIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);

/* ────────────────────────────────────────────
   Pricing data
──────────────────────────────────────────── */

const pricingPlans = [
  {
    tier: "Free",
    price: "$0",
    yearlyPrice: "$0",
    features: ["2 outfit captures", "View only", "Basic support"],
    ctaText: "Get Started",
  },
  {
    tier: "Plus",
    price: "$4.99",
    yearlyPrice: "$3.33",
    features: ["20 outfit captures", "Full mix & match", "Email support"],
    isPopular: true,
    ctaText: "Start Plus",
  },
  {
    tier: "Pro",
    price: "$12.99",
    yearlyPrice: "$8.66",
    features: ["Unlimited outfits", "Priority processing", "Priority support"],
    ctaText: "Go Pro",
  },
];

/* ────────────────────────────────────────────
   Page component
──────────────────────────────────────────── */

export default function Home() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <>
      <Header />

      <main>
        {/* ─── HERO ─── */}
        <section
          id="hero"
          className="relative flex min-h-screen items-center overflow-hidden pt-20"
        >
          {/* Subtle background gradient */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#FFF0F0]/40 via-white to-white" />

          <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
            <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
              {/* Copy */}
              <div className="max-w-2xl">
                <motion.h1
                  initial={{ opacity: 0, y: 32 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7 }}
                  className="font-display text-5xl font-extrabold leading-[1.1] tracking-tight text-[#1A1A2E] sm:text-6xl lg:text-7xl"
                >
                  Your Entire Wardrobe,{" "}
                  <span className="text-[#FF6B6B]">Digitized</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.15 }}
                  className="mt-8 max-w-lg text-lg leading-relaxed text-[#6B7280]"
                >
                  Capture outfits in 360&deg;. Mix &amp; match on your 3D avatar.
                  Never wonder what to wear again.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.3 }}
                  className="mt-10 flex flex-wrap gap-4"
                >
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 rounded-full bg-[#FF6B6B] px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#FF5252] hover:shadow-xl hover:shadow-[#FF6B6B]/20"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    Download for iOS
                  </a>
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-8 py-3.5 text-sm font-semibold text-[#1A1A2E] transition-all hover:border-gray-300 hover:shadow-lg"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.6l2.807 1.626a1 1 0 010 1.734l-2.808 1.626L15.206 12l2.492-2.493zM5.864 2.658L16.8 8.99l-2.302 2.302-8.635-8.635z" />
                    </svg>
                    Download for Android
                  </a>
                </motion.div>
              </div>

              {/* App mockup placeholder */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="flex justify-center lg:justify-end"
              >
                <div className="relative h-[520px] w-[260px] overflow-hidden rounded-[3rem] bg-gradient-to-br from-[#FF6B6B] via-[#FF9B9B] to-[#FFE0E0] shadow-2xl shadow-[#FF6B6B]/20 sm:h-[600px] sm:w-[300px]">
                  {/* Notch */}
                  <div className="absolute left-1/2 top-3 h-6 w-24 -translate-x-1/2 rounded-full bg-black/10" />
                  {/* Screen content placeholder */}
                  <div className="absolute inset-4 top-12 rounded-[2rem] bg-white/20 backdrop-blur-sm" />
                  {/* Bottom bar */}
                  <div className="absolute bottom-4 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-white/40" />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section id="how-it-works" className="bg-[#F8F9FA] py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6B6B]">
                How It Works
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#1A1A2E] sm:text-4xl">
                Three simple steps
              </h2>
            </motion.div>

            <div className="mt-16 grid gap-12 sm:grid-cols-3 lg:mt-20 lg:gap-8">
              <HowItWorksStep
                step={1}
                icon={CameraIcon}
                title="Capture"
                description="Record a 360° video of your outfit. Our AI handles the rest."
              />
              <HowItWorksStep
                step={2}
                icon={GridIcon}
                title="Organize"
                description="Your wardrobe, digitally cataloged and always at your fingertips."
              />
              <HowItWorksStep
                step={3}
                icon={ShuffleIcon}
                title="Mix & Match"
                description="Combine pieces across outfits on your personalized 3D avatar."
              />
            </div>
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section id="features" className="py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6B6B]">
                Features
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#1A1A2E] sm:text-4xl">
                Everything you need
              </h2>
            </motion.div>

            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:mt-20">
              <FeatureCard
                icon={AvatarIcon}
                title="3D Avatar"
                description="See your outfits on a personalized template body. Visualize how pieces look together before you even get dressed."
              />
              <FeatureCard
                icon={SparklesIcon}
                title="Smart Extraction"
                description="AI separates tops, bottoms, and shoes automatically from your 360° captures. No manual tagging needed."
              />
              <FeatureCard
                icon={WifiOffIcon}
                title="Offline Access"
                description="Browse your wardrobe anywhere, no internet needed. Your digital closet is always with you."
              />
              <FeatureCard
                icon={BoltIcon}
                title="Priority Processing"
                description="Pro users get instant outfit processing. Skip the queue and see results in seconds."
              />
            </div>
          </div>
        </section>

        {/* ─── PRICING ─── */}
        <section id="pricing" className="bg-[#F8F9FA] py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6B6B]">
                Pricing
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#1A1A2E] sm:text-4xl">
                Simple, transparent pricing
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm text-[#6B7280]">
                Start for free. Upgrade when you&apos;re ready.
              </p>

              {/* Monthly / Yearly toggle */}
              <div className="mt-10 inline-flex items-center gap-3 rounded-full bg-white p-1 shadow-sm">
                <button
                  onClick={() => setIsYearly(false)}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                    !isYearly
                      ? "bg-[#1A1A2E] text-white"
                      : "text-[#6B7280] hover:text-[#1A1A2E]"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setIsYearly(true)}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                    isYearly
                      ? "bg-[#1A1A2E] text-white"
                      : "text-[#6B7280] hover:text-[#1A1A2E]"
                  }`}
                >
                  Yearly
                  <span className="ml-1.5 text-xs text-[#FF6B6B]">Save 33%</span>
                </button>
              </div>
            </motion.div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
              {pricingPlans.map((plan) => (
                <PricingCard key={plan.tier} {...plan} isYearly={isYearly} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
