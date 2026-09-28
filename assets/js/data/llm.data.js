/* Datos de referencia de modelos y GPUs para las calculadoras de la Parte II.
   Modelos: configuración publicada en sus model cards o papers. KV por token = 2 (K y V) × capas × kv_heads × head_dim
   valores; con MLA (DeepSeek) se guarda un vector latente comprimido por capa (kvElems) en lugar de K y V por cabeza.
   GPUs: especificaciones del fabricante; FLOPS densos, sin sparsity. nvlink = ancho de banda por GPU sumando ambos sentidos.
   Unidades: bytes y FLOPS en unidades SI (1 GB = 1e9 bytes). */
window.SD = window.SD || {};
SD.data = SD.data || {};
SD.data.llm = {
  models: {
    llama8b:  { name: 'Llama 3.1 8B', params: 8.03e9, layers: 32, heads: 32, kvHeads: 8, headDim: 128, ctx: 131072 },
    llama70b: { name: 'Llama 3.1 70B', params: 70.6e9, layers: 80, heads: 64, kvHeads: 8, headDim: 128, ctx: 131072 },
    llama405b: { name: 'Llama 3.1 405B', params: 405e9, layers: 126, heads: 128, kvHeads: 8, headDim: 128, ctx: 131072 },
    gpt3:     { name: 'GPT-3 175B (sin GQA)', params: 175e9, layers: 96, heads: 96, kvHeads: 96, headDim: 128, ctx: 2048 },
    mixtral:  { name: 'Mixtral 8x7B (MoE)', params: 46.7e9, active: 12.9e9, layers: 32, heads: 32, kvHeads: 8, headDim: 128, ctx: 32768 },
    dsv3:     { name: 'DeepSeek-V3 (MoE con MLA)', params: 671e9, active: 37e9, layers: 61, kvElems: 576, ctx: 131072 }
  },
  gpus: {
    a100:   { name: 'A100 80 GB', mem: 80e9, bw: 2.039e12, bf16: 312e12, fp8: null, fp4: null, nvlink: 600e9 },
    h100:   { name: 'H100 SXM', mem: 80e9, bw: 3.35e12, bf16: 989e12, fp8: 1979e12, fp4: null, nvlink: 900e9 },
    h200:   { name: 'H200 SXM', mem: 141e9, bw: 4.8e12, bf16: 989e12, fp8: 1979e12, fp4: null, nvlink: 900e9 },
    b200:   { name: 'B200', mem: 180e9, bw: 8e12, bf16: 2250e12, fp8: 4500e12, fp4: 9000e12, nvlink: 1800e9 },
    mi300x: { name: 'MI300X', mem: 192e9, bw: 5.3e12, bf16: 1307e12, fp8: 2615e12, fp4: null, nvlink: 896e9 }
  },
  /* Bytes por valor según el formato */
  bytes: { fp32: 4, bf16: 2, fp16: 2, fp8: 1, int8: 1, int4: 0.5, fp4: 0.5 },

  /* Bytes de KV cache por token */
  kvPerToken: function (m, kvBytes) {
    if (m.kvElems) return m.layers * m.kvElems * kvBytes;
    return 2 * m.layers * m.kvHeads * m.headDim * kvBytes;
  },

  /* Parámetros que participan en cada token (en un MoE, solo los expertos activos) */
  activeParams: function (m) { return m.active || m.params; }
};
