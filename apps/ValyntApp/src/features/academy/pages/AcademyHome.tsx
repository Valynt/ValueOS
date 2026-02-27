import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { ArrowRight, Award, BookOpen, Brain, Sparkles, Target, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function AcademyHome() {
  return (
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
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Career acceleration</h3>
                  <p className="text-sm text-muted-foreground">
                    85% of graduates report promotion within 6 months
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10">
              View Curriculum
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose VOS Academy?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Learn the Value Operating System through hands-on experience, real-world projects, and personalized guidance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>AI-Powered Learning</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Get personalized recommendations and adaptive learning paths based on your progress and goals.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Practical Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Work on real VOS implementations and build a portfolio of demonstrable skills.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Community Support</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Join a vibrant community of VOS practitioners and get help when you need it.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Certifications</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Earn recognized certifications that validate your VOS expertise.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Interactive Simulations</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Practice VOS concepts in safe, guided environments before applying them in the real world.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Comprehensive Curriculum</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  From fundamentals to advanced topics, master every aspect of the Value Operating System.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/50">
        <div className="container max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Master VOS?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of professionals transforming their careers with the Value Operating System.
          </p>
          <Button size="lg" asChild>
            <Link to="/academy/dashboard">
              Start Your Journey
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
