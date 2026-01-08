import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Product, Client, Sale, SaleItem } from '@/types';
import { ShoppingCart, Plus, Minus, Trash2, Search, CreditCard, Wallet, QrCode, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ClientCombobox } from '@/components/ClientCombobox';

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
  const [search, setSearch] = useState('');

  const filteredProducts = products.filter(p =>
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())) &&
    p.stock > 0
  );

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  
  const finalDiscountValue = isPercentage 
    ? (subtotal * discountValue) / 100 
    : discountValue;

  const total = subtotal - finalDiscountValue;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.productId === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        toast.error('Estoque insuficiente');
        return;
      }
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
        costPrice: product.costPrice,
        total: product.price
      }]);
    }
    toast.success(`${product.name} adicionado`);
  };

  const updateQuantity = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    const item = cart.find(i => i.productId === productId);
    
    if (!product || !item) return;

    const newQuantity = item.quantity + delta;
    
    if (newQuantity <= 0) {
      setCart(cart.filter(i => i.productId !== productId));
      return;
    }
    
    if (newQuantity > product.stock) {
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

    if (newQuantity <= 0) {
      setCart(cart.filter(i => i.productId !== productId));
      return;
    }
    
    if (newQuantity > product.stock) {
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
        return { ...product, stock: product.stock - cartItem.quantity, updatedAt: new Date().toISOString() };
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
        {/* Products Grid */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto por nome ou código..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto flex-1 pb-4">
            {filteredProducts.map(product => (
              <Card
                key={product.id}
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
                onClick={() => addToCart(product)}
              >
                <CardContent className="p-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-medium text-sm line-clamp-2">{product.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{product.code}</p>
                  <p className="font-bold mt-2">{formatCurrency(product.price)}</p>
                  <p className="text-xs text-muted-foreground">Est: {product.stock} {product.unit}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Carrinho
                {cart.length > 0 && (
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {/* Client Selection */}
              <div className="mb-4">
                <ClientCombobox
                  clients={clients}
                  value={selectedClient}
                  onChange={setSelectedClient}
                />
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Carrinho vazio</p>
                    <p className="text-sm">Clique nos produtos para adicionar</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.productId} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(item.unitPrice)} x {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.productId, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          className="h-8 w-16 text-center p-0"
                          value={item.quantity}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                             const val = parseInt(e.target.value);
                             if (!isNaN(val)) updateItemQuantity(item.productId, val);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.productId, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeFromCart(item.productId)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                      <p className="font-bold text-sm w-20 text-right">{formatCurrency(item.total)}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Totals & Payment */}
              <div className="mt-4 pt-4 border-t border-border space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-1 items-center gap-2">
                      <span className="text-sm min-w-fit">Desc. (%):</span>
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
                        className="h-8"
                      />
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      <span className="text-sm min-w-fit">Desc. (R$):</span>
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
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {finalDiscountValue > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Desconto:</span>
                      <span>-{formatCurrency(finalDiscountValue)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="grid grid-cols-4 gap-2">
                  {paymentMethods.map(method => (
                    <Button
                      key={method.id}
                      variant={paymentMethod === method.id ? "default" : "outline"}
                      className={cn(
                        "flex flex-col h-16 gap-1",
                        paymentMethod === method.id && "ring-2 ring-primary"
                      )}
                      onClick={() => setPaymentMethod(method.id)}
                    >
                      <method.icon className="h-4 w-4" />
                      <span className="text-xs">{method.label}</span>
                    </Button>
                  ))}
                </div>

                <Button
                  className="w-full h-12 text-lg"
                  onClick={finalizeSale}
                  disabled={cart.length === 0}
                >
                  Finalizar Venda
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
