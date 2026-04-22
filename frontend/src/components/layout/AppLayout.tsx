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
      <div className="absolute top-0 left-0 bottom-0 w-64 bg-card border-r z-10 hidden md:block" />
      
      {/* Sidebar */}
      <aside className="relative z-20 w-64 hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 ring-1 ring-primary/30">
            <Building2 className="text-primary-foreground w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold tracking-tight text-foreground leadiing-tight">Abelam</h2>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Private Ledger</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                  {item.name}
                  {isActive && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="absolute left-0 w-1 h-8 bg-primary rounded-r-md" 
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="p-4 bg-accent/50 rounded-xl border mb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user?.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b bg-background/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex-1 max-w-xl">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Search precise asset queries, properties, or deals..." 
                className="w-full bg-accent/50 border-0 rounded-full h-10 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium placeholder:font-normal"
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
