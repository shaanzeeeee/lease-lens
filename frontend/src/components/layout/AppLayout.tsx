import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  LayoutDashboard, 
  MessageSquare, 
  FileCheck, 
  LogOut,
  User as UserIcon,
  Search,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSearch } from '../../context/SearchContext';
import { Button } from '../ui/components';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = React.useState<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'dark'
  );

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  useEffect(() => {
    const isSearchablePage = location.pathname === '/properties' || 
                            location.pathname.startsWith('/properties/') || 
                            location.pathname === '/hitl';
    
    if (searchQuery && !isSearchablePage) {
      navigate('/properties');
    }
  }, [searchQuery, location.pathname, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Properties', icon: Building2, path: '/properties' },
    { name: 'Concierge AI', icon: MessageSquare, path: '/concierge' },
    { name: 'Verification Queue', icon: FileCheck, path: '/hitl' },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Sidebar background styling */}
      <div className="absolute top-0 left-0 bottom-0 w-64 bg-card/60 backdrop-blur-xl border-r border-border/50 z-10 hidden md:block" />
      
      {/* Sidebar */}
      <aside className="relative z-20 w-64 hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.15)]">
            <Building2 className="text-primary w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold tracking-tight text-foreground leading-tight">Lumina</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Real Estate AI</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-semibold shadow-sm' 
                    : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-5 h-5 z-10 transition-transform group-hover:scale-110 duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                  <span className="z-10">{item.name}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="absolute left-0 w-1 h-1/2 top-1/4 bg-primary rounded-r-md" 
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="p-4 bg-accent/30 rounded-2xl border border-border/50 mb-4 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center border border-primary/20">
                <UserIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate text-foreground">{user?.full_name}</p>
                <p className="text-[11px] font-medium text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors rounded-xl h-9" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 overflow-hidden">
        {/* Top Header */}
        <header className="h-20 border-b border-border/40 bg-background/60 backdrop-blur-2xl flex items-center justify-between px-8 shrink-0 z-20">
          <div className="flex-1 max-w-xl">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Search precise asset queries, properties, or deals..." 
                className="w-full bg-card border border-border/50 shadow-sm rounded-2xl h-11 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all font-medium placeholder:font-normal placeholder:text-muted-foreground/70"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full hover:bg-accent/50">
              {theme === 'light' ? <Moon className="w-5 h-5 text-muted-foreground" /> : <Sun className="w-5 h-5 text-primary" />}
            </Button>
            <div className="h-6 w-[1px] bg-border mx-1" />
            <div className="text-xs font-medium px-3 py-1 bg-secondary rounded-full border text-secondary-foreground">
              Tenant ID: {user?.tenant_id}
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <div className="flex-1 overflow-auto p-6 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="h-full max-w-6xl mx-auto"
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
