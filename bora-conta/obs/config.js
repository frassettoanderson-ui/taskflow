/* =====================================================================
   BORA CONTÁ · ARTES DO OBS — ÚNICO ARQUIVO QUE VOCÊS PRECISAM EDITAR
   Abra no Bloco de Notas, troque os textos entre aspas e salve.
   Depois, no OBS: clique com o botão direito na fonte > Atualizar.
   ===================================================================== */
window.BORA = {

  // canal do YouTube (o QR da chamada "se inscreve" abre aqui já com a janela de inscrição)
  canal: "@boraconta",
  linkCanal: "https://www.youtube.com/@boraconta?sub_confirmation=1",

  /* ---------- PATROCINADORES ----------
     id      = apelido curto, sem espaço (é o que vai no link do OBS: patrocinador.html?id=exemplo)
     logo    = arquivo dentro da pasta "logos" (PNG com fundo transparente fica melhor)
     infos   = até 3 colunas (titulo pequeno em cima, valor grande embaixo)
     qr      = link que o QR abre (site, WhatsApp, Instagram...). Deixe "" para esconder o QR
     qrTexto = o que aparece embaixo do QR                                                   */
  patrocinadores: [
    {
      id: "exemplo",
      chamada: "OFERECIMENTO",
      nome: "Sua Marca Aqui",
      slogan: "Café especial torrado artesanalmente",
      logo: "exemplo.svg",
      infos: [
        { titulo: "Origem", valor: "Imbituba · SC" },
        { titulo: "Ouvinte do Bora Contá", valor: "10% OFF" },
        { titulo: "Cupom", valor: "BORACONTA" },
      ],
      qr: "https://boraconta.com.br",
      qrTexto: "(48) 99999-9999",
    },
    // para adicionar outro, copie o bloco { ... } acima, cole aqui embaixo e troque o id
  ],

  /* ---------- LOWER THIRDS (nome na tela) ----------
     link no OBS: lower-third.html?id=anderson                                              */
  pessoas: [
    { id: "anderson",  etiqueta: "APRESENTADOR", nome: "Anderson", linha: "Bora Contá", insta: "@boracontaoficial" },
    { id: "leo",       etiqueta: "APRESENTADOR", nome: "Léo",      linha: "Bora Contá", insta: "@boracontaoficial" },
    { id: "convidado", etiqueta: "CONVIDADO",    nome: "Nome do Convidado", linha: "O que ele faz / de onde é", insta: "@instagram" },
  ],

  // tempos (segundos)
  tempoPatrocinador: 12,   // quanto tempo a marca fica na tela antes de virar a chamada "se inscreve"
  tempoInscreva: 8,        // quanto tempo a chamada "se inscreve" fica
  tempoLowerThird: 8,      // quanto tempo o nome fica na tela (0 = fica até você esconder no OBS)
};
