import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Client, Sale } from '@/types';
import { Users, Plus, Search, Pencil, Trash2, Gift, BookOpen, FileDown, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/formatters';
import { exportToCSV } from '@/lib/csvExport';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDocument, validateDocument } from '@/lib/documentValidation';

const clientTags = ['Empreiteiro', 'Varejo', 'Cooperado', 'Profissional', 'Atacado', 'VIP'];

const emptyClient: Omit<Client, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  document: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  creditLimit: 0,
  tags: [] as string[]
};

export default function Clients() {
  const [clients, setClients] = useLocalStorage<Client[]>('clients', []);
  const [sales] = useLocalStorage<Sale[]>('sales', []);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState(emptyClient);

  const handleExport = () => {
    exportToCSV('clientes',
      ['Nome', 'CPF/CNPJ', 'Telefone', 'Email', 'Endereco', 'Cidade', 'Limite Credito', 'Credito Haver'],
      clients.map(c => [c.name, c.document, c.phone, c.email, c.address, c.city, String(c.creditLimit || 0), String(c.storeCredit || 0)])
    );
  };

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.document.includes(search) ||
      c.phone.includes(search);
    const matchesTag = !tagFilter || (c.tags || []).includes(tagFilter);
    return matchesSearch && matchesTag;
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }

    if (formData.document) {
      const docResult = validateDocument(formData.document);
      if (!docResult.valid) {
        toast.error(docResult.type === 'cpf' ? 'CPF inválido' : 'CNPJ inválido');
        return;
      }
    }

    const now = new Date().toISOString();

    if (editingClient) {
      setClients(clients.map(c =>
        c.id === editingClient.id
          ? { ...c, ...formData, updatedAt: now }
          : c
      ));
      toast.success('Cliente atualizado com sucesso');
    } else {
      const newClient: Client = {
        ...formData,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now
      };
      setClients([...clients, newClient]);
      toast.success('Cliente cadastrado com sucesso');
    }

    handleCloseDialog();
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      document: client.document,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      creditLimit: client.creditLimit || 0,
      tags: client.tags || []
    });
    setDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      const clientToDelete = clients.find(c => c.id === deleteId);
      const hasPendingCrediario = sales.some(s => s.clientId === deleteId && s.status === 'crediario_pending');
      if (hasPendingCrediario) {
        toast.error('Este cliente possui crediário pendente. Quite as notas antes de excluir.');
        setDeleteId(null);
        return;
      }
      if (clientToDelete && (clientToDelete.storeCredit || 0) > 0) {
        toast.warning(`Atenção: cliente possuía R$ ${(clientToDelete.storeCredit || 0).toFixed(2)} em crédito em haver.`);
      }
      setClients(clients.filter(c => c.id !== deleteId));
      toast.success('Cliente excluído com sucesso');
      setDeleteId(null);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingClient(null);
    setFormData(emptyClient);
  };

  return (
    <Layout>
      <PageHeader
        title="Clientes"
        description="Gerencie os clientes da loja"
        action={
          <div className="flex gap-2">
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
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="João da Silva"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="document">CPF/CNPJ</Label>
                    <Input
                      id="document"
                      value={formData.document}
                      onChange={e => setFormData({ ...formData, document: formatDocument(e.target.value) })}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Rua, número, bairro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="São Paulo - SP"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="creditLimit">Limite de crédito (R$)</Label>
                  <Input
                    id="creditLimit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.creditLimit || 0}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setFormData({ ...formData, creditLimit: isNaN(val) ? 0 : val });
                    }}
                    onFocus={e => e.target.select()}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-1">
                    {clientTags.map(tag => {
                      const selected = (formData.tags || []).includes(tag);
                      return (
                        <Button key={tag} type="button" variant={selected ? "default" : "outline"} size="sm" className="h-7 text-xs"
                          onClick={() => {
                            const current = formData.tags || [];
                            setFormData({
                              ...formData,
                              tags: selected ? current.filter(t => t !== tag) : [...current, tag]
                            });
                          }}
                        >
                          {tag}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={handleSave}>
                    {editingClient ? 'Salvar' : 'Cadastrar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <div className="mb-6 flex gap-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={tagFilter} onValueChange={v => setTagFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Todas as tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tags</SelectItem>
            {clientTags.map(tag => (
              <SelectItem key={tag} value={tag}>{tag}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredClients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente encontrado"
          description={search ? "Tente buscar com outros termos" : "Cadastre seu primeiro cliente para começar"}
          action={
            !search && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4">
          {filteredClients.map(client => (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-medium text-primary">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{client.name}</p>
                        {(client.creditLimit || 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            <BookOpen className="h-3 w-3" />
                            Limite: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.creditLimit || 0)}
                          </span>
                        )}
                        {(client.storeCredit || 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300">
                            <Gift className="h-3 w-3" />
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.storeCredit || 0)}
                          </span>
                        )}
                        {(client.tags || []).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {client.document || 'Sem documento'} • {client.phone || 'Sem telefone'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm text-muted-foreground">{client.city || 'Sem cidade'}</p>
                      <p className="text-sm text-muted-foreground">{client.email || 'Sem e-mail'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setDetailClient(client)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(client)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(client.id)}>
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
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
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

      <Dialog open={!!detailClient} onOpenChange={() => setDetailClient(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailClient?.name}</DialogTitle>
          </DialogHeader>
          {detailClient && (() => {
            const clientSales = sales
              .filter(s => s.clientId === detailClient.id)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const validSales = clientSales.filter(s => s.status !== 'refunded');
            const totalSpent = validSales.reduce((sum, s) => sum + s.total, 0);
            const saleCount = validSales.length;

            return (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold">{saleCount}</p>
                    <p className="text-xs text-muted-foreground">Compras</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold">{formatCurrency(totalSpent)}</p>
                    <p className="text-xs text-muted-foreground">Total Gasto</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold">{saleCount > 0 ? formatCurrency(totalSpent / saleCount) : 'R$ 0'}</p>
                    <p className="text-xs text-muted-foreground">Ticket Médio</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-sm">Últimas Compras</p>
                  {clientSales.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma compra registrada</p>
                  ) : (
                    clientSales.slice(0, 20).map(sale => (
                      <div key={sale.id} className="p-3 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex justify-between items-center">
                          <div className="min-w-0 flex-1 mr-3">
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(sale.createdAt), 'dd/MM/yyyy HH:mm')}
                            </p>
                            <p className="text-sm truncate">
                              {sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                            </p>
                          </div>
                          <span className={`font-bold text-sm shrink-0 ${sale.status === 'refunded' ? 'line-through text-muted-foreground' : ''}`}>
                            {formatCurrency(sale.total)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
