import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useBrokerageStatus } from '../store/BrokerageStatusContext';

const HowItWorks = () => {
  const [activeTab, setActiveTab] = useState('buyer');
  const navigate = useNavigate();
  const { enabled: brokerageEnabled, loading: brokerageLoading } = useBrokerageStatus();

  useEffect(() => {
    if (!brokerageLoading && !brokerageEnabled && activeTab === 'reseller') {
      setActiveTab('buyer');
    }
  }, [brokerageEnabled, brokerageLoading, activeTab]);

  const tabs = [
    { id: 'buyer', label: 'أنا مشترٍ', icon: '🛒' },
    { id: 'seller', label: 'أنا بائع', icon: '🏪' },
    ...(brokerageEnabled ? [{ id: 'reseller', label: 'أنا مسوق', icon: '🚀' }] : []),
  ];

  const content = {
    buyer: {
      title: 'رحلة الشراء الآمن',
      steps: [
        { title: 'ابحث عن طلبك', desc: 'استخدم محرك البحث المتقدم وفلترة العملات للوصول بدقة لما تحتاجه.', icon: '🔍' },
        { title: 'تواصل مع البائع', desc: 'استفسر عن التفاصيل عبر نظام المحادثات المباشر والآمن.', icon: '💬' },
        { title: 'ادفع بضمان سوقك', desc: 'حول المبلغ لحساب الوساطة الخاص بنا؛ أموالك في أمان حتى تستلم المنتج.', icon: '🛡️' },
        { title: 'استلم وأكد', desc: 'بعد فحص المنتج وتأكيد الاستلام، نقوم نحن بتحويل المبلغ للبائع.', icon: '📦' },
      ],
      faq: [
        { q: 'ماذا لو لم يصلني المنتج؟', a: 'يمكنك فتح نزاع وسيقوم فريق الإدارة بالتحقق وإعادة أموالك فوراً.' },
        { q: 'هل هناك عمولة على المشتري؟', a: 'نعم، تضاف عمولة رمزية قدرها 3% من قيمة المنتج كرسوم لخدمة "الشراء الآمن" والوساطة لضمان حقك.' },
      ]
    },
    seller: {
      title: 'بع بذكاء وأمان',
      steps: [
        { title: 'أضف إعلانك', desc: 'ارفع صور منتجك، حدد السعر والعملة، وانشر إعلانك مجاناً.', icon: '📢' },
        { title: 'وثق حسابك', desc: 'ارفع هويتك لزيادة ثقة المشترين والحصول على شارة "بائع موثوق".', icon: '✅' },
        { title: 'اشحن الطلب', desc: 'عند إبلاغك بدفع المشتري، قم بشحن المنتج وتزويدنا ببيانات الشحن.', icon: '🚚' },
        { title: 'استلم أرباحك', desc: 'بعد استلام المشتري، يضاف الرصيد لمحفظتك ويمكنك سحبه بالعملة التي تفضلها.', icon: '💰' },
      ],
      faq: [
        { q: 'متى يتحرر الرصيد المعلق؟', a: 'يتحول الرصيد من معلق إلى متاح فور تأكيد المشتري للاستلام أو بعد مرور فترة الضمان.' },
        { q: 'كيف أسحب أرباحي؟', a: 'عبر طلب سحب من المحفظة، وسيصلك المبلغ لحسابك البنكي خلال 24 ساعة.' },
      ]
    },
    reseller: {
      title: 'حقق أرباحاً كمسوق',
      steps: [
        { title: 'اختر الحملات', desc: 'تصفح حملات الوساطة المتاحة واختر المنتجات التي تناسب جمهورك.', icon: '🎯' },
        { title: 'انضم إلى الحملة', desc: 'انضم إلى الحملة: إما تلقائياً أو بعد موافقة البائع على طلبك.', icon: '✅' },
        { title: 'شارك رابطك', desc: 'شارك رابط الوساطة الفريد أو استخدم كود التوصية الخاص بك.', icon: '🔗' },
        { title: 'اربح عمولتك', desc: 'عند إتمام أي عملية بيع من خلال رابطك، تضاف عمولتك تلقائياً لمحفظتك.', icon: '📈' },
      ],
      faq: [
        { q: 'هل أحتاج لامتلاك المنتج؟', a: 'لا، أنت تسوق لمنتجات الآخرين، والبائع الأصلي هو من يتكفل بالشحن والتوصيل.' },
        { q: 'ماذا لو كانت الحملة موافقة يدوية؟', a: 'سترى حالة طلبك في صفحة عضوياتك، وسيتم إشعارك فور موافقة أو رفض طلبك.' },
        { q: 'كيف أعرف أرباحي؟', a: 'ستظهر لك تقارير مفصلة في صفحة إنجازاتك للوساطة لكل عملية بيع ناجحة.' },
      ]
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-20 overflow-x-hidden">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 pt-16 pb-28 px-4 text-center text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl"></div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10"
        >
          <span className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-blue-100 mb-6 border border-white/10 uppercase tracking-wider">
            دليلك الشامل للمنصة
          </span>
          <h1 className="text-4xl sm:text-6xl font-black mb-6 leading-tight">
            كيف يعمل <span className="text-blue-300">سوقك؟</span>
          </h1>
          <p className="text-blue-100 text-base sm:text-xl max-w-3xl mx-auto font-medium leading-relaxed px-4">
            نحن هنا لنبني جسراً من الثقة بين البائع والمشتري في اليمن. اكتشف رحلتك معنا سواء كنت تشتري، تبيع، أو تسوق.
          </p>
        </motion.div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-12 relative z-20">
        {/* Tabs - Mobile Optimized */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] p-2 shadow-2xl border border-white/20 dark:border-slate-800 mb-12 flex flex-col sm:flex-row gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-3 py-4 sm:py-5 rounded-3xl font-black text-sm sm:text-base transition-all duration-300 ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30 scale-[1.02]' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-xl sm:text-2xl">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-16"
          >
            {/* Title Section */}
            <div className="text-center space-y-4">
              <motion.div 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="inline-block p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-2"
              >
                <span className="text-3xl">{tabs.find(t => t.id === activeTab).icon}</span>
              </motion.div>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white">
                {content[activeTab].title}
              </h2>
              <div className="w-24 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto rounded-full"></div>
            </div>

            {/* Steps Grid - Fully Responsive */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {content[activeTab].steps.map((step, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-xl shadow-gray-200/50 dark:shadow-none hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors"></div>
                  
                  <div className="relative z-10">
                    <div className="text-5xl mb-6 bg-gray-50 dark:bg-slate-800 w-20 h-20 flex items-center justify-center rounded-[2rem] shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500">
                      {step.icon}
                    </div>
                    
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-black">
                        {idx + 1}
                      </span>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                        {step.title}
                      </h3>
                    </div>
                    
                    <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Trust Badges / Why Us? */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-8">
              {[
                { label: 'أمان تام', icon: '🛡️' },
                { label: 'وساطة مضمونة', icon: '🤝' },
                { label: 'دعم فني 24/7', icon: '📞' },
                { label: 'عملات متعددة', icon: '💰' }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-2 p-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm rounded-3xl border border-white/50 dark:border-slate-800">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs font-black text-gray-600 dark:text-gray-300">{item.label}</span>
                </div>
              ))}
            </div>

            {/* FAQ Section - Modern Design */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[3.5rem] p-8 sm:p-16 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
              
              <div className="relative z-10">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-12 gap-6">
                  <h3 className="text-2xl sm:text-3xl font-black flex items-center gap-4">
                    <span className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-xl">❓</span>
                    أسئلة شائعة
                  </h3>
                  <p className="text-blue-100 font-medium text-center sm:text-right">كل ما تود معرفته عن {tabs.find(t => t.id === activeTab).label}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
                  {content[activeTab].faq.map((item, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.2 }}
                      className="bg-white/10 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/10 hover:bg-white/15 transition-colors"
                    >
                      <h4 className="font-black text-lg mb-4 flex items-start gap-3">
                        <span className="text-blue-300 mt-1">●</span>
                        {item.q}
                      </h4>
                      <p className="text-sm sm:text-base text-blue-50 font-medium leading-relaxed pr-6 border-r-2 border-blue-400/30 mr-2">
                        {item.a}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA - Call to Action */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="text-center py-10"
            >
              <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-[3.5rem] shadow-2xl border border-gray-100 dark:border-slate-800">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">هل أنت جاهز للبدء؟</h3>
                <p className="text-gray-500 dark:text-gray-400 font-medium mb-8">انضم إلى آلاف المستخدمين في أكبر منصة تجارة إلكترونية آمنة في اليمن.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button 
                    onClick={() => navigate('/register')}
                    className="w-full sm:w-auto px-10 py-5 bg-blue-600 text-white rounded-full font-black text-lg shadow-xl shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all"
                  >
                    ابدأ الآن مجاناً
                  </button>
                  <button 
                    onClick={() => navigate('/')}
                    className="w-full sm:w-auto px-10 py-5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-white rounded-full font-black text-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
                  >
                    تصفح الإعلانات
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HowItWorks;