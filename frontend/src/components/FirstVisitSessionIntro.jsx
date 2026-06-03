import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const INTRO_KEY = "suqaq_intro_seen";

const categories = [
  { icon: "🚗", name: "سيارات", color: "bg-blue-500" },
  { icon: "🏠", name: "عقارات", color: "bg-green-500" },
  { icon: "📱", name: "إلكترونيات", color: "bg-purple-500" },
  { icon: "💼", name: "وظائف", color: "bg-orange-500" },
  { icon: "🔧", name: "خدمات", color: "bg-red-500" },
];

export default function FirstVisitSessionIntro() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem(INTRO_KEY);
    if (!hasSeenIntro) {
      setIsVisible(true);
      // Disable scrolling
      document.body.style.overflow = "hidden";
    }
  }, []);

  const handleAnimationComplete = () => {
    setIsVisible(false);
    sessionStorage.setItem(INTRO_KEY, "true");
    // Restore scrolling
    document.body.style.overflow = "";
  };

  // Total duration logic:
  // Logo: 0.5s
  // Text: 0.3s (delay 0.5)
  // Categories: 1s (delay 0.8)
  // Exit: 0.4s
  // Total: ~2.5s - 3s

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white overflow-hidden"
          onAnimationComplete={(definition) => {
            if (definition === "exit") {
              handleAnimationComplete();
            }
          }}
        >
          {/* Background Gradient Elements */}
          <div className="absolute inset-0 z-0">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
              className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-50 rounded-full blur-3xl -mr-64 -mt-64" 
            />
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-50 rounded-full blur-3xl -ml-64 -mb-64" 
            />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            {/* Logo Section */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                duration: 0.5, 
                ease: [0.34, 1.56, 0.64, 1] // Spring-like effect
              }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  سوقك
                </span>
                <span className="text-xs font-bold text-blue-500 uppercase tracking-widest mt-1">
                  نسخة تجريبية
                </span>
              </div>
            </motion.div>

            {/* Slogan */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-gray-500 text-lg sm:text-xl font-medium text-center"
            >
              بيع، اشترِ، واعثر على كل ما تحتاجه
            </motion.p>

            {/* Floating Categories */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {categories.map((cat, index) => {
                // Circular layout calculation
                const angle = (index / categories.length) * Math.PI * 2;
                const radius = 160; // Distance from center
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                return (
                  <motion.div
                    key={cat.name}
                    initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                    animate={{ 
                      scale: 1, 
                      opacity: 1, 
                      x: x, 
                      y: y,
                    }}
                    transition={{ 
                      delay: 0.8 + index * 0.1, 
                      duration: 0.6,
                      ease: "easeOut"
                    }}
                    className="absolute"
                  >
                    <motion.div
                      animate={{ 
                        // Final movement effect towards "natural positions" 
                        // (simplified as moving further out and fading)
                        scale: [1, 1.1, 0.5],
                        opacity: [1, 1, 0],
                        x: x * 2,
                        y: y * 2,
                      }}
                      transition={{ 
                        delay: 2.2, 
                        duration: 0.8, 
                        ease: "easeInOut" 
                      }}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className={`w-14 h-14 rounded-full ${cat.color} flex items-center justify-center text-2xl shadow-lg shadow-gray-200 border-4 border-white`}>
                        {cat.icon}
                      </div>
                      <span className="text-xs font-bold text-gray-700 bg-white/80 px-2 py-0.5 rounded-full backdrop-blur-sm">
                        {cat.name}
                      </span>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            {/* Progress indicator (optional but adds professional feel) */}
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5, duration: 2.2, ease: "linear" }}
              className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 origin-left"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
