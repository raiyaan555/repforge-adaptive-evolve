import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Target, TrendingUp, Users, Star, CheckCircle } from "lucide-react";
import heroImage from "@/assets/hero-fitness.jpg";

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 to-background/70" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-primary font-medium">Adaptive Fitness Tracking</span>
            </div>
            
            <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent leading-tight">
              Build the
              <br />
              <span className="text-primary">strongest</span>
              <br />
              version of you
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              RepForge adapts to your progress, automatically adjusting your workouts based on how you feel. 
              Start strong, stay motivated, evolve continuously.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
              <Button 
                size="lg" 
                variant="energy" 
                onClick={onGetStarted}
                className="text-lg px-8 py-4 h-auto"
              >
                Start Your Journey
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-4 h-auto border-white/20 text-foreground hover:bg-white/10"
              >
                Learn More
              </Button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">10K+</div>
                <div className="text-sm text-muted-foreground">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">50M+</div>
                <div className="text-sm text-muted-foreground">Reps Completed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">95%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Why Choose <span className="text-primary">RepForge</span>?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience the future of fitness tracking with intelligent adaptation and personalized progress
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="text-center p-8 rounded-2xl bg-card border border-border hover:border-primary/20 transition-colors">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Target className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Adaptive Programming</h3>
              <p className="text-muted-foreground leading-relaxed">
                Our AI adjusts your workout intensity based on your daily condition, ensuring optimal progress without burnout.
              </p>
            </div>
            
            <div className="text-center p-8 rounded-2xl bg-card border border-border hover:border-primary/20 transition-colors">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Progress Tracking</h3>
              <p className="text-muted-foreground leading-relaxed">
                Detailed analytics and progress visualization help you see exactly how you're improving over time.
              </p>
            </div>
            
            <div className="text-center p-8 rounded-2xl bg-card border border-border hover:border-primary/20 transition-colors">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Expert-Designed</h3>
              <p className="text-muted-foreground leading-relaxed">
                Programs created by certified trainers and backed by sports science for maximum effectiveness.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-8">
                Transform Your Fitness Journey
              </h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <CheckCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Personalized Workouts</h3>
                    <p className="text-muted-foreground">Every workout is tailored to your current fitness level and goals</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <CheckCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Real-Time Adjustments</h3>
                    <p className="text-muted-foreground">Workouts adapt based on your energy levels and performance</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <CheckCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Progress Analytics</h3>
                    <p className="text-muted-foreground">Comprehensive tracking of your strength and endurance gains</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <CheckCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Expert Guidance</h3>
                    <p className="text-muted-foreground">Professional workout plans designed by certified trainers</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 p-8">
                <div className="h-full w-full rounded-2xl bg-card border border-border flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">💪</div>
                    <h3 className="text-2xl font-bold mb-2">Ready to Start?</h3>
                    <p className="text-muted-foreground">Join thousands of users already transforming their fitness</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              What Our Users Say
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="p-8 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-1 mb-4">
                {[1,2,3,4,5].map((star) => (
                  <Star key={star} className="h-5 w-5 text-primary fill-current" />
                ))}
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "RepForge completely changed how I approach fitness. The adaptive workouts keep me challenged without overwhelming me."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-primary font-semibold">A</span>
                </div>
                <div>
                  <div className="font-semibold">Alex Chen</div>
                  <div className="text-sm text-muted-foreground">Fitness Enthusiast</div>
                </div>
              </div>
            </div>
            
            <div className="p-8 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-1 mb-4">
                {[1,2,3,4,5].map((star) => (
                  <Star key={star} className="h-5 w-5 text-primary fill-current" />
                ))}
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "The progress tracking is incredible. I can see exactly how I'm improving week by week. It's so motivating!"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-primary font-semibold">S</span>
                </div>
                <div>
                  <div className="font-semibold">Sarah Johnson</div>
                  <div className="text-sm text-muted-foreground">Personal Trainer</div>
                </div>
              </div>
            </div>
            
            <div className="p-8 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-1 mb-4">
                {[1,2,3,4,5].map((star) => (
                  <Star key={star} className="h-5 w-5 text-primary fill-current" />
                ))}
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "Finally, a fitness app that actually understands me. The workouts adapt to how I'm feeling each day."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-primary font-semibold">M</span>
                </div>
                <div>
                  <div className="font-semibold">Mike Rodriguez</div>
                  <div className="text-sm text-muted-foreground">Software Engineer</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to <span className="text-primary">Transform</span> Your Fitness?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of users who are already building the strongest version of themselves with RepForge.
            </p>
            <Button 
              size="lg" 
              variant="energy" 
              onClick={onGetStarted}
              className="text-lg px-12 py-4 h-auto"
            >
              Start Your Free Journey
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}