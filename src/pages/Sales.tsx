import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/use-toast';
import { Sale, Product } from '@/types';
import { History, Search, Eye, Calendar, Printer, Download, AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { printReceipt, downloadReceipt } from '@/lib/generateReceipt';

const paymentLabels: Record<string, string> = {
  cash: 'Dinheiro',
  credit: 'Crédito',
  debit: 'Débito',
  pix: 'PIX',
  crediario: 'Crediário',
  store_credit: 'Créd. Haver',
};

export default function Sales() {
  const [sales, setSales] = useLocalStorage<Sale[]>('sales', []);
  const [products, setProducts] = useLocalStorage<Product[]>('products', []);
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('all');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const sortedSales = [...sales].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filteredSales = sortedSales.filter(s => {
    const matchesSearch = s.clientName?.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      format(new Date(s.createdAt), 'dd/MM/yyyy').includes(search);

    if (!matchesSearch) return false;

    const date = new Date(s.createdAt);
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const totalToday = sales
    .filter(s => new Date(s.createdAt).toDateString() === new Date().toDateString())
    .filter(s => s.status !== 'refunded')
    .reduce((sum, s) => sum + s.total, 0);

  const handleRefund = (sale: Sale) => {
    // Update products stock
    const updatedProducts = products.map(product => {
      const saleItem = sale.items.find(item => item.productId === product.id);
      if (saleItem) {
        return {
          ...product,
          stock: product.stock + saleItem.quantity
        };
      }
      return product;
    });

    setProducts(updatedProducts);

    // Update sale status
    const updatedSales = sales.map(s =>
      s.id === sale.id ? { ...s, status: 'refunded' as const } : s
    );

    setSales(updatedSales);
    setSelectedSale(null);

    toast({
      title: "Venda estornada",
      description: "O estoque foi atualizado e a venda marcada como estornada.",
    });
  };

  const getStatusBadge = (sale: Sale) => {
    switch (sale.status) {
      case 'refunded':
        return <Badge variant="destructive" className="text-xs">Estornado</Badge>;
      case 'crediario_pending':
        return <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Crediário Pendente</Badge>;
      case 'crediario_paid':
        return <Badge variant="outline" className="text-xs border-green-500 text-green-600">Crediário Pago</Badge>;
      default:
        return null;
    }
  };

  const getPaymentDisplay = (sale: Sale) => {
    if (sale.paymentEntries && sale.paymentEntries.length > 1) {
      return (
        <div className="flex flex-wrap gap-1">
          {sale.paymentEntries.map((entry, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {paymentLabels[entry.method] || entry.method}
            </Badge>
          ))}
        </div>
      );
    }
    return (
      <Badge variant="secondary">
        {paymentLabels[sale.paymentMethod] || sale.paymentMethod}
      </Badge>
    );
  };

  // Can refund: only completed or crediario_paid sales
  const canRefund = (sale: Sale) => {
    return sale.status === 'completed' || sale.status === 'crediario_paid' || !sale.status;
  };

  return (
    <Layout>
      <PageHeader
        title="Histórico de Vendas"
        description={`Total hoje: ${formatCurrency(totalToday)}`}
      />

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou data..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredSales.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhuma venda encontrada"
          description={search ? "Tente buscar com outros termos" : "As vendas realizadas aparecerão aqui"}
        />
      ) : (
        <div className="grid gap-4">
          {filteredSales.map(sale => (
            <Card key={sale.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{sale.clientName || 'Cliente não identificado'}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(sale.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-bold ${sale.status === 'refunded' ? 'line-through text-muted-foreground' : ''}`}>
                        {formatCurrency(sale.total)}
                      </p>
                      <div className="flex flex-col items-end gap-1 mt-1">
                        {getStatusBadge(sale)}
                        {getPaymentDisplay(sale)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => printReceipt(sale)} title="Imprimir">
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => downloadReceipt(sale)} title="Baixar PDF">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setSelectedSale(sale)} title="Ver detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Venda</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground">
                {format(new Date(selectedSale.createdAt), "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </div>

              <div className="space-y-2">
                <p className="font-medium">Cliente</p>
                <p className="text-muted-foreground">{selectedSale.clientName || 'Não identificado'}</p>
              </div>

              <div className="space-y-2">
                <p className="font-medium">Itens</p>
                <div className="space-y-2">
                  {selectedSale.items.map((item, idx) => {
                    const product = products.find(p => p.id === item.productId);
                    const costPrice = item.costPrice ?? product?.costPrice ?? 0;
                    const profit = (item.unitPrice - costPrice) * item.quantity;

                    return (
                      <div key={idx} className="flex justify-between p-2 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity}x {formatCurrency(item.unitPrice)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Custo unit.: {formatCurrency(costPrice)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(item.total)}</p>
                          <p className={`text-xs ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Lucro: {formatCurrency(profit)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedSale.subtotal)}</span>
                </div>
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desconto:</span>
                    <span>-{formatCurrency(selectedSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(selectedSale.total)}</span>
                </div>

                {(() => {
                   const totalCost = selectedSale.items.reduce((acc, item) => {
                     const product = products.find(p => p.id === item.productId);
                     const cost = item.costPrice ?? product?.costPrice ?? 0;
                     return acc + (cost * item.quantity);
                   }, 0);
                   const totalProfit = selectedSale.total - totalCost;

                   return (
                      <div className="flex justify-between text-sm pt-2 border-t border-dashed">
                        <span className="text-muted-foreground">Lucro da Venda:</span>
                        <span className={`font-medium ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(totalProfit)}
                        </span>
                      </div>
                   );
                })()}

                <div className="flex justify-between text-sm pt-2">
                  <span>Pagamento:</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {getStatusBadge(selectedSale)}
                    {selectedSale.paymentEntries && selectedSale.paymentEntries.length > 1 ? (
                      selectedSale.paymentEntries.map((entry, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {paymentLabels[entry.method] || entry.method}: {formatCurrency(entry.amount)}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="secondary">{paymentLabels[selectedSale.paymentMethod] || selectedSale.paymentMethod}</Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => printReceipt(selectedSale)}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                  <Button className="flex-1" onClick={() => downloadReceipt(selectedSale)}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar PDF
                  </Button>
                </div>

                {canRefund(selectedSale) && (
                  <div className="pt-2 border-t mt-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full">
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Estornar Venda
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Confirmar estorno
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja estornar esta venda?
                            <br />
                            {'\u2022'} O valor de <strong>{formatCurrency(selectedSale.total)}</strong> será revertido.
                            <br />
                            {'\u2022'} Os itens voltarão para o estoque.
                            <br />
                            {'\u2022'} Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRefund(selectedSale)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Confirmar Estorno
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
