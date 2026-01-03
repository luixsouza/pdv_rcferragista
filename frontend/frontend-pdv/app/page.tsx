'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// --- Tipos (Devem bater com seu Java) ---
interface Produto {
    id: number;
    codigoBarras: string;
    descricao: string;
    precoVenda: number;
    unidadeMedida: string;
    estoqueAtual: number;
}

interface ItemCarrinho extends Produto {
    quantidadeVenda: number; // Qtd que está sendo vendida
    subtotal: number;
}

export default function PDV() {
    // --- Estados ---
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
    const [termoBusca, setTermoBusca] = useState('');
    const [qtdInput, setQtdInput] = useState<string>('1'); // String para facilitar digitação de decimais
    const [carregando, setCarregando] = useState(false);

    // Referência para focar no input de busca após adicionar
    const inputBuscaRef = useRef<HTMLInputElement>(null);

    // --- 1. Carregar Produtos do Backend ---
    const carregarProdutos = async (termo: string = '') => {
        try {
            // Se tiver termo, usa a busca inteligente, senão lista tudo
            const url = termo
                ? `http://localhost:8080/api/produtos/buscar?termo=${termo}`
                : 'http://localhost:8080/api/produtos';

            const response = await axios.get(url);
            setProdutos(response.data);
        } catch (error) {
            console.error("Erro ao buscar produtos. O Java está rodando?", error);
        }
    };

    // Carrega ao iniciar
    useEffect(() => {
        carregarProdutos();
    }, []);

    // Busca automática ao digitar (Debounce simples)
    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            carregarProdutos(termoBusca);
        }, 300);
        return () => clearTimeout(delayDebounce);
    }, [termoBusca]);


    // --- 2. Adicionar ao Carrinho ---
    const adicionarAoCarrinho = (produto: Produto) => {
        const qtd = parseFloat(qtdInput.replace(',', '.')); // Aceita virgula ou ponto

        if (isNaN(qtd) || qtd <= 0) {
            alert("Quantidade inválida!");
            return;
        }

        if (produto.estoqueAtual < qtd) {
            alert(`Estoque insuficiente! Disponível: ${produto.estoqueAtual}`);
            return;
        }

        const novoItem: ItemCarrinho = {
            ...produto,
            quantidadeVenda: qtd,
            subtotal: produto.precoVenda * qtd
        };

        setCarrinho([...carrinho, novoItem]);
        setQtdInput('1'); // Reseta qtd
        setTermoBusca(''); // Limpa busca
        inputBuscaRef.current?.focus(); // Volta foco para busca
    };

    // --- 3. Remover do Carrinho ---
    const removerDoCarrinho = (index: number) => {
        const novoCarrinho = [...carrinho];
        novoCarrinho.splice(index, 1);
        setCarrinho(novoCarrinho);
    };

    // --- 4. Finalizar Venda ---
    const finalizarVenda = async () => {
        if (carrinho.length === 0) return;
        setCarregando(true);

        // Monta o JSON igual ao teste do Postman
        const payload = {
            itens: carrinho.map(item => ({
                produtoId: item.id,
                quantidade: item.quantidadeVenda
            }))
        };

        try {
            await axios.post('http://localhost:8080/api/vendas', payload);
            alert('✅ Venda realizada com sucesso!');
            setCarrinho([]); // Limpa carrinho
            carregarProdutos(); // Atualiza estoque na tela
        } catch (error) {
            alert('❌ Erro ao finalizar venda!');
            console.error(error);
        } finally {
            setCarregando(false);
        }
    };

    // Cálculos de totais
    const totalVenda = carrinho.reduce((acc, item) => acc + item.subtotal, 0);

    return (
        <div className="flex h-screen text-gray-800 font-sans overflow-hidden">

            {/* --- LADO ESQUERDO: Catálogo --- */}
            <div className="w-2/3 flex flex-col p-4 gap-4 bg-gray-50 border-r border-gray-300">

                {/* Barra de Topo */}
                <div className="bg-white p-4 rounded-lg shadow-sm flex gap-4 items-center">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Buscar Produto (F1)</label>
                        <input
                            ref={inputBuscaRef}
                            type="text"
                            placeholder="Digite nome ou código de barras..."
                            className="w-full text-xl p-2 border-b-2 border-blue-500 focus:outline-none bg-transparent"
                            value={termoBusca}
                            onChange={e => setTermoBusca(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="w-32">
                        <label className="text-xs font-bold text-gray-500 uppercase">Quantidade</label>
                        <input
                            type="number"
                            className="w-full text-xl p-2 border-b-2 border-green-500 focus:outline-none bg-transparent text-center"
                            value={qtdInput}
                            onChange={e => setQtdInput(e.target.value)}
                            onKeyDown={e => {
                                // Atalho: Enter no campo de qtd tenta adicionar o primeiro produto da lista
                                if(e.key === 'Enter' && produtos.length > 0) adicionarAoCarrinho(produtos[0])
                            }}
                        />
                    </div>
                </div>

                {/* Lista de Produtos (Grid) */}
                <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-4 content-start pr-2">
                    {produtos.map((produto) => (
                        <div
                            key={produto.id}
                            onClick={() => adicionarAoCarrinho(produto)}
                            className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md hover:ring-2 ring-blue-500 cursor-pointer transition flex flex-col justify-between h-32"
                        >
                            <div>
                                <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600">{produto.codigoBarras}</span>
                                <h3 className="font-bold mt-2 leading-tight line-clamp-2">{produto.descricao}</h3>
                            </div>
                            <div className="flex justify-between items-end mt-2">
                                <span className="text-sm text-gray-500">Est: {produto.estoqueAtual} {produto.unidadeMedida}</span>
                                <span className="text-xl font-bold text-blue-700">R$ {produto.precoVenda.toFixed(2)}</span>
                            </div>
                        </div>
                    ))}

                    {produtos.length === 0 && (
                        <div className="col-span-3 text-center text-gray-400 mt-10">
                            Nenhum produto encontrado.
                        </div>
                    )}
                </div>
            </div>

            {/* --- LADO DIREITO: Carrinho e Checkout --- */}
            <div className="w-1/3 bg-white flex flex-col shadow-xl z-10">
                <div className="bg-blue-900 text-white p-6">
                    <h1 className="text-2xl font-bold">PDV Ferragista</h1>
                    <p className="opacity-80 text-sm">Caixa Livre - Operador 01</p>
                </div>

                {/* Lista de Itens do Carrinho */}
                <div className="flex-1 overflow-y-auto p-4">
                    <table className="w-full text-left border-collapse">
                        <thead className="text-gray-500 text-xs uppercase border-b">
                        <tr>
                            <th className="py-2">Item</th>
                            <th className="py-2 text-right">Qtd</th>
                            <th className="py-2 text-right">Total</th>
                            <th className="w-8"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {carrinho.map((item, index) => (
                            <tr key={index} className="border-b hover:bg-gray-50 group">
                                <td className="py-3">
                                    <div className="font-medium">{item.descricao}</div>
                                    <div className="text-xs text-gray-400">Unit: R$ {item.precoVenda.toFixed(2)}</div>
                                </td>
                                <td className="py-3 text-right">
                                    {item.quantidadeVenda} <span className="text-xs">{item.unidadeMedida}</span>
                                </td>
                                <td className="py-3 text-right font-bold text-gray-800">
                                    R$ {item.subtotal.toFixed(2)}
                                </td>
                                <td className="text-right">
                                    <button
                                        onClick={() => removerDoCarrinho(index)}
                                        className="text-red-400 hover:text-red-600 font-bold px-2 invisible group-hover:visible"
                                    >
                                        X
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>

                    {carrinho.length === 0 && (
                        <div className="text-center text-gray-400 mt-10">
                            Carrinho vazio.<br/>Selecione um produto ao lado.
                        </div>
                    )}
                </div>

                {/* Rodapé / Totalizadores */}
                <div className="bg-gray-100 p-6 border-t border-gray-300">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-gray-600 text-lg">Total a Pagar</span>
                        <span className="text-4xl font-extrabold text-blue-900">
              R$ {totalVenda.toFixed(2)}
            </span>
                    </div>

                    <button
                        disabled={carrinho.length === 0 || carregando}
                        onClick={finalizarVenda}
                        className={`w-full py-5 rounded-lg text-xl font-bold text-white shadow-lg transition transform active:scale-95
              ${carrinho.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}
            `}
                    >
                        {carregando ? 'PROCESSANDO...' : 'FINALIZAR VENDA (F5)'}
                    </button>
                </div>
            </div>
        </div>
    );
}