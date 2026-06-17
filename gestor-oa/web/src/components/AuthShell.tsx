import type { ReactNode } from 'react';

// Moldura visual comum das telas de autenticacao.
export default function AuthShell({
  titulo,
  subtitulo,
  children,
  rodape,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-br from-petroleo-700 to-petroleo-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-2xl font-bold text-white">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-petroleo-500">
            G
          </span>
          GestorOA
        </div>
        <div className="card p-7">
          <h1 className="text-xl font-semibold text-slate-800">{titulo}</h1>
          {subtitulo && (
            <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>
          )}
          <div className="mt-5">{children}</div>
        </div>
        {rodape && (
          <div className="mt-4 text-center text-sm text-petroleo-100">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}
