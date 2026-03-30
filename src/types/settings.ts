export interface StoreSettings {
  storeName: string;
  cnpj: string;
  address: string;
  city: string;
  cep: string;
  phone: string;
  lowStockThreshold: number;
  crediarioInterestRate: number;
  discountPresets: { label: string; percent: number }[];
}

export const defaultSettings: StoreSettings = {
  storeName: 'RC Casa & Construção',
  cnpj: '46.483.338/0001-42',
  address: 'Rua Vicente Bueno, Nº 160',
  city: 'Setor Paraíso - Inhumas, GO',
  cep: '75400-896',
  phone: '(62) 99275-1884',
  lowStockThreshold: 10,
  crediarioInterestRate: 0,
  discountPresets: [
    { label: '5%', percent: 5 },
    { label: '10%', percent: 10 },
    { label: '15%', percent: 15 },
  ],
};
