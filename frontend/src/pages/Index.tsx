
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Index = () => {
  const [showContent, setShowContent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleGetStarted = () => {
    navigate('/role-selection');
  };

  return (
    <div className="min-h-screen flex items-center justify-center roomzi-gradient">
      <div className="text-center text-white px-6">
        <div className="animate-fade-in">
          <h1 className="text-6xl font-bold mb-4 tracking-tight">
            Room<span className="text-yellow-300">zi</span>
          </h1>
          <p className="text-xl mb-8 opacity-90">
            Connect landlords and tenants seamlessly
          </p>
        </div>
        
        {showContent && (
          <div className="animate-slide-up">
            <p className="text-lg mb-8 opacity-80 max-w-md mx-auto">
              Whether you're looking for the perfect room or listing your property, 
              Roomzi makes it simple and secure.
            </p>
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-white text-roomzi-blue hover:bg-gray-100 font-semibold px-8 py-3 text-lg rounded-full shadow-lg transform transition-all duration-200 hover:scale-105"
            >
              Get Started
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
