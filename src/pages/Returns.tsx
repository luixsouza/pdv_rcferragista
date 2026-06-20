import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Sale, Client, Product, SaleItem, ReturnRecord, Installment, CreditPayment } from '@/types';
import { RotateCcw, Search, Package, User, ChevronRight, Gift, Hash, AlertTriangle, Printer, Download, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ClientCombobox } from '@/components/ClientCombobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { printRefundReceipt, downloadRefundReceipt } from '@/lib/generateReceipt';
import { processReturn, processAbatement } from '@/lib/processReturn';
import { getEffectiveStatus } from '@/lib/installmentStatus';

export default function Returns() {
  const [sales, setSales] = useLocalStorage<Sale[]>('sales', []);
  const [clients, setClients] = useLocalStorage<Client[]>('clients', []);
  const [products, setProducts] = useLocalStorage<Product[]>('products', []);
  const [returns, setReturns] = useLocalStorage<ReturnRecord[]>('returns', []);
  // DEV-06: installments slice for capping + cancellation (BUG-2 fix) and abatimento
  const [installments, setInstallments] = useLocalStorage<Installment[]>('installments', []);
  // Audit trail for abatimento CreditPayments (DEV-05 / DEV-07)
  const [creditPayments, setCreditPayments] = useLocalStorage<CreditPayment[]>('credit_payments', []);

  // New return flow
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<{ item: SaleItem; quantity: number; selected: boolean }[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Modality state (DEV-04 / DEV-05)
  const [returnModality, setReturnModality] = useState<'haver' | 'abatimento'>('haver');
  const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<string[]>([]);

  // Search by sale code (alternative to client flow)
  const [saleCodeSearch, setSaleCodeSearch] = useState('');

  // History
  const [searchHistory, setSearchHistory] = useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const client = clients.find(c => c.id === selectedClient);

  // DEV-06 (BUG-4 fix): include crediario_pending alongside completed and crediario_paid,
  // aligns with Sales.tsx canReturn logic. Excludes 'refunded'.
  const eligibleSales = sales
    .filter(s => s.status === 'completed' || s.status === 'crediario_paid' || s.status === 'crediario_pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Client's sales (when client is selected)
  const clientSales = selectedClient
    ? eligibleSales.filter(s => s.clientId === selectedClient)
    : [];

  // Search sales by code
  const searchedSales = saleCodeSearch.trim().length >= 3
    ? eligibleSales.filter(s =>
        s.id.toUpperCase().includes(saleCodeSearch.trim().toUpperCase()) ||
        (s.clientName && s.clientName.toLowerCase().includes(saleCodeSearch.trim().toLowerCase()))
      )
    : [];

  // Select sale directly from code search (may not have client)
  const selectSaleFromSearch = (sale: Sale) => {
    if (sale.clientId) {
      setSelectedClient(sale.clientId);
    }
    selectSale(sale);
  };

  // Get already returned quantities for a sale
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

  const selectSale = (sale: Sale) => {
    const returnedQtys = getReturnedQuantities(sale.id);
    setSelectedSale(sale);
    setReturnItems(
      sale.items
        .map(item => {
          const alreadyReturned = returnedQtys[item.productId] || 0;
          const maxReturnable = item.quantity - alreadyReturned;
          return {
            item,
            quantity: maxReturnable > 0 ? maxReturnable : 0,
            selected: maxReturnable > 0,
          };
        })
        .filter(ri => {
          const alreadyReturned = returnedQtys[ri.item.productId] || 0;
          return ri.item.quantity - alreadyReturned > 0;
        })
    );
    // Reset modality on sale selection
    setReturnModality('haver');
    setSelectedInstallmentIds([]);
    setStep(3);
  };

  const totalRefund = returnItems
    .filter(ri => ri.selected && ri.quantity > 0)
    .reduce((sum, ri) => sum + ri.quantity * ri.item.unitPrice, 0);

  // Derive open/overdue installments for the selected sale (for abatimento picker)
  const saleOpenInstallments = useMemo(() => {
    if (!selectedSale) return [];
    return installments.filter(
      i => i.saleId === selectedSale.id &&
           (getEffectiveStatus(i) === 'open' || getEffectiveStatus(i) === 'overdue')
    );
  }, [installments, selectedSale]);

  // Determine if the selected sale is a crediário sale (for modality selector visibility)
  const isCrediarioSale = selectedSale
    ? (selectedSale.paymentMethod === 'crediario' ||
       selectedSale.paymentEntries?.some(e => e.method === 'crediario') === true ||
       selectedSale.status === 'crediario_pending' ||
       selectedSale.status === 'crediario_paid')
    : false;

  // Live abatimento preview (display only — full calc runs in handleReturn)
  const abatimentoPreview = useMemo(() => {
    if (returnModality !== 'abatimento' || selectedInstallmentIds.length === 0 || !selectedSale) {
      return null;
    }
    return processAbatement({
      sale: selectedSale,
      returnValue: totalRefund,
      selectedInstallmentIds,
      installments,
      clientId: selectedClient,
      clientName: client?.name || selectedSale.clientName || '',
    });
  }, [returnModality, selectedInstallmentIds, totalRefund, installments, selectedSale, selectedClient, client]);

  const handleReturn = () => {
    if (!selectedSale) return;

    const itemsToReturn = returnItems.filter(ri => ri.selected && ri.quantity > 0);

    if (itemsToReturn.length === 0) {
      toast.error('Selecione pelo menos um item para devolver');
      return;
    }

    // Validate quantities (Returns.tsx-specific pre-call guard — preserved from original)
    const returnedQtys = getReturnedQuantities(selectedSale.id);
    for (const ri of itemsToReturn) {
      const alreadyReturned = returnedQtys[ri.item.productId] || 0;
      const maxReturnable = ri.item.quantity - alreadyReturned;
      if (ri.quantity > maxReturnable) {
        toast.error(`Quantidade máxima para "${ri.item.productName}" é ${maxReturnable}`);
        return;
      }
    }

    const hasClient = !!selectedClient;

    // Build shared return record (stock restoration + base returnRecord)
    const { returnRecord, updatedProducts, updatedClients, allItemsReturned, cancelledInstallmentIds } = processReturn({
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
      clientId: selectedClient || undefined,
      clientName: client?.name || selectedSale.clientName || 'Sem cliente',
      alreadyReturnedQtys: returnedQtys,
      installments, // DEV-06: pass installments for haver capping + cancelledInstallmentIds
    });

    const updatedSales = allItemsReturned
      ? sales.map(s => s.id === selectedSale.id ? { ...s, status: 'refunded' as const } : s)
      : sales;

    if (returnModality === 'abatimento') {
      // D-05: Abatimento modality — no haver, reduce chosen installments
      if (!selectedClient) {
        toast.error('Abatimento de débito requer um cliente vinculado');
        return;
      }
      if (selectedInstallmentIds.length === 0) {
        toast.error('Selecione pelo menos uma parcela para abater');
        return;
      }

      // W-5: Force creditGenerated = 0 — abatimento NEVER mints haver (literal zero assignment)
      returnRecord.creditGenerated = 0;

      // Call processAbatement to reduce chosen installments
      const abResult = processAbatement({
        sale: selectedSale,
        returnValue: returnRecord.totalRefunded,
        selectedInstallmentIds,
        installments,
        clientId: selectedClient,
        clientName: client?.name || selectedSale.clientName || 'Sem cliente',
      });

      // Persist abatedMap on returnRecord for DEV-07 reversal
      returnRecord.abatedInstallments = abResult.abatedMap;

      // BUG-2 (abatimento branch): also cancel open/overdue on full return
      if (cancelledInstallmentIds.length > 0) {
        // Merge: first apply abatement updates, then cancel open/overdue
        const afterAbatement = abResult.updatedInstallments.map(inst =>
          cancelledInstallmentIds.includes(inst.id) ? { ...inst, status: 'cancelled' as const } : inst
        );
        setInstallments(afterAbatement);
      } else {
        setInstallments(abResult.updatedInstallments);
      }

      // Persist abatimento CreditPayments (audit trail T-04-02)
      setCreditPayments([...creditPayments, ...abResult.creditPayments]);

      // Apply product stock (from processReturn); do NOT touch clients (no storeCredit change)
      setProducts(updatedProducts);
      // Do NOT call setClients — updatedClients would increment storeCredit; abatimento skips it
      setSales(updatedSales);
      setReturns([...returns, returnRecord]);

      // Reset
      setSelectedSale(null);
      setReturnItems([]);
      setStep(1);
      setSelectedClient('');
      setSaleCodeSearch('');
      setReturnModality('haver');
      setSelectedInstallmentIds([]);

      if (abResult.residual > 0) {
        toast.warning(
          `Devolução registrada em abatimento. Parcelas reduzidas. Excedente de ${formatCurrency(abResult.residual)} NÃO aplicado — selecione mais parcelas se necessário.`
        );
      } else {
        toast.success(`Devolução registrada! ${formatCurrency(abResult.abatedTotal)} abatido nas parcelas selecionadas. Nenhum haver gerado.`);
      }
    } else {
      // D-04: Haver modality — use capped creditGenerated from processReturn
      // BUG-2 fix: cancel open/overdue installments on full crediário return
      if (cancelledInstallmentIds.length > 0) {
        setInstallments(
          installments.map(inst =>
            cancelledInstallmentIds.includes(inst.id)
              ? { ...inst, status: 'cancelled' as const }
              : inst
          )
        );
      }

      setProducts(updatedProducts);
      setClients(updatedClients);
      setSales(updatedSales);
      setReturns([...returns, returnRecord]);

      // Reset
      setSelectedSale(null);
      setReturnItems([]);
      setStep(1);
      setSelectedClient('');
      setSaleCodeSearch('');
      setReturnModality('haver');
      setSelectedInstallmentIds([]);

      if (hasClient) {
        // Toast reflects capped creditGenerated (not totalRefund)
        toast.success(`Devolução registrada! ${formatCurrency(returnRecord.creditGenerated)} adicionado ao crédito em haver do cliente.`);
      } else {
        toast.success(`Devolução registrada! Estoque restaurado. (Sem cliente vinculado, crédito não gerado)`);
      }
    }
  };

  const handleReverseReturn = (ret: ReturnRecord) => {
    // 1. Deduct stock (reverse the restoration)
    const updatedProducts = products.map(product => {
      const returnItem = ret.items.find(ri => ri.productId === product.id);
      if (returnItem) {
        const deduction = product.unit === 'mil' ? returnItem.quantity / 1000 : returnItem.quantity;
        return { ...product, stock: product.stock - deduction, updatedAt: new Date().toISOString() };
      }
      return product;
    });

    // 2. Deduct store credit from client — only for haver-modality returns (ret.creditGenerated > 0)
    // D-07: abatimento reversal does NOT touch storeCredit
    const updatedClients = ret.creditGenerated > 0 && ret.clientId !== 'sem-cliente'
      ? clients.map(c => {
          if (c.id !== ret.clientId) return c;
          const newCredit = Math.max(0, (c.storeCredit || 0) - ret.creditGenerated);
          return { ...c, storeCredit: newCredit, updatedAt: new Date().toISOString() };
        })
      : clients;

    // 3. Mark return as reversed
    const updatedReturns = returns.map(r =>
      r.id === ret.id ? { ...r, reversedAt: new Date().toISOString() } : r
    );

    // 4. If original sale was marked refunded, restore its status
    const originalSale = sales.find(s => s.id === ret.originalSaleId);
    if (originalSale && originalSale.status === 'refunded') {
      const otherActiveReturns = updatedReturns.filter(r => r.originalSaleId === ret.originalSaleId && !r.reversedAt);
      const returnedQtys: Record<string, number> = {};
      otherActiveReturns.forEach(r => r.items.forEach(item => {
        returnedQtys[item.productId] = (returnedQtys[item.productId] || 0) + item.quantity;
      }));
      const allStillReturned = originalSale.items.every(item => (returnedQtys[item.productId] || 0) >= item.quantity);

      if (!allStillReturned) {
        const restoredStatus = originalSale.crediarioPaid !== undefined ? 'crediario_paid' : 'completed';
        setSales(sales.map(s => s.id === ret.originalSaleId ? { ...s, status: restoredStatus as Sale['status'] } : s));
      }
    }

    // 5. D-07: Restore cancelled installments to 'open' (overdue re-evaluated on next mount via getEffectiveStatus)
    // Guard: legacy records without cancelledInstallmentIds won't crash
    let restoredInstallments = installments;
    if (ret.cancelledInstallmentIds && ret.cancelledInstallmentIds.length > 0) {
      restoredInstallments = restoredInstallments.map(inst =>
        ret.cancelledInstallmentIds!.includes(inst.id)
          ? { ...inst, status: 'open' as const, paidAt: undefined }
          : inst
      );
    }

    // 6. D-07: Reverse abatimento discountApplied if present (abatimento modality reversal)
    // Identified by abatedInstallments presence (the map was recorded on the ReturnRecord in handleReturn)
    if (ret.abatedInstallments && ret.abatedInstallments.length > 0) {
      restoredInstallments = restoredInstallments.map(inst => {
        const entry = ret.abatedInstallments!.find(a => a.installmentId === inst.id);
        if (!entry) return inst;

        // Math.max(0, ...) guard — prevents negative discountApplied (FINANCIAL-PITFALLS §6)
        const newDiscount = Math.max(0, (inst.discountApplied || 0) - entry.amount);
        // If installment was marked 'paid' purely by the abatement discount and it is no longer covered, restore 'open'
        const wasPaidByAbatement = inst.status === 'paid' && inst.paidAt !== undefined;
        const stillCovered = (inst.amountPaid + newDiscount) >= inst.amount;
        const newStatus: Installment['status'] =
          wasPaidByAbatement && !stillCovered ? 'open' : inst.status;
        const newPaidAt = newStatus === 'open' ? undefined : inst.paidAt;

        return {
          ...inst,
          discountApplied: newDiscount,
          status: newStatus,
          paidAt: newPaidAt,
        };
      });

      // Remove abatimento CreditPayments created for this return (by saleId + type 'abatimento')
      // The abatedInstallments map identifies exactly which installments were touched
      const abatedInstallmentIds = ret.abatedInstallments.map(a => a.installmentId);
      setCreditPayments(
        creditPayments.filter(
          cp => !(cp.type === 'abatimento' &&
                  cp.saleId === ret.originalSaleId &&
                  cp.installmentId !== undefined &&
                  abatedInstallmentIds.includes(cp.installmentId))
        )
      );
    }

    // Apply single setInstallments call (D-07: covers both cancellation restore + abatimento restore)
    if (restoredInstallments !== installments) {
      setInstallments(restoredInstallments);
    }

    setProducts(updatedProducts);
    setClients(updatedClients);
    setReturns(updatedReturns);

    const clientObj = clients.find(c => c.id === ret.clientId);
    const hadCancelledInstallments = ret.cancelledInstallmentIds && ret.cancelledInstallmentIds.length > 0;
    const hadAbatimento = ret.abatedInstallments && ret.abatedInstallments.length > 0;

    if (ret.creditGenerated > 0 && clientObj && (clientObj.storeCredit || 0) < ret.creditGenerated) {
      toast.warning(`Devolução estornada. Atenção: crédito do cliente era menor que ${formatCurrency(ret.creditGenerated)}, saldo zerado.`);
    } else if (hadCancelledInstallments && hadAbatimento) {
      toast.success('Devolução estornada. Estoque, parcelas canceladas e abatimento revertidos.');
    } else if (hadCancelledInstallments) {
      toast.success('Devolução estornada. Estoque e parcelas canceladas restaurados.');
    } else if (hadAbatimento) {
      toast.success('Devolução estornada. Estoque e abatimento de parcelas revertidos.');
    } else {
      toast.success('Devolução estornada. Estoque e crédito ajustados.');
    }
  };

  const resetFlow = () => {
    setSelectedSale(null);
    setReturnItems([]);
    setSaleCodeSearch('');
    setReturnModality('haver');
    setSelectedInstallmentIds([]);
    setStep(1);
  };

  // History
  const filteredHistory = returns
    .filter(r => {
      if (!searchHistory) return true;
      return r.clientName.toLowerCase().includes(searchHistory.toLowerCase()) ||
        format(new Date(r.createdAt), 'dd/MM/yyyy').includes(searchHistory);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Layout>
      <PageHeader
        title="Devoluções"
        description="Registre devoluções e gere crédito em haver para clientes"
      />

      <Tabs defaultValue="new" className="space-y-6">
        <TabsList>
          <TabsTrigger value="new">Nova Devolução</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6">
          {/* Step indicators */}
          {!selectedSale && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={step >= 1 ? "default" : "secondary"}>1. Encontrar Venda</Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant={step >= 3 ? "default" : "secondary"}>2. Selecionar Itens</Badge>
            </div>
          )}

          {/* Find Sale: Two options */}
          {!selectedSale && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: By Client */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Buscar por Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ClientCombobox
                    clients={clients}
                    value={selectedClient}
                    onChange={(value) => {
                      setSelectedClient(value);
                      setSelectedSale(null);
                      setReturnItems([]);
                      setSaleCodeSearch('');
                    }}
                  />
                  {client && (client.storeCredit || 0) > 0 && (
                    <div className="mt-3 flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                      <Gift className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-green-700 dark:text-green-300">
                        Crédito em haver: <strong>{formatCurrency(client.storeCredit || 0)}</strong>
                      </span>
                    </div>
                  )}

                  {selectedClient && (
                    <div className="mt-3 space-y-2 max-h-48 overflow-auto">
                      {clientSales.length === 0 ? (
                        <p className="text-muted-foreground text-center py-3 text-sm">
                          Nenhuma venda elegível para devolução
                        </p>
                      ) : (
                        clientSales.map(sale => (
                          <div
                            key={sale.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => selectSale(sale)}
                          >
                            <div>
                              <p className="text-sm font-medium">
                                #{sale.id.slice(0, 8).toUpperCase()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(sale.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                                {' - '}{sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{formatCurrency(sale.total)}</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Option 2: By Sale Code */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Buscar por Código da Venda
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Digite o código ou nome do cliente..."
                      value={saleCodeSearch}
                      onChange={e => {
                        setSaleCodeSearch(e.target.value);
                        setSelectedClient('');
                      }}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Busque pelo código da venda (ex: A1B2C3D4) ou nome do cliente
                  </p>

                  {saleCodeSearch.trim().length >= 3 && (
                    <div className="mt-3 space-y-2 max-h-48 overflow-auto">
                      {searchedSales.length === 0 ? (
                        <p className="text-muted-foreground text-center py-3 text-sm">
                          Nenhuma venda encontrada
                        </p>
                      ) : (
                        searchedSales.slice(0, 10).map(sale => (
                          <div
                            key={sale.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => selectSaleFromSearch(sale)}
                          >
                            <div>
                              <p className="text-sm font-medium">
                                #{sale.id.slice(0, 8).toUpperCase()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {sale.clientName || 'Sem cliente'} - {format(new Date(sale.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{formatCurrency(sale.total)}</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Selected sale info */}
          {selectedSale && !returnItems.length && (
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Venda #{selectedSale.id.slice(0, 8).toUpperCase()} - {formatCurrency(selectedSale.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedSale.clientName || 'Sem cliente'} - {format(new Date(selectedSale.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={resetFlow}>Trocar venda</Button>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Select Items + Modality */}
          {step === 3 && selectedSale && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Selecionar Itens para Devolver
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      #{selectedSale.id.slice(0, 8).toUpperCase()} - {selectedSale.clientName || 'Sem cliente'}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={resetFlow}>Trocar</Button>
                  </div>
                </div>
                {!selectedClient && (
                  <p className="text-xs text-amber-600 mt-1">Venda sem cliente vinculado - estoque será restaurado, mas crédito em haver não será gerado</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {returnItems.map((ri, index) => (
                    <div key={ri.item.productId} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Checkbox
                        checked={ri.selected}
                        onCheckedChange={(checked) => {
                          setReturnItems(returnItems.map((item, i) =>
                            i === index ? { ...item, selected: !!checked } : item
                          ));
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{ri.item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(ri.item.unitPrice)} /un - Comprou {ri.item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Qtd:</span>
                        <Input
                          type="number"
                          min="1"
                          max={ri.item.quantity}
                          value={ri.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val >= 0) {
                              const returnedQtys = getReturnedQuantities(selectedSale.id);
                              const maxReturnable = ri.item.quantity - (returnedQtys[ri.item.productId] || 0);
                              setReturnItems(returnItems.map((item, i) =>
                                i === index ? { ...item, quantity: Math.min(val, maxReturnable) } : item
                              ));
                            }
                          }}
                          onFocus={e => e.target.select()}
                          className="w-16 h-8 text-center"
                          disabled={!ri.selected}
                        />
                      </div>
                      <span className="font-medium text-sm w-24 text-right">
                        {ri.selected ? formatCurrency(ri.quantity * ri.item.unitPrice) : '-'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Modality selector (DEV-04/DEV-05): shown only for crediário sales with a client */}
                {isCrediarioSale && selectedClient && (
                  <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                    <p className="text-sm font-medium">Modalidade de devolução</p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setReturnModality('haver'); setSelectedInstallmentIds([]); }}
                        className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border text-sm transition-colors ${
                          returnModality === 'haver'
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-input hover:bg-muted'
                        }`}
                      >
                        <Gift className="h-4 w-4" />
                        Gerar Haver
                      </button>
                      <button
                        type="button"
                        onClick={() => setReturnModality('abatimento')}
                        className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border text-sm transition-colors ${
                          returnModality === 'abatimento'
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-input hover:bg-muted'
                        }`}
                      >
                        <CreditCard className="h-4 w-4" />
                        Abatimento de Débito
                      </button>
                    </div>

                    {/* Abatimento installment picker (DEV-05) */}
                    {returnModality === 'abatimento' && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Selecione a(s) parcela(s) a abater com o valor da devolução:
                        </p>
                        {saleOpenInstallments.length === 0 ? (
                          <p className="text-xs text-amber-600">Nenhuma parcela em aberto para este cliente.</p>
                        ) : (
                          saleOpenInstallments.map(inst => {
                            const remaining = inst.amount - inst.amountPaid - (inst.discountApplied || 0);
                            const effectiveStatus = getEffectiveStatus(inst);
                            return (
                              <div key={inst.id} className="flex items-center gap-3 p-2 bg-background rounded border">
                                <Checkbox
                                  checked={selectedInstallmentIds.includes(inst.id)}
                                  onCheckedChange={(checked) => {
                                    setSelectedInstallmentIds(prev =>
                                      checked
                                        ? [...prev, inst.id]
                                        : prev.filter(id => id !== inst.id)
                                    );
                                  }}
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">
                                    Parcela {inst.number}/{inst.totalInstallments}
                                    {effectiveStatus === 'overdue' && (
                                      <Badge variant="destructive" className="ml-2 text-xs">Vencida</Badge>
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Vence {format(new Date(inst.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                                  </p>
                                </div>
                                <span className="text-sm font-medium">{formatCurrency(remaining)}</span>
                              </div>
                            );
                          })
                        )}

                        {/* Live abatimento preview */}
                        {abatimentoPreview && (
                          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                            <p className="text-blue-700 dark:text-blue-300 font-medium">
                              A abater: <strong>{formatCurrency(abatimentoPreview.abatedTotal)}</strong>
                              {abatimentoPreview.residual > 0 && (
                                <span className="text-amber-600 ml-2">
                                  / Excedente: {formatCurrency(abatimentoPreview.residual)} (nao sera aplicado)
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Summary */}
                <div className="border-t pt-4 space-y-2">
                  {returnModality === 'haver' ? (
                    <>
                      <div className="flex justify-between text-lg font-bold">
                        <span>Crédito a gerar:</span>
                        <span className="text-green-600">{formatCurrency(totalRefund)}</span>
                      </div>
                      {isCrediarioSale && (
                        <p className="text-xs text-muted-foreground">
                          O valor será capped pelo valor efetivamente pago no crediário (DEV-04).
                        </p>
                      )}
                      {!isCrediarioSale && (
                        <p className="text-xs text-muted-foreground">
                          O valor será adicionado como crédito em haver para o cliente
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-lg font-bold">
                        <span>Valor para abatimento:</span>
                        <span className="text-blue-600">{formatCurrency(totalRefund)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Nenhum haver sera gerado — o valor reduz as parcelas selecionadas.
                      </p>
                    </>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={resetFlow}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleReturn}
                    disabled={totalRefund <= 0}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Confirmar Devolução
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou data..."
              value={searchHistory}
              onChange={e => setSearchHistory(e.target.value)}
              className="pl-10"
            />
          </div>

          {filteredHistory.length === 0 ? (
            <EmptyState
              icon={RotateCcw}
              title="Nenhuma devolução registrada"
              description="As devoluções realizadas aparecerão aqui"
            />
          ) : (
            <div className="grid gap-4">
              {filteredHistory.map(ret => {
                const isAbatimento = ret.abatedInstallments && ret.abatedInstallments.length > 0;
                return (
                  <Card key={ret.id} className={`hover:shadow-md transition-shadow ${ret.reversedAt ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${ret.reversedAt ? 'bg-gray-100 dark:bg-gray-900' : 'bg-blue-100 dark:bg-blue-950'}`}>
                            <RotateCcw className={`h-6 w-6 ${ret.reversedAt ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'}`} />
                          </div>
                          <div>
                            <p className="font-medium">{ret.clientName}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(ret.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {ret.items.length} {ret.items.length === 1 ? 'item' : 'itens'} devolvido{ret.items.length > 1 ? 's' : ''} - Venda #{ret.originalSaleId.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          {isAbatimento ? (
                            <p className={`font-bold ${ret.reversedAt ? 'line-through text-muted-foreground' : 'text-blue-600 dark:text-blue-400'}`}>
                              Abatimento {formatCurrency(ret.totalRefunded)}
                            </p>
                          ) : (
                            <p className={`font-bold ${ret.reversedAt ? 'line-through text-muted-foreground' : 'text-green-600 dark:text-green-400'}`}>
                              +{formatCurrency(ret.creditGenerated)}
                            </p>
                          )}
                          {ret.reversedAt ? (
                            <Badge variant="destructive" className="text-xs">Estornado</Badge>
                          ) : (
                            <>
                              {isAbatimento ? (
                                <Badge variant="secondary" className="text-xs">
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  Abatimento de parcela
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  <Gift className="h-3 w-3 mr-1" />
                                  Crédito gerado
                                </Badge>
                              )}
                              <div className="flex gap-1 mt-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => {
                                    const sale = sales.find(s => s.id === ret.originalSaleId);
                                    printRefundReceipt(ret, sale);
                                  }}
                                  title="Imprimir comprovante"
                                >
                                  <Printer className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => {
                                    const sale = sales.find(s => s.id === ret.originalSaleId);
                                    downloadRefundReceipt(ret, sale);
                                  }}
                                  title="Baixar comprovante"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              </div>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="mt-1 w-full">
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Estornar
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                      <AlertTriangle className="h-5 w-5 text-destructive" />
                                      Estornar devolução?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {isAbatimento
                                        ? `O estoque sera deduzido novamente e o abatimento de ${formatCurrency(ret.totalRefunded)} sera revertido nas parcelas. As parcelas canceladas serao restauradas para em aberto.`
                                        : `O estoque será deduzido novamente e o crédito em haver de ${formatCurrency(ret.creditGenerated)} será removido do cliente.${ret.cancelledInstallmentIds && ret.cancelledInstallmentIds.length > 0 ? ' As parcelas canceladas serão restauradas para em aberto.' : ''}`
                                      }
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleReverseReturn(ret)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Confirmar Estorno
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
