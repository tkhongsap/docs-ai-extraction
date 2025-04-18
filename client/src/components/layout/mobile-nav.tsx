import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, Upload } from "lucide-react";

export default function MobileNav() {
  const [location] = useLocation();
  
  const isActive = (path: string) => {
    return location === path;
  };
  
  return (
    <div className="md:hidden border-t border-[#e2e8f0] fixed bottom-0 left-0 right-0 bg-white z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around">
        <Link 
          href="/" 
          className={`flex-1 text-center py-3 ${isActive("/") ? "text-primary" : "text-gray-600"}`}
        >
          <div className={`mx-auto ${isActive("/") ? "bg-primary/10 text-primary" : "text-gray-500"} rounded-full p-1 w-10 h-10 flex items-center justify-center mb-1`}>
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium">Dashboard</span>
        </Link>
        <Link 
          href="/documents" 
          className={`flex-1 text-center py-3 ${isActive("/documents") ? "text-primary" : "text-gray-600"}`}
        >
          <div className={`mx-auto ${isActive("/documents") ? "bg-primary/10 text-primary" : "text-gray-500"} rounded-full p-1 w-10 h-10 flex items-center justify-center mb-1`}>
            <FileText className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium">Documents</span>
        </Link>
        <Link 
          href="/upload" 
          className={`flex-1 text-center py-3 ${isActive("/upload") ? "text-primary" : "text-gray-600"}`}
        >
          <div className={`mx-auto ${isActive("/upload") ? "bg-primary/10 text-primary" : "text-gray-500"} rounded-full p-1 w-10 h-10 flex items-center justify-center mb-1`}>
            <Upload className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium">Upload</span>
        </Link>
      </div>
    </div>
  );
}
