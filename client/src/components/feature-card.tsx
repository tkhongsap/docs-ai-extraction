import { ReactNode } from "react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  iconClassName: string;
}

export default function FeatureCard({ title, description, icon, iconClassName }: FeatureCardProps) {
  return (
    <div className="bg-white p-5 rounded-lg shadow-sm">
      <div className={`${iconClassName} w-12 h-12 rounded-full flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
