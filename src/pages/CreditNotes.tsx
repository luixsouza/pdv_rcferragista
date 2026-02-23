import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Sale, Client, CreditPayment, Installment } from '@/types';
import { BookOpen, Search, DollarSign, Calendar, User, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ClientCombobox } from '@/components/ClientCombobox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const paymentLabels: Record<string, string> = {
  cash: 'Dinheiro',
  credit: 'Cartão de Crédito',
  debit: 'Cartão de Débito',
  pix: 'PIX',
};

export default function CreditNotes() {
  const [sales, setSales] = useLocalStorage<Sale[]>('sales', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [creditPayments, setCreditPayments] = useLocalStorage<CreditPayment[]>('credit_payments', []);
  const [installments, setInstallments] = useLocalStorage<Installment[]>('installments', []);

  const [selectedClientFilter, setSelectedClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'overdue' | 'paid'>('all');
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<CreditPayment['paymentMethod']>('cash');

  // Resumo tab client
  const [resumoClient, setResumoClient] = useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Auto-update overdue installments on mount
  useEffect(() => {
    const today = startOfDay(new Date());
    let updated = false;
    const updatedInstallments = installments.map(inst => {
      if (inst.status === 'open' && isBefore(new Date(inst.dueDate), today)) {
        updated = true;
        return { ...inst, status: 'overdue' as const };
      }
      return inst;
    });
    if (updated) {
      setInstallments(updatedInstallments);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Resumo calculations ----
  const resumoClientData = clients.find(c => c.id === resumoClient);
  const resumoCreditLimit = resumoClientData?.creditLimit || 0;
  const resumoCreditUsed = resumoClient
    ? installments
        .filter(i => i.clientId === resumoClient && (i.status === 'open' || i.status === 'overdue'))
        .reduce((sum, i) => sum + (i.amount - i.amountPaid), 0)
    : 0;
  const resumoCreditAvailable = Math.max(0, resumoCreditLimit - resumoCreditUsed);
  const resumoUsagePercent = resumoCreditLimit > 0 ? Math.min(100, (resumoCreditUsed / resumoCreditLimit) * 100) : 0;
  const resumoOverdue = resumoClient
    ? installments.filter(i => i.clientId === resumoClient && i.status === 'overdue')
    : [];
  const resumoOverdueAmount = resumoOverdue.reduce((sum, i) => sum + (i.amount - i.amountPaid), 0);

  // ---- Parcelas tab ----
  const filteredInstallments = installments
    .filter(i => {
      if (selectedClientFilter && i.clientId !== selectedClientFilter) return false;
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      // Hide entry installments (number=0) from list
      if (i.number === 0) return false;
      return true;
    })
    .sort((a, b) => {
      // Overdue first, then open, then paid
      const order = { overdue: 0, open: 1, paid: 2 };
      const diff = order[a.status] - order[b.status];
      if (diff !== 0) return diff;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  const totalPendingInstallments = installments
    .filter(i => i.status === 'open' || i.status === 'overdue')
    .reduce((sum, i) => sum + (i.amount - i.amountPaid), 0);

  // ---- Inadimplentes tab ----
  const overdueInstallments = installments.filter(i => i.status === 'overdue');
  const delinquentClients = new Map<string, { clientName: string; overdueCount: number; overdueAmount: number; oldestDue: string }>();
  overdueInstallments.forEach(inst => {
    const existing = delinquentClients.get(inst.clientId);
    const remaining = inst.amount - inst.amountPaid;
    if (existing) {
      existing.overdueCount += 1;
      existing.overdueAmount += remaining;
      if (new Date(inst.dueDate) < new Date(existing.oldestDue)) {
        existing.oldestDue = inst.dueDate;
      }
    } else {
      delinquentClients.set(inst.clientId, {
        clientName: inst.clientName,
        overdueCount: 1,
        overdueAmount: remaining,
        oldestDue: inst.dueDate,
      });
    }
  });
  const delinquentList = Array.from(delinquentClients.entries())
    .sort((a, b) => b[1].overdueAmount - a[1].overdueAmount);

  // ---- Payment dialog ----
  const openPaymentDialog = (inst: Installment) => {
    const remaining = inst.amount - inst.amountPaid;
    setSelectedInstallment(inst);
    setPaymentAmount(remaining);
    setPaymentMethod('cash');
  };

  const handlePayment = () => {
    if (!selectedInstallment) return;

    const remaining = selectedInstallment.amount - selectedInstallment.amountPaid;

    if (paymentAmount <= 0) {
      toast.error('O valor do pagamento deve ser maior que zero');
      return;
    }

    if (paymentAmount > remaining + 0.01) {
      toast.error(`Valor excede o saldo da parcela: ${formatCurrency(remaining)}`);
      return;
    }

    const now = new Date().toISOString();
    const newAmountPaid = selectedInstallment.amountPaid + paymentAmount;
    const isFullyPaid = newAmountPaid >= selectedInstallment.amount - 0.01;

    // Create credit payment record
    const payment: CreditPayment = {
      id: crypto.randomUUID(),
      saleId: selectedInstallment.saleId,
      installmentId: selectedInstallment.id,
      clientId: selectedInstallment.clientId,
      clientName: selectedInstallment.clientName,
      amount: paymentAmount,
      paymentMethod,
      createdAt: now
    };

    setCreditPayments([...creditPayments, payment]);

    // Update installment
    const updatedInstallments = installments.map(i => {
      if (i.id !== selectedInstallment.id) return i;
      return {
        ...i,
        amountPaid: newAmountPaid,
        status: isFullyPaid ? 'paid' as const : i.status,
        paidAt: isFullyPaid ? now : undefined,
        paymentMethod: isFullyPaid ? paymentMethod : undefined,
      };
    });
    setInstallments(updatedInstallments);

    // Update sale crediarioPaid and check if all installments are paid
    const saleInstallments = updatedInstallments.filter(i => i.saleId === selectedInstallment.saleId && i.number > 0);
    const allPaid = saleInstallments.every(i => i.status === 'paid' || (i.id === selectedInstallment.id && isFullyPaid));
    const totalPaidOnSale = saleInstallments.reduce((sum, i) => {
      if (i.id === selectedInstallment.id) return sum + newAmountPaid;
      return sum + i.amountPaid;
    }, 0);

    // Also count entry payment if exists
    const entryInstallment = updatedInstallments.find(i => i.saleId === selectedInstallment.saleId && i.number === 0);
    const entryPaid = entryInstallment?.amountPaid || 0;

    const updatedSales = sales.map(s => {
      if (s.id !== selectedInstallment.saleId) return s;
      return {
        ...s,
        crediarioPaid: totalPaidOnSale + entryPaid,
        status: allPaid ? 'crediario_paid' as const : 'crediario_pending' as const,
        paidAt: allPaid ? now : undefined,
      };
    });
    setSales(updatedSales);

    setSelectedInstallment(null);

    if (isFullyPaid) {
      if (allPaid) {
        toast.success('Crediário quitado! Todas as parcelas foram pagas.');
      } else {
        toast.success(`Parcela ${selectedInstallment.number}/${selectedInstallment.totalInstallments} quitada!`);
      }
    } else {
      toast.success(`Pagamento de ${formatCurrency(paymentAmount)} registrado na parcela ${selectedInstallment.number}/${selectedInstallment.totalInstallments}`);
    }
  };

  const getStatusBadge = (status: Installment['status']) => {
    switch (status) {
      case 'overdue':
        return <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Vencida</Badge>;
      case 'open':
        return <Badge variant="outline" className="text-xs border-amber-500 text-amber-600"><Clock className="h-3 w-3 mr-1" />Aberta</Badge>;
      case 'paid':
        return <Badge variant="outline" className="text-xs border-green-500 text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Paga</Badge>;
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Crediário"
        description={`Total pendente: ${formatCurrency(totalPendingInstallments)}`}
      />

      <Tabs defaultValue="resumo" className="space-y-6">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
          <TabsTrigger value="inadimplentes">
            Inadimplentes
            {delinquentList.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {delinquentList.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* ===== ABA RESUMO ===== */}
        <TabsContent value="resumo" className="space-y-6">
          <div className="max-w-sm">
            <Label className="mb-2 block text-sm font-medium">Selecionar Cliente</Label>
            <ClientCombobox
              clients={clients}
              value={resumoClient}
              onChange={setResumoClient}
            />
          </div>

          {resumoClient && resumoClientData ? (
            <div className="max-w-lg space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-medium text-primary">
                        {resumoClientData.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-lg">{resumoClientData.name}</p>
                      <p className="text-sm text-muted-foreground">{resumoClientData.document || 'Sem documento'}</p>
                    </div>
                  </div>

                  {resumoOverdue.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                      <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-700 dark:text-red-300">Cliente Inadimplente</p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {resumoOverdue.length} parcela(s) vencida(s) - Total: {formatCurrency(resumoOverdueAmount)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Limite de Crédito</span>
                      <span className="font-medium">{formatCurrency(resumoCreditLimit)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Utilizado</span>
                      <span className="font-medium text-amber-600">{formatCurrency(resumoCreditUsed)}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            resumoUsagePercent >= 90 ? "bg-red-500" :
                            resumoUsagePercent >= 70 ? "bg-amber-500" : "bg-blue-500"
                          )}
                          style={{ width: `${resumoUsagePercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">{resumoUsagePercent.toFixed(0)}% utilizado</p>
                    </div>

                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="font-medium">Disponível</span>
                      <span className={cn("font-bold text-lg", resumoCreditAvailable > 0 ? "text-green-600" : "text-red-600")}>
                        {formatCurrency(resumoCreditAvailable)}
                      </span>
                    </div>
                  </div>

                  {resumoCreditLimit <= 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Este cliente não possui limite de crédito configurado. Configure no cadastro de clientes.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Client's installments summary */}
              {(() => {
                const clientInstallments = installments.filter(i => i.clientId === resumoClient && i.number > 0);
                const openCount = clientInstallments.filter(i => i.status === 'open').length;
                const overdueCount = clientInstallments.filter(i => i.status === 'overdue').length;
                const paidCount = clientInstallments.filter(i => i.status === 'paid').length;
                if (clientInstallments.length === 0) return null;

                return (
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm font-medium mb-3">Parcelas do Cliente</p>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-2 bg-amber-50 dark:bg-amber-950 rounded-lg">
                          <p className="text-2xl font-bold text-amber-600">{openCount}</p>
                          <p className="text-xs text-muted-foreground">Abertas</p>
                        </div>
                        <div className="p-2 bg-red-50 dark:bg-red-950 rounded-lg">
                          <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
                          <p className="text-xs text-muted-foreground">Vencidas</p>
                        </div>
                        <div className="p-2 bg-green-50 dark:bg-green-950 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{paidCount}</p>
                          <p className="text-xs text-muted-foreground">Pagas</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          ) : (
            <EmptyState
              icon={User}
              title="Selecione um cliente"
              description="Escolha um cliente acima para ver o resumo do crediário"
            />
          )}
        </TabsContent>

        {/* ===== ABA PARCELAS ===== */}
        <TabsContent value="parcelas" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="max-w-sm flex-1">
              <ClientCombobox
                clients={clients}
                value={selectedClientFilter}
                onChange={setSelectedClientFilter}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="open">Abertas</SelectItem>
                <SelectItem value="overdue">Vencidas</SelectItem>
                <SelectItem value="paid">Pagas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredInstallments.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Nenhuma parcela encontrada"
              description={selectedClientFilter || statusFilter !== 'all' ? "Tente alterar os filtros" : "As parcelas de crediário aparecerão aqui"}
            />
          ) : (
            <div className="grid gap-3">
              {filteredInstallments.map(inst => {
                const remaining = inst.amount - inst.amountPaid;
                const progress = inst.amount > 0 ? (inst.amountPaid / inst.amount) * 100 : 0;

                return (
                  <Card key={inst.id} className={cn(
                    "hover:shadow-md transition-shadow",
                    inst.status === 'overdue' && "border-red-300 dark:border-red-800"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "h-12 w-12 rounded-lg flex items-center justify-center text-sm font-bold",
                            inst.status === 'overdue' ? "bg-red-100 dark:bg-red-950 text-red-600" :
                            inst.status === 'paid' ? "bg-green-100 dark:bg-green-950 text-green-600" :
                            "bg-amber-100 dark:bg-amber-950 text-amber-600"
                          )}>
                            {inst.number}/{inst.totalInstallments}
                          </div>
                          <div>
                            <p className="font-medium">{inst.clientName}</p>
                            <p className="text-sm text-muted-foreground">
                              Vencimento: {format(new Date(inst.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Venda #{inst.saleId.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Valor: {formatCurrency(inst.amount)}</p>
                            {inst.amountPaid > 0 && inst.status !== 'paid' && (
                              <p className="text-xs text-green-600">Pago: {formatCurrency(inst.amountPaid)}</p>
                            )}
                            <p className={cn(
                              "font-bold",
                              inst.status === 'paid' ? "text-green-600" :
                              inst.status === 'overdue' ? "text-red-600" : "text-amber-600"
                            )}>
                              {inst.status === 'paid' ? 'Quitada' : formatCurrency(remaining)}
                            </p>
                            {progress > 0 && inst.status !== 'paid' && (
                              <div className="w-20 h-1.5 bg-muted rounded-full mt-1 ml-auto">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(inst.status)}
                            {inst.status !== 'paid' && (
                              <Button size="sm" onClick={() => openPaymentDialog(inst)}>
                                <DollarSign className="h-3 w-3 mr-1" />
                                Pagar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== ABA INADIMPLENTES ===== */}
        <TabsContent value="inadimplentes" className="space-y-4">
          {delinquentList.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nenhum inadimplente"
              description="Todos os clientes estão em dia com as parcelas"
            />
          ) : (
            <>
              <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <p className="font-medium text-red-700 dark:text-red-300">
                    {delinquentList.length} cliente(s) inadimplente(s)
                  </p>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  Total em atraso: {formatCurrency(overdueInstallments.reduce((sum, i) => sum + (i.amount - i.amountPaid), 0))}
                </p>
              </div>

              <div className="grid gap-4">
                {delinquentList.map(([clientId, data]) => (
                  <Card key={clientId} className="border-red-200 dark:border-red-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium">{data.clientName}</p>
                            <p className="text-sm text-muted-foreground">
                              {data.overdueCount} parcela(s) vencida(s)
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Mais antiga: {format(new Date(data.oldestDue), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Total em atraso</p>
                          <p className="font-bold text-red-600 text-lg">{formatCurrency(data.overdueAmount)}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-1"
                            onClick={() => {
                              setSelectedClientFilter(clientId);
                              setStatusFilter('overdue');
                              // Switch to parcelas tab programmatically
                              const tabEl = document.querySelector('[data-state="active"][role="tabpanel"]');
                              const parcelasTab = document.querySelector('[value="parcelas"]') as HTMLElement;
                              if (parcelasTab) parcelasTab.click();
                            }}
                          >
                            Ver parcelas
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ===== ABA HISTÓRICO ===== */}
        <TabsContent value="historico" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou data..."
              value={selectedClientFilter}
              onChange={e => setSelectedClientFilter(e.target.value)}
              className="pl-10"
            />
          </div>

          {(() => {
            const filteredHistory = creditPayments
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return filteredHistory.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title="Nenhum pagamento registrado"
                description="Os pagamentos de parcelas aparecerão aqui"
              />
            ) : (
              <div className="grid gap-4">
                {filteredHistory.map(payment => {
                  const inst = payment.installmentId ? installments.find(i => i.id === payment.installmentId) : null;
                  return (
                    <Card key={payment.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
                              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <p className="font-medium">{payment.clientName}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(payment.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Venda #{payment.saleId.slice(0, 8).toUpperCase()}
                                {inst && ` - Parcela ${inst.number}/${inst.totalInstallments}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600 dark:text-green-400">{formatCurrency(payment.amount)}</p>
                            <Badge variant="secondary" className="text-xs">
                              {paymentLabels[payment.paymentMethod]}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={!!selectedInstallment} onOpenChange={() => setSelectedInstallment(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          {selectedInstallment && (
            <div className="space-y-4 mt-4">
              <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedInstallment.clientName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Vencimento: {format(new Date(selectedInstallment.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Parcela {selectedInstallment.number}/{selectedInstallment.totalInstallments}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t mt-2">
                  <span>Valor da parcela:</span>
                  <span className="font-medium">{formatCurrency(selectedInstallment.amount)}</span>
                </div>
                {selectedInstallment.amountPaid > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Já pago:</span>
                    <span>{formatCurrency(selectedInstallment.amountPaid)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-amber-600">
                  <span>Restante:</span>
                  <span>{formatCurrency(selectedInstallment.amount - selectedInstallment.amountPaid)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Valor do pagamento</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setPaymentAmount(val);
                  }}
                  onFocus={e => e.target.select()}
                />
              </div>

              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as CreditPayment['paymentMethod'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="credit">Cartão de Crédito</SelectItem>
                    <SelectItem value="debit">Cartão de Débito</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedInstallment(null)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handlePayment}>
                  Confirmar Pagamento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
