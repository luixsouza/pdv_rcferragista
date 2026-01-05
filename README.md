# PDV RC Ferragista

Sistema de Ponto de Venda (PDV) simples e offline, desenvolvido para gerenciamento de vendas, produtos e clientes.

## 🚀 Como Rodar o Projeto (Desenvolvimento)

Para rodar o projeto em modo de desenvolvimento (com hot-reload):

1. Instale as dependências (caso ainda não tenha feito):
   ```bash
   npm install
   ```

2. Inicie a aplicação:
   ```bash
   npm run electron:dev
   ```

## 📦 Como Gerar o Executável (Build)

Para criar o instalador `.exe` para usar no computador do cliente:

1. Execute o comando de build:
   ```bash
   npm run electron:build
   ```

2. O arquivo instalador será gerado na pasta:
   `dist-electron/PDV RC Ferragista Setup X.X.X.exe`

## 💾 Backup e Restauração de Dados

O sistema salva todos os dados (Produtos, Clientes e Vendas) em um arquivo local no computador. É importante fazer backups regulares desse arquivo.

### Onde ficam os dados?
Os dados são salvos em um arquivo chamado **`config.json`**.

**Caminho no Windows:**
```
C:\Users\<SEU_USUARIO>\AppData\Roaming\PDV RC Ferragista\config.json
```
*(Nota: Em modo de desenvolvimento, a pasta pode se chamar `pdv-rc-ferragista` ou `vite_react_shadcn_ts` dependendo da versão, mas na versão instalada no cliente será `pdv-rc-ferragista`)*

### Como fazer Backup
1. Pressione a tecla `Windows + R` no teclado.
2. Digite `%APPDATA%\pdv-rc-ferragista` e aperte Enter.
3. Copie o arquivo `config.json` para um local seguro (Pen Drive, Google Drive, HD Externo).

### Como Restaurar Dados
1. Instale o programa no novo computador.
2. Abra o programa pelo menos uma vez e feche-o.
3. Pressione `Windows + R`, digite `%APPDATA%\pdv-rc-ferragista` e aperte Enter.
4. Cole o seu arquivo `config.json` de backup nesta pasta (substituindo o existente).
5. Abra o programa novamente. Seus dados estarão lá.

## 🛠 Tecnologias Utilizadas
- **Electron**: Para transformar o site em aplicativo Desktop.
- **React + Vite**: Interface do usuário.
- **Electron Store**: Banco de dados local (arquivo JSON).
- **Shadcn/ui**: Componentes visuais.
