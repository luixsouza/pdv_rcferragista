import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Product, Client, Quote, SaleItem } from '@/types';
import { ShoppingCart, Plus, Minus, Trash2, Search, FileText, Printer, Download, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { ClientCombobox } from '@/components/ClientCombobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { printQuote, downloadQuote } from '@/lib/generateQuote';

export default function Quotes() {
  const [products] = useLocalStorage<Product[]>('products', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [quotes, setQuotes] = useLocalStorage<Quote[]>('quotes', []);
  
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
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
        toast.warning('Atenção: Quantidade excede o estoque atual');
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
    toast.success(`${product.name} adicionado ao orçamento`);
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
       toast.warning('Atenção: Quantidade excede o estoque atual');
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
       toast.warning('Atenção: Quantidade excede o estoque atual');
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

  const finalizeQuote = () => {
    if (cart.length === 0) {
      toast.error('Adicione produtos ao orçamento');
      return;
    }

    const client = clients.find(c => c.id === selectedClient);
    
    const quote: Quote = {
      id: crypto.randomUUID(),
      clientId: selectedClient || undefined,
      clientName: client?.name,
      items: cart,
      subtotal,
      discount: finalDiscountValue,
      total,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setQuotes([...quotes, quote]);
    
    // Reset
    setCart([]);
    setSelectedClient('');
    setDiscountValue(0);
    setIsPercentage(true);
    
    toast.success(`Orçamento gerado: ${formatCurrency(total)}`);
  };

  return (
    <Layout>
      <Tabs defaultValue="new" className="w-full">
        <div className="flex items-center justify-between mb-6">
           <CardTitle className="text-2xl font-bold flex items-center gap-2">
             <FileText className="h-8 w-8 text-primary" />
             Orçamentos
           </CardTitle>
           <TabsList>
             <TabsTrigger value="new">Novo Orçamento</TabsTrigger>
             <TabsTrigger value="history">Histórico</TabsTrigger>
           </TabsList>
        </div>

        <TabsContent value="new">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
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
                    <FileText className="h-5 w-5 text-primary" />
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
                <FileText className="h-5 w-5" />
                Orçamento
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
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Orçamento vazio</p>
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

                <Button
                  className="w-full h-12 text-lg"
                  onClick={finalizeQuote}
                  disabled={cart.length === 0}
                >
                  Gerar Orçamento
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </TabsContent>

        <TabsContent value="history">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
             {quotes.length === 0 ? (
               <div className="col-span-full text-center py-12 text-muted-foreground">
                 <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                 <p className="text-lg font-medium">Nenhum orçamento gerado</p>
                 <p>Os orçamentos salvos aparecerão aqui.</p>
               </div>
             ) : (
               quotes.slice().reverse().map(quote => (
                 <Card key={quote.id} className="flex flex-col">
                   <CardHeader>
                     <div className="flex justify-between items-start">
                       <div>
                         <CardTitle className="text-lg">
                           {quote.clientName || 'Cliente não identificado'}
                         </CardTitle>
                         <p className="text-sm text-muted-foreground">
                           {format(new Date(quote.createdAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                         </p>
                       </div>
                       <div className="text-right">
                         <span className="font-bold text-lg block">{formatCurrency(quote.total)}</span>
                         <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                           {quote.items.length} itens
                         </span>
                       </div>
                     </div>
                   </CardHeader>
                   <CardContent className="flex-1">
                     <div className="space-y-1">
                       {quote.items.slice(0, 3).map((item, idx) => (
                         <div key={idx} className="text-sm flex justify-between">
                           <span className="truncate flex-1 pr-2">{item.quantity}x {item.productName}</span>
                           <span className="text-muted-foreground">{formatCurrency(item.total)}</span>
                         </div>
                       ))}
                       {quote.items.length > 3 && (
                         <p className="text-xs text-muted-foreground pt-1">
                           + {quote.items.length - 3} outros itens...
                         </p>
                       )}
                     </div>
                   </CardContent>
                   <CardFooter className="flex gap-2 justify-end border-t pt-4">
                      <Button variant="outline" size="sm" onClick={() => printQuote(quote)}>
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => downloadQuote(quote)}>
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                   </CardFooter>
                 </Card>
               ))
             )}
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
