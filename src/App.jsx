import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import AskMilo from '@/pages/AskMilo';
import MyRequests from '@/pages/MyRequests';
import QuestionBank from '@/pages/QuestionBank';
import StudyHub from '@/pages/StudyHub';
import Practice from '@/pages/Practice';
import ProgressPage from '@/pages/Progress';
import SavedItems from '@/pages/SavedItems';
import CreatorQueue from '@/pages/CreatorQueue';
import AdminPanel from '@/pages/AdminPanel';
import AdminUsers from '@/pages/AdminUsers';
import BecomeCreator from '@/pages/BecomeCreator';
import CreatorApplications from '@/pages/CreatorApplications';
import AuditLogPage from '@/pages/AuditLog';
import Settings from '@/pages/Settings';
import RequestTutor from '@/pages/RequestTutor';
import VideoLibrary from '@/pages/VideoLibrary';
import VideoDetail from '@/pages/VideoDetail';
import UploadVideo from '@/pages/UploadVideo';
import ManageVideos from '@/pages/ManageVideos';
import Wardrobe from '@/pages/Wardrobe';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ask" element={<AskMilo />} />
          <Route path="/requests" element={<MyRequests />} />
          <Route path="/bank" element={<QuestionBank />} />
          <Route path="/study" element={<StudyHub />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/saved" element={<SavedItems />} />
          <Route path="/queue" element={<CreatorQueue />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/applications" element={<CreatorApplications />} />
          <Route path="/admin/audit" element={<AuditLogPage />} />
          <Route path="/become-creator" element={<BecomeCreator />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/request-tutor" element={<RequestTutor />} />
          <Route path="/videos" element={<VideoLibrary />} />
          <Route path="/videos/:id" element={<VideoDetail />} />
          <Route path="/videos/upload" element={<UploadVideo />} />
          <Route path="/videos/manage" element={<ManageVideos />} />
          <Route path="/wardrobe" element={<Wardrobe />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App