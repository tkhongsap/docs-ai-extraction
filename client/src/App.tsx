import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";

// Pages
import Dashboard from "@/pages/dashboard";
import Upload from "@/pages/upload";
import Processing from "@/pages/processing";
import Documents from "@/pages/documents";
import Review from "@/pages/review";

// Layout
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import MobileNav from "@/components/layout/mobile-nav";

function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/upload" component={Upload} />
          <Route path="/processing" component={Processing} />
          <Route path="/documents" component={Documents} />
          <Route path="/review/:id" component={Review} />
          <Route component={NotFound} />
        </Switch>
      </main>
      
      <Footer />
      <MobileNav />
      <Toaster />
    </div>
  );
}

export default App;
