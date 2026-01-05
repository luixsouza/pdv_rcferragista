const categoryPrefixes: Record<string, string> = {
  'Ferramentas Manuais': 'FM',
  'Ferramentas Elétricas': 'FE',
  'Parafusos e Fixadores': 'PF',
  'Tintas e Acessórios': 'TA',
  'Materiais Elétricos': 'ME',
  'Materiais Hidráulicos': 'MH',
  'EPI': 'EP',
  'Abrasivos': 'AB',
  'Colas e Adesivos': 'CA',
  'Construção Civil': 'CC',
  'Jardinagem': 'JD',
  'Automotivo': 'AU',
  'Iluminação': 'IL',
  'Segurança': 'SG',
  'Outros': 'OT'
};

export function generateProductCode(category: string): string {
  const prefix = categoryPrefixes[category] || 'GE';
  const randomNum = Math.floor(Math.random() * 9000) + 1000;
  const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `${prefix}${randomNum}${randomLetter}`;
}
