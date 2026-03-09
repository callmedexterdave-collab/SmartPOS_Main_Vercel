import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const AdminDashboard: React.FC = () => {
  const [, setLocation] = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [hasViewedAll, setHasViewedAll] = useState(false);
  const { user } = useAuth();

  const features = [
    {
      image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
      title: "Offline POS",
      description: "Hindi na kailangan ng internet para makapag record ng sales at i-manage ang inventory mo."
    },
    {
      image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
      title: "User Friendly",
      description: "Madaling gamitin para sa lahat. Simple at malinaw na interface."
    },
    {
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
      title: "Smart Inventory",
      description: "Automatic na pag-update ng stock. Hindi na kailangan mag-manual count."
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = (prev + 1) % features.length;
        if (next === 0 && prev === features.length - 1) {
          setHasViewedAll(true);
        }
        return next;
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [features.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    if (index === features.length - 1) {
      setHasViewedAll(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gray-50"
    >
      {/* Header */}
      <div className="bg-[#3B6C7D] text-white p-6 rounded-b-3xl">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <h1 className="text-2xl font-bold mb-2">Welcome {user?.businessName || 'Kanegosyo'}!</h1>
          <p className="text-[#D89D9D]">Manage your business with ease</p>
        </motion.div>
      </div>
      
      {/* Feature Carousel */}
      <div className="p-6">
        <div className="relative mb-6">
          <div className="overflow-hidden rounded-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-2xl shadow-lg p-6"
              >
                <img
                  src={features[currentSlide].image}
                  alt={features[currentSlide].title}
                  className="w-full h-40 object-cover rounded-xl mb-4"
                />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  {features[currentSlide].title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {features[currentSlide].description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
          
          {/* Manual Navigation */}
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => goToSlide(Math.max(0, currentSlide - 1))}
              disabled={currentSlide === 0}
              data-testid="button-prev-slide"
              className="p-2 rounded-full bg-gray-200 disabled:opacity-50 touch-feedback"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            {/* Carousel Indicators */}
            <div className="flex space-x-2">
              {features.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  data-testid={`button-slide-${index}`}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentSlide ? 'bg-[#FF8882]' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            
            <button
              onClick={() => goToSlide(Math.min(features.length - 1, currentSlide + 1))}
              disabled={currentSlide === features.length - 1}
              data-testid="button-next-slide"
              className="p-2 rounded-full bg-gray-200 disabled:opacity-50 touch-feedback"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <Button
          onClick={() => setLocation('/admin-main')}
          data-testid="button-continue"
          className="w-full p-4 rounded-xl font-semibold shadow-lg touch-feedback bg-[#FF8882] text-white hover:bg-[#D89D9D]"
          style={{
            boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)',
          }}
        >
          Continue to Dashboard
        </Button>
      </div>
    </motion.div>
  );
};

export default AdminDashboard;
