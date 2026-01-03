'use client';

import { useState, useEffect, Fragment } from 'react'; // <--- 1. Importe Fragment aqui
import axios from 'axios';
import Link from 'next/link';

interface ItemVenda {
    id: number;
    produto: {
        descricao: string;
        unidadeMedida: string;
    };
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
}

interface Venda {
    id: number;
    dataVenda: string;
    totalVenda: number;
    itens: ItemVenda[];
}

export default function RelatorioVendas() {
    const [vendas, setVendas] = useState<Venda[]>([]);

    // Estado para controlar qual venda está expandida (detalhes visíveis)
    const [vendaExpandida, setVendaExpandida] = useState<number | null>(null);

    useEffect(() => {
        axios.get('http://localhost:8080/api/vendas')
            .then(res => setVendas(res.data))
            .catch(err => console.error("Erro ao carregar vendas", err));
    }, []);

    const toggleDetalhes = (id: number) => {
        setVendaExpandida(vendaExpandida === id ? null : id);
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">

            {/* Cabeçalho */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-blue-900">Histórico de Vendas</h1>
                <Link href="/" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    Voltar ao PDV
                </Link>
            </div>

            {/* Tabela de Vendas */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-200 text-gray-700 uppercase text-sm">
                    <tr>
                        <th className="p-4"># ID</th>
                        <th className="p-4">Data / Hora</th>
                        <th className="p-4">Total</th>
                        <th className="p-4 text-center">Ações</th>
                    </tr>
                    </thead>
                    <tbody>
                    {vendas.map(venda => (
                        // 2. AQUI ESTÁ A CORREÇÃO: Usamos Fragment com a KEY
                        <Fragment key={venda.id}>

                            {/* Linha Principal da Venda */}
                            <tr className="border-b hover:bg-gray-50">
                                <td className="p-4 font-bold text-gray-600">{venda.id}</td>
                                <td className="p-4">
                                    {new Date(venda.dataVenda).toLocaleString('pt-BR')}
                                </td>
                                <td className="p-4 font-bold text-green-600">
                                    R$ {venda.totalVenda.toFixed(2)}
                                </td>
                                <td className="p-4 text-center">
                                    <button
                                        onClick={() => toggleDetalhes(venda.id)}
                                        className="text-blue-500 hover:text-blue-700 font-semibold text-sm"
                                    >
                                        {vendaExpandida === venda.id ? 'Ocultar Itens' : 'Ver Itens'}
                                    </button>
                                </td>
                            </tr>

                            {/* Linha de Detalhes (Aparece só se clicar) */}
                            {vendaExpandida === venda.id && (
                                <tr className="bg-blue-50 animate-fade-in">
                                    <td colSpan={4} className="p-4">
                                        <div className="bg-white border rounded p-3 shadow-inner">
                                            <h4 className="font-bold text-sm mb-2 text-gray-500">ITENS DA VENDA #{venda.id}</h4>
                                            <table className="w-full text-sm">
                                                <thead>
                                                <tr className="text-gray-400 border-b">
                                                    <th className="text-left pb-1">Produto</th>
                                                    <th className="text-right pb-1">Qtd</th>
                                                    <th className="text-right pb-1">Unitário</th>
                                                    <th className="text-right pb-1">Subtotal</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {venda.itens.map(item => (
                                                    <tr key={item.id} className="border-b last:border-0">
                                                        <td className="py-2">{item.produto.descricao}</td>
                                                        <td className="py-2 text-right">
                                                            {item.quantidade} {item.produto.unidadeMedida}
                                                        </td>
                                                        <td className="py-2 text-right">R$ {item.precoUnitario.toFixed(2)}</td>
                                                        <td className="py-2 text-right font-bold">R$ {item.subtotal.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </Fragment>
                    ))}
                    </tbody>
                </table>

                {vendas.length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                        Nenhuma venda registrada ainda.
                    </div>
                )}
            </div>
        </div>
    );
}