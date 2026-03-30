import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  History,
  FileText,
  BookOpen,
  RotateCcw,
  Settings,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/products', label: 'Produtos', icon: Package },
  { path: '/clients', label: 'Clientes', icon: Users },
  { path: '/pos', label: 'PDV', icon: ShoppingCart },
  { path: '/sales', label: 'Vendas', icon: History },
  { path: '/quotes', label: 'Orçamentos', icon: FileText },
  { path: '/credit-notes', label: 'Crediário', icon: BookOpen },
  { path: '/returns', label: 'Devoluções', icon: RotateCcw },
  { path: '/settings', label: 'Configurações', icon: Settings },
];

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border h-16 flex items-center px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div className="flex items-center gap-2 ml-4">
          <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
          <span className="font-semibold text-lg">RC Casa & Construção</span>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 bg-card border-r border-border transition-transform duration-300",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center gap-3 px-6 border-b border-border bg-primary/5">
          <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain" />
          <span className="font-bold text-lg leading-tight text-foreground">RC Casa &<br/>Construção</span>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm",
                  "hover:bg-primary/10",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground font-medium"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "drop-shadow-sm")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
