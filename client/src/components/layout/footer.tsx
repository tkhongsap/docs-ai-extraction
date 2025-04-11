import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-[#e2e8f0] py-6 mt-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center">
              <i className="fas fa-file-alt text-primary text-xl mr-2"></i>
              <span className="font-bold text-lg">OCR Extract</span>
            </div>
            <p className="text-gray-600 text-sm mt-1">Extract text from documents with AI</p>
          </div>
          <div className="flex space-x-6">
            <Link href="#" className="text-gray-600 hover:text-primary">
              <span className="text-sm">Help</span>
            </Link>
            <Link href="#" className="text-gray-600 hover:text-primary">
              <span className="text-sm">Privacy</span>
            </Link>
            <Link href="#" className="text-gray-600 hover:text-primary">
              <span className="text-sm">Terms</span>
            </Link>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[#e2e8f0] text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} OCR Document Extraction App. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
