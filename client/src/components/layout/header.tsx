import { Link, useLocation } from "wouter";
import { CircleHelp, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  const [location] = useLocation();
  
  const isActive = (path: string) => {
    return location === path;
  };
  
  return (
    <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <i className="fas fa-file-alt text-primary text-2xl mr-2"></i>
              <span className="font-bold text-xl">OCR Extract</span>
            </Link>
          </div>
          
          <nav className="hidden md:flex space-x-6">
            <Link 
              href="/"
              className={isActive("/") ? "text-primary font-medium" : "text-gray-600 hover:text-primary"}
            >
              Dashboard
            </Link>
            <Link 
              href="/documents"
              className={isActive("/documents") ? "text-primary font-medium" : "text-gray-600 hover:text-primary"}
            >
              Documents
            </Link>
            <Link 
              href="/upload"
              className={isActive("/upload") ? "text-primary font-medium" : "text-gray-600 hover:text-primary"}
            >
              Upload
            </Link>
          </nav>
          
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="rounded-full">
              <CircleHelp className="text-gray-600" />
            </Button>
            <div className="ml-4 relative">
              <Button variant="outline" size="icon" className="rounded-full border-2 border-primary text-primary">
                <User className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
