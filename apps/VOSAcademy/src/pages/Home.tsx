import { ArrowRight, Award, BookOpen, Brain, Sparkles, Target, TrendingUp, Users } from "lucide-react";
import { Link } from "wouter";

import { SidebarLayout } from "@/components/SidebarLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/data/const";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  return (
    <SidebarLayout>
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="vos-gradient text-white py-20 md:py-32 relative overflow-hidden">
          <div className="container max-w-6xl relative z-10">
            {/* VOS System Online Badge */}
            <div className="mb-8">
              <span className="status-active text-sm md:text-base">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                VOS® System Online
              </span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight max-w-4xl">
              Mastering the Value Operating System
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8 max-w-3xl">
              Get personalized VOS education tailored to your learning style, career goals, and industry needs. Join 10,000+ professionals already transforming their careers.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 max-w-3xl">
              <div className="bg-card/95 text-card-foreground shadow-beautiful-md rounded-lg border border-border/40">
                <div className="p-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">300+ VOS use cases</h3>
                    <p className="text-sm text-muted-foreground">
                      Step-by-step tutorials for immediate application
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-card/95 text-card-foreground shadow-beautiful-md rounded-lg border border-border/40">
                <div className="p-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Daily content</h3>
                    <p className="text-sm text-muted-foreground">
                      Stay ahead with daily VOS tool updates
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-card/95 text-card-foreground shadow-beautiful-md rounded-lg border border-border/40">
                <div className="p-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Exclusive community</h3>
                    <p className="text-sm text-muted-foreground">
                      Network with VOS-first professionals
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-card/95 text-card-foreground shadow-beautiful-md rounded-lg border border-border/40">
                <div className="p-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">VOS certifications</h3>
                    <p className="text-sm text-muted-foreground">
                      Boost your career with recognized credentials
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {isAuthenticated ? (
            <Link href="/dashboard" className="inline-flex items-center px-8 py-4 text-base md:text-lg font-semibold bg-white text-primary shadow-beautiful-lg rounded-lg gap-2 hover:opacity-90 transition-opacity">
                  Continue Learning <ArrowRight className="h-5 w-5" />
            </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                <a href={getLoginUrl()} className="inline-flex items-center px-8 py-4 text-base md:text-lg font-semibold bg-white text-primary shadow-beautiful-lg rounded-lg gap-2 hover:opacity-90 transition-opacity">
                  Start free trial <ArrowRight className="h-5 w-5" />
                </a>
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  <span className="text-white/80">10,000+ members • 14-day free trial</span>
                </div>
              </div>
            )}
          </div>

          {/* Testimonial Card */}
          <div className="absolute top-20 right-12 hidden xl:block">
            <div className="w-96 bg-background/95 backdrop-blur shadow-beautiful-xl rounded-lg border border-border">
              <div className="p-6">
                <p className="text-lg mb-4 italic">
                  "VOS won't replace humans, but humans who use VOS will replace humans that don't."
                </p>
                <p className="font-semibold">— Value Engineering Leader</p>
              </div>
            </div>
          </div>
        </section>

        {/* Learning Path Section */}
        <section className="py-20 bg-background">
          <div className="container">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Your Learning Journey</h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl">
              Master the 10 pillars of the Value Operating System through interactive lessons, simulations, and AI-powered guidance
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-card text-card-foreground shadow-beautiful-md hover:shadow-beautiful-lg rounded-lg transition-shadow">
                <div className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">10 Core Pillars</h3>
                  <p className="text-sm text-muted-foreground">
                    Comprehensive curriculum covering unified value language, discovery, quantification, and more
                  </p>
                </div>
              </div>

              <div className="bg-card text-card-foreground shadow-beautiful-md hover:shadow-beautiful-lg rounded-lg transition-shadow">
                <div className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">AI-Powered Tutor</h3>
                  <p className="text-sm text-muted-foreground">
                    Get personalized guidance adapted to your role and maturity level
                  </p>
                </div>
              </div>

              <div className="bg-card text-card-foreground shadow-beautiful-md hover:shadow-beautiful-lg rounded-lg transition-shadow">
                <div className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Interactive Simulations</h3>
                  <p className="text-sm text-muted-foreground">
                    Practice value discovery, business case development, and QBR modeling
                  </p>
                </div>
              </div>

              <div className="bg-card text-card-foreground shadow-beautiful-md hover:shadow-beautiful-lg rounded-lg transition-shadow">
                <div className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Maturity Progression</h3>
                  <p className="text-sm text-muted-foreground">
                    Track your growth from L0 (Unaware) to L5 (Transformative) across 6 role tracks
                  </p>
                </div>
              </div>

              <div className="bg-card text-card-foreground shadow-beautiful-md hover:shadow-beautiful-lg rounded-lg transition-shadow">
                <div className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Award className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Certification System</h3>
                  <p className="text-sm text-muted-foreground">
                    Earn Bronze, Silver, and Gold certifications with our 40/30/30 scoring rubric
                  </p>
                </div>
              </div>

              <div className="bg-card text-card-foreground shadow-beautiful-md hover:shadow-beautiful-lg rounded-lg transition-shadow">
                <div className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Role-Based Learning</h3>
                  <p className="text-sm text-muted-foreground">
                    Tailored content for Sales, CS, Marketing, Product, Executive, and VE roles
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        {!isAuthenticated && (
          <section className="py-20 bg-background">
            <div className="container max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to transform your value delivery?
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Join thousands of professionals mastering the Value Operating System
              </p>
              <a href={getLoginUrl()} className="inline-flex items-center px-8 py-3 text-base md:text-lg font-semibold bg-primary text-primary-foreground shadow-light-blue-sm rounded-lg gap-2 hover:opacity-90 transition-opacity">
                  Start Your Free Trial <ArrowRight className="h-5 w-5" />
                </a>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t py-8 bg-background">
          <div className="container flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 VOS Academy. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </SidebarLayout>
  );
}
