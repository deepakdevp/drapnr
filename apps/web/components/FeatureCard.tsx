"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export default function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="group rounded-2xl border border-gray-100 bg-white p-8 transition-all hover:shadow-lg lg:p-10"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF0F0] text-[#FF6B6B] transition-colors group-hover:bg-[#FF6B6B] group-hover:text-white">
        {icon}
      </div>
      <h3 className="mt-6 font-display text-lg font-semibold text-[#1A1A2E]">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">{description}</p>
    </motion.div>
  );
}
