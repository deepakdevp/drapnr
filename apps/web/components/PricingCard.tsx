"use client";

import { motion } from "framer-motion";

interface PricingCardProps {
  tier: string;
  price: string;
  yearlyPrice: string;
  features: string[];
  isPopular?: boolean;
  ctaText: string;
  isYearly: boolean;
}

export default function PricingCard({
  tier,
  price,
  yearlyPrice,
  features,
  isPopular = false,
  ctaText,
  isYearly,
}: PricingCardProps) {
  const displayPrice = isYearly ? yearlyPrice : price;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className={`relative flex flex-col rounded-2xl border p-8 transition-shadow lg:p-10 ${
        isPopular
          ? "border-[#FF6B6B] bg-white shadow-xl shadow-[#FF6B6B]/5"
          : "border-gray-100 bg-white hover:shadow-lg"
      }`}
    >
      {/* Popular badge */}
      {isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#FF6B6B] px-4 py-1 text-xs font-semibold tracking-wide text-white">
          Most Popular
        </span>
      )}

      {/* Tier */}
      <h3 className="font-display text-lg font-semibold text-[#1A1A2E]">{tier}</h3>

      {/* Price */}
      <div className="mt-6 flex items-baseline gap-1">
        <span className="font-display text-4xl font-bold tracking-tight text-[#1A1A2E]">
          {displayPrice}
        </span>
        {displayPrice !== "$0" && (
          <span className="text-sm text-[#6B7280]">/{isYearly ? "yr" : "mo"}</span>
        )}
      </div>

      {isYearly && displayPrice !== "$0" && (
        <p className="mt-1 text-xs font-medium text-[#FF6B6B]">Save 33%</p>
      )}

      {/* Divider */}
      <div className="my-8 h-px bg-gray-100" />

      {/* Features */}
      <ul className="flex flex-1 flex-col gap-4">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-[#6B7280]">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FF6B6B]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <a
        href="#"
        className={`mt-8 block rounded-full py-3 text-center text-sm font-semibold transition-all ${
          isPopular
            ? "bg-[#FF6B6B] text-white hover:bg-[#FF5252] hover:shadow-lg hover:shadow-[#FF6B6B]/20"
            : "bg-[#F8F9FA] text-[#1A1A2E] hover:bg-gray-200"
        }`}
      >
        {ctaText}
      </a>
    </motion.div>
  );
}
