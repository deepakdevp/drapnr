"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface HowItWorksStepProps {
  step: number;
  icon: ReactNode;
  title: string;
  description: string;
}

export default function HowItWorksStep({ step, icon, title, description }: HowItWorksStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: step * 0.1 }}
      className="relative flex flex-col items-center text-center"
    >
      {/* Step number badge */}
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF6B6B] text-xs font-bold text-white">
        {step}
      </div>

      {/* Icon */}
      <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F8F9FA] text-[#1A1A2E]">
        {icon}
      </div>

      {/* Content */}
      <h3 className="mt-6 font-display text-lg font-semibold text-[#1A1A2E]">{title}</h3>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#6B7280]">{description}</p>
    </motion.div>
  );
}
