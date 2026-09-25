import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// Components
import ScrollToTop from "./components/ScrollToTop.jsx";
import WelcomePromotionSummary from "./components/WelcomePromotionSummary.jsx";
import FirstVisitSessionIntro from "./components/FirstVisitSessionIntro.jsx";
import AppOpeningIntro from "./components/AppOpeningIntro.jsx";
import SupportChatFAB from "./components/SupportChatFAB.jsx";
import OnboardingTour from "./components/OnboardingTour.jsx";
import LoadingSpinner from "./components/LoadingSpinner.jsx";
import RouteErrorBoundary from "./components/RouteErrorBoundary.jsx";
import PushSubscriptionManager from "./components/PushSubscriptionManager.jsx";
import MainLayout from "./layouts/MainLayout.jsx";
import AuthLayout from "./layouts/AuthLayout.jsx";
import AdminLayout from "./pages/AdminLayout.jsx";
import { useAuth } from "./store/AuthContext.jsx";
import { useBrokerageStatus } from "./store/BrokerageStatusContext.jsx";
import { AD_COMMISSION_ENABLED } from "./config/commission.js";
import { IS_MAINTENANCE } from "./config/maintenance.js";
import Logo from "./components/Logo.jsx";

// Pages
const Home = lazy(() => import("./pages/Home.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));
const PhoneForgotPassword = lazy(() => import("./pages/PhoneForgotPassword.jsx"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard.jsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.jsx"));
const AdminAds = lazy(() => import("./pages/AdminAds.jsx"));
const AdminManagedSellerAd = lazy(() => import("./pages/AdminManagedSellerAd.jsx"));
const AdminManagedSellers = lazy(() => import("./pages/AdminManagedSellers.jsx"));
const AdminUsers = lazy(() => import("./pages/AdminUsers.jsx"));
const AdminSupervisors = lazy(() => import("./pages/AdminSupervisors.jsx"));
const AdminGovernorates = lazy(() => import("./pages/AdminGovernorates.jsx"));
const AdminCities = lazy(() => import("./pages/AdminCities.jsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.jsx"));
const AddProduct = lazy(() => import("./pages/AddProduct.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail.jsx"));
const Terms = lazy(() => import("./pages/Terms.jsx"));
const Privacy = lazy(() => import("./pages/Privacy.jsx"));
const RefundEscrow = lazy(() => import("./pages/RefundEscrow.jsx"));
const Chat = lazy(() => import("./pages/Chat.jsx"));
const Pricing = lazy(() => import("./pages/Pricing.jsx"));
const MyAds = lazy(() => import("./pages/MyAds.jsx"));
const Messages = lazy(() => import("./pages/Messages.jsx"));
const Notifications = lazy(() => import("./pages/Notifications.jsx"));
const EditAd = lazy(() => import("./pages/EditAd.jsx"));
const SellerPublic = lazy(() => import("./pages/SellerPublic.jsx"));
const Favorites = lazy(() => import("./pages/Favorites.jsx"));
const Following = lazy(() => import("./pages/Following.jsx"));
const AdminReports = lazy(() => import("./pages/AdminReports.jsx"));
const AdminAuditLogs = lazy(() => import("./pages/AdminAuditLogs.jsx"));
const AdminTags = lazy(() => import("./pages/AdminTags.jsx"));
const TagPage = lazy(() => import("./pages/TagPage.jsx"));
const AdminCategories = lazy(() => import("./pages/AdminCategories.jsx"));
const CategoryPage = lazy(() => import("./pages/CategoryPage.jsx"));
const SearchResults = lazy(() => import("./pages/SearchResults.jsx"));
const SellerFeaturedAd = lazy(() => import("./pages/SellerFeaturedAd.jsx"));
const SellerVerification = lazy(() => import("./pages/SellerVerification.jsx"));
const Categories = lazy(() => import("./pages/Categories.jsx"));
const AdminPlans = lazy(() => import("./pages/AdminPlans.jsx"));
const AdminBankAccounts = lazy(() => import("./pages/AdminBankAccounts.jsx"));
const AdminFinanceHub = lazy(() => import("./pages/AdminFinanceHub.jsx"));
const AdminFeaturedRequests = lazy(() => import("./pages/AdminFeaturedRequests.jsx"));
const AdminVerificationRequests = lazy(() => import("./pages/AdminVerificationRequests.jsx"));
const SellerSubscriptions = lazy(() => import("./pages/SellerSubscriptions.jsx"));
const AdminPhoneUsers = lazy(() => import("./pages/AdminPhoneUsers.jsx"));
const AdminPasswordResetRequests = lazy(() => import("./pages/AdminPasswordResetRequests.jsx"));
const SetNewPassword = lazy(() => import("./pages/SetNewPassword.jsx"));
const ChooseAddType = lazy(() => import("./pages/ChooseAddType.jsx"));
const CommissionPay = lazy(() => import("./pages/CommissionPay.jsx"));
const AdminSoldAds = lazy(() => import("./pages/AdminSoldAds.jsx"));
const AdminMessaging = lazy(() => import("./pages/AdminMessaging.jsx"));
const AdminSettings = lazy(() => import("./pages/AdminSettings.jsx"));
const AdminSupportInbox = lazy(() => import("./pages/AdminSupportInbox.jsx"));
const SellerCommissions = lazy(() => import("./pages/SellerCommissions.jsx"));
const AdminEscrowDashboard = lazy(() => import("./pages/AdminEscrowDashboard.jsx"));
const AdminAnalyticsDashboard = lazy(() => import("./pages/AdminAnalyticsDashboard.jsx"));
const AdminDeletedUsers = lazy(() => import("./pages/AdminDeletedUsers.jsx"));
const AdminRecycleBin = lazy(() => import("./pages/AdminRecycleBin.jsx"));
const AdminActivityLogs = lazy(() => import("./pages/AdminActivityLogs.jsx"));
const AdminSystemHealth = lazy(() => import("./pages/AdminSystemHealth.jsx"));
const AdminWelcomePromotion = lazy(() => import("./pages/AdminWelcomePromotion.jsx"));
const AdminDeletedAds = lazy(() => import("./pages/AdminDeletedAds.jsx"));
const AdminArchivedAds = lazy(() => import("./pages/AdminArchivedAds.jsx"));
const AdminPlatformReviews = lazy(() => import("./pages/AdminPlatformReviews.jsx"));
const AdminEscrowMonitoring = lazy(() => import("./pages/AdminEscrowMonitoring.jsx"));
const AdminBrokerage = lazy(() => import("./pages/AdminBrokerage.jsx"));
const PlatformReviews = lazy(() => import("./pages/PlatformReviews.jsx"));
const OrderDetail = lazy(() => import("./pages/OrderDetail.jsx"));
const Wallet = lazy(() => import("./pages/Wallet.jsx"));
const AccountSettings = lazy(() => import("./pages/AccountSettings.jsx"));
const HowItWorks = lazy(() => import("./pages/HowItWorks.jsx"));
const SecureDealExplanation = lazy(() => import("./pages/SecureDealExplanation.jsx"));
// Brokerage Pages
const BrokerDashboard = lazy(() => import("./pages/BrokerDashboard.jsx"));
const BrokerageCampaigns = lazy(() => import("./pages/BrokerageCampaigns.jsx"));
const BrokerageMemberships = lazy(() => import("./pages/BrokerageMemberships.jsx"));
const BrokerageDeals = lazy(() => import("./pages/BrokerageDeals.jsx"));
const BrokerageAchievements = lazy(() => import("./pages/BrokerageAchievements.jsx"));
const BrokerageSellerCampaigns = lazy(() => import("./pages/BrokerageSellerCampaigns.jsx"));
const BrokerageCampaignDetails = lazy(() => import("./pages/BrokerageCampaignDetails.jsx"));
const ReferralDashboard = lazy(() => import("./pages/ReferralDashboard.jsx"));
const AdminReferrals = lazy(() => import("./pages/AdminReferrals.jsx"));
const ReferralRedirect = lazy(() => import("./pages/ReferralRedirect.jsx"));

function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (role === null && ["admin", "supervisor"].includes(user.role) && location.pathname.startsWith("/seller")) {
    return <Navigate to="/admin" replace />;
  }
  if (role === "admin" && !["admin", "supervisor"].includes(user.role)) return <Navigate to="/login" replace />;
  if (role && role !== "admin" && user.role !== role) return <Navigate to="/login" replace />;
  return children;
}

function RequireMainAdmin({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.role !== "admin") return <Navigate to="/admin" replace />;
  return children;
}

function RequireBrokerageEnabled({ children }) {
  const { enabled, loading } = useBrokerageStatus();
  const location = useLocation();
  if (loading) return <LoadingSpinner fullPage />;
  if (!enabled) return <Navigate to="/" replace state={{ from: location }} />;
  return children;
}

function MaintenanceScreen() {
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_30%),radial-gradient(circle_at_bottom,_rgba(251,191,36,0.14),_transparent_35%),linear-gradient(135deg,_#020817_0%,_#0f172a_30%,_#111827_100%)] text-slate-50 dark:bg-slate-950 dark:text-slate-50">
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl rounded-[30px] border border-white/10 bg-white/5 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.75)] backdrop-blur-sm sm:p-8 lg:p-12">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6 flex items-center justify-center">
              <div className="absolute inset-0 scale-125 rounded-full bg-brand-500/20 blur-3xl" />
              <div className="relative flex items-center justify-center rounded-full border border-brand-400/40 bg-gradient-to-br from-brand-500/20 via-sky-500/10 to-amber-400/15 p-5 shadow-[0_0_50px_rgba(59,130,246,0.25)] animate-[pulse_2.8s_ease-in-out_infinite]">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-slate-950/40 shadow-inner">
                  <div className="absolute inset-2 rounded-full border border-dashed border-brand-300/60 animate-spin-slow" />
                  <div className="absolute -right-3 -top-2 flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/50 bg-amber-400/20 text-lg text-amber-200 shadow-lg shadow-amber-500/20 animate-bounce">
                    🔧
                  </div>
                  <Logo iconSize="h-12 sm:h-14" />
                </div>
              </div>
            </div>

            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-xs font-black tracking-[0.18em] text-amber-200 uppercase shadow-[0_0_22px_rgba(251,191,36,0.18)]">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-300 animate-pulse" />
              Maintenance
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
              التطبيق قيد الصيانة والتطوير 🛠️
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
              نقوم حالياً بإجراء تحديثات وتحسينات شاملة لمنصة سوقك لتقديم تجربة أفضل وأكثر أماناً.
            </p>

            <div className="mt-8 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-brand-400 via-sky-400 to-amber-300" />
            </div>

            <p className="mt-8 text-lg font-bold text-brand-200">
              انتظرونا بحلة جديدة قريباً جداً!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();

  if (IS_MAINTENANCE) {
    return <MaintenanceScreen />;
  }

  React.useEffect(() => {
    const noIndexPaths = [
      '/login',
      '/register',
      '/forgot-password',
      '/verify-email',
      '/seller',
      '/add-product',
      '/choose-add-type',
      '/commission/pay',
      '/messages',
      '/notifications',
      '/favorites',
      '/following',
      '/wallet',
      '/my-ads',
      '/account-settings',
      '/orders',
      '/admin',
      '/search',
      '/tag',
      '/user',
      '/s'
    ];

    const isNoIndex = noIndexPaths.some((path) =>
      path === location.pathname || location.pathname.startsWith(`${path}/`) || location.pathname.startsWith('/admin')
    );

    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', isNoIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  }, [location.pathname]);

  return (
    <>
      <AppOpeningIntro />
      <PushSubscriptionManager />
      <FirstVisitSessionIntro />
      <ScrollToTop />
      <SupportChatFAB />
      <WelcomePromotionSummary />
      <OnboardingTour />
      <RouteErrorBoundary>
        <Suspense fallback={<LoadingSpinner fullPage />}>
          <Routes>
          <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/phone-forgot-password" element={<PhoneForgotPassword />} />
        <Route path="/set-new-password" element={<SetNewPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Route>

      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/seller" element={<RequireRole role={null}><SellerDashboard /></RequireRole>} />
        <Route path="/seller/featured-ad" element={<RequireRole role={null}><SellerFeaturedAd /></RequireRole>} />
        <Route path="/seller/feature-ad" element={<RequireRole role={null}><SellerFeaturedAd /></RequireRole>} />
        <Route path="/seller/verification" element={<RequireRole role={null}><SellerVerification /></RequireRole>} />
        <Route path="/seller/subscriptions" element={<RequireRole role={null}><SellerSubscriptions /></RequireRole>} />
        <Route path="/seller/commissions" element={AD_COMMISSION_ENABLED ? <RequireRole role={null}><SellerCommissions /></RequireRole> : <Navigate to="/" replace />} />
        <Route path="/add-product" element={<RequireRole role={null}><AddProduct /></RequireRole>} />
        <Route path="/choose-add-type" element={<RequireRole role={null}><ChooseAddType /></RequireRole>} />
        <Route path="/commission/pay" element={AD_COMMISSION_ENABLED ? <RequireRole role={null}><CommissionPay /></RequireRole> : <Navigate to="/" replace />} />
        <Route path="/admin/*"
          element={
            <RequireRole role="admin">
              <AdminLayout />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="tags" element={<AdminTags />} />
          <Route path="ads" element={<AdminAds />} />
          <Route path="managed-sellers/new-ad" element={<AdminManagedSellerAd />} />
          <Route path="managed-sellers" element={<AdminManagedSellers />} />
          <Route path="governorates" element={<AdminGovernorates />} />
          <Route path="cities" element={<AdminCities />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="supervisors" element={<RequireMainAdmin><AdminSupervisors /></RequireMainAdmin>} />
          <Route path="deleted-users" element={<AdminDeletedUsers />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="bank-accounts" element={<AdminBankAccounts />} />
          <Route path="featured-requests" element={<AdminFeaturedRequests />} />
          <Route path="verification-requests" element={<AdminVerificationRequests />} />
          <Route path="sold-ads" element={<AdminSoldAds />} />
          <Route path="phone-users" element={<AdminPhoneUsers />} />
          <Route path="password-reset-requests" element={<AdminPasswordResetRequests />} />
          <Route path="finance-hub" element={<AdminFinanceHub />} />
          <Route path="support-inbox" element={<AdminSupportInbox />} />
          <Route path="messaging" element={<AdminMessaging />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="escrow" element={<AdminEscrowDashboard />} />
          <Route path="escrow-monitoring" element={<AdminEscrowMonitoring />} />
          <Route path="analytics" element={<AdminAnalyticsDashboard />} />
          <Route path="activity-logs" element={<AdminActivityLogs />} />
          <Route path="platform-reviews" element={<AdminPlatformReviews />} />
          <Route path="recycle-bin" element={<AdminRecycleBin />} />
          <Route path="system-health" element={<AdminSystemHealth />} />
          <Route path="welcome-promotion" element={<AdminWelcomePromotion />} />
          <Route path="deleted-ads" element={<AdminDeletedAds />} />
          <Route path="archived-ads" element={<AdminArchivedAds />} />
          <Route path="brokerage" element={<AdminBrokerage />} />
          <Route path="referrals" element={<AdminReferrals />} />
        </Route>
        <Route path="/categories" element={<Categories />} />
        <Route path="/category/:slug" element={<CategoryPage />} />
        <Route path="/category/:slug/:subSlug" element={<CategoryPage />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/tag/:slug" element={<TagPage />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/ad/:id" element={<ProductDetail />} />
        <Route path="/ad/:id/:slug" element={<ProductDetail />} />
        <Route path="/user/:id" element={<SellerPublic />} />
        <Route
          path="/messages"
          element={
            <RequireRole role={null}>
              <Messages />
            </RequireRole>
          }
        />
        <Route path="/s/:id" element={<SellerPublic />} />
        <Route
          path="/following"
          element={
            <RequireRole role={null}>
              <Following />
            </RequireRole>
          }
        />
        <Route
          path="/favorites"
          element={
            <RequireRole role={null}>
              <Favorites />
            </RequireRole>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireRole role={null}>
              <Notifications />
            </RequireRole>
          }
        />
        <Route path="/edit-ad/:id" element={<RequireRole role={null}><EditAd /></RequireRole>} />
        <Route path="/my-ads" element={<RequireRole role={null}><MyAds /></RequireRole>} />
        <Route path="/account-settings" element={<RequireRole role={null}><AccountSettings /></RequireRole>} />
        <Route path="/orders/:id" element={<RequireRole role={null}><OrderDetail /></RequireRole>} />
        <Route path="/wallet" element={<RequireRole role={null}><Wallet /></RequireRole>} />
        
        <Route
          path="/chat/:productId"
          element={
            <RequireRole role={null}>
              <Chat />
            </RequireRole>
          }
        />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/secure-deal-explanation" element={<SecureDealExplanation />} />
        <Route path="/refund-escrow" element={<RefundEscrow />} />
        <Route path="/platform-reviews" element={<PlatformReviews />} />
        <Route path="/pricing" element={<Pricing />} />
        
        {/* Brokerage Routes */}
        <Route path="/brokerage" element={<RequireBrokerageEnabled><RequireRole role={null}><BrokerDashboard /></RequireRole></RequireBrokerageEnabled>} />
        <Route path="/referrals" element={<RequireRole role={null}><ReferralDashboard /></RequireRole>} />
        <Route path="/r/:code" element={<ReferralRedirect />} />
        <Route path="/brokerage/campaigns" element={<RequireBrokerageEnabled><RequireRole role={null}><BrokerageCampaigns /></RequireRole></RequireBrokerageEnabled>} />
        <Route path="/brokerage/memberships" element={<RequireBrokerageEnabled><RequireRole role={null}><BrokerageMemberships /></RequireRole></RequireBrokerageEnabled>} />
        <Route path="/brokerage/deals" element={<RequireBrokerageEnabled><RequireRole role={null}><BrokerageDeals /></RequireRole></RequireBrokerageEnabled>} />
        <Route path="/brokerage/achievements" element={<RequireBrokerageEnabled><RequireRole role={null}><BrokerageAchievements /></RequireRole></RequireBrokerageEnabled>} />
        <Route path="/brokerage/my-campaigns" element={<RequireBrokerageEnabled><RequireRole role={null}><BrokerageSellerCampaigns /></RequireRole></RequireBrokerageEnabled>} />
        <Route path="/brokerage/campaigns/:id" element={<RequireBrokerageEnabled><RequireRole role={null}><BrokerageCampaignDetails /></RequireRole></RequireBrokerageEnabled>} />
        
        <Route path="*" element={<NotFound />} />
      </Route>
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </>
  );
}
