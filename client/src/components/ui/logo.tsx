import { ScanText } from "lucide-react";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className = "", iconOnly = false }: LogoProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <div className="relative flex items-center justify-center bg-[#3182ce]/10 text-[#3182ce] rounded-lg p-1">
        <ScanText className="h-6 w-6 text-[#3182ce]" />
      </div>
      {!iconOnly && (
        <div className="ml-2">
          <span className="font-bold text-xl text-[#1a202c]">DocuScan</span>
          <span className="ml-1 text-[#3182ce] font-medium">AI</span>
        </div>
      )}
    </div>
  );
}