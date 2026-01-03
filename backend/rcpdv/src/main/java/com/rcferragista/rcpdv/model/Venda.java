package com.rcferragista.rcpdv.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "vendas")
public class Venda {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "data_venda")
    private LocalDateTime dataVenda = LocalDateTime.now();

    @Column(name = "total_venda")
    private BigDecimal totalVenda = BigDecimal.ZERO;
}