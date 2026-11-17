// chrome.storage em memória (prévia visual no navegador comum)
const dados: Record<string, unknown> = {};
const ouvintes = new Set<(m: Record<string, { newValue: unknown }>, a: string) => void>();
(globalThis as any).chrome = {
  storage: {
    local: {
      async get(k: string | string[]) {
        const ks = typeof k === 'string' ? [k] : k;
        const r: Record<string, unknown> = {};
        for (const x of ks) if (x in dados) r[x] = structuredClone(dados[x]);
        return r;
      },
      async set(o: Record<string, unknown>) {
        const mud: Record<string, { newValue: unknown }> = {};
        for (const [k, v] of Object.entries(o)) {
          mud[k] = { newValue: v };
          dados[k] = structuredClone(v);
        }
        ouvintes.forEach((f) => f(mud, 'local'));
      },
      async remove(k: string) {
        delete dados[k];
      },
    },
    onChanged: { addListener: (f: any) => ouvintes.add(f), removeListener: (f: any) => ouvintes.delete(f) },
  },
  runtime: { sendMessage: async () => ({ ok: true, texto: 'Texto de exemplo da IA' }), onMessage: { addListener() {}, removeListener() {} } },
};
export {};
