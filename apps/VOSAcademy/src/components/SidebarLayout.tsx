import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icons } from "@/lib/icons";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch data for search
  const { data: pillars } = trpc.pillars.list.useQuery();
  const { data: simulations } = trpc.simulations.list.useQuery();

  const navItems = [
    { icon: Icons.Home, label: "Home", path: "/" },
    { icon: Icons.BookOpen, label: "Learning Pillars", path: "/dashboard" },
    { icon: Icons.Gamepad2, label: "Simulations", path: "/simulations" },
    { icon: Icons.TreePine, label: "Value Tree Builder", path: "/value-tree-builder" },
    { icon: Icons.BarChart3, label: "Progress", path: "/simulation-progress" },
    { icon: Icons.BarChart3, label: "Analytics", path: "/analytics" },
    { icon: Icons.Brain, label: "AI Tutor", path: "/ai-tutor" },
    { icon: Icons.Trophy, label: "Certifications", path: "/certifications" },
    { icon: Icons.BookOpen, label: "Resources", path: "/resources" },
    { icon: Icons.User, label: "Profile", path: "/profile" },
  ];

  const resources = [
    { title: "KPI Discovery Sheet", path: "/resources", type: "Template" },
    { title: "Value Hypothesis Canvas", path: "/resources", type: "Template" },
    { title: "ROI Calculator", path: "/resources", type: "Tool" },
    { title: "Business Case Template", path: "/resources", type: "Template" },
  ];

  // Combine all searchable items
  const searchableItems = [
    ...navItems.map(item => ({ ...item, type: "Page" as const })),
    ...(pillars || []).map(pillar => ({
      label: pillar.title,
      path: `/pillar/${pillar.pillarNumber}`,
      type: "Pillar" as const,
      icon: Icons.BookOpen
    })),
    ...(simulations || []).map(sim => ({
      label: sim.title,
      path: `/simulations`,
      type: "Simulation" as const,
      icon: Icons.Gamepad2
    })),
    ...resources.map(resource => ({
      label: resource.title,
      path: resource.path,
      type: resource.type,
      icon: Icons.BookOpen
    }))
  ];

  // Filter items based on search query
  const filteredItems = searchableItems.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const handleSearchSelect = (path: string) => {
    setLocation(path);
    setIsSearchOpen(false);
    setSearchQuery("");
    setIsMobileMenuOpen(false);
  };

  // Handle keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">VA</span>
            </div>
            <span className="font-semibold text-lg">{APP_TITLE}</span>
          </div>
        </Link>
      </div>

      {/* Search */}
      <div className="p-4 bg-sidebar">
        <div 
          className="relative cursor-pointer"
          onClick={() => setIsSearchOpen(true)}
        >
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search" 
            className="pl-9 bg-background/80 cursor-pointer"
            readOnly
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto bg-sidebar text-sidebar-foreground">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link key={item.path} href={item.path}>
              <div
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors
                  ${active 
                    ? "bg-sidebar-primary/10 text-sidebar-primary-foreground" 
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-sidebar-border bg-sidebar text-sidebar-foreground space-y-1">
        <button
          className="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <Icons.User className="h-5 w-5" />
          <span className="text-sm font-medium">Settings</span>
        </button>
        
        <button
          className="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <Icons.HelpCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Support</span>
        </button>

        {user ? (
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <Icons.X className="h-5 w-5" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        ) : (
          <Link href="/login">
            <Button variant="outline" className="w-full justify-start">
              Login
            </Button>
          </Link>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-x-hidden w-full">
      {/* Skip link for accessibility */}
      <a
        href="#main-content"
        className="skip-link focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded-md z-50"
      >
        Skip to main content
      </a>

      {/* Mobile Header - Improved responsive design */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar text-sidebar-foreground border-b border-sidebar-border px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">VA</span>
          </div>
          <span className="font-semibold text-lg">{APP_TITLE}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile search button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Open search"
            className="md:hidden"
          >
            <Icons.Search className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? <Icons.X className="h-6 w-6" /> : <Icons.Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar - Improved overlay and animations */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity duration-300">
          <aside className="fixed left-0 top-0 bottom-0 w-[280px] max-w-[85vw] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col animate-in slide-in-from-left duration-300">
            <SidebarContent />
          </aside>
          <div
            className="absolute inset-0 -z-10 cursor-pointer"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          />
        </div>
      )}

      {/* Search Dialog - Improved accessibility */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="sm:max-w-[600px] mx-4" role="dialog" aria-labelledby="search-dialog-title">
          <DialogHeader>
            <DialogTitle id="search-dialog-title">Search VOS Academy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search pillars, simulations, resources..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                aria-label="Search VOS Academy content"
                aria-describedby="search-help"
              />
              <div id="search-help" className="sr-only">
                Type to search through pillars, simulations, and resources. Use arrow keys to navigate results, Enter to select.
              </div>
            </div>

            {searchQuery && (
              <div className="max-h-[400px] overflow-y-auto space-y-2" role="listbox" aria-label="Search results">
                {filteredItems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8" role="status">
                    No results found for "{searchQuery}"
                  </p>
                ) : (
                  filteredItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => handleSearchSelect(item.path)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors text-left focus:outline-none focus:ring-2 focus:ring-primary"
                        role="option"
                        aria-selected="false"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.label}</div>
                          <div className="text-sm text-muted-foreground">{item.type}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {!searchQuery && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 px-2">Quick Links</h3>
                  <nav className="space-y-1" role="navigation" aria-label="Quick links">
                    {navItems.slice(0, 4).map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.path}
                          onClick={() => handleSearchSelect(item.path)}
                          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent transition-colors text-left focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <span className="text-sm">{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content - Improved mobile responsiveness */}
      <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden pt-16 lg:pt-0 bg-background w-full">
        <div className="min-h-full w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
