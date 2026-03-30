import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { StoreSettings, defaultSettings } from '@/types/settings';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { X, Plus } from 'lucide-react';

const Settings = () => {
  const [settings, setSettings] = useLocalStorage<StoreSettings>('store_settings', defaultSettings);

  const updateField = <K extends keyof StoreSettings>(field: K, value: StoreSettings[K]) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    toast.success('Configurações salvas');
  };

  const addPreset = () => {
    const newPreset = { label: '', percent: 0 };
    setSettings(prev => ({
      ...prev,
      discountPresets: [...prev.discountPresets, newPreset],
    }));
    toast.success('Configurações salvas');
  };

  const removePreset = (index: number) => {
    setSettings(prev => ({
      ...prev,
      discountPresets: prev.discountPresets.filter((_, i) => i !== index),
    }));
    toast.success('Configurações salvas');
  };

  const updatePreset = (index: number, field: 'label' | 'percent', value: string | number) => {
    setSettings(prev => ({
      ...prev,
      discountPresets: prev.discountPresets.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    }));
    toast.success('Configurações salvas');
  };

  return (
    <Layout>
      <PageHeader title="Configurações" description="Configure as informações da loja e preferências do sistema" />

      <Tabs defaultValue="loja" className="space-y-4">
        <TabsList>
          <TabsTrigger value="loja">Loja</TabsTrigger>
          <TabsTrigger value="crediario">Crediário</TabsTrigger>
          <TabsTrigger value="descontos">Descontos</TabsTrigger>
        </TabsList>

        <TabsContent value="loja">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Nome da loja</Label>
                  <Input
                    id="storeName"
                    value={settings.storeName}
                    onChange={e => setSettings(prev => ({ ...prev, storeName: e.target.value }))}
                    onBlur={() => toast.success('Configurações salvas')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={settings.cnpj}
                    onChange={e => setSettings(prev => ({ ...prev, cnpj: e.target.value }))}
                    onBlur={() => toast.success('Configurações salvas')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={settings.address}
                    onChange={e => setSettings(prev => ({ ...prev, address: e.target.value }))}
                    onBlur={() => toast.success('Configurações salvas')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade / Estado</Label>
                  <Input
                    id="city"
                    value={settings.city}
                    onChange={e => setSettings(prev => ({ ...prev, city: e.target.value }))}
                    onBlur={() => toast.success('Configurações salvas')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={settings.cep}
                    onChange={e => setSettings(prev => ({ ...prev, cep: e.target.value }))}
                    onBlur={() => toast.success('Configurações salvas')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={settings.phone}
                    onChange={e => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                    onBlur={() => toast.success('Configurações salvas')}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border/60">
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="lowStockThreshold">Limite de estoque baixo</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    min={0}
                    value={settings.lowStockThreshold}
                    onChange={e => setSettings(prev => ({ ...prev, lowStockThreshold: Number(e.target.value) }))}
                    onBlur={() => toast.success('Configurações salvas')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Produtos com estoque igual ou abaixo deste valor aparecem no alerta do Dashboard
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crediario">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="crediarioInterestRate">Taxa de juros mensal (%)</Label>
                <Input
                  id="crediarioInterestRate"
                  type="number"
                  min={0}
                  step={0.1}
                  value={settings.crediarioInterestRate}
                  onChange={e => setSettings(prev => ({ ...prev, crediarioInterestRate: Number(e.target.value) }))}
                  onBlur={() => toast.success('Configurações salvas')}
                />
                <p className="text-xs text-muted-foreground">
                  0 = sem juros. Aplicado sobre parcelas vencidas do crediário.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="descontos">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Presets de desconto rápido disponíveis no PDV.
              </p>

              <div className="space-y-3">
                {settings.discountPresets.map((preset, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs">Rótulo</Label>
                      <Input
                        value={preset.label}
                        onChange={e => {
                          const newPresets = [...settings.discountPresets];
                          newPresets[index] = { ...newPresets[index], label: e.target.value };
                          setSettings(prev => ({ ...prev, discountPresets: newPresets }));
                        }}
                        onBlur={() => toast.success('Configurações salvas')}
                        placeholder="Ex: 5%"
                      />
                    </div>
                    <div className="space-y-1 w-28">
                      <Label className="text-xs">Percentual</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={preset.percent}
                        onChange={e => {
                          const newPresets = [...settings.discountPresets];
                          newPresets[index] = { ...newPresets[index], percent: Number(e.target.value) };
                          setSettings(prev => ({ ...prev, discountPresets: newPresets }));
                        }}
                        onBlur={() => toast.success('Configurações salvas')}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-5 text-destructive hover:text-destructive"
                      onClick={() => removePreset(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={addPreset} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default Settings;
