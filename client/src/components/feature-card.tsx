import { ReactNode } from "react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  iconClassName: string;
}

export default function FeatureCard({ title, description, icon, iconClassName }: FeatureCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 hover:border-gray-200 group">
      <div className={`${iconClassName} w-14 h-14 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-200`}>
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-3">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
