import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { signInWithRedirect } from '../services/authService';
import { Button } from '../components/ui/button';
import { Loader2 } from 'lucide-react';

export const LandingPage = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const navigate = useNavigate();

  // Auto-redirect authenticated users to dashboard
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
    <div className="landing-page">
      {/* Hero Section */}
      <HeroSection onGetStarted={handleGetStarted} onSignIn={handleGetStarted} />
      
      {/* Feature Sections */}
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
      
      {/* Final CTA Section */}
      <CTASection onGetStarted={handleGetStarted} />
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

// Hero Section Component
const HeroSection = ({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) => {
  return (
    <section className="hero-section min-h-screen flex flex-col justify-center items-center bg-white px-6 pt-20 pb-28 md:px-20 lg:px-32">
      {/* Fixed Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32 h-16 flex items-center justify-between">
          <div className="text-2xl font-bold text-gray-900">KIRANA</div>
          <Button
            variant="ghost"
            onClick={onSignIn}
            className="text-sm font-medium"
          >
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="flex flex-col items-center text-center max-w-[1400px] w-full mt-16">
        {/* Headline */}
        <h1 className="text-hero font-bold text-gray-900 leading-tight tracking-tight mb-6">
          Never run out of your essentials.
        </h1>
        
        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-gray-600 leading-relaxed max-w-[600px] mb-12">
          Smart predictions that learn your household's rhythm.
        </p>
        
        {/* CTA Button */}
        <Button
          size="lg"
          onClick={onGetStarted}
          className="min-w-[280px] h-14 text-lg font-semibold bg-brand-blue hover:bg-brand-blue/90 transition-transform hover:scale-105"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 23 23" fill="currentColor">
            <path d="M11.5 0C5.159 0 0 5.159 0 11.5S5.159 23 11.5 23 23 17.841 23 11.5 17.841 0 11.5 0zm5.313 15.531c-.248.621-.87 1.026-1.556 1.026-.19 0-.384-.033-.573-.103l-7.094-2.625a1.78 1.78 0 01-1.103-1.103L4.121 5.632c-.213-.574-.027-1.216.458-1.58a1.58 1.58 0 011.767-.165l7.094 2.625c.494.183.882.571 1.065 1.065l2.625 7.094c.136.367.123.774-.036 1.132-.159.358-.438.646-.781.728z"/>
          </svg>
          Get Started with Microsoft
        </Button>
        
        {/* Product Screenshot */}
        <div className="mt-16 w-full max-w-[1200px]">
          <img
            src="/images/landing/hero-screenshot.webp"
            srcSet="/images/landing/hero-screenshot-600.webp 600w, /images/landing/hero-screenshot-800.webp 800w, /images/landing/hero-screenshot-1200.webp 1200w"
            sizes="(max-width: 768px) 600px, (max-width: 1280px) 800px, 1200px"
            alt="Inventory view showing milk, eggs, and bread with color-coded run-out predictions"
            loading="eager"
            className="w-full rounded-2xl shadow-hero"
          />
        </div>
      </div>
    </section>
  );
};

// Feature Section Component (Reusable)
interface FeatureSectionProps {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  reversed: boolean;
}

const FeatureSection = ({ title, description, imageSrc, imageAlt, reversed }: FeatureSectionProps) => {
  return (
    <section className={`section-padding ${reversed ? 'bg-white' : 'bg-gray-50'}`}>
      <div className={`max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${reversed ? 'lg:grid-flow-dense' : ''}`}>
        {/* Image */}
        <div className={`${reversed ? 'lg:col-start-2' : ''}`}>
          <img
            src={imageSrc}
            srcSet={`${imageSrc.replace('.webp', '-600.webp')} 600w, ${imageSrc.replace('.webp', '-800.webp')} 800w, ${imageSrc}`}
            sizes="(max-width: 768px) 600px, (max-width: 1024px) 800px, 1000px"
            alt={imageAlt}
            loading="lazy"
            className="w-full rounded-2xl shadow-lg parallax-image"
          />
        </div>
        
        {/* Text Content */}
        <div className={`${reversed ? 'lg:col-start-1 lg:row-start-1' : ''} max-w-[500px] ${reversed ? 'lg:ml-auto' : ''}`}>
          <h2 className="text-feature font-bold text-gray-900 leading-tight mb-6">
            {title}
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
};

// CTA Section Component
const CTASection = ({ onGetStarted }: { onGetStarted: () => void }) => {
  return (
    <section className="py-40 px-6 md:px-20 lg:px-32 bg-linear-to-br from-brand-blue to-blue-600 text-white text-center">
      <div className="max-w-[800px] mx-auto">
        <h2 className="text-4xl md:text-5xl lg:text-[56px] font-bold leading-tight mb-4">
          Start tracking your essentials.
        </h2>
        <p className="text-xl text-white/90 mb-12">
          It's free. Forever.
        </p>
        <Button
          size="lg"
          onClick={onGetStarted}
          className="min-w-[280px] h-14 text-lg font-semibold bg-white text-brand-blue hover:bg-gray-50 transition-transform hover:scale-105"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 23 23" fill="currentColor">
            <path d="M11.5 0C5.159 0 0 5.159 0 11.5S5.159 23 11.5 23 23 17.841 23 11.5 17.841 0 11.5 0zm5.313 15.531c-.248.621-.87 1.026-1.556 1.026-.19 0-.384-.033-.573-.103l-7.094-2.625a1.78 1.78 0 01-1.103-1.103L4.121 5.632c-.213-.574-.027-1.216.458-1.58a1.58 1.58 0 011.767-.165l7.094 2.625c.494.183.882.571 1.065 1.065l2.625 7.094c.136.367.123.774-.036 1.132-.159.358-.438.646-.781.728z"/>
          </svg>
          Get Started with Microsoft
        </Button>
      </div>
    </section>
  );
};

// Footer Component
const Footer = () => {
  return (
    <footer className="py-16 px-6 md:px-20 lg:px-32 bg-gray-50 text-center">
      <div className="max-w-[1400px] mx-auto">
        <div className="text-2xl font-bold text-gray-900 mb-6">KIRANA</div>
        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600 mb-4">
          <a href="/privacy" className="hover:text-brand-blue transition-colors hover:underline">
            Privacy Policy
          </a>
          <span className="text-gray-400">•</span>
          <a href="/terms" className="hover:text-brand-blue transition-colors hover:underline">
            Terms of Service
          </a>
          <span className="text-gray-400">•</span>
          <a href="/support" className="hover:text-brand-blue transition-colors hover:underline">
            Support
          </a>
        </div>
        <div className="text-sm text-gray-500">
          Made with ❤️ by Ved
        </div>
        <div className="text-sm text-gray-400 mt-2">
          © 2025 Kirana
        </div>
      </div>
    </footer>
  );
};
