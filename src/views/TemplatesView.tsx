import React, { useState } from 'react';
import { Search, Sparkles, BarChart3, Table, PieChart, FileText } from 'lucide-react';
import { templateLibrary, ComponentTemplate } from '../services/TemplateLibrary';

interface TemplatesViewProps {
  onUseTemplate: (templateId: string) => void;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({ onUseTemplate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'metrics' | 'charts' | 'tables' | 'narratives' | 'composite'>('all');

  const allTemplates = templateLibrary.getAllTemplates();

  const filteredTemplates = allTemplates.filter(t => {
    const matchesSearch = searchQuery === '' ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (category: ComponentTemplate['category']) => {
    switch (category) {
      case 'metrics': return <BarChart3 className="h-5 w-5" />;
      case 'charts': return <PieChart className="h-5 w-5" />;
      case 'tables': return <Table className="h-5 w-5" />;
      case 'narratives': return <FileText className="h-5 w-5" />;
      case 'composite': return <Sparkles className="h-5 w-5" />;
    }
  };

  const getCategoryColor = (category: ComponentTemplate['category']) => {
    switch (category) {
      case 'metrics': return 'bg-blue-100 text-blue-800';
      case 'charts': return 'bg-green-100 text-green-800';
      case 'tables': return 'bg-purple-100 text-purple-800';
      case 'narratives': return 'bg-orange-100 text-orange-800';
      case 'composite': return 'bg-pink-100 text-pink-800';
    }
  };

  return (
    <div className="flex-1 bg-background">
      <div className="bg-card border-b border-border shadow-beautiful-md px-8 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Template Library</h1>
          <p className="text-muted-foreground mt-1">Jump-start your analysis with pre-built templates</p>
        </div>

        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search templates by name, description, or tags..."
              aria-label="Search templates"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {(['all', 'metrics', 'charts', 'tables', 'narratives', 'composite'] as const).map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-16">
            <Sparkles className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No templates found</h3>
            <p className="text-muted-foreground">Try adjusting your search terms or category filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className="bg-card text-card-foreground border border-border rounded-xl p-6 hover:shadow-beautiful-lg transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${getCategoryColor(template.category)}`}>
                    {getCategoryIcon(template.category)}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {template.components.length} components
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {template.name}
                </h3>

                <p className="text-sm text-muted-foreground mb-4">
                  {template.description}
                </p>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {template.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => onUseTemplate(template.id)}
                  className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-light-blue-sm hover:bg-primary/90 transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Use Template</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
