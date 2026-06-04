import React, { useState, useEffect } from 'react';

const CountdownTimer = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function calculateTimeLeft() {
    const difference = +new Date(endDate) - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate]);

  const timerComponents = [];

  Object.keys(timeLeft).forEach((interval) => {
    if (!timeLeft[interval] && interval !== 'seconds' && interval !== 'minutes') {
      return;
    }

    const labels = {
      days: 'يوم',
      hours: 'ساعة',
      minutes: 'دقيقة',
      seconds: 'ثانية'
    };

    timerComponents.push(
      <div key={interval} className="flex flex-col items-center px-2 py-1 bg-white/10 rounded-lg backdrop-blur-sm min-w-[50px]">
        <span className="text-lg font-black leading-none">{timeLeft[interval]}</span>
        <span className="text-[10px] font-bold opacity-70">{labels[interval]}</span>
      </div>
    );
  });

  if (timerComponents.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-2 py-3 px-4 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl text-white shadow-lg shadow-orange-200/50">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider">
        <span className="animate-pulse">⚡</span>
        ينتهي العرض خلال
      </div>
      <div className="flex items-center gap-1.5">
        {timerComponents}
      </div>
    </div>
  );
};

export default CountdownTimer;
