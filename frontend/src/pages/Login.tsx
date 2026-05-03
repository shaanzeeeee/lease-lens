import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Lock, Mail, Loader2 } from 'lucide-react';
import { Button, Input } from '../components/ui/components';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const response = await apiClient.post('/auth/login', {
          email,
          password,
        });
        
        login(response.data.access_token, response.data.user);
        navigate('/dashboard');
      } else {
        const response = await apiClient.post('/auth/register', {
          email,
          password,
          full_name: fullName,
        });
        
        login(response.data.access_token, response.data.user);
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const detail = err.response?.data?.detail;
      const errorMessage = typeof detail === 'string' 
        ? detail 
        : (Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : 'Authentication failed. Please try again.');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Form Section */}
      <div className="w-full lg:w-[50%] flex items-center justify-center p-8 relative z-10">
        {/* Subtle ambient light for form side */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
        </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md p-8 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-primary/20 ring-1 ring-primary/10 animate-pulse-glow"
          >
            <Building2 className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Abelam Private Ledger</h1>
          <p className="text-muted-foreground mt-2 text-sm text-center font-medium leading-relaxed">
            Institutional-grade real estate asset management<br />and intelligent underwriting.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-card border shadow-2xl rounded-2xl p-6 backdrop-blur-xl bg-card/80"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-lg font-medium"
              >
                {error}
              </motion.div>
            )}
            
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-semibold">Full Name</label>
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  className="bg-background/50"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" /> Email Address
              </label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50 h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" /> Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/50 h-11"
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" /> Confirm Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={!isLogin}
                  className="bg-background/50 h-11"
                />
              </div>
            )}

            <Button type="submit" className="w-full mt-6 h-12 text-base font-bold shadow-lg shadow-primary/20" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Authenticating…
                </span>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-muted-foreground hover:text-primary transition-colors font-medium"
              type="button"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </motion.div>

        <p className="text-center text-[10px] text-muted-foreground/50 mt-6 uppercase tracking-widest font-semibold">
          Secured by Abelam AI · Enterprise Grade
        </p>
      </motion.div>
      </div>

      {/* Right Visual Section */}
      <div className="hidden lg:flex w-[50%] relative overflow-hidden items-center justify-center border-l border-border/50 bg-muted/10">
        <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] rounded-full bg-primary/20 blur-[140px] animate-pulse-glow" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/15 blur-[160px]" />
        
        {/* Abstract Floating UI Elements */}
        <div className="relative z-10 w-full max-w-lg p-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="glass-panel p-8 rounded-3xl border border-primary/20 shadow-2xl bg-card/40 backdrop-blur-3xl"
          >
            <div className="grid grid-cols-2 gap-4 opacity-80">
              <div className="h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent border border-primary/10" />
              <div className="h-24 rounded-2xl bg-gradient-to-bl from-blue-500/20 to-transparent border border-blue-500/10" />
              <div className="col-span-2 h-32 rounded-2xl bg-gradient-to-tr from-muted/50 to-transparent border border-border/50 flex items-center justify-center">
                <div className="h-2 w-1/2 bg-muted rounded-full" />
              </div>
            </div>
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="text-3xl font-bold mt-12 text-foreground tracking-tight"
          >
            Smarter Real Estate Underwriting
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="text-muted-foreground mt-4 leading-relaxed"
          >
            Automate document extraction, calculate NOIs, and accelerate your deal flow with our LangGraph-powered AI pipeline.
          </motion.p>
        </div>
      </div>
    </div>
  );
}
