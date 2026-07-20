'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CognifyLogo } from '@/components/ui/cognify-logo';
import {
  HelpCircle,
  Bot,
  Users,
  Clock,
  Shield,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  Upload,
  BookOpen,
  TrendingUp,
  Zap,
  Star,
} from 'lucide-react';

const features = [
  { icon: Upload, title: 'Upload Any Question', description: 'Take a photo or screenshot of any SAT question and upload it instantly.' },
  { icon: Bot, title: 'Instant AI Help', description: 'Get immediate, step-by-step explanations powered by advanced AI.' },
  { icon: Users, title: 'Human Expert Reviews', description: 'Request personalized explanations from our team of SAT experts.' },
  { icon: Clock, title: 'Available 24/7', description: 'Get help whenever you need it, day or night.' },
  { icon: BookOpen, title: 'Question Bank', description: 'Practice with curated SAT questions across all topics and difficulty levels.' },
  { icon: TrendingUp, title: 'Track Progress', description: 'See your mastery grow with detailed analytics across every SAT domain.' },
];

const steps = [
  { number: '01', title: 'Upload Your Question', description: 'Take a screenshot, photo, or type any SAT practice problem.', icon: Upload },
  { number: '02', title: 'Get AI Explanation', description: 'Receive an instant, detailed step-by-step solution.', icon: Bot },
  { number: '03', title: 'Request Human Help', description: 'Need more? Get a personalized explanation from our experts.', icon: Users },
  { number: '04', title: 'Improve Your Score', description: 'Save explanations, track progress, and master SAT concepts.', icon: GraduationCap },
];

const subjectsCovered = [
  { name: 'Math: Algebra', description: 'Linear equations, inequalities, systems' },
  { name: 'Math: Advanced Math', description: 'Functions, polynomials, nonlinear equations' },
  { name: 'Math: Geometry', description: 'Triangles, circles, trigonometry' },
  { name: 'Math: Problem Solving', description: 'Statistics, ratios, percentages' },
  { name: 'Reading: Information & Ideas', description: 'Main idea, evidence, summaries' },
  { name: 'Writing: Expression of Ideas', description: 'Rhetoric, transitions, organization' },
];

const testimonials = [
  { quote: "My score went from 1180 to 1410 in 3 months. The step-by-step explanations made everything click.", name: "Jordan M.", grade: "11th Grade" },
  { quote: "Having a real tutor review my hardest questions was a game-changer. Worth every minute.", name: "Priya K.", grade: "12th Grade" },
  { quote: "I used to skip math sections. Now algebra is my strongest subject thanks to Milo.", name: "Alex T.", grade: "10th Grade" },
];

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users directly to the dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading || user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <CognifyLogo variant="fullLogo" size="md" href="/" />
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#subjects" className="hover:text-foreground transition-colors">Subjects</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* ambient glow orbs — the thing that was missing that made this
            page read as "flat" instead of premium */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-primary/20 blur-[100px]" />
          <div className="absolute top-10 -right-32 w-[380px] h-[380px] rounded-full bg-purple/20 blur-[100px]" />
          <div className="absolute bottom-0 left-1/3 w-[320px] h-[320px] rounded-full bg-milo/15 blur-[100px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-gradient-to-r from-primary/10 to-purple/10 text-sm font-medium mb-6 glow-primary">
            <Zap className="h-3.5 w-3.5 text-primary" />
            AI + Human tutors in one place
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            SAT Help<br />
            <span className="text-gradient-brand">On Demand</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Upload any SAT question. Get instant AI explanations plus personalized
            help from expert tutors — 24 hours a day.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="text-base px-8 h-12">
              <Link href="/signup">
                Start Free Today
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-base px-8 h-12">
              <a href="#how-it-works">See How It Works</a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required · Free to start
          </p>
        </div>

        {/* Hero visual */}
        <div className="max-w-5xl mx-auto mt-16">
          <div className="rounded-2xl border bg-gradient-to-b from-muted/40 to-background p-8 md:p-12 shadow-xl">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="bg-background shadow-sm">
                <CardContent className="pt-6">
                  <Upload className="h-8 w-8 text-primary mb-4" />
                  <h3 className="font-semibold mb-2">Upload Question</h3>
                  <div className="aspect-[4/3] rounded-lg bg-muted/60 flex flex-col items-center justify-center mb-4 border-2 border-dashed border-border">
                    <Upload className="h-10 w-10 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">Photo or screenshot</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Any SAT question format</p>
                </CardContent>
              </Card>

              <Card className="bg-background shadow-sm border-primary/30">
                <CardContent className="pt-6">
                  <Bot className="h-8 w-8 text-primary mb-4" />
                  <h3 className="font-semibold mb-2">AI Processes It</h3>
                  <div className="space-y-2.5 mb-4">
                    {['Identifying equation type…', 'Applying algebra rules…', 'Building explanation…'].map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`h-2 rounded-full flex-1 ${i === 2 ? 'bg-primary/30 w-3/5' : 'bg-primary'}`} />
                        <span className="text-xs text-muted-foreground w-28 truncate">{step}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Powered by advanced AI</p>
                </CardContent>
              </Card>

              <Card className="bg-background shadow-sm border-success/25">
                <CardContent className="pt-6">
                  <CheckCircle2 className="h-8 w-8 text-success mb-4" />
                  <h3 className="font-semibold mb-2">Get Explanation</h3>
                  <div className="space-y-2 mb-4">
                    {['Step 1: Set up equation', 'Step 2: Isolate x', 'Step 3: Verify answer'].map((s) => (
                      <div key={s} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Clear, step-by-step solution</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-6 border-y bg-muted/30">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '24/7', label: 'AI Available' },
            { value: '8', label: 'SAT Domains Covered' },
            { value: '150+', label: 'Avg Score Gain' },
            { value: '< 3s', label: 'AI Response Time' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-lg text-muted-foreground">From question to mastery in four steps</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="text-center group">
                  <div className="relative inline-block mb-5">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-8 w-8 text-primary" />
                    </div>
                    <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {parseInt(step.number)}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Cognify?</h2>
            <p className="text-lg text-muted-foreground">Everything you need to master the SAT</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="bg-background card-hover">
                  <CardContent className="pt-6">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Subjects */}
      <section id="subjects" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">All SAT Topics Covered</h2>
            <p className="text-lg text-muted-foreground">From algebra to reading comprehension</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {subjectsCovered.map((subject) => (
              <Card key={subject.name} className="card-hover">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{subject.name}</h3>
                    <p className="text-sm text-muted-foreground">{subject.description}</p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-success ml-auto flex-shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Students Love Cognify</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="bg-background">
                <CardContent className="pt-6">
                  <div className="flex gap-0.5 mb-4">
                    {[1,2,3,4,5].map((i) => <Star key={i} className="h-4 w-4 fill-yellow-400 text-warning/70" />)}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                  <div>
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.grade}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-gradient-brand text-primary-foreground">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Ready to Raise Your Score?</h2>
          <p className="text-lg opacity-90 mb-8">
            Join students who are already using Cognify to master the SAT — free to start.
          </p>
          <Button size="lg" variant="secondary" asChild className="text-base px-8 h-12">
            <Link href="/signup">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            <div className="max-w-xs">
              <div className="mb-3">
                <CognifyLogo variant="fullLogo" size="sm" href="/" />
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered SAT prep with human expert backup. Available 24/7.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm">
              <div>
                <h4 className="font-semibold mb-3">Product</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li><a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a></li>
                  <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                  <li><a href="#subjects" className="hover:text-foreground transition-colors">Subjects</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Account</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li><Link href="/signup" className="hover:text-foreground transition-colors">Sign Up Free</Link></li>
                  <li><Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Cognify. All rights reserved.</p>
            <div className="flex items-center gap-1 text-xs">
              <Shield className="h-3.5 w-3.5" />
              Your data is encrypted and secure
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
