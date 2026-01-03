package com.rcferragista.rcpdv.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class VendaDTO {
    private List<ItemVendaDTO> itens;
    
    @Data
    public static class ItemVendaDTO {
        private Long produtoId;
        private BigDecimal quantidade;
    }
}