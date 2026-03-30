import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Product, Client, Sale, SaleItem, PaymentEntry, Installment } from '@/types';
import { ShoppingCart, Plus, Minus, Trash2, Search, CreditCard, Wallet, QrCode, Banknote, X, BookOpen, Gift, Split, AlertTriangle } from 'lucide-react';
import { addMonths } from 'date-fns';
import { CardBrand, CARD_BRAND_LABELS, getCardFee, calculateFee, hasDebit } from '@/lib/cardFees';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { ClientCombobox } from '@/components/ClientCombobox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const paymentMethods = [
  { id: 'cash', label: 'Dinheiro', icon: Banknote },
  { id: 'credit', label: 'Crédito', icon: CreditCard },
  { id: 'debit', label: 'Débito', icon: Wallet },
  { id: 'pix', label: 'PIX', icon: QrCode },
  { id: 'crediario', label: 'Crediário', icon: BookOpen },
  { id: 'store_credit', label: 'Créd. Haver', icon: Gift },
] as const;

const splitPaymentMethods = [
  { id: 'cash', label: 'Dinheiro' },
  { id: 'credit', label: 'Crédito' },
  { id: 'debit', label: 'Débito' },
  { id: 'pix', label: 'PIX' },
  { id: 'crediario', label: 'Crediário' },
  { id: 'store_credit', label: 'Créd. Haver' },
] as const;

export default function POS() {
  const [products, setProducts] = useLocalStorage<Product[]>('products', []);
  const [clients, setClients] = useLocalStorage<Client[]>('clients', []);
  const [sales, setSales] = useLocalStorage<Sale[]>('sales', []);
  const [installments, setInstallments] = useLocalStorage<Installment[]>('installments', []);

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<Sale['paymentMethod']>('cash');
  const [discountValue, setDiscountValue] = useState(0);
  const [isPercentage, setIsPercentage] = useState(true);

  // Split payment state
  const [splitMode, setSplitMode] = useState(false);
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([
    { method: 'cash', amount: 0 }
  ]);

  // Crediário installment state
  const [installmentCount, setInstallmentCount] = useState(1);
  const [entryAmount, setEntryAmount] = useState(0);

  // Card fee state
  const [cardBrand, setCardBrand] = useState<CardBrand | ''>('');
  const [cardInstallments, setCardInstallments] = useState(1);

  // Search state
  const [openSearch, setOpenSearch] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const filteredProducts = products
    .filter(p =>
      p.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      p.code.toLowerCase().includes(searchValue.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchValue.toLowerCase())
    )
    .sort((a, b) => {
      if (a.stock > 0 && b.stock <= 0) return -1;
      if (a.stock <= 0 && b.stock > 0) return 1;
      return 0;
    });

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);

  const finalDiscountValue = isPercentage
    ? (subtotal * discountValue) / 100
    : discountValue;

  const total = Math.max(0, subtotal - finalDiscountValue);

  const client = clients.find(c => c.id === selectedClient);
  const clientStoreCredit = client?.storeCredit || 0;

  // Credit limit calculations
  const clientCreditLimit = client?.creditLimit || 0;
  const clientCreditUsed = selectedClient
    ? installments
        .filter(i => i.clientId === selectedClient && (i.status === 'open' || i.status === 'overdue'))
        .reduce((sum, i) => sum + (i.amount - i.amountPaid - (i.discountApplied || 0)), 0)
    : 0;
  const clientCreditAvailable = Math.max(0, clientCreditLimit - clientCreditUsed);
  const clientOverdueInstallments = selectedClient
    ? installments.filter(i => i.clientId === selectedClient && i.status === 'overdue')
    : [];
  const isClientDelinquent = clientOverdueInstallments.length > 0;

  // Crediário amount (how much goes to installments)
  const crediarioTotal = splitMode
    ? paymentEntries.filter(e => e.method === 'crediario').reduce((s, e) => s + e.amount, 0)
    : (paymentMethod === 'crediario' ? total : 0);
  const crediarioFinanced = Math.max(0, crediarioTotal - entryAmount);
  const installmentValue = installmentCount > 0 ? crediarioFinanced / installmentCount : 0;

  // Card fee calculations
  const isCardPayment = !splitMode && (paymentMethod === 'credit' || paymentMethod === 'debit');
  const cardFeePercent = isCardPayment && cardBrand
    ? getCardFee(cardBrand as CardBrand, paymentMethod as 'credit' | 'debit', paymentMethod === 'credit' ? cardInstallments : 1)
    : null;
  const cardFeeInfo = cardFeePercent !== null ? calculateFee(total, cardFeePercent) : null;


  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.productId === product.id);
    const isMilheiro = product.unit === 'mil';
    const effectiveStock = isMilheiro ? product.stock * 1000 : product.stock;

    const unitPrice = isMilheiro ? product.price / 1000 : product.price;
    const costPrice = isMilheiro ? (product.costPrice || 0) / 1000 : (product.costPrice || 0);

    if (existingItem) {
      if (existingItem.quantity >= effectiveStock) {
        toast.error('Estoque insuficiente');
        return;
      }
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
          : item
      ));
    } else {
      if (effectiveStock < 1) {
         toast.error('Estoque insuficiente');
         return;
      }
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: unitPrice,
        costPrice: costPrice,
        total: unitPrice
      }]);
    }
    toast.success(`${product.name} adicionado`);
    setOpenSearch(false);
    setSearchValue("");
  };

  const updateQuantity = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    const item = cart.find(i => i.productId === productId);

    if (!product || !item) return;

    const isMilheiro = product.unit === 'mil';
    const effectiveStock = isMilheiro ? product.stock * 1000 : product.stock;

    const newQuantity = item.quantity + delta;

    if (newQuantity <= 0) {
      setCart(cart.filter(i => i.productId !== productId));
      return;
    }

    if (newQuantity > effectiveStock) {
      toast.error('Estoque insuficiente');
      return;
    }

    setCart(cart.map(i =>
      i.productId === productId
        ? { ...i, quantity: newQuantity, total: newQuantity * i.unitPrice }
        : i
    ));
  };

  const updateItemQuantity = (productId: string, newQuantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const isMilheiro = product.unit === 'mil';
    const effectiveStock = isMilheiro ? product.stock * 1000 : product.stock;

    if (newQuantity <= 0) {
      setCart(cart.filter(i => i.productId !== productId));
      return;
    }

    if (newQuantity > effectiveStock) {
      toast.error('Estoque insuficiente');
      return;
    }

    setCart(cart.map(i =>
      i.productId === productId
        ? { ...i, quantity: newQuantity, total: newQuantity * i.unitPrice }
        : i
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(i => i.productId !== productId));
  };

  // Split payment helpers
  const addPaymentEntry = () => {
    setPaymentEntries([...paymentEntries, { method: 'cash', amount: 0 }]);
  };

  const removePaymentEntry = (index: number) => {
    if (paymentEntries.length <= 1) return;
    setPaymentEntries(paymentEntries.filter((_, i) => i !== index));
  };

  const updatePaymentEntry = (index: number, field: 'method' | 'amount' | 'cardBrand' | 'cardInstallments', value: string | number) => {
    setPaymentEntries(paymentEntries.map((entry, i) => {
      if (i !== index) return entry;
      if (field === 'method') {
        const newMethod = value as PaymentEntry['method'];
        // Reset card fields when changing method
        return { ...entry, method: newMethod, cardBrand: undefined, cardInstallments: undefined, cardFeePercent: undefined, cardFeeAmount: undefined };
      }
      if (field === 'cardBrand') return { ...entry, cardBrand: value as string };
      if (field === 'cardInstallments') return { ...entry, cardInstallments: value as number };
      return { ...entry, amount: value as number };
    }));
  };

  const totalAllocated = paymentEntries.reduce((sum, e) => sum + e.amount, 0);
  const hasCrediario = splitMode
    ? paymentEntries.some(e => e.method === 'crediario')
    : paymentMethod === 'crediario';
  const hasStoreCredit = splitMode
    ? paymentEntries.some(e => e.method === 'store_credit')
    : paymentMethod === 'store_credit';
  const storeCreditUsed = splitMode
    ? paymentEntries.filter(e => e.method === 'store_credit').reduce((s, e) => s + e.amount, 0)
    : (paymentMethod === 'store_credit' ? total : 0);

  const finalizeSale = () => {
    if (cart.length === 0) {
      toast.error('Adicione produtos ao carrinho');
      return;
    }

    // Validate crediario requires client
    if (hasCrediario && !selectedClient) {
      toast.error('Selecione um cliente para venda no crediário');
      return;
    }

    // Validate credit limit for crediário
    if (hasCrediario && selectedClient) {
      if (clientCreditLimit <= 0) {
        toast.error('Configure o limite de crédito deste cliente antes de vender no crediário');
        return;
      }
      if (isClientDelinquent) {
        toast.error(`Cliente inadimplente! Possui ${clientOverdueInstallments.length} parcela(s) vencida(s). Quite antes de nova venda.`);
        return;
      }
      if (crediarioFinanced > clientCreditAvailable + 0.01) {
        toast.error(`Limite insuficiente. Disponível: ${formatCurrency(clientCreditAvailable)}, Necessário: ${formatCurrency(crediarioFinanced)}`);
        return;
      }
      if (entryAmount < 0) {
        toast.error('O valor de entrada não pode ser negativo');
        return;
      }
      if (entryAmount > crediarioTotal) {
        toast.error('O valor de entrada não pode ser maior que o total do crediário');
        return;
      }
    }

    // Validate store credit requires client
    if (hasStoreCredit && !selectedClient) {
      toast.error('Selecione um cliente para usar crédito em haver');
      return;
    }

    // Validate store credit balance
    if (storeCreditUsed > 0 && storeCreditUsed > clientStoreCredit + 0.01) {
      toast.error(`Crédito em haver insuficiente. Saldo: ${formatCurrency(clientStoreCredit)}`);
      return;
    }

    // Validate split payment
    if (splitMode) {
      if (paymentEntries.some(e => e.amount <= 0)) {
        toast.error('Todos os valores de pagamento devem ser maiores que zero');
        return;
      }
      if (Math.abs(totalAllocated - total) > 0.01) {
        toast.error(`Soma dos pagamentos (${formatCurrency(totalAllocated)}) difere do total (${formatCurrency(total)})`);
        return;
      }
    }

    // Validate card brand for card payments
    if (!splitMode && (paymentMethod === 'credit' || paymentMethod === 'debit') && !cardBrand) {
      toast.error('Selecione a bandeira do cartão');
      return;
    }
    if (!splitMode && paymentMethod === 'debit' && cardBrand && !hasDebit(cardBrand as CardBrand)) {
      toast.error('Débito não disponível para esta bandeira');
      return;
    }
    if (splitMode) {
      for (const entry of paymentEntries) {
        if ((entry.method === 'credit' || entry.method === 'debit') && !entry.cardBrand) {
          toast.error('Selecione a bandeira do cartão em todas as formas de cartão');
          return;
        }
        if (entry.method === 'debit' && entry.cardBrand && !hasDebit(entry.cardBrand as CardBrand)) {
          toast.error(`Débito não disponível para ${CARD_BRAND_LABELS[entry.cardBrand as CardBrand] || entry.cardBrand}`);
          return;
        }
      }
    }

    const primaryMethod = splitMode ? paymentEntries[0].method : paymentMethod;
    const isCrediario = hasCrediario;

    // Calculate card fees for split entries
    const finalPaymentEntries = splitMode ? paymentEntries.map(entry => {
      if ((entry.method === 'credit' || entry.method === 'debit') && entry.cardBrand) {
        const inst = entry.method === 'credit' ? (entry.cardInstallments || 1) : 1;
        const fee = getCardFee(entry.cardBrand as CardBrand, entry.method, inst);
        if (fee !== null) {
          const { feeAmount } = calculateFee(entry.amount, fee);
          return { ...entry, cardFeePercent: fee, cardFeeAmount: feeAmount };
        }
      }
      return entry;
    }) : undefined;

    const sale: Sale = {
      id: crypto.randomUUID(),
      clientId: selectedClient || undefined,
      clientName: client?.name,
      items: cart,
      subtotal,
      discount: finalDiscountValue,
      total,
      paymentMethod: primaryMethod,
      paymentEntries: finalPaymentEntries,
      status: isCrediario ? 'crediario_pending' : 'completed',
      crediarioPaid: isCrediario ? 0 : undefined,
      installmentCount: isCrediario ? installmentCount : undefined,
      entryAmount: isCrediario && entryAmount > 0 ? entryAmount : undefined,
      cardBrand: !splitMode && isCardPayment && cardBrand ? cardBrand : undefined,
      cardInstallments: !splitMode && paymentMethod === 'credit' && cardBrand ? cardInstallments : undefined,
      cardFeePercent: !splitMode && cardFeePercent !== null ? cardFeePercent : undefined,
      cardFeeAmount: !splitMode && cardFeeInfo ? cardFeeInfo.feeAmount : undefined,
      createdAt: new Date().toISOString()
    };

    // Update stock
    const updatedProducts = products.map(product => {
      const cartItem = cart.find(item => item.productId === product.id);
      if (cartItem) {
        const deduction = product.unit === 'mil' ? cartItem.quantity / 1000 : cartItem.quantity;
        return { ...product, stock: product.stock - deduction, updatedAt: new Date().toISOString() };
      }
      return product;
    });

    setProducts(updatedProducts);
    setSales([...sales, sale]);

    // Generate installments for crediário
    if (isCrediario && selectedClient && client) {
      const now = new Date();
      const newInstallments: Installment[] = [];

      // If entry amount, create a paid "entry" installment (parcela 0 - entrada)
      if (entryAmount > 0) {
        newInstallments.push({
          id: crypto.randomUUID(),
          saleId: sale.id,
          clientId: selectedClient,
          clientName: client.name,
          number: 0,
          totalInstallments: installmentCount,
          amount: entryAmount,
          amountPaid: entryAmount,
          dueDate: now.toISOString(),
          status: 'paid',
          paidAt: now.toISOString(),
          paymentMethod: 'cash',
          createdAt: now.toISOString()
        });
      }

      // Generate N installments with monthly due dates
      for (let i = 1; i <= installmentCount; i++) {
        const dueDate = addMonths(now, i);
        newInstallments.push({
          id: crypto.randomUUID(),
          saleId: sale.id,
          clientId: selectedClient,
          clientName: client.name,
          number: i,
          totalInstallments: installmentCount,
          amount: installmentValue,
          amountPaid: 0,
          dueDate: dueDate.toISOString(),
          status: 'open',
          createdAt: now.toISOString()
        });
      }

      setInstallments([...installments, ...newInstallments]);
    }

    // Deduct store credit if used
    if (storeCreditUsed > 0 && selectedClient) {
      setClients(clients.map(c =>
        c.id === selectedClient
          ? { ...c, storeCredit: Math.max(0, (c.storeCredit || 0) - storeCreditUsed), updatedAt: new Date().toISOString() }
          : c
      ));
    }

    // Low stock alerts
    const LOW_STOCK_THRESHOLD = 5;
    const cartProductIds = cart.map(i => i.productId);
    const affectedProducts = updatedProducts.filter(p => cartProductIds.includes(p.id));

    const outOfStock = affectedProducts.filter(p => p.stock <= 0);
    const lowStock = affectedProducts.filter(p => {
      if (p.stock <= 0) return false;
      const threshold = p.minStock > 0 ? p.minStock : LOW_STOCK_THRESHOLD;
      return p.stock <= threshold;
    });

    if (outOfStock.length > 0) {
      toast.error(
        `ESTOQUE ZERADO: ${outOfStock.map(p => p.name).join(', ')}`,
        { duration: 8000 }
      );
    }
    if (lowStock.length > 0) {
      toast.warning(
        `Estoque baixo: ${lowStock.map(p => `${p.name} (${p.stock} ${p.unit})`).join(', ')}`,
        { duration: 6000 }
      );
    }

    // Reset
    setCart([]);
    setSelectedClient('');
    setDiscountValue(0);
    setIsPercentage(true);
    setPaymentMethod('cash');
    setSplitMode(false);
    setPaymentEntries([{ method: 'cash', amount: 0 }]);
    setInstallmentCount(1);
    setEntryAmount(0);
    setCardBrand('');
    setCardInstallments(1);

    if (isCrediario) {
      toast.success(`Venda no crediário registrada: ${formatCurrency(total)}`);
    } else {
      toast.success(`Venda finalizada: ${formatCurrency(total)}`);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-100px)] gap-4 overflow-hidden">
        {/* Top Bar: Search & Client */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
          <div className="md:col-span-1">
             <ClientCombobox
               clients={clients}
               value={selectedClient}
               onChange={setSelectedClient}
             />
          </div>
          <div className="md:col-span-3">
             <Popover open={openSearch} onOpenChange={setOpenSearch}>
               <PopoverTrigger asChild>
                 <Button
                   variant="outline"
                   role="combobox"
                   aria-expanded={openSearch}
                   className="w-full justify-between h-10 px-3 text-muted-foreground"
                 >
                   <div className="flex items-center gap-2">
                     <Search className="h-4 w-4 shrink-0 opacity-50" />
                     {searchValue ? searchValue : "Buscar produto (Nome ou Código)..."}
                   </div>
                   {searchValue && (
                      <X
                        className="h-4 w-4 opacity-50 hover:opacity-100 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchValue("");
                        }}
                      />
                   )}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                 <Command shouldFilter={false}>
                   <CommandInput
                      placeholder="Buscar produto..."
                      value={searchValue}
                      onValueChange={setSearchValue}
                   />
                   <CommandList>
                     <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                     <CommandGroup heading="Produtos Disponíveis">
                       {filteredProducts.slice(0, 10).map((product) => {
                         const outOfStock = product.stock <= 0;
                         return (
                           <CommandItem
                             key={product.id}
                             value={product.name + " " + product.code}
                             onSelect={() => !outOfStock && addToCart(product)}
                             className={cn(
                               "flex items-center justify-between cursor-pointer",
                               outOfStock && "opacity-50 cursor-not-allowed"
                             )}
                           >
                             <div className="flex flex-col">
                               <span className="font-medium">{product.name}</span>
                               <span className="text-xs text-muted-foreground">Cód: {product.code}</span>
                             </div>
                             <div className="flex items-center gap-4">
                               <div className="text-right">
                                 <span className="block font-bold">{formatCurrency(product.price)}</span>
                                 {outOfStock
                                   ? <span className="text-xs text-red-500 font-medium">Sem estoque</span>
                                   : <span className="text-xs text-muted-foreground">Est: {product.stock}</span>
                                 }
                               </div>
                               {!outOfStock && <Plus className="h-4 w-4 text-muted-foreground" />}
                             </div>
                           </CommandItem>
                         );
                       })}
                     </CommandGroup>
                   </CommandList>
                 </Command>
               </PopoverContent>
             </Popover>
          </div>
        </div>

        {/* Main Content: Cart & Checkout */}
        <div className="flex flex-col lg:flex-row flex-1 gap-6 overflow-hidden min-h-0">

             {/* Left Column: Cart Items List */}
             <div className="flex-1 bg-card rounded-lg border shadow-sm flex flex-col min-h-0">
                 <div className="p-4 border-b font-medium grid grid-cols-12 gap-2 text-sm text-muted-foreground bg-muted/30 shrink-0">
                     <div className="col-span-5 md:col-span-6 pl-2">PRODUTO</div>
                     <div className="col-span-3 md:col-span-2 text-center">QTD</div>
                     <div className="col-span-2 text-right hidden md:block">UNITÁRIO</div>
                     <div className="col-span-4 md:col-span-2 text-right pr-2">TOTAL</div>
                 </div>

                 <div className="flex-1 overflow-auto p-2 space-y-1">
                     {cart.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 opacity-50">
                          <ShoppingCart className="h-12 w-12" />
                          <p>Seu carrinho está vazio</p>
                          <p className="text-sm">Busque produtos acima para começar</p>
                       </div>
                     ) : (
                       cart.map((item) => (
                         <div key={item.productId} className="grid grid-cols-12 gap-2 items-center p-3 hover:bg-muted/50 rounded-lg border border-transparent hover:border-border transition-colors group">
                             <div className="col-span-5 md:col-span-6">
                                <p className="font-medium truncate" title={item.productName}>{item.productName}</p>
                                <p className="text-xs text-muted-foreground md:hidden">
                                  {formatCurrency(item.unitPrice)} un.
                                </p>
                             </div>

                             <div className="col-span-3 md:col-span-2 flex items-center justify-center gap-1">
                               <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => updateQuantity(item.productId, -1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number"
                                  className="h-8 w-14 text-center p-0"
                                  value={item.quantity}
                                  onChange={(e) => {
                                     const val = parseInt(e.target.value);
                                     if (!isNaN(val)) updateItemQuantity(item.productId, val);
                                  }}
                                  onFocus={(e) => e.target.select()}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => updateQuantity(item.productId, 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                             </div>

                             <div className="col-span-2 text-right hidden md:block text-sm">
                                {formatCurrency(item.unitPrice)}
                             </div>

                             <div className="col-span-4 md:col-span-2 text-right font-bold flex items-center justify-end gap-2">
                                <span>{formatCurrency(item.total)}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                                  onClick={() => removeFromCart(item.productId)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                             </div>
                         </div>
                       ))
                     )}
                 </div>
             </div>

             {/* Right Column: Checkout Summary */}
             <div className="w-full lg:w-[380px] flex flex-col gap-4 lg:overflow-auto shrink-0">
                 <Card>
                   <CardHeader className="pb-2">
                     <CardTitle className="text-lg">Resumo</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      {/* Discount Controls */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Desc. (%)</label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={isPercentage ? discountValue : (subtotal > 0 ? (discountValue / subtotal * 100).toFixed(2) : 0)}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0) {
                                 setIsPercentage(true);
                                 setDiscountValue(val);
                              }
                            }}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Desc. (R$)</label>
                          <Input
                            type="number"
                            min="0"
                            value={!isPercentage ? discountValue : (subtotal * discountValue / 100).toFixed(2)}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0) {
                                 setIsPercentage(false);
                                 setDiscountValue(val);
                              }
                            }}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                      </div>

                      <div className="space-y-2 pt-4 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                        {finalDiscountValue > 0 && (
                          <div className="flex justify-between text-sm text-destructive">
                            <span>Desconto</span>
                            <span>-{formatCurrency(finalDiscountValue)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xl font-bold pt-2 border-t">
                          <span>Total</span>
                          <span>{formatCurrency(total)}</span>
                        </div>
                      </div>

                      {/* Store credit info */}
                      {selectedClient && clientStoreCredit > 0 && (
                        <div className="flex justify-between text-sm p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                          <span className="text-green-700 dark:text-green-300">Crédito em haver</span>
                          <span className="font-medium text-green-700 dark:text-green-300">{formatCurrency(clientStoreCredit)}</span>
                        </div>
                      )}

                      {/* Credit limit info when crediário selected */}
                      {hasCrediario && selectedClient && (
                        <div className="space-y-2">
                          {isClientDelinquent && (
                            <div className="flex items-center gap-2 text-sm p-2 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              <span>Cliente inadimplente! {clientOverdueInstallments.length} parcela(s) vencida(s)</span>
                            </div>
                          )}
                          <div className="text-sm p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800 space-y-1">
                            <div className="flex justify-between">
                              <span className="text-blue-700 dark:text-blue-300">Limite</span>
                              <span className="font-medium text-blue-700 dark:text-blue-300">{formatCurrency(clientCreditLimit)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-700 dark:text-blue-300">Utilizado</span>
                              <span className="font-medium text-blue-700 dark:text-blue-300">{formatCurrency(clientCreditUsed)}</span>
                            </div>
                            <div className="flex justify-between border-t border-blue-200 dark:border-blue-700 pt-1">
                              <span className="text-blue-700 dark:text-blue-300 font-medium">Disponível</span>
                              <span className={cn("font-bold", clientCreditAvailable > 0 ? "text-blue-700 dark:text-blue-300" : "text-red-600")}>{formatCurrency(clientCreditAvailable)}</span>
                            </div>
                            {clientCreditLimit <= 0 && (
                              <p className="text-xs text-red-600 mt-1">Configure o limite de crédito no cadastro do cliente</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Installment config when crediário selected */}
                      {hasCrediario && crediarioTotal > 0 && (
                        <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                          <p className="text-sm font-medium">Configuração do Crediário</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-medium">Nº de Parcelas</label>
                              <Select
                                value={String(installmentCount)}
                                onValueChange={(v) => setInstallmentCount(parseInt(v))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                                    <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium">Entrada (R$)</label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={entryAmount}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setEntryAmount(isNaN(val) ? 0 : val);
                                }}
                                onFocus={(e) => e.target.select()}
                                placeholder="0,00"
                              />
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground bg-background p-2 rounded border">
                            {entryAmount > 0
                              ? `Entrada ${formatCurrency(entryAmount)} + ${installmentCount}x de ${formatCurrency(installmentValue)}`
                              : `${installmentCount}x de ${formatCurrency(installmentValue)}`
                            }
                          </div>
                        </div>
                      )}
                   </CardContent>
                 </Card>

                 <div className="bg-card rounded-lg border shadow-sm p-4 space-y-4 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">Forma de Pagamento</p>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="split-mode" className="text-xs text-muted-foreground">Combinado</Label>
                        <Switch
                          id="split-mode"
                          checked={splitMode}
                          onCheckedChange={(checked) => {
                            setSplitMode(checked);
                            if (checked) {
                              setPaymentEntries([{ method: 'cash', amount: total }]);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {!splitMode ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {paymentMethods.map(method => (
                            <Button
                              key={method.id}
                              variant={paymentMethod === method.id ? "default" : "outline"}
                              className={cn(
                                "h-14 flex flex-col items-center justify-center gap-1",
                                paymentMethod === method.id && "ring-2 ring-primary ring-offset-1"
                              )}
                              onClick={() => {
                                setPaymentMethod(method.id);
                                setCardBrand('');
                                setCardInstallments(1);
                              }}
                            >
                              <method.icon className="h-4 w-4" />
                              <span className="text-xs">{method.label}</span>
                            </Button>
                          ))}
                        </div>

                        {/* Card fee config */}
                        {(paymentMethod === 'credit' || paymentMethod === 'debit') && (
                          <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                            <p className="text-sm font-medium">Configuração do Cartão</p>
                            <div className={cn("grid gap-3", paymentMethod === 'credit' ? "grid-cols-2" : "grid-cols-1")}>
                              <div className="space-y-1">
                                <label className="text-xs font-medium">Bandeira</label>
                                <Select value={cardBrand} onValueChange={(v) => setCardBrand(v as CardBrand)}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(Object.entries(CARD_BRAND_LABELS) as [CardBrand, string][]).map(([key, label]) => (
                                      <SelectItem key={key} value={key} disabled={paymentMethod === 'debit' && !hasDebit(key)}>
                                        {label}{paymentMethod === 'debit' && !hasDebit(key) ? ' (sem débito)' : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {paymentMethod === 'credit' && (
                                <div className="space-y-1">
                                  <label className="text-xs font-medium">Parcelas</label>
                                  <Select value={String(cardInstallments)} onValueChange={(v) => setCardInstallments(parseInt(v))}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                                        <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                            {cardFeePercent !== null && cardFeeInfo && (
                              <div className="text-sm bg-background p-2 rounded border space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Taxa ({cardFeePercent}%)</span>
                                  <span className="text-red-600 font-medium">-{formatCurrency(cardFeeInfo.feeAmount)}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1">
                                  <span className="font-medium">Valor líquido</span>
                                  <span className="font-bold text-green-600">{formatCurrency(cardFeeInfo.netAmount)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-3">
                        {paymentEntries.map((entry, index) => {
                          const isCard = entry.method === 'credit' || entry.method === 'debit';
                          const entryFee = isCard && entry.cardBrand
                            ? getCardFee(entry.cardBrand as CardBrand, entry.method as 'credit' | 'debit', entry.method === 'credit' ? (entry.cardInstallments || 1) : 1)
                            : null;
                          const entryFeeInfo = entryFee !== null && entry.amount > 0 ? calculateFee(entry.amount, entryFee) : null;

                          return (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Select
                                  value={entry.method}
                                  onValueChange={(value) => updatePaymentEntry(index, 'method', value)}
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {splitPaymentMethods.map(m => (
                                      <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={entry.amount}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) updatePaymentEntry(index, 'amount', val);
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  className="flex-1"
                                  placeholder="R$ 0,00"
                                />
                                {paymentEntries.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive shrink-0"
                                    onClick={() => removePaymentEntry(index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              {isCard && (
                                <div className="ml-1 flex items-center gap-2">
                                  <Select
                                    value={entry.cardBrand || ''}
                                    onValueChange={(v) => updatePaymentEntry(index, 'cardBrand', v)}
                                  >
                                    <SelectTrigger className="w-[130px] h-8 text-xs">
                                      <SelectValue placeholder="Bandeira..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(Object.entries(CARD_BRAND_LABELS) as [CardBrand, string][]).map(([key, label]) => (
                                        <SelectItem key={key} value={key} disabled={entry.method === 'debit' && !hasDebit(key)}>
                                          {label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {entry.method === 'credit' && (
                                    <Select
                                      value={String(entry.cardInstallments || 1)}
                                      onValueChange={(v) => updatePaymentEntry(index, 'cardInstallments', parseInt(v))}
                                    >
                                      <SelectTrigger className="w-[80px] h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                                          <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                  {entryFeeInfo && (
                                    <span className="text-xs text-muted-foreground">
                                      Taxa {entryFee}% = -{formatCurrency(entryFeeInfo.feeAmount)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={addPaymentEntry}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar forma
                        </Button>

                        <div className={cn(
                          "flex justify-between text-sm p-2 rounded border",
                          Math.abs(totalAllocated - total) <= 0.01
                            ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                            : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                        )}>
                          <span>Alocado: {formatCurrency(totalAllocated)}</span>
                          <span>Falta: {formatCurrency(Math.max(0, total - totalAllocated))}</span>
                        </div>
                      </div>
                    )}

                    <Button
                      className="w-full h-14 text-lg mt-auto"
                      size="lg"
                      onClick={finalizeSale}
                      disabled={cart.length === 0}
                    >
                      {hasCrediario ? 'Registrar Crediário' : 'Finalizar Venda'}
                    </Button>
                 </div>
             </div>
        </div>
      </div>
    </Layout>
  );
}
