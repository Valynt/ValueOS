import { useAuth } from "@/hooks/useAuth";
import { SidebarLayout } from "@/components/SidebarLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { APP_LOGO, APP_TITLE } from "@/const";
import { Download, Search, FileText, FileSpreadsheet, Presentation, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

type ResourceItem = {
  id?: number | string;
  title?: string;
  description?: string;
  type?: string;
  pillarNumber: number;
  pillarTitle: string;
};

export default function Resources() {
  const { user } = useAuth();
  const { data: pillars } = trpc.pillars.list.useQuery();
  const [searchQuery, setSearchQuery] = useState("");

  // Flatten all resources from all pillars
  const allResources = pillars?.flatMap(pillar => {
    const content = typeof pillar.content === 'string' ? JSON.parse(pillar.content) : pillar.content;
    const resources = (content?.resources || []) as Array<Omit<ResourceItem, "pillarNumber" | "pillarTitle">>;
    return resources.map((resource) => ({
      ...resource,
      pillarNumber: pillar.pillarNumber,
      pillarTitle: pillar.title,
    }));
  }) || [];

  // Filter resources based on search query
  const filteredResources = allResources.filter(resource =>
    resource.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    resource.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    resource.pillarTitle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group resources by type
  const resourcesByType = filteredResources.reduce<Record<string, ResourceItem[]>>((acc, resource) => {
    const type = resource.type || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(resource);
    return acc;
  }, {});

  const getResourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'template':
        return <FileSpreadsheet className="h-5 w-5" />;
      case 'guide':
        return <BookOpen className="h-5 w-5" />;
      case 'playbook':
        return <Presentation className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <SidebarLayout>
      <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={APP_LOGO} alt="VOS Logo" className="h-8 w-8" />
            <span className="font-bold text-xl">{APP_TITLE}</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Dashboard
            </Link>
            <Link href="/resources" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Resources
            </Link>
            <Link href="/profile" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Profile
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 py-8">
        <div className="container max-w-6xl">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Resource Library</h1>
            <p className="text-xl text-muted-foreground">
              Download templates, guides, and tools to accelerate your VOS implementation
            </p>
          </div>

          {/* Search */}
          <div className="mb-8">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
              <CardHeader className="pb-3">
                <CardDescription>Total Resources</CardDescription>
                <CardTitle className="text-3xl">{allResources.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
              <CardHeader className="pb-3">
                <CardDescription>Templates</CardDescription>
                <CardTitle className="text-3xl">
                  {allResources.filter((resource) => resource.type === 'Template').length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
              <CardHeader className="pb-3">
                <CardDescription>Guides</CardDescription>
                <CardTitle className="text-3xl">
                  {allResources.filter((resource) => resource.type === 'Guide').length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
              <CardHeader className="pb-3">
                <CardDescription>Playbooks</CardDescription>
                <CardTitle className="text-3xl">
                  {allResources.filter((resource) => resource.type === 'Playbook').length}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Resources by Type */}
          {Object.keys(resourcesByType).length === 0 ? (
            <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No resources found matching your search.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(resourcesByType).map(([type, resources]) => (
                <div key={type}>
                  <h2 className="text-2xl font-bold mb-4">{type}s</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {resources.map((resource, index) => (
                      <Card
                        key={index}
                        className="bg-card text-card-foreground shadow-beautiful-md hover:shadow-beautiful-lg rounded-lg transition-all duration-300 hover:-translate-y-1"
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="mt-1 text-muted-foreground">
                                {getResourceIcon(resource.type)}
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-lg mb-2">{resource.title}</CardTitle>
                                {resource.description && (
                                  <CardDescription>{resource.description}</CardDescription>
                                )}
                              </div>
                            </div>
                            <Download className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <Link href={`/pillar/${resource.pillarNumber}`} className="text-sm text-primary hover:underline">
                              {resource.pillarTitle}
                            </Link>
                            <Badge variant="outline">{resource.type}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-background mt-12">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 VOS Education Hub. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <Link href="/resources" className="text-sm text-muted-foreground hover:text-foreground">
                Resources
              </Link>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                About VOS
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </SidebarLayout>
  );
}
