import { AuthProvider, useAuth } from './auth/AuthContext';
import { DashboardPage } from './pages/DashboardPage';
import { AuthPage } from './pages/AuthPage';

function AppContent() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="surface-card px-4 py-3 text-sm font-semibold text-slate-700">
          Loading workspace...
        </p>
      </main>
    );
  }

  return user ? <DashboardPage /> : <AuthPage />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
