import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Product } from '@/types';
import { Package, Plus, Search, Pencil, Trash2, RefreshCw, FileDown, Percent } from 'lucide-react';
import { exportToCSV } from '@/lib/csvExport';
import { generateProductCode } from '@/lib/generateProductCode';
import { quantityStep, clampQuantityForUnit } from '@/lib/units';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const categories = [
  // Ferramentas e Equipamentos
  'Ferramentas Manuais',
  'Ferramentas Elétricas',
  'Acessórios p/ Ferramentas',
  'Medição e Nivelamento',
  'Solda e Maçaricos',

  // Estrutural e Construção
  'Construção Civil (Grosso)',
  'Cimentos e Argamassas',
  'Telhas e Calhas',
  'Impermeabilizantes',
  'Gesso e Drywall',
  
  // Fixação e Segurança
  'Parafusos e Fixadores',
  'Fechaduras e Cadeados',
  'EPI',
  'Segurança e Monitoramento',

  // Instalações
  'Materiais Elétricos',
  'Iluminação',
  'Automação Residencial',
  'Materiais Hidráulicos',
  'Louças e Metais',

  // Acabamento e Decoração
  'Pisos e Revestimentos',
  'Tintas e Acessórios',
  'Colas e Adesivos',
  'Esquadrias (Portas e Janelas)',

  // Diversos
  'Abrasivos',
  'Jardinagem e Agro',
  'Utilidades Domésticas',
  'Limpeza e Química',
  'Automotivo',
  'Outros'
];

const units = ['un', 'kg', 'mt', 'cx', 'pc', 'lt', 'par', 'jg', 'rl', 'mil'];

const emptyProduct: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  code: '',
  barcode: '',
  category: '',
  price: 0,
  costPrice: 0,
  stock: 0,
  minStock: 0,
  unit: 'un'
};

export default function Products() {
  const [products, setProducts] = useLocalStorage<Product[]>('products', []);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(emptyProduct);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkPercent, setBulkPercent] = useState(0);
  const [bulkField, setBulkField] = useState<'price' | 'costPrice'>('price');

  const handleExport = () => {
    exportToCSV('produtos',
      ['Codigo', 'Cod.Barras', 'Nome', 'Categoria', 'Preco Custo', 'Preco Venda', 'Estoque', 'Unidade'],
      products.map(p => [p.code, p.barcode || '', p.name, p.category, p.costPrice.toFixed(2), p.price.toFixed(2), String(p.stock), p.unit])
    );
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );


  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('Preencha o nome do produto');
      return;
    }

    const now = new Date().toISOString();
    const code = formData.code.trim() || generateProductCode(formData.category || 'Outros');

    const clampedStock = clampQuantityForUnit(formData.stock, formData.unit);

    if (editingProduct) {
      setProducts(products.map(p =>
        p.id === editingProduct.id
          ? { ...p, ...formData, code, stock: clampedStock, updatedAt: now }
          : p
      ));
      toast.success('Produto atualizado com sucesso');
    } else {
      const newProduct: Product = {
        ...formData,
        code,
        stock: clampedStock,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now
      };
      setProducts([...products, newProduct]);
      toast.success('Produto cadastrado com sucesso');
    }

    handleCloseDialog();
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      code: product.code,
      barcode: product.barcode || '',
      category: product.category,
      price: product.price,
      costPrice: product.costPrice,
      stock: product.stock,
      minStock: product.minStock,
      unit: product.unit
    });
    setDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      setProducts(products.filter(p => p.id !== deleteId));
      toast.success('Produto excluído com sucesso');
      setDeleteId(null);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProduct(null);
    setFormData(emptyProduct);
  };

  return (
    <Layout>
      <PageHeader
        title="Produtos"
        description="Gerencie o catálogo de produtos da loja"
        action={
          <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Percent className="h-4 w-4 mr-2" />
            Ajuste em Massa
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (!open) handleCloseDialog();
            else setDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Código</Label>
                    <div className="flex gap-2">
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={e => setFormData({ ...formData, code: e.target.value })}
                        placeholder="Auto"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setFormData({ ...formData, code: generateProductCode(formData.category || 'Outros') })}
                        title="Gerar código"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unidade</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={value => setFormData({ ...formData, unit: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(unit => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Código de Barras</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode || ''}
                    onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="7891234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Martelo de Borracha"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={value => {
                      setFormData({ ...formData, category: value });
                      if (!formData.code || formData.code === '') {
                        setFormData(prev => ({ ...prev, category: value, code: generateProductCode(value) }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="costPrice">Preço Custo</Label>
                    <Input
                      id="costPrice"
                      type="number"
                      step="0.01"
                      value={formData.costPrice}
                      onChange={e => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço Venda *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Estoque Inicial</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    step={quantityStep(formData.unit)}
                    value={formData.stock}
                    onChange={e => setFormData({ ...formData, stock: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={handleSave}>
                    {editingProduct ? 'Salvar' : 'Cadastrar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto encontrado"
          description={search ? "Tente buscar com outros termos" : "Cadastre seu primeiro produto para começar"}
          action={
            !search && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4">
          {filteredProducts.map(product => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.code}{product.barcode ? ` • EAN: ${product.barcode}` : ''} • {product.category || 'Sem categoria'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(product.price)}</p>
                      <p className={`text-sm ${product.stock <= product.minStock ? 'text-destructive' : 'text-muted-foreground'}`}>
                        Estoque: {product.stock} {product.unit}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(product.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajuste de Preços em Massa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={bulkCategory} onValueChange={setBulkCategory}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Campo</Label>
              <Select value={bulkField} onValueChange={v => setBulkField(v as 'price' | 'costPrice')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Preço de Venda</SelectItem>
                  <SelectItem value="costPrice">Preço de Custo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Percentual de ajuste (%)</Label>
              <Input type="number" step="0.1" value={bulkPercent}
                onChange={e => setBulkPercent(parseFloat(e.target.value) || 0)}
                onFocus={e => e.target.select()}
                placeholder="Ex: 10 para +10%, -5 para -5%"
              />
              <p className="text-xs text-muted-foreground">
                Positivo = aumento, Negativo = redução
              </p>
            </div>

            {bulkCategory && bulkPercent !== 0 && (() => {
              const affected = products.filter(p => p.category === bulkCategory);
              return (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <p><strong>{affected.length}</strong> produto(s) serão afetados</p>
                  <p className="text-muted-foreground">
                    {bulkPercent > 0 ? 'Aumento' : 'Redução'} de {Math.abs(bulkPercent)}% no {bulkField === 'price' ? 'preço de venda' : 'preço de custo'}
                  </p>
                </div>
              );
            })()}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setBulkOpen(false)}>Cancelar</Button>
              <Button className="flex-1" disabled={!bulkCategory || bulkPercent === 0}
                onClick={() => {
                  const factor = 1 + (bulkPercent / 100);
                  const now = new Date().toISOString();
                  let count = 0;
                  setProducts(products.map(p => {
                    if (p.category !== bulkCategory) return p;
                    count++;
                    const newValue = Math.round(p[bulkField] * factor * 100) / 100;
                    return { ...p, [bulkField]: Math.max(0, newValue), updatedAt: now };
                  }));
                  toast.success(`${count} produto(s) atualizados com ${bulkPercent > 0 ? '+' : ''}${bulkPercent}%`);
                  setBulkOpen(false);
                  setBulkPercent(0);
                  setBulkCategory('');
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
