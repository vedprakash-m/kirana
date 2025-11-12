import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { signInWithRedirect } from '../services/authService';
import { Button } from '../components/ui/button';
import { Loader2, ArrowRight, Sparkles, Zap, Upload } from 'lucide-react';

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
    <div className="landing-page min-h-screen bg-white">
      <HeroSection onGetStarted={handleGetStarted} onSignIn={handleGetStarted} />
      <FeaturesGrid />
      <FeatureShowcase onGetStarted={handleGetStarted} />
      <CTASection onGetStarted={handleGetStarted} />
      <Footer />
    </div>
  );
};

// Hero Section
const HeroSection = ({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50/30 to-white">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100 rounded-full blur-3xl opacity-20"></div>
      </div>

      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-4 flex items-center justify-between">
          <div className="text-xl font-semibold text-slate-900">
            Kirana
          </div>
          <Button
            variant="ghost"
            onClick={onSignIn}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 rounded-lg"
          >
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="relative pt-32 pb-24 md:pt-40 md:pb-32 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 shadow-sm text-blue-700 rounded-full text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Grocery Intelligence</span>
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
              Never run out of your{' '}
              <span className="bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">essentials</span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Smart predictions that learn your household's shopping patterns. Know exactly when to restock—before you run out.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                onClick={onGetStarted}
                className="group bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-base font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Get Started Free
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                variant="outline"
                className="px-8 py-6 text-base font-medium rounded-xl border-slate-300 hover:border-blue-300 hover:bg-blue-50/50 transition-all"
              >
                Watch Demo
              </Button>
            </div>
            
            {/* Trust Indicator */}
            <p className="text-sm text-slate-500">
              Free forever • No credit card required • Works with Microsoft Account
            </p>
          </div>

          {/* Hero Image */}
          <div className="mt-16 md:mt-20">
            <div className="relative group">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
              
              {/* Image container - Placeholder with gradient */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-white border border-slate-200 p-3">
                <div className="relative aspect-[16/10] bg-gradient-to-br from-slate-100 via-blue-50 to-purple-50 rounded-lg flex items-center justify-center">
                  {/* Placeholder content */}
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-white/50 backdrop-blur rounded-2xl flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </div>
                    <div className="text-sm font-medium text-slate-600">Dashboard Preview</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Features Grid
const FeaturesGrid = () => {
  const features = [
    {
      icon: Sparkles,
      title: 'AI-Powered Predictions',
      description: 'Machine learning algorithms analyze your consumption patterns to predict when items will run out.',
      color: 'blue',
    },
    {
      icon: Zap,
      title: 'One-Tap Restocking',
      description: 'Record purchases instantly and watch predictions update in real-time. No manual entry required.',
      color: 'purple',
    },
    {
      icon: Upload,
      title: 'Smart Import',
      description: 'Upload Amazon order history or receipts. AI extracts all items automatically.',
      color: 'indigo',
    },
  ];

  const colorStyles = {
    blue: {
      bg: 'bg-blue-50',
      hoverBg: 'group-hover:bg-blue-100',
      icon: 'text-blue-600',
      border: 'border-blue-100',
    },
    purple: {
      bg: 'bg-purple-50',
      hoverBg: 'group-hover:bg-purple-100',
      icon: 'text-purple-600',
      border: 'border-purple-100',
    },
    indigo: {
      bg: 'bg-indigo-50',
      hoverBg: 'group-hover:bg-indigo-100',
      icon: 'text-indigo-600',
      border: 'border-indigo-100',
    },
  };

  return (
    <section className="py-20 md:py-28 px-6 md:px-8 bg-slate-50 border-y border-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Everything you need to stay stocked
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Powerful features that make grocery management effortless
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => {
            const styles = colorStyles[feature.color as keyof typeof colorStyles];
            return (
              <div key={index} className="group">
                <div className={`bg-white rounded-2xl p-8 border-2 ${styles.border} hover:border-${feature.color}-200 hover:shadow-xl transition-all duration-300 h-full`}>
                  <div className={`w-14 h-14 ${styles.bg} ${styles.hoverBg} rounded-xl flex items-center justify-center mb-6 transition-colors`}>
                    <feature.icon className={`w-7 h-7 ${styles.icon}`} />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// Feature Showcase
const FeatureShowcase = ({ onGetStarted }: { onGetStarted: () => void }) => {
  const showcases = [
    {
      title: 'Know before you run out',
      description: 'Our AI learns your household\'s shopping patterns and predicts when you\'ll run out of each item. No manual tracking. No guesswork. Just smart predictions.',
      image: '/images/landing/feature-predictions.webp',
      accent: 'blue',
    },
    {
      title: 'Restock in one tap',
      description: 'When an item is running out, just tap to record your next purchase. The AI updates its prediction instantly. Fast. Simple. Accurate.',
      image: '/images/landing/feature-restock.webp',
      accent: 'purple',
    },
    {
      title: 'Import your purchase history',
      description: 'Upload your Amazon order history or scan a receipt. Kirana extracts everything automatically. Share your household inventory with family. Everyone stays synced.',
      image: '/images/landing/feature-import.webp',
      accent: 'indigo',
    },
  ];

  const accentColors = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    indigo: 'from-indigo-500 to-indigo-600',
  };

  return (
    <section className="py-24 md:py-32 px-6 md:px-8 bg-white">
      <div className="max-w-7xl mx-auto space-y-32 md:space-y-40">
        {showcases.map((showcase, index) => (
          <div
            key={index}
            className={`flex flex-col ${
              index % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'
            } gap-12 md:gap-20 items-center`}
          >
            {/* Text Content */}
            <div className="flex-1 space-y-6">
              <div className={`inline-block px-4 py-1.5 bg-gradient-to-r ${accentColors[showcase.accent as keyof typeof accentColors]} text-white text-sm font-medium rounded-full`}>
                Feature {index + 1}
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900">
                {showcase.title}
              </h2>
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed">
                {showcase.description}
              </p>
              {index === showcases.length - 1 && (
                <div className="pt-2">
                  <Button
                    onClick={onGetStarted}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-base font-medium rounded-xl shadow-lg hover:shadow-xl transition-all"
                  >
                    Start Free Trial
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
            
            {/* Image */}
            <div className="flex-1">
              <div className="relative group">
                {/* Colored glow */}
                <div className={`absolute -inset-1 bg-gradient-to-r ${accentColors[showcase.accent as keyof typeof accentColors]} rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition duration-500`}></div>
                
                {/* Image container - Placeholder with gradient */}
                <div className="relative rounded-2xl overflow-hidden bg-white border-2 border-slate-200 shadow-xl p-3">
                  <div className={`relative aspect-[16/10] bg-gradient-to-br ${
                    showcase.accent === 'blue' ? 'from-blue-50 via-slate-50 to-blue-100' :
                    showcase.accent === 'purple' ? 'from-purple-50 via-slate-50 to-purple-100' :
                    'from-indigo-50 via-slate-50 to-indigo-100'
                  } rounded-lg flex items-center justify-center`}>
                    {/* Placeholder icon */}
                    <div className={`w-16 h-16 bg-white/60 backdrop-blur rounded-2xl flex items-center justify-center shadow-lg border ${
                      showcase.accent === 'blue' ? 'border-blue-200' :
                      showcase.accent === 'purple' ? 'border-purple-200' :
                      'border-indigo-200'
                    }`}>
                      <svg className={`w-8 h-8 ${
                        showcase.accent === 'blue' ? 'text-blue-600' :
                        showcase.accent === 'purple' ? 'text-purple-600' :
                        'text-indigo-600'
                      }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// CTA Section
const CTASection = ({ onGetStarted }: { onGetStarted: () => void }) => {
  return (
    <section className="py-24 md:py-32 px-6 md:px-8 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <div className="relative rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 overflow-hidden shadow-2xl">
          {/* Animated Background Pattern */}
          <div className="absolute inset-0">
            <svg className="w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="1.5" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid-pattern)" />
            </svg>
          </div>
          
          {/* Gradient Orbs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20"></div>
          
          {/* Content */}
          <div className="relative px-8 md:px-16 py-20 md:py-24 text-center space-y-8">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Ready to never run out again?
            </h2>
            <p className="text-lg md:text-xl text-blue-50 max-w-2xl mx-auto leading-relaxed">
              Join smart households using AI to manage their groceries effortlessly. Start your free trial today.
            </p>
            <div className="pt-4">
              <Button
                onClick={onGetStarted}
                className="bg-white text-blue-600 hover:bg-blue-50 px-10 py-6 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all group"
              >
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            <p className="text-sm text-blue-100 font-medium">
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
    <footer className="border-t-2 border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-16 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-12 mb-12">
          {/* Brand */}
          <div className="col-span-2 space-y-4">
            <div className="text-2xl font-bold text-slate-900">
              Kirana
            </div>
            <p className="text-sm text-slate-600 leading-relaxed max-w-xs">
              AI-powered grocery intelligence for smart households. Never run out of essentials again.
            </p>
          </div>
          
          {/* Product */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">Product</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="/features" className="text-slate-600 hover:text-blue-600 transition-colors">Features</a></li>
              <li><a href="/pricing" className="text-slate-600 hover:text-blue-600 transition-colors">Pricing</a></li>
              <li><a href="/demo" className="text-slate-600 hover:text-blue-600 transition-colors">Demo</a></li>
            </ul>
          </div>
          
          {/* Company */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">Company</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="/about" className="text-slate-600 hover:text-blue-600 transition-colors">About</a></li>
              <li><a href="/blog" className="text-slate-600 hover:text-blue-600 transition-colors">Blog</a></li>
              <li><a href="/support" className="text-slate-600 hover:text-blue-600 transition-colors">Support</a></li>
            </ul>
          </div>
          
          {/* Legal */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">Legal</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="/privacy" className="text-slate-600 hover:text-blue-600 transition-colors">Privacy</a></li>
              <li><a href="/terms" className="text-slate-600 hover:text-blue-600 transition-colors">Terms</a></li>
              <li><a href="/security" className="text-slate-600 hover:text-blue-600 transition-colors">Security</a></li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <div>© 2025 Kirana. All rights reserved.</div>
          <div className="flex items-center gap-1.5">
            Made with <span className="text-red-500 text-base">❤️</span> by Ved
          </div>
        </div>
      </div>
    </footer>
  );
};
