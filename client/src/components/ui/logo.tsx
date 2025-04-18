import { ScanText } from "lucide-react";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className = "", iconOnly = false }: LogoProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <div className="relative flex items-center justify-center bg-primary bg-opacity-10 text-primary rounded-lg p-1">
        <ScanText className="h-6 w-6 text-primary" />
      </div>
      {!iconOnly && (
        <div className="ml-2">
          <span className="font-bold text-xl">DocuScan</span>
          <span className="ml-1 text-primary font-medium">AI</span>
        </div>
      )}
    </div>
  );
}