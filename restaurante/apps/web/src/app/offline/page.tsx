import Link from 'next/link';

export const metadata = { title: 'Sem internet' };

/**
 * A tela que aparece quando o navegador não consegue falar com o servidor e
 * também não tem aquela página guardada.
 *
 * Ela existe para o caixa não ver o erro cru do navegador e achar que o
 * sistema morreu — e para lembrar o caminho de volta: o PDV continua vendendo.
 */
export default function PaginaOffline() {
  return (
    <main className="center-screen">
      <div className="card card--login" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 46 }}>📴</div>
        <h1 className="title">Sem internet</h1>
        <p className="subtitle">
          Esta tela precisa de conexão para carregar. Assim que a internet voltar, ela abre
          normalmente.
        </p>

        <div className="fechado" style={{ textAlign: 'left', margin: '16px 0' }}>
          <strong>O caixa continua funcionando.</strong> No PDV você segue vendendo e recebendo:
          as vendas ficam guardadas neste aparelho e sobem sozinhas quando a conexão voltar.
          <br />
          <br />
          A <strong>cozinha</strong>, essa sim, só recebe os pedidos quando a internet voltar —
          nesse meio-tempo, produza pelo papel.
        </div>

        <Link href="/pdv">
          <button style={{ width: '100%' }}>Ir para o PDV</button>
        </Link>
      </div>
    </main>
  );
}
