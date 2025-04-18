import { ReactNode } from "react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  iconClassName: string;
}

export default function FeatureCard({ title, description, icon, iconClassName }: FeatureCardProps) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-md border border-gray-100 hover:shadow-xl transition-all duration-300 hover:border-indigo-100 group relative overflow-hidden">
      {/* Subtle background gradient that appears on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {/* Icon with enhanced hover animation */}
      <div className={`${iconClassName} w-14 h-14 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-all duration-300 shadow-sm group-hover:shadow-md`}>
        <div className="transform group-hover:rotate-[-8deg] transition-transform duration-300">
          {icon}
        </div>
      </div>
      
      {/* Content with improved typography */}
      <div className="relative z-10">
        <h3 className="font-semibold text-gray-800 text-xl mb-3 group-hover:text-indigo-700 transition-colors duration-300">{title}</h3>
        <p className="text-gray-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
