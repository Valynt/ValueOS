import { ArrowRight, Award, BookOpen, Calendar, Clock, FileText, Search, Tag, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { SEO } from './SEO';

import { supabase } from '@/lib/supabase';


interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  author_role: string;
  published_date: string;
  featured_image: string | null;
  tags: string[];
  read_time: number;
  content_type?: string;
  featured?: boolean;
}

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    if (!supabase) {
      console.error('Supabase client not initialized. Skipping blog posts fetch.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('published', true)
        .lte('published_date', new Date().toISOString())
        .order('featured', { ascending: false })
        .order('published_date', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const allTags = Array.from(new Set(posts.flatMap(post => post.tags)));
  const contentTypes = Array.from(new Set(posts.map(post => post.content_type).filter(Boolean)));

  const filteredPosts = posts.filter(post => {
    const matchesTag = !selectedTag || post.tags.includes(selectedTag);
    const matchesType = !selectedType || post.content_type === selectedType;
    const matchesSearch = !searchQuery ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTag && matchesType && matchesSearch;
  });

  const featuredPost = filteredPosts.find(post => post.featured);
  const regularPosts = filteredPosts.filter(post => !post.featured);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'Guide': return BookOpen;
      case 'Case Study': return Award;
      case 'Research': return TrendingUp;
      case 'Article': return FileText;
      default: return FileText;
    }
  };

  return (
    <>
      <SEO
        title="Resources & Insights: Transform Cost Centers into Profit Engines | VALYNT"
        description="Expert guides, case studies, and frameworks for turning Customer Success, Services, and Support into revenue-generating profit centers. Reduce CAC, prove ROI, and drive measurable value outcomes."
      />

      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          "name": "VALYNT Resources & Insights",
          "description": "Expert resources on transforming cost centers into profit centers through value operations",
          "url": "https://valynt.xyz/blog",
          "publisher": {
            "@type": "Organization",
            "name": "VALYNT",
            "logo": {
              "@type": "ImageObject",
              "url": "https://valynt.xyz/logo.png"
            }
          }
        })}
      </script>

      <div className="min-h-screen pt-24 pb-16" style={{ backgroundColor: '#0B0C0F' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{
              border: '1px solid rgba(24, 195, 165, 0.3)',
              backgroundColor: 'rgba(24, 195, 165, 0.1)'
            }}>
              <TrendingUp className="w-4 h-4" style={{ color: '#18C3A5' }} />
              <span className="text-sm font-medium" style={{ color: '#18C3A5' }}>Strategic Resources for Value Leaders</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Turn Knowledge Into
              <span className="block mt-2" style={{ color: '#18C3A5' }}>Revenue Advantage</span>
            </h1>

            <p className="text-xl leading-relaxed mb-8" style={{ color: '#707070' }}>
              Proven frameworks, real outcomes, and strategic insights to transform your cost centers into measurable profit engines. Join 500+ revenue leaders who are redefining value operations.
            </p>

            <div className="relative max-w-xl mx-auto mb-12">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#707070' }} />
              <input
                type="text"
                placeholder="Search resources by topic, outcome, or challenge..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-full text-white placeholder-gray-500 focus:outline-none transition-all"
                style={{
                  backgroundColor: '#1E1E1E',
                  border: '1px solid rgba(224, 224, 224, 0.1)'
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <button
              onClick={() => setSelectedType(null)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                selectedType === null ? 'shadow-lg' : 'hover:bg-white/5'
              }`}
              style={selectedType === null ? {
                backgroundColor: '#18C3A5',
                color: '#0B0C0F'
              } : {
                border: '1px solid rgba(224, 224, 224, 0.2)',
                color: '#E0E0E0'
              }}
            >
              All Resources
            </button>
            {contentTypes.map(type => {
              const Icon = getContentTypeIcon(type as string);
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type as string)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                    selectedType === type ? 'shadow-lg' : 'hover:bg-white/5'
                  }`}
                  style={selectedType === type ? {
                    backgroundColor: '#18C3A5',
                    color: '#0B0C0F'
                  } : {
                    border: '1px solid rgba(224, 224, 224, 0.2)',
                    color: '#E0E0E0'
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {type}
                </button>
              );
            })}
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-12">
              {allTags.slice(0, 8).map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedTag === tag ? 'shadow-md' : 'hover:bg-white/5'
                  }`}
                  style={selectedTag === tag ? {
                    backgroundColor: 'rgba(24, 195, 165, 0.2)',
                    color: '#18C3A5',
                    border: '1px solid rgba(24, 195, 165, 0.4)'
                  } : {
                    border: '1px solid rgba(224, 224, 224, 0.1)',
                    color: '#707070'
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="space-y-8">
              <div className="rounded-3xl overflow-hidden animate-pulse" style={{
                backgroundColor: '#1E1E1E',
                border: '1px solid rgba(224, 224, 224, 0.1)',
                height: '400px'
              }} />
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-2xl overflow-hidden animate-pulse" style={{
                    backgroundColor: '#1E1E1E',
                    border: '1px solid rgba(224, 224, 224, 0.1)'
                  }}>
                    <div className="h-48" style={{ backgroundColor: '#2A2A2A' }} />
                    <div className="p-6">
                      <div className="h-4 rounded w-3/4 mb-4" style={{ backgroundColor: '#2A2A2A' }} />
                      <div className="h-4 rounded w-full mb-2" style={{ backgroundColor: '#2A2A2A' }} />
                      <div className="h-4 rounded w-5/6" style={{ backgroundColor: '#2A2A2A' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !supabase ? (
            <div className="text-center py-16">
              <p className="text-xl mb-2" style={{ color: '#707070' }}>
                Blog is temporarily unavailable.
              </p>
              <p className="mb-4" style={{ color: '#707070' }}>
                Please check back later.
              </p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xl mb-4" style={{ color: '#707070' }}>
                No resources found matching your criteria.
              </p>
              <button
                onClick={() => {
                  setSelectedTag(null);
                  setSelectedType(null);
                  setSearchQuery('');
                }}
                className="px-6 py-3 rounded-full font-medium transition-all"
                style={{
                  backgroundColor: '#18C3A5',
                  color: '#0B0C0F'
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-12">
              {featuredPost && (
                <Link
                  to={`/blog/${featuredPost.slug}`}
                  className="group block rounded-3xl overflow-hidden transition-all duration-300 hover:scale-[1.01]"
                  style={{
                    backgroundColor: '#1E1E1E',
                    border: '1px solid rgba(224, 224, 224, 0.1)'
                  }}
                >
                  <div className="grid md:grid-cols-2 gap-8 p-8 md:p-12 items-center">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{
                          backgroundColor: 'rgba(24, 195, 165, 0.2)',
                          color: '#18C3A5'
                        }}>
                          FEATURED
                        </span>
                        {featuredPost.content_type && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium" style={{
                            border: '1px solid rgba(224, 224, 224, 0.2)',
                            color: '#E0E0E0'
                          }}>
                            {featuredPost.content_type}
                          </span>
                        )}
                      </div>

                      <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 group-hover:opacity-90 transition-opacity">
                        {featuredPost.title}
                      </h2>

                      <p className="text-lg mb-6" style={{ color: '#707070' }}>
                        {featuredPost.excerpt}
                      </p>

                      <div className="flex flex-wrap items-center gap-6 text-sm mb-6" style={{ color: '#707070' }}>
                        <span className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {formatDate(featuredPost.published_date)}
                        </span>
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {featuredPost.read_time} min read
                        </span>
                        <span style={{ color: '#E0E0E0' }}>{featuredPost.author}</span>
                      </div>

                      <div className="flex items-center gap-2 font-semibold" style={{ color: '#18C3A5' }}>
                        Read Full Resource
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                      </div>
                    </div>

                    {featuredPost.featured_image && (
                      <div className="relative overflow-hidden rounded-2xl h-80">
                        <img
                          src={featuredPost.featured_image}
                          alt={featuredPost.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                  </div>
                </Link>
              )}

              {regularPosts.length > 0 && (
                <div>
                  <h3 className="text-2xl font-bold text-white mb-6">
                    More Resources
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {regularPosts.map(post => {
                      const Icon = post.content_type ? getContentTypeIcon(post.content_type) : FileText;
                      return (
                        <Link
                          key={post.id}
                          to={`/blog/${post.slug}`}
                          className="group rounded-2xl overflow-hidden transition-all duration-300 flex flex-col hover:scale-[1.02]"
                          style={{
                            backgroundColor: '#1E1E1E',
                            border: '1px solid rgba(224, 224, 224, 0.1)'
                          }}
                        >
                          {post.featured_image && (
                            <div className="relative overflow-hidden h-48">
                              <img
                                src={post.featured_image}
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              {post.content_type && (
                                <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1" style={{
                                  backgroundColor: 'rgba(11, 12, 15, 0.8)',
                                  backdropFilter: 'blur(8px)',
                                  color: '#18C3A5',
                                  border: '1px solid rgba(24, 195, 165, 0.3)'
                                }}>
                                  <Icon className="w-3 h-3" />
                                  {post.content_type}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="p-6 flex flex-col flex-grow">
                            {post.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {post.tags.slice(0, 2).map(tag => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full"
                                    style={{
                                      backgroundColor: 'rgba(24, 195, 165, 0.1)',
                                      color: '#18C3A5',
                                      border: '1px solid rgba(24, 195, 165, 0.3)'
                                    }}
                                  >
                                    <Tag className="w-3 h-3" />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <h2 className="text-xl font-bold text-white mb-3 group-hover:opacity-90 transition-opacity line-clamp-2">
                              {post.title}
                            </h2>
                            <p className="mb-4 line-clamp-3 flex-grow" style={{ color: '#707070' }}>
                              {post.excerpt}
                            </p>
                            <div className="flex items-center justify-between text-sm pt-4" style={{
                              borderTop: '1px solid rgba(224, 224, 224, 0.1)',
                              color: '#707070'
                            }}>
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {post.read_time} min
                                </span>
                              </div>
                              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" style={{ color: '#18C3A5' }} />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
