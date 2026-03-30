import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Client, Sale } from '@/types';
import { Users, Plus, Search, Pencil, Trash2, Gift, BookOpen } from 'lucide-react';
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
import { toast } from 'sonner';
import { formatDocument, validateDocument } from '@/lib/documentValidation';

const emptyClient: Omit<Client, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  document: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  creditLimit: 0
};

export default function Clients() {
  const [clients, setClients] = useLocalStorage<Client[]>('clients', []);
  const [sales] = useLocalStorage<Sale[]>('sales', []);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState(emptyClient);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.document.includes(search) ||
    c.phone.includes(search)
  );

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
      creditLimit: client.creditLimit || 0
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
        }
      />

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
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
    </Layout>
  );
}
