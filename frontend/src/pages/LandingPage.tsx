import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { signInWithRedirect } from '../services/authService';
import { Button } from '../components/ui/button';
import { 
  Loader2, 
  ArrowRight, 
  Sparkles, 
  Zap, 
  Upload, 
  Shield, 
  Clock, 
  Users,
  Check,
  Play,
  Star
} from 'lucide-react';

export const LandingPage = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleGetStarted = async () => {
    try {
      await signInWithRedirect();
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="landing-page min-h-screen bg-white antialiased">
      <Navigation onSignIn={handleGetStarted} />
      <HeroSection onGetStarted={handleGetStarted} />
      <LogoCloud />
      <FeaturesSection />
      <HowItWorks />
      <FeatureShowcase onGetStarted={handleGetStarted} />
      <Testimonials />
      <PricingPreview onGetStarted={handleGetStarted} />
      <CTASection onGetStarted={handleGetStarted} />
      <Footer />
    </div>
  );
};

// Navigation
const Navigation = ({ onSignIn }: { onSignIn: () => void }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">Kirana</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">How it Works</a>
          <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={onSignIn}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Sign In
          </Button>
          <Button
            onClick={onSignIn}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-medium rounded-lg"
          >
            Get Started
          </Button>
        </div>
      </div>
    </nav>
  );
};

// Hero Section with animated gradient
const HeroSection = ({ onGetStarted }: { onGetStarted: () => void }) => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-b from-slate-50 via-white to-blue-50/30">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-200/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-200/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-100/20 rounded-full blur-3xl"></div>
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

      <div className="relative w-full pt-32 pb-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 text-blue-700 rounded-full text-sm font-medium shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span>AI-Powered Grocery Intelligence</span>
            </div>
            
            {/* Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 leading-[1.1] tracking-tight">
              Never run out of
              <br />
              <span className="relative">
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  your essentials
                </span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M2 10C50 4 100 2 150 6C200 10 250 4 298 8" stroke="url(#gradient)" strokeWidth="3" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#2563eb"/>
                      <stop offset="50%" stopColor="#4f46e5"/>
                      <stop offset="100%" stopColor="#9333ea"/>
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-slate-600 leading-relaxed max-w-2xl mx-auto font-light">
              Smart predictions that learn your household's shopping patterns.
              <span className="text-slate-900 font-medium"> Know exactly when to restock</span>—before you run out.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                onClick={onGetStarted}
                className="group bg-slate-900 hover:bg-slate-800 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5"
              >
                Start Free — No Credit Card
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                variant="outline"
                className="group px-8 py-6 text-lg font-medium rounded-xl border-2 border-slate-200 hover:border-slate-300 bg-white/80 backdrop-blur-sm hover:bg-white transition-all"
              >
                <Play className="mr-2 w-5 h-5 text-blue-600" />
                Watch Demo
              </Button>
            </div>
            
            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Free forever</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Works with Microsoft Account</span>
              </div>
            </div>
          </div>

          {/* Hero Image / App Preview */}
          <div className="mt-20 relative">
            <div className="relative mx-auto max-w-5xl">
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-3xl blur-2xl opacity-20"></div>
              
              {/* Browser Frame */}
              <div className="relative bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-700">
                {/* Browser Bar */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-slate-700 rounded-md px-4 py-1.5 text-sm text-slate-400 font-mono">
                      kirana.app/dashboard
                    </div>
                  </div>
                </div>
                
                {/* App Preview Content */}
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-8">
                  <AppPreview />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// App Preview Component (replaces broken image)
const AppPreview = () => {
  const items = [
    { name: 'Milk', emoji: '🥛', daysLeft: 2, status: 'urgent', confidence: 94 },
    { name: 'Eggs', emoji: '🥚', daysLeft: 5, status: 'warning', confidence: 87 },
    { name: 'Bread', emoji: '🍞', daysLeft: 3, status: 'urgent', confidence: 91 },
    { name: 'Butter', emoji: '🧈', daysLeft: 12, status: 'ok', confidence: 82 },
    { name: 'Coffee', emoji: '☕', daysLeft: 8, status: 'ok', confidence: 89 },
  ];

  const statusColors = {
    urgent: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    ok: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Sidebar */}
      <div className="hidden md:block space-y-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">Kirana</div>
              <div className="text-xs text-slate-500">Smart Inventory</div>
            </div>
          </div>
          <nav className="space-y-1">
            {['Dashboard', 'Inventory', 'Import', 'Settings'].map((item, i) => (
              <div key={item} className={`px-3 py-2 rounded-lg text-sm ${i === 0 ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                {item}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="md:col-span-2 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Items', value: '24', icon: '📦' },
            { label: 'Running Low', value: '3', icon: '⚠️' },
            { label: 'Predictions', value: '94%', icon: '🎯' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-xs text-slate-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Items List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Running Out Soon</h3>
            <span className="text-xs text-blue-600 font-medium">View All →</span>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.name} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.emoji}</span>
                  <div>
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.confidence}% confidence</div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[item.status as keyof typeof statusColors]}`}>
                  {item.daysLeft} days left
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Logo Cloud / Social Proof
const LogoCloud = () => {
  return (
    <section className="py-16 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-slate-500 mb-8">
          TRUSTED BY SMART HOUSEHOLDS
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-60">
          {['Amazon CSV Import', 'Microsoft Auth', 'AI Predictions', 'Bank-Grade Security', 'Real-time Sync'].map((item) => (
            <div key={item} className="flex items-center gap-2 text-slate-600">
              <Shield className="w-5 h-5" />
              <span className="font-medium">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Features Section
const FeaturesSection = () => {
  const features = [
    {
      icon: Sparkles,
      title: 'AI-Powered Predictions',
      description: 'Machine learning algorithms analyze your consumption patterns to predict exactly when items will run out.',
      color: '#3b82f6',
      bg: 'bg-blue-50',
    },
    {
      icon: Zap,
      title: 'One-Tap Restocking',
      description: 'Record purchases instantly with a single tap. Predictions update in real-time automatically.',
      color: '#f59e0b',
      bg: 'bg-amber-50',
    },
    {
      icon: Upload,
      title: 'Smart CSV Import',
      description: 'Upload your Amazon order history. Our AI extracts and categorizes items automatically.',
      color: '#22c55e',
      bg: 'bg-green-50',
    },
    {
      icon: Users,
      title: 'Family Sharing',
      description: 'Share your household inventory with family members. Everyone stays synced in real-time.',
      color: '#a855f7',
      bg: 'bg-purple-50',
    },
    {
      icon: Shield,
      title: 'Bank-Grade Security',
      description: 'Your data is encrypted and protected with enterprise-grade security. We never sell your data.',
      color: '#475569',
      bg: 'bg-slate-50',
    },
    {
      icon: Clock,
      title: 'Smart Notifications',
      description: 'Get notified before items run out, not after. Timely reminders that actually help.',
      color: '#f43f5e',
      bg: 'bg-rose-50',
    },
  ];

  return (
    <section id="features" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Features
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            Everything you need to
            <br />stay stocked
          </h2>
          <p className="text-xl text-slate-600">
            Powerful features that make grocery management effortless
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="group bg-white rounded-2xl p-8 border border-slate-200 hover:border-slate-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`w-14 h-14 ${feature.bg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-7 h-7" style={{ color: feature.color }} />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// How It Works
const HowItWorks = () => {
  const steps = [
    {
      number: '01',
      title: 'Import Your History',
      description: 'Upload your Amazon order CSV or add items manually. Our AI does the heavy lifting.',
      icon: Upload,
    },
    {
      number: '02',
      title: 'AI Learns Your Patterns',
      description: 'Machine learning analyzes your consumption habits and predicts when items run out.',
      icon: Sparkles,
    },
    {
      number: '03',
      title: 'Get Smart Reminders',
      description: 'Receive timely notifications before you run out. One tap to mark as restocked.',
      icon: Zap,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-4">
            How It Works
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            Get started in minutes
          </h2>
          <p className="text-xl text-slate-600">
            Three simple steps to never run out of essentials again
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting Line */}
          <div className="hidden md:block absolute top-24 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-blue-200 via-indigo-200 to-purple-200"></div>
          
          {steps.map((step, index) => (
            <div key={index} className="relative text-center">
              <div className="relative inline-flex mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <step.icon className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full border-2 border-indigo-500 flex items-center justify-center text-sm font-bold text-indigo-600 shadow-md">
                  {step.number.slice(-1)}
                </div>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                {step.title}
              </h3>
              <p className="text-slate-600 max-w-sm mx-auto">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Feature Showcase (alternating sections)
const FeatureShowcase = ({ onGetStarted }: { onGetStarted: () => void }) => {
  const showcases = [
    {
      badge: 'Predictions',
      title: 'Know before you run out',
      description: 'Our AI learns your household\'s shopping patterns and predicts when you\'ll run out of each item. No manual tracking. No guesswork. Just smart predictions that actually work.',
      features: ['Learns from your habits', '94% prediction accuracy', 'Updates in real-time'],
      visual: 'predictions',
    },
    {
      badge: 'One-Tap',
      title: 'Restock in a single tap',
      description: 'When an item is running low, just tap to record your purchase. The AI instantly updates its prediction. It\'s that simple.',
      features: ['Instant updates', 'No manual entry', 'Works offline'],
      visual: 'restock',
    },
    {
      badge: 'Import',
      title: 'Import your purchase history',
      description: 'Upload your Amazon order history and let our AI extract and categorize every item. Years of data processed in seconds.',
      features: ['Amazon CSV support', 'AI item recognition', 'Auto-categorization'],
      visual: 'import',
    },
  ];

  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 space-y-32">
        {showcases.map((showcase, index) => (
          <div
            key={index}
            className={`flex flex-col ${
              index % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'
            } gap-12 lg:gap-20 items-center`}
          >
            {/* Text Content */}
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {showcase.badge}
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
                {showcase.title}
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                {showcase.description}
              </p>
              <ul className="space-y-3">
                {showcase.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-700">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
              {index === showcases.length - 1 && (
                <div className="pt-4">
                  <Button
                    onClick={onGetStarted}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
                  >
                    Start Free Trial
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </div>
              )}
            </div>
            
            {/* Visual */}
            <div className="flex-1">
              <ShowcaseVisual type={showcase.visual} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// Showcase Visual Component
const ShowcaseVisual = ({ type }: { type: string }) => {
  if (type === 'predictions') {
    return (
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-slate-900">Predictions</h4>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">94% accurate</span>
        </div>
        {[
          { name: 'Milk', days: 2, emoji: '🥛', width: '20%', color: 'bg-red-500' },
          { name: 'Eggs', days: 5, emoji: '🥚', width: '45%', color: 'bg-amber-500' },
          { name: 'Bread', days: 8, emoji: '🍞', width: '70%', color: 'bg-green-500' },
        ].map((item) => (
          <div key={item.name} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span>{item.emoji}</span>
                <span className="font-medium text-slate-900">{item.name}</span>
              </span>
              <span className="text-slate-500">{item.days} days</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: item.width }}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'restock') {
    return (
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
        <div className="text-center space-y-4">
          <div className="text-6xl">🥛</div>
          <h4 className="font-semibold text-slate-900 text-lg">Milk</h4>
          <p className="text-red-600 font-medium">Running out in 2 days</p>
          <button className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all">
            ✓ Mark as Restocked
          </button>
          <p className="text-xs text-slate-500">Tap to update prediction</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <p className="font-medium text-slate-900">Drop your Amazon CSV here</p>
        <p className="text-sm text-slate-500 mt-1">or click to browse</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
          <Check className="w-5 h-5 text-green-600" />
          <span className="text-sm text-slate-700">247 items detected</span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <span className="text-sm text-slate-700">AI categorizing...</span>
        </div>
      </div>
    </div>
  );
};

// Testimonials
const Testimonials = () => {
  const testimonials = [
    {
      quote: "Finally, an app that actually understands my shopping habits. Haven't run out of milk since I started using it!",
      author: "Sarah M.",
      role: "Busy Mom of 3",
      avatar: "👩",
      rating: 5,
    },
    {
      quote: "The Amazon import feature saved me hours. All my purchase history, perfectly organized.",
      author: "James K.",
      role: "Tech Professional",
      avatar: "👨",
      rating: 5,
    },
    {
      quote: "Simple, smart, and actually useful. This is how all apps should be designed.",
      author: "Priya S.",
      role: "Home Manager",
      avatar: "👩‍💼",
      rating: 5,
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-4">
            <Star className="w-4 h-4" />
            Testimonials
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            Loved by smart households
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-amber-400 fill-current" />
                ))}
              </div>
              <p className="text-slate-700 mb-6 leading-relaxed italic">
                "{testimonial.quote}"
              </p>
              <div className="flex items-center gap-3">
                <div className="text-3xl">{testimonial.avatar}</div>
                <div>
                  <div className="font-semibold text-slate-900">{testimonial.author}</div>
                  <div className="text-sm text-slate-500">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Pricing Preview
const PricingPreview = ({ onGetStarted }: { onGetStarted: () => void }) => {
  return (
    <section id="pricing" className="py-24 bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-4">
            Pricing
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Free forever. Really.
          </h2>
          <p className="text-xl text-slate-600">
            No hidden fees. No credit card required. No catch.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Free Plan</h3>
                <p className="text-slate-600 mt-1">Everything you need for a smart household</p>
              </div>
              <div className="text-right">
                <div className="text-5xl font-bold text-slate-900">$0</div>
                <div className="text-slate-500">forever</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {[
                'Unlimited items',
                'AI predictions',
                'Amazon CSV import',
                'Family sharing (up to 5)',
                'Real-time sync',
                'Mobile & desktop',
                'Smart notifications',
                'Data export',
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-600" />
                  </div>
                  <span className="text-slate-700">{feature}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={onGetStarted}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-6 text-lg font-semibold rounded-xl"
            >
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

// CTA Section
const CTASection = ({ onGetStarted }: { onGetStarted: () => void }) => {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.3),transparent_50%)]"></div>
            <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,rgba(147,51,234,0.3),transparent_50%)]"></div>
          </div>
          
          {/* Content */}
          <div className="relative px-8 md:px-16 py-20 text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
              Ready to never run out again?
            </h2>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-8">
              Join thousands of smart households using AI to manage their essentials effortlessly.
            </p>
            <Button
              onClick={onGetStarted}
              className="bg-white text-slate-900 hover:bg-slate-100 px-10 py-6 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all group"
            >
              Start Free Today
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <p className="text-sm text-slate-400 mt-6">
              No credit card required • Free forever • 2 minute setup
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

// Footer
const Footer = () => {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">Kirana</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed max-w-xs">
              AI-powered grocery intelligence for smart households. Never run out of essentials again.
            </p>
          </div>
          
          {/* Links */}
          {[
            { title: 'Product', links: ['Features', 'Pricing', 'Demo'] },
            { title: 'Company', links: ['About', 'Blog', 'Careers'] },
            { title: 'Legal', links: ['Privacy', 'Terms', 'Security'] },
          ].map((group) => (
            <div key={group.title}>
              <h3 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">{group.title}</h3>
              <ul className="space-y-3 text-sm">
                {group.links.map((link) => (
                  <li key={link}>
                    <a href={`/${link.toLowerCase()}`} className="text-slate-600 hover:text-slate-900 transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div>© 2025 Kirana. All rights reserved.</div>
          <div className="flex items-center gap-1.5">
            Made with <span className="text-red-500">❤️</span> by Ved
          </div>
        </div>
      </div>
    </footer>
  );
};
