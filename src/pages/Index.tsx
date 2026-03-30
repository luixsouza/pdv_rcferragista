import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { StatsCard } from '@/components/StatsCard';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Product, Client, Sale, Installment } from '@/types';
import { Package, Users, ShoppingCart, TrendingUp, TrendingDown, DollarSign, AlertTriangle, BookOpen, UserX, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const paymentLabels: Record<string, string> = {
  cash: 'Dinheiro',
  credit: 'Crédito',
  debit: 'Débito',
  pix: 'PIX',
  crediario: 'Crediário',
  store_credit: 'Créd. Haver',
};

const Index = () => {
  const [products] = useLocalStorage<Product[]>('products', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [sales] = useLocalStorage<Sale[]>('sales', []);
  const [installments] = useLocalStorage<Installment[]>('installments', []);
  const [period, setPeriod] = useState('today');

  const periodSales = sales.filter(sale => {
    if (sale.status === 'refunded') return false;

    const date = new Date(sale.createdAt);
    switch (period) {
      case 'today':
        return isToday(date);
      case 'week':
        return isThisWeek(date, { locale: ptBR });
      case 'month':
        return isThisMonth(date);
      default:
        return true;
    }
  });

  const periodRevenue = periodSales.reduce((sum, sale) => sum + sale.total, 0);

  const periodCost = periodSales.reduce((sum, sale) => {
    const saleCost = sale.items.reduce((itemSum, item) => {
      const product = products.find(p => p.id === item.productId);
      const itemCostPrice = item.costPrice ?? product?.costPrice ?? 0;
      return itemSum + (itemCostPrice * item.quantity);
    }, 0);
    return sum + saleCost;
  }, 0);

  const periodProfit = periodRevenue - periodCost;

  const lowStockProducts = products
    .filter(p => p.stock <= 10)
    .sort((a, b) => a.stock - b.stock);

  const [lowStockPage, setLowStockPage] = useState(0);
  const LOW_STOCK_PER_PAGE = 8;
  const lowStockTotalPages = Math.max(1, Math.ceil(lowStockProducts.length / LOW_STOCK_PER_PAGE));
  const lowStockPaged = lowStockProducts.slice(
    lowStockPage * LOW_STOCK_PER_PAGE,
    (lowStockPage + 1) * LOW_STOCK_PER_PAGE
  );

  const pendingCrediario = installments
    .filter(i => i.status === 'open' || i.status === 'overdue')
    .reduce((sum, i) => sum + (i.amount - i.amountPaid - (i.discountApplied || 0)), 0);

  const delinquentClientIds = new Set(
    installments.filter(i => i.status === 'overdue').map(i => i.clientId)
  );
  const delinquentCount = delinquentClientIds.size;


  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return 'Vendas Hoje';
      case 'week': return 'Vendas da Semana';
      case 'month': return 'Vendas do Mês';
      default: return 'Todas as Vendas';
    }
  };

  const recentSales = sales.slice(-5).reverse();



  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Visao geral do seu negocio</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="all">Todo o período</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title={getPeriodLabel()}
            value={formatCurrency(periodRevenue)}
            icon={TrendingUp}
          />
          <StatsCard
            title={getPeriodLabel().replace('Vendas', 'Custo')}
            value={formatCurrency(periodCost)}
            icon={TrendingDown}
          />
          <StatsCard
            title={getPeriodLabel().replace('Vendas', 'Lucro')}
            value={formatCurrency(periodProfit)}
            icon={DollarSign}
          />
          <StatsCard
            title="Total de Vendas"
            value={periodSales.length}
            icon={ShoppingCart}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Produtos Cadastrados"
            value={products.length}
            icon={Package}
          />
          <StatsCard
            title="Clientes"
            value={clients.length}
            icon={Users}
          />
          <StatsCard
            title="Crediário Pendente"
            value={formatCurrency(pendingCrediario)}
            icon={BookOpen}
          />
          <StatsCard
            title="Inadimplentes"
            value={delinquentCount}
            icon={UserX}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Low Stock Alert */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Estoque Baixo ({lowStockProducts.length})
                </span>
                {lowStockTotalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={lowStockPage === 0}
                      onClick={() => setLowStockPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-normal text-muted-foreground">
                      {lowStockPage + 1}/{lowStockTotalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={lowStockPage >= lowStockTotalPages - 1}
                      onClick={() => setLowStockPage(p => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum produto com estoque baixo
                </p>
              ) : (
                <div className="space-y-2">
                  {lowStockPaged.map(product => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">Cod: {product.code}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn(
                          "font-bold text-sm",
                          product.stock <= 0 ? 'text-destructive' : 'text-amber-500'
                        )}>
                          {product.stock} {product.unit}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Sales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Vendas Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentSales.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma venda registrada
                </p>
              ) : (
                <div className="space-y-2">
                  {recentSales.map(sale => (
                    <div key={sale.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="font-medium text-sm truncate">{sale.clientName || 'Cliente nao identificado'}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(sale.createdAt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm">{formatCurrency(sale.total)}</p>
                        <div className="flex gap-1 justify-end mt-0.5">
                          {sale.status === 'crediario_pending' && (
                            <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 px-1.5 py-0">Crediario</Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {paymentLabels[sale.paymentMethod] || sale.paymentMethod}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
