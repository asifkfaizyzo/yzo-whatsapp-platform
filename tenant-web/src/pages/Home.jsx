import Navbar from "../components/landing/layout/Navbar";
import Footer from "../components/landing/layout/Footer";
import HeroSection from "../components/landing/home/HeroSection";
import TrustBar      from "../components/landing/home/TrustBar";
import QuickFeatures from "../components/landing/home/QuickFeatures";
import CTABanner     from "../components/landing/home/CTABanner";

export default function Home() {
  return (
    <div>
      <Navbar />
      <HeroSection />
       <TrustBar />
      <QuickFeatures />
      <CTABanner />
      <Footer />
    </div>
  );
}