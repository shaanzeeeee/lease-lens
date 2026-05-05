import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SearchProvider } from './context/SearchContext';
import AppLayout from './components/layout/AppLayout';

// Lazy loading for performance optimization
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Concierge = React.lazy(() => import('./pages/Concierge'));
const HitlQueue = React.lazy(() => import('./pages/HitlQueue'));
const Properties = React.lazy(() => import('./pages/Properties'));
const PropertyDetail = React.lazy(() => import('./pages/PropertyDetail'));

// Loading Fallback
const PageLoader = () => (
  <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
    <p className="text-muted-foreground font-medium animate-pulse">Loading Lumina...</p>
  </div>
);

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <PageLoader />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <SearchProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/concierge" element={<Concierge />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/properties/:id" element={<PropertyDetail />} />
                <Route path="/hitl" element={<HitlQueue />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </SearchProvider>
    </AuthProvider>
  );
}

export default App;
