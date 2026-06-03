import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const INTRO_KEY = "suqaq_intro_seen";

const categories = [
  { icon: "🚗", name: "سيارات", color: "from-blue-400 to-blue-600" },
  { icon: "🏠", name: "عقارات", color: "from-emerald-400 to-emerald-600" },
  { icon: "📱", name: "إلكترونيات", color: "from-purple-400 to-purple-600" },
  { icon: "💼", name: "وظائف", color: "from-amber-400 to-amber-600" },
  { icon: "🔧", name: "خدمات", color: "from-rose-400 to-rose-600" },
];

export default function FirstVisitSessionIntro() {
  const [isVisible, setIsVisible] = useState(false);
  const [startExit, setStartExit] = useState(false);

  const finishIntro = useCallback(() => {
    setStartExit(true);
    // Give time for exit animation to play
    setTimeout(() => {
      setIsVisible(false);
      sessionStorage.setItem(INTRO_KEY, "true");
      document.body.style.overflow = "";
    }, 600);
  }, []);

  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem(INTRO_KEY);
    if (!hasSeenIntro) {
      setIsVisible(true);
      document.body.style.overflow = "hidden";

      // Auto-dismiss sequence
      // 0.0s: Start
      // 0.5s: Logo appears
      // 0.8s: Slogan appears
      // 1.2s: Categories appear
      // 2.8s: Start exit animation
      const timer = setTimeout(() => {
        finishIntro();
      }, 3200);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
      };
    }
  }, [finishIntro]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {!startExit && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white overflow-hidden"
        >
          {/* Enhanced Background with mesh-like gradients */}
          <div className="absolute inset-0 z-0 opacity-40">
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                x: [0, 50, 0],
                y: [0, 30, 0]
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-100 rounded-full blur-[120px]" 
            />
            <motion.div 
              animate={{ 
                scale: [1.2, 1, 1.2],
                x: [0, -40, 0],
                y: [0, -20, 0]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-100 rounded-full blur-[120px]" 
            />
          </div>

          <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-6">
            {/* Logo Section */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.7, 
                ease: [0.22, 1, 0.36, 1] 
              }}
              className="flex flex-col items-center gap-4 mb-8"
            >
              <div className="relative">
                <motion.div 
                  animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 bg-blue-400 blur-2xl rounded-full"
                />
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[28%] flex items-center justify-center shadow-2xl shadow-blue-500/30">
                  <svg className="w-12 h-12 sm:w-14 sm:h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
              </div>
              
              <div className="text-center">
                <motion.h1 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-5xl sm:text-6xl font-black tracking-tight bg-gradient-to-b from-blue-600 to-indigo-700 bg-clip-text text-transparent"
                >
                  سوقك
                </motion.h1>
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-[10px] font-bold text-blue-500/60 uppercase tracking-[0.3em] block mt-1"
                >
                  Beta Version
                </motion.span>
              </div>
            </motion.div>

            {/* Slogan with elegant line */}
            <div className="relative py-4 w-full flex flex-col items-center">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: 40 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="h-[2px] bg-blue-200 mb-4"
              />
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="text-gray-500 text-lg font-medium text-center leading-relaxed"
              >
                بيع، اشترِ، واعثر على <br/>
                <span className="text-blue-600 font-bold">كل ما تحتاجه</span>
              </motion.p>
            </div>

            {/* Floating Categories - Improved Circular Motion */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {categories.map((cat, index) => {
                const angle = (index / categories.length) * Math.PI * 2 - Math.PI / 2;
                const radius = 180;
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
                      delay: 1.2 + index * 0.15, 
                      duration: 0.8,
                      type: "spring",
                      stiffness: 100,
                      damping: 15
                    }}
                    className="absolute"
                  >
                    <motion.div
                      animate={{ 
                        y: [0, -10, 0],
                      }}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity, 
                        delay: index * 0.4,
                        ease: "easeInOut" 
                      }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-3xl shadow-xl shadow-gray-200 border-4 border-white transform rotate-3 hover:rotate-0 transition-transform`}>
                        {cat.icon}
                      </div>
                      <span className="text-[11px] font-bold text-gray-800 bg-white/90 px-3 py-1 rounded-full shadow-sm backdrop-blur-md border border-gray-100">
                        {cat.name}
                      </span>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Bottom Progress/Status */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
            className="absolute bottom-12 flex flex-col items-center gap-3"
          >
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div 
                  key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 bg-blue-500 rounded-full"
                />
              ))}
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              جاري تجهيز السوق...
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
