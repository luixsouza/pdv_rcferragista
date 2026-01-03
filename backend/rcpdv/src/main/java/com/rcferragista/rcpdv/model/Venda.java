package com.rcferragista.rcpdv.model;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

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

    @OneToMany(mappedBy = "venda", fetch = FetchType.EAGER)
    @JsonManagedReference
    private List<ItemVenda> itens;
}