import { Link, useLocation } from "wouter";
import { Home, FileText, Upload } from "lucide-react";

export default function MobileNav() {
  const [location] = useLocation();
  
  const isActive = (path: string) => {
    return location === path;
  };
  
  return (
    <div className="md:hidden border-t border-[#e2e8f0] fixed bottom-0 left-0 right-0 bg-white z-10">
      <div className="flex justify-around">
        <Link 
          href="/" 
          className={`flex-1 text-center py-2 ${isActive("/") ? "text-primary border-b-2 border-primary" : "text-gray-600"}`}
        >
          <Home className="h-5 w-5 mx-auto mb-1" />
          <span className="text-xs">Dashboard</span>
        </Link>
        <Link 
          href="/documents" 
          className={`flex-1 text-center py-2 ${isActive("/documents") ? "text-primary border-b-2 border-primary" : "text-gray-600"}`}
        >
          <FileText className="h-5 w-5 mx-auto mb-1" />
          <span className="text-xs">Documents</span>
        </Link>
        <Link 
          href="/upload" 
          className={`flex-1 text-center py-2 ${isActive("/upload") ? "text-primary border-b-2 border-primary" : "text-gray-600"}`}
        >
          <Upload className="h-5 w-5 mx-auto mb-1" />
          <span className="text-xs">Upload</span>
        </Link>
      </div>
    </div>
  );
}
