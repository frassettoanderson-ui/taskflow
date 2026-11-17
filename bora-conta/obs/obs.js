/* utilidades compartilhadas pelas artes do OBS */
(function () {
  // os atalhos da pasta "OBS - atalhos" passam a escolha por window.name (o OBS, em arquivo local, pode ignorar o "?")
  const q = new URLSearchParams(location.search || (window.name.startsWith("bora:") ? "?" + window.name.slice(5) : ""));
  if (q.get("previa") === "1") document.body.classList.add("previa");

  window.OBS = {
    q,
    espera: (s) => new Promise((r) => setTimeout(r, s * 1000)),
    /* desenha um QR em SVG dentro do elemento (preto no branco, com margem) */
    qr(el, texto) {
      const qr = qrcode(0, "M");
      qr.addData(texto);
      qr.make();
      const n = qr.getModuleCount();
      let d = "";
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
      el.innerHTML = `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><path d="${d}" fill="#160029"/></svg>`;
    },
    /* busca pelo id do link (?id=...) ou o primeiro da lista */
    escolhe(lista) {
      const id = q.get("id"), n = +q.get("n");
      return (id && lista.find((x) => x.id === id)) || (n && lista[n - 1]) || lista[0];
    },
  };
})();
