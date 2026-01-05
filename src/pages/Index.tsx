import { Layout } from '@/components/Layout';
import { StatsCard } from '@/components/StatsCard';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Product, Client, Sale } from '@/types';
import { Package, Users, ShoppingCart, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Index = () => {
  const [products] = useLocalStorage<Product[]>('products', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [sales] = useLocalStorage<Sale[]>('sales', []);

  const today = new Date().toDateString();
  const todaySales = sales.filter(sale => new Date(sale.createdAt).toDateString() === today);
  const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);

  const recentSales = sales.slice(-5).reverse();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Bem-vindo ao seu sistema de gestão</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Vendas Hoje"
            value={formatCurrency(todayRevenue)}
            icon={TrendingUp}
          />
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
            title="Total de Vendas"
            value={formatCurrency(totalRevenue)}
            icon={ShoppingCart}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Low Stock Alert */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Estoque Baixo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum produto com estoque baixo
                </p>
              ) : (
                <div className="space-y-3">
                  {lowStockProducts.slice(0, 5).map(product => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">Código: {product.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-destructive">{product.stock} {product.unit}</p>
                        <p className="text-xs text-muted-foreground">Mín: {product.minStock}</p>
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
                <div className="space-y-3">
                  {recentSales.map(sale => (
                    <div key={sale.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{sale.clientName || 'Cliente não identificado'}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(sale.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(sale.total)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{sale.paymentMethod}</p>
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
