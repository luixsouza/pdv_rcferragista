import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Sale, Product, Installment, CreditPayment } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { TrendingUp, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Reports() {
  const [sales] = useLocalStorage<Sale[]>('sales', []);
  const [products] = useLocalStorage<Product[]>('products', []);
  const [installments] = useLocalStorage<Installment[]>('installments', []);
  const [creditPayments] = useLocalStorage<CreditPayment[]>('credit_payments', []);

  // Fechamento de Caixa state
  const [cashDate, setCashDate] = useState(new Date().toISOString().slice(0, 10));

  // Relatório Mensal state
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));

  // ======= FECHAMENTO DE CAIXA =======
  const cashReport = useMemo(() => {
    const daySales = sales.filter(s => {
      const d = new Date(s.createdAt);
      return d.toISOString().slice(0, 10) === cashDate && s.status !== 'refunded';
    });

    const totalRevenue = daySales.reduce((sum, s) => sum + s.total, 0);
    const saleCount = daySales.length;

    // Payment method breakdown
    const byMethod: Record<string, number> = {};
    daySales.forEach(s => {
      if (s.paymentEntries && s.paymentEntries.length > 1) {
        s.paymentEntries.forEach(e => {
          byMethod[e.method] = (byMethod[e.method] || 0) + e.amount;
        });
      } else {
        byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] || 0) + s.total;
      }
    });

    // Card fees
    const totalCardFees = daySales.reduce((sum, s) => {
      let fees = s.cardFeeAmount || 0;
      if (s.paymentEntries) {
        fees += s.paymentEntries.reduce((f, e) => f + (e.cardFeeAmount || 0), 0);
      }
      return sum + fees;
    }, 0);

    // Crediário payments received today
    const dayCrediarioPayments = creditPayments.filter(p =>
      p.createdAt.slice(0, 10) === cashDate && p.type !== 'discount'
    );
    const crediarioReceived = dayCrediarioPayments.reduce((sum, p) => sum + p.amount, 0);

    // Refunds — accounting total (sum of sale.total for reversed sales)
    const dayRefunds = sales.filter(s =>
      s.status === 'refunded' && s.createdAt.slice(0, 10) === cashDate
    );
    const totalRefunds = dayRefunds.reduce((sum, s) => sum + s.total, 0);

    // Cash actually disbursed from the register at estorno (EST-03b / cashRefundOut field).
    // Distinct from totalRefunds (accounting reversal value) — the two will differ when estorno
    // generates haver instead of cash, or when a crediário sale had zero paid (no cash out).
    const cashRefundOut = dayRefunds.reduce((sum, s) => sum + (s.cashRefundOut || 0), 0);

    return { totalRevenue, saleCount, byMethod, totalCardFees, crediarioReceived, totalRefunds, cashRefundOut };
  }, [sales, creditPayments, cashDate]);

  // ======= RELATÓRIO MENSAL =======
  const monthlyReport = useMemo(() => {
    const [year, month] = reportMonth.split('-').map(Number);
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(monthStart);

    const monthSales = sales.filter(s => {
      const d = new Date(s.createdAt);
      return d >= monthStart && d <= monthEnd && s.status !== 'refunded';
    });

    const revenue = monthSales.reduce((sum, s) => sum + s.total, 0);
    const cost = monthSales.reduce((sum, s) => {
      return sum + s.items.reduce((itemSum, item) => {
        const product = products.find(p => p.id === item.productId);
        const costPrice = item.costPrice ?? product?.costPrice ?? 0;
        return itemSum + (costPrice * item.quantity);
      }, 0);
    }, 0);
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const avgTicket = monthSales.length > 0 ? revenue / monthSales.length : 0;

    // Top 5 products
    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    monthSales.forEach(sale => {
      sale.items.forEach(item => {
        const existing = productMap.get(item.productId);
        if (existing) {
          existing.qty += item.quantity;
          existing.revenue += item.total;
        } else {
          productMap.set(item.productId, { name: item.productName, qty: item.quantity, revenue: item.total });
        }
      });
    });
    const topProducts = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Top 5 clients
    const clientMap = new Map<string, { name: string; total: number; count: number }>();
    monthSales.forEach(sale => {
      if (!sale.clientName) return;
      const existing = clientMap.get(sale.clientId || '');
      if (existing) {
        existing.total += sale.total;
        existing.count += 1;
      } else {
        clientMap.set(sale.clientId || '', { name: sale.clientName, total: sale.total, count: 1 });
      }
    });
    const topClients = Array.from(clientMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);

    return { revenue, cost, profit, margin, avgTicket, saleCount: monthSales.length, topProducts, topClients };
  }, [sales, products, reportMonth]);

  // ======= RECEBÍVEIS =======
  const receivables = useMemo(() => {
    const now = new Date();
    const pending = installments.filter(i =>
      (i.status === 'open' || i.status === 'overdue') && i.number > 0
    );

    const buckets = {
      current: [] as typeof pending,    // not yet due
      days30: [] as typeof pending,     // 1-30 days overdue
      days60: [] as typeof pending,     // 31-60 days
      days90: [] as typeof pending,     // 61-90 days
      over90: [] as typeof pending,     // 90+ days
    };

    pending.forEach(inst => {
      const dueDate = new Date(inst.dueDate);
      const daysOver = differenceInDays(now, dueDate);
      if (daysOver <= 0) buckets.current.push(inst);
      else if (daysOver <= 30) buckets.days30.push(inst);
      else if (daysOver <= 60) buckets.days60.push(inst);
      else if (daysOver <= 90) buckets.days90.push(inst);
      else buckets.over90.push(inst);
    });

    const sumBucket = (list: typeof pending) =>
      list.reduce((sum, i) => sum + (i.amount - i.amountPaid - (i.discountApplied || 0)), 0);

    // Group by client for detail
    const byClient = new Map<string, { name: string; total: number; count: number; oldest: string }>();
    pending.forEach(inst => {
      const remaining = inst.amount - inst.amountPaid - (inst.discountApplied || 0);
      const existing = byClient.get(inst.clientId);
      if (existing) {
        existing.total += remaining;
        existing.count += 1;
        if (new Date(inst.dueDate) < new Date(existing.oldest)) existing.oldest = inst.dueDate;
      } else {
        byClient.set(inst.clientId, { name: inst.clientName, total: remaining, count: 1, oldest: inst.dueDate });
      }
    });
    const clientList = Array.from(byClient.values()).sort((a, b) => b.total - a.total);

    return {
      buckets,
      totals: {
        current: sumBucket(buckets.current),
        days30: sumBucket(buckets.days30),
        days60: sumBucket(buckets.days60),
        days90: sumBucket(buckets.days90),
        over90: sumBucket(buckets.over90),
        total: sumBucket(pending),
      },
      clientList,
    };
  }, [installments]);

  const paymentMethodLabels: Record<string, string> = {
    cash: 'Dinheiro', credit: 'Crédito', debit: 'Débito', pix: 'PIX',
    crediario: 'Crediário', store_credit: 'Créd. Haver',
  };

  return (
    <Layout>
      <PageHeader title="Relatórios" description="Análise financeira e operacional" />

      <Tabs defaultValue="caixa" className="space-y-6">
        <TabsList>
          <TabsTrigger value="caixa">Fechamento de Caixa</TabsTrigger>
          <TabsTrigger value="mensal">Relatório Mensal</TabsTrigger>
          <TabsTrigger value="recebiveis">Recebíveis</TabsTrigger>
        </TabsList>

        {/* ===== FECHAMENTO DE CAIXA ===== */}
        <TabsContent value="caixa" className="space-y-6">
          <div className="flex items-center gap-4">
            <Input
              type="date"
              value={cashDate}
              onChange={e => setCashDate(e.target.value)}
              className="w-[200px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Faturamento</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(cashReport.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">{cashReport.saleCount} venda(s)</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Crediário Recebido</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(cashReport.crediarioReceived)}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estornos</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(cashReport.totalRefunds)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Formas de Pagamento</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(cashReport.byMethod).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhuma venda no dia</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(cashReport.byMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
                    <div key={method} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="font-medium text-sm">{paymentMethodLabels[method] || method}</span>
                      <span className="font-bold">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  {cashReport.totalCardFees > 0 && (
                    <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                      <span className="text-sm text-red-700 dark:text-red-300">Taxas de Cartão</span>
                      <span className="font-bold text-red-600">-{formatCurrency(cashReport.totalCardFees)}</span>
                    </div>
                  )}
                  {cashReport.cashRefundOut > 0 && (
                    <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                      <span className="text-sm text-red-700 dark:text-red-300">Saída de Caixa (Estorno em Dinheiro)</span>
                      <span className="font-bold text-red-600">-{formatCurrency(cashReport.cashRefundOut)}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== RELATÓRIO MENSAL ===== */}
        <TabsContent value="mensal" className="space-y-6">
          <div className="flex items-center gap-4">
            <Input
              type="month"
              value={reportMonth}
              onChange={e => setReportMonth(e.target.value)}
              className="w-[200px]"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Receita</p>
                <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(monthlyReport.revenue)}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Custo</p>
                <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(monthlyReport.cost)}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Lucro</p>
                <p className={cn("text-xl font-bold mt-1", monthlyReport.profit >= 0 ? "text-blue-600" : "text-red-600")}>
                  {formatCurrency(monthlyReport.profit)}
                </p>
                <p className="text-xs text-muted-foreground">{monthlyReport.margin.toFixed(1)}% margem</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Ticket Médio</p>
                <p className="text-xl font-bold text-amber-600 mt-1">{formatCurrency(monthlyReport.avgTicket)}</p>
                <p className="text-xs text-muted-foreground">{monthlyReport.saleCount} vendas</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Top 5 Produtos</CardTitle></CardHeader>
              <CardContent>
                {monthlyReport.topProducts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Sem dados</p>
                ) : (
                  <div className="space-y-2">
                    {monthlyReport.topProducts.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-bold text-muted-foreground w-5">#{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.qty} un.</p>
                          </div>
                        </div>
                        <span className="font-bold text-sm shrink-0">{formatCurrency(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Top 5 Clientes</CardTitle></CardHeader>
              <CardContent>
                {monthlyReport.topClients.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Sem dados</p>
                ) : (
                  <div className="space-y-2">
                    {monthlyReport.topClients.map((c, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-bold text-muted-foreground w-5">#{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.count} compra(s)</p>
                          </div>
                        </div>
                        <span className="font-bold text-sm shrink-0">{formatCurrency(c.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== RECEBÍVEIS ===== */}
        <TabsContent value="recebiveis" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'A vencer', value: receivables.totals.current, color: 'text-green-600', border: 'border-l-green-500' },
              { label: '1-30 dias', value: receivables.totals.days30, color: 'text-amber-600', border: 'border-l-amber-500' },
              { label: '31-60 dias', value: receivables.totals.days60, color: 'text-orange-600', border: 'border-l-orange-500' },
              { label: '61-90 dias', value: receivables.totals.days90, color: 'text-red-500', border: 'border-l-red-500' },
              { label: '90+ dias', value: receivables.totals.over90, color: 'text-red-700', border: 'border-l-red-700' },
              { label: 'Total', value: receivables.totals.total, color: 'text-foreground', border: 'border-l-primary' },
            ].map((bucket, idx) => (
              <Card key={idx} className={cn("border-l-4", bucket.border)}>
                <CardContent className="p-3 text-center">
                  <p className="text-xs font-medium uppercase text-muted-foreground">{bucket.label}</p>
                  <p className={cn("text-lg font-bold mt-1", bucket.color)}>{formatCurrency(bucket.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Detalhamento por Cliente</CardTitle></CardHeader>
            <CardContent>
              {receivables.clientList.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhum recebível pendente</p>
              ) : (
                <div className="space-y-2">
                  {receivables.clientList.map((c, idx) => {
                    const daysOver = differenceInDays(new Date(), new Date(c.oldest));
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.count} parcela(s) • Mais antiga: {format(new Date(c.oldest), 'dd/MM/yyyy')}
                            {daysOver > 0 && (
                              <span className="text-red-500 ml-1">({daysOver} dias atraso)</span>
                            )}
                          </p>
                        </div>
                        <span className={cn("font-bold text-sm shrink-0", daysOver > 60 ? "text-red-600" : daysOver > 0 ? "text-amber-600" : "text-foreground")}>
                          {formatCurrency(c.total)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
