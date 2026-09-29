"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { urlFoto } from "@/lib/uploads-url";

/** Slide de imagem (arte pronta 1920×500, já com degradê) ou slide montado em código (enquanto não há artes). */
export type Slide =
  | { tipo: "imagem"; src: string; srcMobile?: string; href: string; alt: string }
  | { tipo: "codigo"; titulo: string; sub: string; cta: string; href: string; fotos: string[] };

/** Banner principal de ponta a ponta, como o do Mercado Livre (altura 400px no desktop, 500px em telas largas). */
export function BannerCarrossel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);
  const ir = (d: number) => setI((x) => (x + d + slides.length) % slides.length);

  return (
    <div className="group relative w-full overflow-hidden">
      <div className="flex transition-transform duration-700" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((s, k) =>
          s.tipo === "imagem" ? (
            <Link
              key={k}
              href={s.href}
              // sem arte de celular: mostra a arte inteira na proporção original (não corta o texto)
              className={`relative block w-full shrink-0 md:h-[400px] 3xl:h-[500px] ${s.srcMobile ? "h-[230px] sm:h-[300px]" : "aspect-[1920/500] md:aspect-auto"}`}
            >
              <picture>
                {s.srcMobile && <source media="(max-width: 767px)" srcSet={s.srcMobile} />}
                <img src={s.src} alt={s.alt} className="h-full w-full object-cover object-top" />
              </picture>
            </Link>
          ) : (
            <Link
              key={k}
              href={s.href}
              className="relative block h-[230px] w-full shrink-0 bg-[linear-gradient(180deg,#111_0%,#111_62%,#3a3a3a_80%,var(--color-fundo)_100%)] text-white sm:h-[300px] md:h-[400px] 3xl:h-[500px]"
            >
              <div className="mx-auto flex h-[70%] max-w-[1200px] items-center gap-4 px-5 md:h-[64%] md:px-8">
                <div className="relative z-10 max-w-[58%] md:max-w-[46%]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ouro md:text-xs">Versátil</p>
                  <h2 className="mt-1 text-[22px] font-bold leading-tight md:text-[38px]">{s.titulo}</h2>
                  <p className="mt-1.5 text-[12px] text-white/70 md:mt-3 md:text-[16px]">{s.sub}</p>
                  <span className="mt-3 inline-block rounded-[6px] bg-ouro px-4 py-2 text-[13px] font-semibold text-noite md:mt-5 md:px-6 md:py-3 md:text-[15px]">{s.cta}</span>
                </div>
                <div className="ml-auto flex h-full w-[40%] items-center justify-end gap-2 py-3 md:w-[46%] md:gap-4 md:py-6">
                  {s.fotos.slice(0, 3).map((f, n) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={f}
                      src={urlFoto(f, true)}
                      alt=""
                      className={`aspect-square max-h-full rounded-[6px] bg-white object-contain p-1.5 shadow-lg ${n === 1 ? "w-[85%] md:w-auto md:h-full" : "hidden md:block md:h-[82%] md:w-auto"}`}
                    />
                  ))}
                </div>
              </div>
            </Link>
          ),
        )}
      </div>

      {/* degradê do banner para o cinza da página (os cards de destaque ficam por cima dele) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-32 bg-gradient-to-b from-transparent to-fundo md:block" />

      {slides.length > 1 && (
        <>
          <button onClick={() => ir(-1)} aria-label="Banner anterior" className="absolute left-0 top-[40%] hidden h-16 w-9 -translate-y-1/2 items-center justify-center rounded-r-full bg-white/90 text-2xl text-marfim opacity-0 shadow transition group-hover:opacity-100 md:flex">
            ‹
          </button>
          <button onClick={() => ir(1)} aria-label="Próximo banner" className="absolute right-0 top-[40%] hidden h-16 w-9 -translate-y-1/2 items-center justify-center rounded-l-full bg-white/90 text-2xl text-marfim opacity-0 shadow transition group-hover:opacity-100 md:flex">
            ›
          </button>
          <div className="absolute left-1/2 top-[64%] flex -translate-x-1/2 gap-1.5 md:top-[56%] 3xl:top-[45%]">
            {slides.map((_, k) => (
              <button key={k} onClick={() => setI(k)} aria-label={`Banner ${k + 1}`} className={`h-2 w-2 rounded-full ${k === i ? "bg-white" : "bg-white/45"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
