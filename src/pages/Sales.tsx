import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/use-toast';
import { Sale, Product, Installment, CreditPayment, Client, ReturnRecord, SaleItem } from '@/types';
import { History, Search, Eye, Calendar, Printer, Download, AlertTriangle, RotateCcw, FileDown } from 'lucide-react';
import { exportToCSV } from '@/lib/csvExport';
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
import { Checkbox } from '@/components/ui/checkbox';
import { printReceipt, downloadReceipt } from '@/lib/generateReceipt';
import { formatCurrency, roundCurrency, paymentLabels } from '@/lib/formatters';
import { processReturn } from '@/lib/processReturn';
import { processRefund } from '@/lib/processRefund';
import type { ProcessRefundResult } from '@/lib/processRefund';

export default function Sales() {
  const [sales, setSales] = useLocalStorage<Sale[]>('sales', []);
  const [products, setProducts] = useLocalStorage<Product[]>('products', []);
  const [installments, setInstallments] = useLocalStorage<Installment[]>('installments', []);
  const [clients, setClients] = useLocalStorage<Client[]>('clients', []);
  const [creditPayments] = useLocalStorage<CreditPayment[]>('credit_payments', []);
  const [returns, setReturns] = useLocalStorage<ReturnRecord[]>('returns', []);
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Return from sale dialog
  const [returnMode, setReturnMode] = useState(false);
  const [returnItems, setReturnItems] = useState<{ item: SaleItem; quantity: number; selected: boolean }[]>([]);

  // Haver-vs-cash decision dialog for estorno (EST-03)
  const [pendingRefund, setPendingRefund] = useState<{ sale: Sale; result: ProcessRefundResult } | null>(null);

  const handleExport = () => {
    exportToCSV('vendas',
      ['Data', 'Cliente', 'Itens', 'Subtotal', 'Desconto', 'Total', 'Pagamento', 'Status'],
      filteredSales.map(s => [
        format(new Date(s.createdAt), 'dd/MM/yyyy HH:mm'),
        s.clientName || 'Sem cliente',
        s.items.map(i => `${i.quantity}x ${i.productName}`).join(', '),
        s.subtotal.toFixed(2), s.discount.toFixed(2), s.total.toFixed(2),
        paymentLabels[s.paymentMethod] || s.paymentMethod,
        s.status || 'completed'
      ])
    );
  };

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
      case 'custom': {
        if (!dateFrom && !dateTo) return true;
        const d = new Date(s.createdAt);
        if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false;
        if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
        return true;
      }
      default:
        return true;
    }
  });



  const totalToday = sales
    .filter(s => new Date(s.createdAt).toDateString() === new Date().toDateString())
    .filter(s => s.status !== 'refunded')
    .reduce((sum, s) => sum + s.total, 0);

  const handleRefund = (sale: Sale) => {
    // Idempotency guard: already refunded
    if (sale.status === 'refunded') return;

    // Compute all refund effects via the pure core (EST-01..04)
    const result = processRefund({
      sale,
      products,
      installments,
      alreadyReturnedQtys: getReturnedQuantities(sale.id),
    });

    // Apply double-restock-safe stock update immediately (no UI decision needed for stock)
    setProducts(result.updatedProducts);

    // Cancel only open/overdue installments (EST-02); uses cancelledInstallmentIds.includes — idempotent
    setInstallments(installments.map(inst =>
      result.cancelledInstallmentIds.includes(inst.id)
        ? { ...inst, status: 'cancelled' as const }
        : inst
    ));

    // Decide flow based on whether a financial decision is needed (EST-03)
    if (result.isCrediarioSale && result.paidAmount > 0) {
      // Open the haver-vs-cash decision dialog; persist after user chooses
      setPendingRefund({ sale, result });
    } else if (!result.isCrediarioSale) {
      // Non-crediário sale (cash/card/pix): record as cash-out, storeCredit untouched
      finalizeRefund(sale, result, 'cash');
    } else {
      // Crediário with zero paid: just cancel debt, no financial transfer (EST-01)
      finalizeRefund(sale, result, 'none');
    }
  };

  /**
   * Apply the final state mutations for a refund after the operator has chosen
   * the financial mode ('haver' | 'cash' | 'none').
   *
   * All three modes persist cancelledInstallmentIds on the refunded sale (EST-02 audit trail).
   * haver:  increments client.storeCredit by roundCurrency(paidAmount); no cashRefundOut.
   * cash:   sets sale.cashRefundOut = roundCurrency(paidAmount); no storeCredit change.
   * none:   no financial transfer (zero-paid crediário — EST-01).
   */
  const finalizeRefund = (sale: Sale, result: ProcessRefundResult, mode: 'haver' | 'cash' | 'none') => {
    const paid = roundCurrency(result.paidAmount);

    if (mode === 'haver' && sale.clientId) {
      // Haver path: increment client storeCredit by exactly roundCurrency(paidAmount) (T-03-04)
      setClients(clients.map(c =>
        c.id === sale.clientId
          ? { ...c, storeCredit: roundCurrency((c.storeCredit || 0) + paid), updatedAt: new Date().toISOString() }
          : c
      ));
      // Mark sale refunded + persist cancelledInstallmentIds (no cashRefundOut on haver path)
      setSales(sales.map(s =>
        s.id === sale.id
          ? { ...s, status: 'refunded' as const, cancelledInstallmentIds: result.cancelledInstallmentIds }
          : s
      ));
      setSelectedSale(null);
      setPendingRefund(null);
      toast({
        title: "Venda estornada",
        description: `Estoque restaurado, parcelas canceladas e ${formatCurrency(paid)} adicionado como crédito em haver.`,
      });
    } else if (mode === 'cash') {
      // Cash path: record cashRefundOut on refunded sale (EST-03b); storeCredit untouched (T-03-04)
      setSales(sales.map(s =>
        s.id === sale.id
          ? { ...s, status: 'refunded' as const, cancelledInstallmentIds: result.cancelledInstallmentIds, cashRefundOut: paid }
          : s
      ));
      setSelectedSale(null);
      setPendingRefund(null);
      if (result.isCrediarioSale) {
        toast({
          title: "Venda estornada",
          description: `Estoque restaurado, parcelas canceladas. Saída de caixa: ${formatCurrency(paid)}.`,
        });
      } else {
        toast({
          title: "Venda estornada",
          description: "O estoque foi atualizado e a venda marcada como estornada.",
        });
      }
    } else {
      // mode === 'none': zero-paid crediário — cancel debt only, no financial transfer (EST-01)
      setSales(sales.map(s =>
        s.id === sale.id
          ? { ...s, status: 'refunded' as const, cancelledInstallmentIds: result.cancelledInstallmentIds }
          : s
      ));
      setSelectedSale(null);
      setPendingRefund(null);
      toast({
        title: "Venda estornada",
        description: "Parcelas canceladas. Nenhum valor pago — nenhum haver gerado.",
      });
    }
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
  // Return helpers
  const getReturnedQuantities = (saleId: string): Record<string, number> => {
    const saleReturns = returns.filter(r => r.originalSaleId === saleId && !r.reversedAt);
    const quantities: Record<string, number> = {};
    saleReturns.forEach(r => {
      r.items.forEach(item => {
        quantities[item.productId] = (quantities[item.productId] || 0) + item.quantity;
      });
    });
    return quantities;
  };

  const initiateReturn = (sale: Sale) => {
    const returnedQtys = getReturnedQuantities(sale.id);
    const items = sale.items
      .map(item => {
        const alreadyReturned = returnedQtys[item.productId] || 0;
        const maxReturnable = item.quantity - alreadyReturned;
        return { item, quantity: maxReturnable > 0 ? maxReturnable : 0, selected: maxReturnable > 0 };
      })
      .filter(ri => ri.quantity > 0);

    if (items.length === 0) {
      toast({ title: "Todos os itens já foram devolvidos", description: "Não há itens disponíveis para devolução." });
      return;
    }
    setReturnItems(items);
    setReturnMode(true);
  };

  const returnTotal = returnItems
    .filter(ri => ri.selected && ri.quantity > 0)
    .reduce((sum, ri) => sum + ri.quantity * ri.item.unitPrice, 0);

  const handleReturnFromSale = () => {
    if (!selectedSale) return;
    const itemsToReturn = returnItems.filter(ri => ri.selected && ri.quantity > 0);
    if (itemsToReturn.length === 0) {
      toast({ title: "Selecione itens", description: "Selecione pelo menos um item para devolver." });
      return;
    }

    const hasClient = !!selectedSale.clientId;
    const clientObj = hasClient ? clients.find(c => c.id === selectedSale.clientId) : null;
    const alreadyReturnedQtys = getReturnedQuantities(selectedSale.id);

    const { returnRecord, updatedProducts, updatedClients, allItemsReturned } = processReturn({
      sale: selectedSale,
      itemsToReturn: itemsToReturn.map(ri => ({
        productId: ri.item.productId,
        productName: ri.item.productName,
        quantity: ri.quantity,
        unitPrice: ri.item.unitPrice,
        costPrice: ri.item.costPrice,
      })),
      products,
      clients,
      clientId: selectedSale.clientId,
      clientName: clientObj?.name || selectedSale.clientName || 'Sem cliente',
      alreadyReturnedQtys,
    });

    const updatedSales = allItemsReturned
      ? sales.map(s => s.id === selectedSale.id ? { ...s, status: 'refunded' as const } : s)
      : sales;

    setProducts(updatedProducts);
    setClients(updatedClients);
    setSales(updatedSales);
    setReturns([...returns, returnRecord]);
    setSelectedSale(null);
    setReturnMode(false);
    setReturnItems([]);

    toast({
      title: "Devolução registrada",
      description: hasClient
        ? `${formatCurrency(returnRecord.totalRefunded)} adicionado ao crédito em haver do cliente.`
        : `Estoque restaurado. (Sem cliente, crédito não gerado)`,
    });
  };

  const canRefund = (sale: Sale) => {
    return sale.status === 'completed' || sale.status === 'crediario_paid' || sale.status === 'crediario_pending' || !sale.status;
  };

  const canReturn = (sale: Sale) => {
    if (sale.status === 'refunded') return false;
    const returnedQtys = getReturnedQuantities(sale.id);
    return sale.items.some(item => (item.quantity - (returnedQtys[item.productId] || 0)) > 0);
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
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
        {period === 'custom' && (
          <div className="flex gap-2">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[160px]" />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[160px]" />
          </div>
        )}
        <Button variant="outline" onClick={handleExport}>
          <FileDown className="h-4 w-4 mr-2" />
          Exportar
        </Button>
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
                      {canReturn(sale) && (
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedSale(sale); setTimeout(() => initiateReturn(sale), 100); }} title="Devolver itens">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
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

      <Dialog open={!!selectedSale} onOpenChange={() => { setSelectedSale(null); setReturnMode(false); setReturnItems([]); setPendingRefund(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
                          {entry.cardFeePercent ? ` (${entry.cardFeePercent}%)` : ''}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="secondary">
                        {paymentLabels[selectedSale.paymentMethod] || selectedSale.paymentMethod}
                        {selectedSale.cardInstallments && selectedSale.cardInstallments > 1 ? ` ${selectedSale.cardInstallments}x` : ''}
                      </Badge>
                    )}
                  </div>
                </div>

                {selectedSale.cardFeePercent != null && selectedSale.cardFeeAmount != null && (
                  <div className="flex justify-between text-sm p-2 bg-amber-50 dark:bg-amber-950 rounded border border-amber-200 dark:border-amber-800">
                    <span className="text-amber-700 dark:text-amber-300">Taxa maquininha ({selectedSale.cardFeePercent}%)</span>
                    <span className="font-medium text-amber-700 dark:text-amber-300">
                      -{formatCurrency(selectedSale.cardFeeAmount)} | Líq: {formatCurrency(selectedSale.total - selectedSale.cardFeeAmount)}
                    </span>
                  </div>
                )}

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

                {canReturn(selectedSale) && !returnMode && (
                  <Button variant="secondary" className="w-full" onClick={() => initiateReturn(selectedSale)}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Devolver Itens
                  </Button>
                )}

                {returnMode && (
                  <div className="pt-2 border-t mt-2 space-y-3">
                    <p className="font-medium text-sm">Selecione os itens para devolução:</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {returnItems.map((ri, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                          <Checkbox
                            checked={ri.selected}
                            onCheckedChange={(checked) => {
                              const updated = [...returnItems];
                              updated[idx] = { ...updated[idx], selected: !!checked };
                              setReturnItems(updated);
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ri.item.productName}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(ri.item.unitPrice)} un.</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Qtd:</span>
                            <Input
                              type="number"
                              min={1}
                              max={ri.item.quantity - (getReturnedQuantities(selectedSale.id)[ri.item.productId] || 0)}
                              value={ri.quantity}
                              onChange={(e) => {
                                const val = Math.max(1, Math.min(
                                  ri.item.quantity - (getReturnedQuantities(selectedSale.id)[ri.item.productId] || 0),
                                  parseInt(e.target.value) || 1
                                ));
                                const updated = [...returnItems];
                                updated[idx] = { ...updated[idx], quantity: val };
                                setReturnItems(updated);
                              }}
                              className="w-16 h-8 text-center"
                              disabled={!ri.selected}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {returnTotal > 0 && (
                      <div className="flex justify-between text-sm font-medium p-2 bg-amber-50 dark:bg-amber-950 rounded">
                        <span>Crédito em haver:</span>
                        <span>{formatCurrency(returnTotal)}</span>
                      </div>
                    )}
                    {!selectedSale.clientId && (
                      <p className="text-xs text-amber-600">Venda sem cliente — estoque será restaurado, mas crédito em haver não será gerado.</p>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => { setReturnMode(false); setReturnItems([]); }}>
                        Cancelar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button className="flex-1" disabled={returnItems.filter(ri => ri.selected).length === 0}>
                            Confirmar Devolução
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar devolução</AlertDialogTitle>
                            <AlertDialogDescription>
                              {returnItems.filter(ri => ri.selected).length} item(ns) serão devolvidos.
                              {selectedSale.clientId
                                ? ` ${formatCurrency(returnTotal)} será adicionado como crédito em haver.`
                                : ' O estoque será restaurado (sem crédito — venda sem cliente).'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleReturnFromSale}>
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}

                {canRefund(selectedSale) && !returnMode && (
                  <div className="pt-2 border-t mt-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Estornar Venda
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Confirmar estorno
                          </AlertDialogTitle>
                          <AlertDialogDescription asChild>
                            <div>
                              Tem certeza que deseja estornar esta venda?
                              <br />
                              {'•'} O valor de <strong>{formatCurrency(selectedSale.total)}</strong> será revertido.
                              <br />
                              {'•'} Os itens voltarão para o estoque.
                              {(selectedSale.status === 'crediario_pending' || selectedSale.status === 'crediario_paid') && (
                                <>
                                  <br />
                                  {'•'} As parcelas em aberto serão canceladas.
                                  {(() => {
                                    const paid = roundCurrency(installments
                                      .filter(i => i.saleId === selectedSale.id)
                                      .reduce((sum, i) => sum + i.amountPaid, 0));
                                    return paid > 0 ? (
                                      <>
                                        <br />
                                        {'•'} <strong>{formatCurrency(paid)}</strong> ja pago &mdash; voce escolhera como devolver (haver ou dinheiro).
                                      </>
                                    ) : null;
                                  })()}
                                </>
                              )}
                              <br />
                              {'•'} Esta acao nao pode ser desfeita.
                            </div>
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

      {/* EST-03: Haver-vs-cash decision dialog — shown after estorno computed, before persisting sale status */}
      <AlertDialog open={!!pendingRefund} onOpenChange={(open) => { if (!open) setPendingRefund(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Devolver valor pago</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {pendingRefund && (
                  <>
                    <p>
                      O cliente pagou <strong>{formatCurrency(roundCurrency(pendingRefund.result.paidAmount))}</strong> nesta venda.
                      Como deseja devolver este valor?
                    </p>
                    {pendingRefund.result.otherPaid > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Inclui {formatCurrency(pendingRefund.result.otherPaid)} pago em dinheiro/entrada (nao crediario).
                      </p>
                    )}
                    {!pendingRefund.sale.clientId && (
                      <p className="mt-2 text-xs text-amber-600">
                        Venda sem cliente vinculado — a opcao Haver nao esta disponivel.
                      </p>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setPendingRefund(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRefund && finalizeRefund(pendingRefund.sale, pendingRefund.result, 'cash')}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Devolver em Dinheiro (Saida de Caixa)
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => pendingRefund && finalizeRefund(pendingRefund.sale, pendingRefund.result, 'haver')}
              disabled={!pendingRefund?.sale.clientId}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Gerar Haver (Credito)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
