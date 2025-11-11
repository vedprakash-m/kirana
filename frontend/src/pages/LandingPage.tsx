import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { signInWithRedirect } from '../services/authService';
import { Button } from '../components/ui/button';
import { Loader2 } from 'lucide-react';

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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="landing-page min-h-screen bg-white">
      <HeroSection onGetStarted={handleGetStarted} onSignIn={handleGetStarted} />
      
      <FeatureSection
        title="Know before you run out."
        description="Our AI learns your household's shopping patterns and predicts when you'll run out of each item. No manual tracking. No guesswork. Just smart predictions."
        imageSrc="/images/landing/feature-predictions.webp"
        imageAlt="Prediction timeline graph showing AI-powered consumption patterns"
        reversed={false}
      />
      
      <FeatureSection
        title="Restock in one tap."
        description="When an item is running out, just tap to record your next purchase. The AI updates its prediction instantly. Fast. Simple. Accurate."
        imageSrc="/images/landing/feature-restock.webp"
        imageAlt="Item card showing one-tap restock button with instant prediction update"
        reversed={true}
      />
      
      <FeatureSection
        title="Import your purchase history."
        description="Upload your Amazon order history or scan a receipt. Kirana extracts everything automatically. Share your household inventory with family. Everyone stays synced."
        imageSrc="/images/landing/feature-import.webp"
        imageAlt="CSV upload interface showing automatic parsing progress"
        reversed={false}
      />
      
      <CTASection onGetStarted={handleGetStarted} />
      <Footer />
    </div>
  );
};

const HeroSection = ({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) => {
  return (
    <section className="relative min-h-screen flex flex-col bg-linear-to-b from-white to-gray-50">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 h-20 flex items-center justify-between">
          <div className="text-2xl font-bold bg-linear-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
            KIRANA
          </div>
          <Button
            variant="ghost"
            onClick={onSignIn}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-6 py-2 rounded-full transition-all"
          >
            Sign In
          </Button>
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 md:px-8 lg:px-12 pt-32 pb-20">
        <div className="max-w-5xl mx-auto space-y-8">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight tracking-tight">
            Never run out of your{' '}
            <span className="bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              essentials
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
            Smart predictions that learn your household's rhythm
          </p>
          
          <div className="pt-4">
            <Button
              size="lg"
              onClick={onGetStarted}
              className="group relative min-w-[280px] h-14 text-lg font-semibold bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-full"
            >
              <span className="flex items-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 23 23" fill="currentColor">
                  <path d="M11.5 0C5.159 0 0 5.159 0 11.5S5.159 23 11.5 23 23 17.841 23 11.5 17.841 0 11.5 0zm5.313 15.531c-.248.621-.87 1.026-1.556 1.026-.19 0-.384-.033-.573-.103l-7.094-2.625a1.78 1.78 0 01-1.103-1.103L4.121 5.632c-.213-.574-.027-1.216.458-1.58a1.58 1.58 0 011.767-.165l7.094 2.625c.494.183.882.571 1.065 1.065l2.625 7.094c.136.367.123.774-.036 1.132-.159.358-.438.646-.781.728z"/>
                </svg>
                Get Started with Microsoft
              </span>
            </Button>
            <p className="text-sm text-gray-500 mt-4">Free forever • No credit card required</p>
          </div>
        </div>
        
        <div className="mt-16 w-full max-w-6xl mx-auto">
          <div className="relative rounded-2xl shadow-2xl overflow-hidden bg-white p-2">
            <img
              src="/images/landing/hero-screenshot.webp"
              srcSet="/images/landing/hero-screenshot-600.webp 600w, /images/landing/hero-screenshot-800.webp 800w, /images/landing/hero-screenshot-1200.webp 1200w"
              sizes="(max-width: 768px) 600px, (max-width: 1280px) 800px, 1200px"
              alt="Inventory view showing milk, eggs, and bread with color-coded run-out predictions"
              loading="eager"
              className="w-full rounded-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

interface FeatureSectionProps {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  reversed: boolean;
}

const FeatureSection = ({ title, description, imageSrc, imageAlt, reversed }: FeatureSectionProps) => {
  return (
    <section className={`py-24 md:py-32 px-6 md:px-8 lg:px-12 ${reversed ? 'bg-white' : 'bg-gray-50'}`}>
      <div className={`max-w-7xl mx-auto flex flex-col gap-12 md:gap-16 lg:gap-20 ${reversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center`}>
        <div className="flex-1 space-y-6">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight tracking-tight">
            {title}
          </h2>
          <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-xl">
            {description}
          </p>
        </div>
        
        <div className="flex-1 w-full">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-white p-2">
            <img
              src={imageSrc}
              srcSet={`${imageSrc.replace('.webp', '-600.webp')} 600w, ${imageSrc.replace('.webp', '-800.webp')} 800w, ${imageSrc}`}
              sizes="(max-width: 768px) 600px, (max-width: 1024px) 800px, 1000px"
              alt={imageAlt}
              loading="lazy"
              className="w-full rounded-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

const CTASection = ({ onGetStarted }: { onGetStarted: () => void }) => {
  return (
    <section className="relative py-32 md:py-40 px-6 md:px-8 lg:px-12 bg-linear-to-br from-blue-600 via-blue-700 to-purple-700 overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}></div>
      </div>
      
      <div className="relative max-w-4xl mx-auto text-center space-y-8">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
          Start tracking your essentials
        </h2>
        <p className="text-xl md:text-2xl text-white/90 leading-relaxed">
          Free forever. No credit card required.
        </p>
        <div className="pt-4">
          <Button
            size="lg"
            onClick={onGetStarted}
            className="group min-w-[280px] h-14 text-lg font-semibold bg-white text-blue-700 hover:bg-gray-50 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 rounded-full"
          >
            <span className="flex items-center gap-3">
              <svg className="w-5 h-5" viewBox="0 0 23 23" fill="currentColor">
                <path d="M11.5 0C5.159 0 0 5.159 0 11.5S5.159 23 11.5 23 23 17.841 23 11.5 17.841 0 11.5 0zm5.313 15.531c-.248.621-.87 1.026-1.556 1.026-.19 0-.384-.033-.573-.103l-7.094-2.625a1.78 1.78 0 01-1.103-1.103L4.121 5.632c-.213-.574-.027-1.216.458-1.58a1.58 1.58 0 011.767-.165l7.094 2.625c.494.183.882.571 1.065 1.065l2.625 7.094c.136.367.123.774-.036 1.132-.159.358-.438.646-.781.728z"/>
              </svg>
              Get Started with Microsoft
            </span>
          </Button>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="py-20 px-6 md:px-8 lg:px-12 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 pb-8 border-b border-gray-200">
          <div className="text-3xl font-bold bg-linear-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
            KIRANA
          </div>
          <nav className="flex flex-wrap gap-8 text-sm">
            <a href="/privacy" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
              Privacy Policy
            </a>
            <a href="/terms" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
              Terms of Service
            </a>
            <a href="/support" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
              Support
            </a>
          </nav>
        </div>
        
        <div className="pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-gray-500">
          <div>© 2025 Kirana. All rights reserved.</div>
          <div className="flex items-center gap-1">
            Made with <span className="text-red-500">❤️</span> by Ved
          </div>
        </div>
      </div>
    </footer>
  );
};
