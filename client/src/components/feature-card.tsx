import { ReactNode } from "react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  iconClassName: string;
}

export default function FeatureCard({ title, description, icon, iconClassName }: FeatureCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-[#e2e8f0] hover:shadow-md transition-all duration-200 hover:border-[#e2e8f0] group">
      <div className={`${iconClassName} w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200`}>
        {icon}
      </div>
      <h3 className="font-semibold text-[#1a202c] text-lg mb-2">{title}</h3>
      <p className="text-gray-600 text-base leading-relaxed">{description}</p>
    </div>
  );
}
