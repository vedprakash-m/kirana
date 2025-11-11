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
    <div className="landing-page min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
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
    <section className="relative overflow-hidden">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-6 flex items-center justify-between">
          <div className="text-xl font-semibold text-slate-900">
            Kirana
          </div>
          <Button
            variant="ghost"
            onClick={onSignIn}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white/50"
          >
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="relative pt-32 pb-20 md:pt-40 md:pb-28 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Grocery Intelligence</span>
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
              Never run out of your{' '}
              <span className="text-blue-600">essentials</span>
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
                className="px-8 py-6 text-base font-medium rounded-xl border-slate-200 hover:border-slate-300 hover:bg-slate-50"
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
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200/50 bg-white p-2">
              <img
                src="/images/landing/hero-screenshot.webp"
                srcSet="/images/landing/hero-screenshot-600.webp 600w, /images/landing/hero-screenshot-800.webp 800w, /images/landing/hero-screenshot-1200.webp 1200w"
                sizes="(max-width: 768px) 600px, (max-width: 1280px) 800px, 1200px"
                alt="Kirana dashboard showing inventory with smart predictions"
                loading="eager"
                className="w-full rounded-lg"
              />
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
    },
    {
      icon: Zap,
      title: 'One-Tap Restocking',
      description: 'Record purchases instantly and watch predictions update in real-time. No manual entry required.',
    },
    {
      icon: Upload,
      title: 'Smart Import',
      description: 'Upload Amazon order history or receipts. AI extracts all items automatically.',
    },
  ];

  return (
    <section className="py-20 md:py-28 px-6 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {features.map((feature, index) => (
            <div key={index} className="group">
              <div className="bg-white rounded-2xl p-8 border border-slate-200/50 hover:border-blue-200 hover:shadow-lg transition-all duration-200">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-colors">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
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
    },
    {
      title: 'Restock in one tap',
      description: 'When an item is running out, just tap to record your next purchase. The AI updates its prediction instantly. Fast. Simple. Accurate.',
      image: '/images/landing/feature-restock.webp',
    },
    {
      title: 'Import your purchase history',
      description: 'Upload your Amazon order history or scan a receipt. Kirana extracts everything automatically. Share your household inventory with family. Everyone stays synced.',
      image: '/images/landing/feature-import.webp',
    },
  ];

  return (
    <section className="py-20 md:py-28 px-6 md:px-8 bg-slate-50/50">
      <div className="max-w-7xl mx-auto space-y-24 md:space-y-32">
        {showcases.map((showcase, index) => (
          <div
            key={index}
            className={`flex flex-col ${
              index % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'
            } gap-12 md:gap-16 items-center`}
          >
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                {showcase.title}
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                {showcase.description}
              </p>
              {index === showcases.length - 1 && (
                <Button
                  onClick={onGetStarted}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium mt-4"
                >
                  Start Free Trial
                </Button>
              )}
            </div>
            <div className="flex-1">
              <div className="relative rounded-2xl overflow-hidden shadow-xl border border-slate-200/50 bg-white p-2">
                <img
                  src={showcase.image}
                  srcSet={`${showcase.image.replace('.webp', '-600.webp')} 600w, ${showcase.image.replace('.webp', '-800.webp')} 800w, ${showcase.image}`}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  alt={showcase.title}
                  loading="lazy"
                  className="w-full rounded-lg"
                />
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
    <section className="py-20 md:py-28 px-6 md:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-3xl bg-gradient-to-br from-blue-600 to-blue-700 overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          
          {/* Content */}
          <div className="relative px-8 md:px-16 py-16 md:py-20 text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Ready to never run out again?
            </h2>
            <p className="text-lg md:text-xl text-blue-50 max-w-2xl mx-auto">
              Join smart households using AI to manage their groceries effortlessly.
            </p>
            <div className="pt-4">
              <Button
                onClick={onGetStarted}
                className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-6 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                Get Started Free
              </Button>
            </div>
            <p className="text-sm text-blue-100">
              No credit card required • Free forever
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
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="text-xl font-semibold text-slate-900">
              Kirana
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              AI-powered grocery intelligence for smart households.
            </p>
          </div>
          
          {/* Product */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Product</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="/features" className="text-slate-600 hover:text-blue-600 transition-colors">Features</a></li>
              <li><a href="/pricing" className="text-slate-600 hover:text-blue-600 transition-colors">Pricing</a></li>
              <li><a href="/demo" className="text-slate-600 hover:text-blue-600 transition-colors">Demo</a></li>
            </ul>
          </div>
          
          {/* Company */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Company</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="/about" className="text-slate-600 hover:text-blue-600 transition-colors">About</a></li>
              <li><a href="/blog" className="text-slate-600 hover:text-blue-600 transition-colors">Blog</a></li>
              <li><a href="/support" className="text-slate-600 hover:text-blue-600 transition-colors">Support</a></li>
            </ul>
          </div>
          
          {/* Legal */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Legal</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="/privacy" className="text-slate-600 hover:text-blue-600 transition-colors">Privacy Policy</a></li>
              <li><a href="/terms" className="text-slate-600 hover:text-blue-600 transition-colors">Terms of Service</a></li>
              <li><a href="/security" className="text-slate-600 hover:text-blue-600 transition-colors">Security</a></li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <div>© 2025 Kirana. All rights reserved.</div>
          <div className="flex items-center gap-1">
            Made with <span className="text-red-500">❤️</span> by Ved
          </div>
        </div>
      </div>
    </footer>
  );
};
