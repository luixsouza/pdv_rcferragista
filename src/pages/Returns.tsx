import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Sale, Client, Product, SaleItem, ReturnRecord } from '@/types';
import { RotateCcw, Search, Package, Calendar, User, ChevronRight, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ClientCombobox } from '@/components/ClientCombobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Returns() {
  const [sales, setSales] = useLocalStorage<Sale[]>('sales', []);
  const [clients, setClients] = useLocalStorage<Client[]>('clients', []);
  const [products, setProducts] = useLocalStorage<Product[]>('products', []);
  const [returns, setReturns] = useLocalStorage<ReturnRecord[]>('returns', []);

  // New return flow
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<{ item: SaleItem; quantity: number; selected: boolean }[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // History
  const [searchHistory, setSearchHistory] = useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const client = clients.find(c => c.id === selectedClient);

  // Client's sales that can be returned (completed or crediario_paid, not already fully refunded)
  const clientSales = sales
    .filter(s => s.clientId === selectedClient)
    .filter(s => s.status === 'completed' || s.status === 'crediario_paid')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Get already returned quantities for a sale
  const getReturnedQuantities = (saleId: string): Record<string, number> => {
    const saleReturns = returns.filter(r => r.originalSaleId === saleId);
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
    setStep(3);
  };

  const totalRefund = returnItems
    .filter(ri => ri.selected && ri.quantity > 0)
    .reduce((sum, ri) => sum + ri.quantity * ri.item.unitPrice, 0);

  const handleReturn = () => {
    if (!selectedSale || !selectedClient) return;

    const itemsToReturn = returnItems.filter(ri => ri.selected && ri.quantity > 0);

    if (itemsToReturn.length === 0) {
      toast.error('Selecione pelo menos um item para devolver');
      return;
    }

    // Validate quantities
    const returnedQtys = getReturnedQuantities(selectedSale.id);
    for (const ri of itemsToReturn) {
      const alreadyReturned = returnedQtys[ri.item.productId] || 0;
      const maxReturnable = ri.item.quantity - alreadyReturned;
      if (ri.quantity > maxReturnable) {
        toast.error(`Quantidade máxima para "${ri.item.productName}" é ${maxReturnable}`);
        return;
      }
    }

    const returnRecord: ReturnRecord = {
      id: crypto.randomUUID(),
      originalSaleId: selectedSale.id,
      clientId: selectedClient,
      clientName: client?.name || 'Não identificado',
      items: itemsToReturn.map(ri => ({
        productId: ri.item.productId,
        productName: ri.item.productName,
        quantity: ri.quantity,
        unitPrice: ri.item.unitPrice,
        costPrice: ri.item.costPrice,
        total: ri.quantity * ri.item.unitPrice,
      })),
      totalRefunded: totalRefund,
      creditGenerated: totalRefund,
      createdAt: new Date().toISOString(),
    };

    // Restore stock
    const updatedProducts = products.map(product => {
      const returnItem = itemsToReturn.find(ri => ri.item.productId === product.id);
      if (returnItem) {
        const restock = product.unit === 'mil' ? returnItem.quantity / 1000 : returnItem.quantity;
        return { ...product, stock: product.stock + restock, updatedAt: new Date().toISOString() };
      }
      return product;
    });

    // Add store credit to client
    const updatedClients = clients.map(c =>
      c.id === selectedClient
        ? { ...c, storeCredit: (c.storeCredit || 0) + totalRefund, updatedAt: new Date().toISOString() }
        : c
    );

    // Check if all items fully returned - mark sale as refunded
    const allReturnedQtys = getReturnedQuantities(selectedSale.id);
    itemsToReturn.forEach(ri => {
      allReturnedQtys[ri.item.productId] = (allReturnedQtys[ri.item.productId] || 0) + ri.quantity;
    });
    const allItemsReturned = selectedSale.items.every(
      item => (allReturnedQtys[item.productId] || 0) >= item.quantity
    );

    const updatedSales = allItemsReturned
      ? sales.map(s => s.id === selectedSale.id ? { ...s, status: 'refunded' as const } : s)
      : sales;

    setProducts(updatedProducts);
    setClients(updatedClients);
    setSales(updatedSales);
    setReturns([...returns, returnRecord]);

    // Reset
    setSelectedSale(null);
    setReturnItems([]);
    setStep(1);
    setSelectedClient('');

    toast.success(`Devolução registrada! ${formatCurrency(totalRefund)} adicionado ao crédito em haver do cliente.`);
  };

  const resetFlow = () => {
    setSelectedSale(null);
    setReturnItems([]);
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
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={step >= 1 ? "default" : "secondary"}>1. Cliente</Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant={step >= 2 ? "default" : "secondary"}>2. Venda</Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant={step >= 3 ? "default" : "secondary"}>3. Itens</Badge>
          </div>

          {/* Step 1: Select Client */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Selecionar Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-sm">
                <ClientCombobox
                  clients={clients}
                  value={selectedClient}
                  onChange={(value) => {
                    setSelectedClient(value);
                    setSelectedSale(null);
                    setReturnItems([]);
                    if (value) setStep(2);
                    else setStep(1);
                  }}
                />
              </div>
              {client && (client.storeCredit || 0) > 0 && (
                <div className="mt-3 flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                  <Gift className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    Crédito em haver: <strong>{formatCurrency(client.storeCredit || 0)}</strong>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Select Sale */}
          {step >= 2 && selectedClient && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Selecionar Venda
                  </CardTitle>
                  {selectedSale && (
                    <Button variant="ghost" size="sm" onClick={resetFlow}>
                      Trocar venda
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!selectedSale ? (
                  clientSales.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhuma venda elegível para devolução
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-auto">
                      {clientSales.map(sale => (
                        <div
                          key={sale.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => selectSale(sale)}
                        >
                          <div>
                            <p className="text-sm font-medium">
                              Venda #{sale.id.slice(0, 8).toUpperCase()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(sale.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              {' - '}{sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatCurrency(sale.total)}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium">
                      Venda #{selectedSale.id.slice(0, 8).toUpperCase()} - {formatCurrency(selectedSale.total)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(selectedSale.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Select Items */}
          {step === 3 && selectedSale && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Selecionar Itens para Devolver
                </CardTitle>
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

                {/* Summary */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Crédito a gerar:</span>
                    <span className="text-green-600">{formatCurrency(totalRefund)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O valor será adicionado como crédito em haver para o cliente
                  </p>
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
              {filteredHistory.map(ret => (
                <Card key={ret.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                          <RotateCcw className="h-6 w-6 text-blue-600 dark:text-blue-400" />
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
                      <div className="text-right">
                        <p className="font-bold text-green-600 dark:text-green-400">
                          +{formatCurrency(ret.creditGenerated)}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          <Gift className="h-3 w-3 mr-1" />
                          Crédito gerado
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
