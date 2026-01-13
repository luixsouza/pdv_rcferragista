import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Product, Client, Sale, SaleItem } from '@/types';
import { ShoppingCart, Plus, Minus, Trash2, Search, CreditCard, Wallet, QrCode, Banknote, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ClientCombobox } from '@/components/ClientCombobox';
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
] as const;

export default function POS() {
  const [products, setProducts] = useLocalStorage<Product[]>('products', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [sales, setSales] = useLocalStorage<Sale[]>('sales', []);
  
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<Sale['paymentMethod']>('cash');
  const [discountValue, setDiscountValue] = useState(0);
  const [isPercentage, setIsPercentage] = useState(true);
  
  // Search state
  const [openSearch, setOpenSearch] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const filteredProducts = products.filter(p =>
    (p.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    p.code.toLowerCase().includes(searchValue.toLowerCase())) &&
    p.stock > 0
  );

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  
  const finalDiscountValue = isPercentage 
    ? (subtotal * discountValue) / 100 
    : discountValue;

  const total = Math.max(0, subtotal - finalDiscountValue);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.productId === product.id);
    const isMilheiro = product.unit === 'mil';
    const effectiveStock = isMilheiro ? product.stock * 1000 : product.stock;
    
    // For 'mil' items, unitPrice is price/1000 (price per unit)
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

  const finalizeSale = () => {
    if (cart.length === 0) {
      toast.error('Adicione produtos ao carrinho');
      return;
    }

    const client = clients.find(c => c.id === selectedClient);
    
    const sale: Sale = {
      id: crypto.randomUUID(),
      clientId: selectedClient || undefined,
      clientName: client?.name,
      items: cart,
      subtotal,
      discount: finalDiscountValue,
      total,
      paymentMethod,
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
    
    // Reset
    setCart([]);
    setSelectedClient('');
    setDiscountValue(0);
    setIsPercentage(true);
    setPaymentMethod('cash');
    
    toast.success(`Venda finalizada: ${formatCurrency(total)}`);
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-100px)] gap-4">
        {/* Top Bar: Search & Client */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                       {filteredProducts.slice(0, 10).map((product) => (
                         <CommandItem
                           key={product.id}
                           value={product.name + " " + product.code}
                           onSelect={() => addToCart(product)}
                           className="flex items-center justify-between cursor-pointer"
                         >
                           <div className="flex flex-col">
                             <span className="font-medium">{product.name}</span>
                             <span className="text-xs text-muted-foreground">Cód: {product.code}</span>
                           </div>
                           <div className="flex items-center gap-4">
                             <div className="text-right">
                               <span className="block font-bold">{formatCurrency(product.price)}</span>
                               <span className="text-xs text-muted-foreground">Est: {product.stock}</span>
                             </div>
                             <Plus className="h-4 w-4 text-muted-foreground" />
                           </div>
                         </CommandItem>
                       ))}
                     </CommandGroup>
                   </CommandList>
                 </Command>
               </PopoverContent>
             </Popover>
          </div>
        </div>

        {/* Main Content: Cart & Checkout */}
        <div className="flex flex-col lg:flex-row flex-1 gap-6 overflow-hidden">
             
             {/* Left Column: Cart Items List */}
             <div className="flex-1 bg-card rounded-lg border shadow-sm flex flex-col min-h-0">
                 <div className="p-4 border-b font-medium grid grid-cols-12 gap-2 text-sm text-muted-foreground bg-muted/30">
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
             <div className="w-full lg:w-[350px] flex flex-col gap-4">
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
                   </CardContent>
                 </Card>

                 <div className="bg-card rounded-lg border shadow-sm p-4 space-y-4 flex-1">
                    <p className="font-medium text-sm">Forma de Pagamento</p>
                    <div className="grid grid-cols-2 gap-2">
                      {paymentMethods.map(method => (
                        <Button
                          key={method.id}
                          variant={paymentMethod === method.id ? "default" : "outline"}
                          className={cn(
                            "h-14 flex flex-col items-center justify-center gap-1",
                            paymentMethod === method.id && "ring-2 ring-primary ring-offset-1"
                          )}
                          onClick={() => setPaymentMethod(method.id)}
                        >
                          <method.icon className="h-4 w-4" />
                          <span className="text-xs">{method.label}</span>
                        </Button>
                      ))}
                    </div>
                    
                    <Button
                      className="w-full h-14 text-lg mt-auto"
                      size="lg"
                      onClick={finalizeSale}
                      disabled={cart.length === 0}
                    >
                      Finalizar Venda
                    </Button>
                 </div>
             </div>
        </div>
      </div>
    </Layout>
  );
}
