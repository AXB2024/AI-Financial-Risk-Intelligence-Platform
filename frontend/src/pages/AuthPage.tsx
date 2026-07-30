import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AlertBanner } from '../components/AlertBanner';
import { getApiErrorMessage } from '../services/api';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'register') {
        await signUp(name, email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
      <section className="surface-card w-full p-6">
        <div className="mb-6">
          <p className="section-label">Risk Intelligence</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {mode === 'register' ? 'Create your workspace' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Save portfolios, rerun analyses, and build a private risk history.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`h-10 rounded-lg text-sm font-semibold ${
              mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`h-10 rounded-lg text-sm font-semibold ${
              mode === 'register' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' ? (
            <label className="block">
              <span className="field-label">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="field-input"
                minLength={2}
                required
              />
            </label>
          ) : null}

          <label className="block">
            <span className="field-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field-input"
              required
            />
          </label>

          <label className="block">
            <span className="field-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field-input"
              minLength={8}
              required
            />
          </label>

          {error ? <AlertBanner message={error} /> : null}

          <button
            type="submit"
            disabled={loading}
            className={`btn-primary w-full ${loading ? 'btn-disabled' : ''}`}
          >
            {loading ? 'Please wait...' : mode === 'register' ? 'Create Account' : 'Log In'}
          </button>
        </form>
      </section>
    </main>
  );
}
