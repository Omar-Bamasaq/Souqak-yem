import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// Components
import ScrollToTop from "./components/ScrollToTop.jsx";
import WelcomePromotionSummary from "./components/WelcomePromotionSummary.jsx";
import FirstVisitSessionIntro from "./components/FirstVisitSessionIntro.jsx";
import SupportChatFAB from "./components/SupportChatFAB.jsx";
import OnboardingTour from "./components/OnboardingTour.jsx";
import LoadingSpinner from "./components/LoadingSpinner.jsx";
import PushSubscriptionManager from "./components/PushSubscriptionManager.jsx";
import MainLayout from "./layouts/MainLayout.jsx";
import AuthLayout from "./layouts/AuthLayout.jsx";
import AdminLayout from "./pages/AdminLayout.jsx";
import { useAuth } from "./store/AuthContext.jsx";

// Pages
const Home = lazy(() => import("./pages/Home.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard.jsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.jsx"));
const AdminAds = lazy(() => import("./pages/AdminAds.jsx"));
const AdminUsers = lazy(() => import("./pages/AdminUsers.jsx"));
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
const PlatformReviews = lazy(() => import("./pages/PlatformReviews.jsx"));
const OrderDetail = lazy(() => import("./pages/OrderDetail.jsx"));
const Wallet = lazy(() => import("./pages/Wallet.jsx"));
const AccountSettings = lazy(() => import("./pages/AccountSettings.jsx"));
const HowItWorks = lazy(() => import("./pages/HowItWorks.jsx"));
const SecureDealExplanation = lazy(() => import("./pages/SecureDealExplanation.jsx"));

function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (role && user.role !== role) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <PushSubscriptionManager />
      <FirstVisitSessionIntro />
      <ScrollToTop />
      <SupportChatFAB />
      <WelcomePromotionSummary />
      <OnboardingTour />
      <Suspense fallback={<LoadingSpinner fullPage />}>
        <Routes>
          <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Route>

      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/seller" element={<RequireRole role={null}><SellerDashboard /></RequireRole>} />
        <Route path="/seller/featured-ad" element={<RequireRole role={null}><SellerFeaturedAd /></RequireRole>} />
        <Route path="/seller/feature-ad" element={<RequireRole role={null}><SellerFeaturedAd /></RequireRole>} />
        <Route path="/seller/verification" element={<RequireRole role={null}><SellerVerification /></RequireRole>} />
        <Route path="/seller/subscriptions" element={<RequireRole role={null}><SellerSubscriptions /></RequireRole>} />
        <Route path="/seller/commissions" element={<RequireRole role={null}><SellerCommissions /></RequireRole>} />
        <Route path="/add-product" element={<RequireRole role={null}><AddProduct /></RequireRole>} />
        <Route path="/choose-add-type" element={<RequireRole role={null}><ChooseAddType /></RequireRole>} />
        <Route path="/commission/pay" element={<RequireRole role={null}><CommissionPay /></RequireRole>} />
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
          <Route path="governorates" element={<AdminGovernorates />} />
          <Route path="cities" element={<AdminCities />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="deleted-users" element={<AdminDeletedUsers />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="bank-accounts" element={<AdminBankAccounts />} />
          <Route path="featured-requests" element={<AdminFeaturedRequests />} />
          <Route path="verification-requests" element={<AdminVerificationRequests />} />
          <Route path="sold-ads" element={<AdminSoldAds />} />
          <Route path="phone-users" element={<AdminPhoneUsers />} />
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
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </Suspense>
    </>
  );
}
