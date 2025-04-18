import { Link, useLocation } from "wouter";
import { CircleHelp, User, LayoutDashboard, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function Header() {
  const [location] = useLocation();
  
  const isActive = (path: string) => {
    return location === path;
  };
  
  return (
    <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-10 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Logo />
            </Link>
          </div>
          
          <nav className="hidden md:flex space-x-1">
            <Link href="/">
              <Button variant={isActive("/") ? "default" : "ghost"} className={`flex items-center gap-2 font-medium ${isActive("/") ? "bg-[#3182ce] text-white" : "text-[#1a202c] hover:text-[#3182ce]"}`}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link href="/documents">
              <Button variant={isActive("/documents") ? "default" : "ghost"} className={`flex items-center gap-2 font-medium ${isActive("/documents") ? "bg-[#3182ce] text-white" : "text-[#1a202c] hover:text-[#3182ce]"}`}>
                <FileText className="h-4 w-4" />
                Documents
              </Button>
            </Link>
            <Link href="/upload">
              <Button variant={isActive("/upload") ? "default" : "ghost"} className={`flex items-center gap-2 font-medium ${isActive("/upload") ? "bg-[#3182ce] text-white" : "text-[#1a202c] hover:text-[#3182ce]"}`}>
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </Link>
          </nav>
          
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-[#3182ce]/10">
              <CircleHelp className="h-5 w-5 text-[#3182ce]" />
            </Button>
            <div className="relative">
              <Button variant="outline" size="icon" className="rounded-full border-2 border-[#3182ce] text-[#3182ce]">
                <User className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
