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
                duration: 0.8, 
                ease: [0.22, 1, 0.36, 1] 
              }}
              className="flex flex-col items-center gap-6 mb-8"
            >
              <div className="relative">
                {/* Enhanced Glow Effect */}
                <motion.div 
                  animate={{ 
                    scale: [1, 1.1, 1], 
                    opacity: [0.3, 0.6, 0.3],
                    rotate: [0, 90, 180, 270, 360]
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-20%] bg-gradient-to-tr from-brand-400/30 to-brand-600/30 blur-3xl rounded-full"
                />
                
                {/* Main Logo */}
                <div className="relative group">
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <img 
                      src="/opening-logo.svg" 
                      alt="سوقك" 
                      className="h-24 sm:h-32 w-auto object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
                    />
                  </motion.div>
                </div>
              </div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75, duration: 0.7 }}
                className="text-center text-lg font-black tracking-wide text-brand-700 sm:text-xl"
              >
                سوق اليمن بين يديك
              </motion.p>
            </motion.div>

            {/* Slogan with elegant line */}
            <div className="relative py-4 w-full flex flex-col items-center">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: 60 }}
                transition={{ delay: 0.7, duration: 1 }}
                className="h-[3px] bg-brand-200 rounded-full mb-6"
              />
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.8 }}
                className="text-gray-600 text-xl font-medium text-center leading-relaxed"
              >
                بيع، اشترِ، واعثر على <br/>
                <span className="text-brand-600 font-black text-2xl mt-1 block">كل ما تحتاجه</span>
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
