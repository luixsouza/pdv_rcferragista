package com.rcferragista.rcpdv.controller;

import com.rcferragista.rcpdv.dto.VendaDTO;
import com.rcferragista.rcpdv.model.ItemVenda;
import com.rcferragista.rcpdv.model.Produto;
import com.rcferragista.rcpdv.model.Venda;
import com.rcferragista.rcpdv.repository.ItemVendaRepository;
import com.rcferragista.rcpdv.repository.ProdutoRepository;
import com.rcferragista.rcpdv.repository.VendaRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:3000")
public class PdvController {

    @Autowired
    private ProdutoRepository produtoRepository;

    @Autowired
    private VendaRepository vendaRepository;

    @Autowired
    private ItemVendaRepository itemVendaRepository;

    // Lista todos os produtos
    @GetMapping("/produtos")
    public List<Produto> listarProdutos() {
        return produtoRepository.findAll();
    }

    @GetMapping("/vendas")
    public List<Venda> listarVendas() {
        // Retorna ordenado por ID decrescente (mais recentes primeiro)
        return vendaRepository.findAll(Sort.by(Sort.Direction.DESC, "id"));
    }

    // Busca inteligente: pelo nome ou código de barras
    @GetMapping("/produtos/buscar")
    public List<Produto> buscar(@RequestParam String termo) {
        if (termo == null || termo.isEmpty()) {
            return produtoRepository.findAll();
        }
        return produtoRepository.buscarPorCodigoOuNome(termo);
    }

    // Processa a Venda Completa
    @PostMapping("/vendas")
    @Transactional // Importante: Se der erro, desfaz tudo (rollback)
    public ResponseEntity<?> finalizarVenda(@RequestBody VendaDTO vendaDto) {
        
        // 1. Cria a nova venda
        Venda venda = new Venda();
        venda = vendaRepository.save(venda); // Salva para gerar o ID

        BigDecimal totalVenda = BigDecimal.ZERO;

        // 2. Itera sobre os itens recebidos do Frontend
        for (VendaDTO.ItemVendaDTO itemDto : vendaDto.getItens()) {
            
            // Busca o produto no banco para ter certeza do preço e estoque atual
            Produto produto = produtoRepository.findById(itemDto.getProdutoId())
                    .orElseThrow(() -> new RuntimeException("Produto não encontrado ID: " + itemDto.getProdutoId()));

            // Validação de Estoque (Opcional: remova se quiser permitir estoque negativo)
            if (produto.getEstoqueAtual().compareTo(itemDto.getQuantidade()) < 0) {
                 return ResponseEntity.badRequest().body("Estoque insuficiente para: " + produto.getDescricao());
            }

            // 3. Atualiza o Estoque (Baixa)
            produto.setEstoqueAtual(produto.getEstoqueAtual().subtract(itemDto.getQuantidade()));
            produtoRepository.save(produto);

            // 4. Calcula subtotal e cria o Item da Venda
            BigDecimal subtotal = produto.getPrecoVenda().multiply(itemDto.getQuantidade());
            
            ItemVenda itemVenda = new ItemVenda();
            itemVenda.setVenda(venda);
            itemVenda.setProduto(produto);
            itemVenda.setQuantidade(itemDto.getQuantidade());
            itemVenda.setPrecoUnitario(produto.getPrecoVenda());
            itemVenda.setSubtotal(subtotal);

            itemVendaRepository.save(itemVenda);

            // Soma ao total geral
            totalVenda = totalVenda.add(subtotal);
        }

        // 5. Atualiza o valor total da venda no cabeçalho
        venda.setTotalVenda(totalVenda);
        vendaRepository.save(venda);

        return ResponseEntity.ok().body("{\"status\": \"Venda " + venda.getId() + " realizada com sucesso!\"}");
    }
}