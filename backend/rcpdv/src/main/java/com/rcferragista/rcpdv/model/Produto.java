package com.rcferragista.rcpdv.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Entity
@Table(name = "produtos")
public class Produto {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String codigoBarras;
    private String descricao;
    private BigDecimal precoVenda;
    private String unidadeMedida;
    private BigDecimal estoqueAtual;
}
