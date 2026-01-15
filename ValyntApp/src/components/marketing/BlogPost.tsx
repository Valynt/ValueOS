import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, Clock, Tag, ArrowLeft, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SEO } from './SEO';

interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  author_role: string;
  published_date: string;
  featured_image: string | null;
  tags: string[];
  read_time: number;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedPosts, setRelatedPosts] = useState<BlogPostData[]>([]);

  useEffect(() => {
    if (slug) {
      fetchPost(slug);
    }
  }, [slug]);

  const fetchPost = async (slug: string) => {
    if (!supabase) {
      console.error('Supabase client not initialized. Skipping blog post fetch.');
      setLoading(false);
      navigate('/blog');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .lte('published_date', new Date().toISOString())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        navigate('/blog');
        return;
      }

      setPost(data);
      fetchRelatedPosts(data.tags, data.id);
    } catch (error) {
      console.error('Error fetching blog post:', error);
      navigate('/blog');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedPosts = async (tags: string[], currentPostId: string) => {
    if (!supabase) {
      console.error('Supabase client not initialized. Skipping related posts fetch.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('published', true)
        .lte('published_date', new Date().toISOString())
        .neq('id', currentPostId)
        .limit(3);

      if (error) throw error;

      const related = (data || []).filter(p =>
        p.tags.some((tag: string) => tags.includes(tag))
      ).slice(0, 3);

      setRelatedPosts(related.length > 0 ? related : (data || []).slice(0, 3));
    } catch (error) {
      console.error('Error fetching related posts:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleShare = async () => {
    if (navigator.share && post) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16" style={{ backgroundColor: '#0B0C0F' }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="animate-pulse">
            <div className="h-8 rounded w-3/4 mb-4" style={{ backgroundColor: '#2A2A2A' }} />
            <div className="h-64 rounded-2xl mb-8" style={{ backgroundColor: '#2A2A2A' }} />
            <div className="space-y-4">
              <div className="h-4 rounded" style={{ backgroundColor: '#2A2A2A' }} />
              <div className="h-4 rounded" style={{ backgroundColor: '#2A2A2A' }} />
              <div className="h-4 rounded w-5/6" style={{ backgroundColor: '#2A2A2A' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <>
      <SEO
        title={`${post.title} - VALYNT Blog`}
        description={post.excerpt}
      />

      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": post.title,
          "description": post.excerpt,
          "image": post.featured_image || "https://valynt.xyz/default-og-image.png",
          "author": {
            "@type": "Person",
            "name": post.author,
            "jobTitle": post.author_role
          },
          "publisher": {
            "@type": "Organization",
            "name": "VALYNT",
            "logo": {
              "@type": "ImageObject",
              "url": "https://valynt.xyz/logo.png"
            }
          },
          "datePublished": post.published_date,
          "dateModified": post.published_date,
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `https://valynt.xyz/blog/${post.slug}`
          },
          "keywords": post.tags.join(", ")
        })}
      </script>

      <div className="min-h-screen pt-24 pb-16" style={{ backgroundColor: '#0B0C0F' }}>
        <div className="max-w-4xl mx-auto px-6">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 font-medium mb-8 group hover:opacity-80 transition-opacity"
            style={{ color: '#18C3A5' }}
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Blog
          </Link>

          <article>
            <header className="mb-8">
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full"
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

              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
                {post.title}
              </h1>

              <div className="flex flex-wrap items-center gap-6 mb-6" style={{ color: '#707070' }}>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-medium text-white">{post.author}</p>
                    <p className="text-sm">{post.author_role}</p>
                  </div>
                </div>
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(post.published_date)}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {post.read_time} min read
                </span>
                <button
                  onClick={handleShare}
                  className="ml-auto flex items-center gap-2 hover:opacity-80 transition-opacity"
                  style={{ color: '#18C3A5' }}
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>

              {post.featured_image && (
                <img
                  src={post.featured_image}
                  alt={post.title}
                  className="w-full h-[400px] object-cover rounded-2xl mb-8"
                  style={{
                    border: '1px solid rgba(224, 224, 224, 0.1)'
                  }}
                />
              )}
            </header>

            <div className="prose prose-lg max-w-none mb-12 blog-content">
              <div
                className="leading-relaxed"
                style={{ color: '#E0E0E0' }}
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            </div>

            <footer className="pt-8" style={{ borderTop: '1px solid rgba(224, 224, 224, 0.1)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm mb-1" style={{ color: '#707070' }}>Written by</p>
                  <p className="font-semibold text-white">{post.author}</p>
                  <p className="text-sm" style={{ color: '#707070' }}>{post.author_role}</p>
                </div>
                <button
                  onClick={handleShare}
                  className="px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
                  style={{
                    backgroundColor: '#18C3A5',
                    color: '#0B0C0F'
                  }}
                >
                  <Share2 className="w-4 h-4" />
                  Share Article
                </button>
              </div>
            </footer>
          </article>

          {relatedPosts.length > 0 && (
            <div className="mt-16 pt-16" style={{ borderTop: '1px solid rgba(224, 224, 224, 0.1)' }}>
              <h2 className="text-3xl font-bold text-white mb-8">Related Articles</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map(relatedPost => (
                  <Link
                    key={relatedPost.id}
                    to={`/blog/${relatedPost.slug}`}
                    className="group rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
                    style={{
                      backgroundColor: '#1E1E1E',
                      border: '1px solid rgba(224, 224, 224, 0.1)'
                    }}
                  >
                    {relatedPost.featured_image && (
                      <img
                        src={relatedPost.featured_image}
                        alt={relatedPost.title}
                        className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-white mb-2 group-hover:opacity-80 transition-opacity line-clamp-2">
                        {relatedPost.title}
                      </h3>
                      <p className="text-sm line-clamp-2" style={{ color: '#707070' }}>
                        {relatedPost.excerpt}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
