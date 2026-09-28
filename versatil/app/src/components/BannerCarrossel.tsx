"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { urlFoto } from "@/lib/uploads-url";

type Slide = { titulo: string; sub: string; cta: string; href: string; fotos: string[]; tema: "escuro" | "claro" };

export function BannerCarrossel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <div className="relative mx-auto max-w-[1200px] overflow-hidden md:rounded-[6px]">
      <div className="flex transition-transform duration-700" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((s) => (
          <Link
            key={s.titulo}
            href={s.href}
            className={`relative flex h-[190px] w-full shrink-0 items-center overflow-hidden px-6 md:h-[300px] md:px-14 ${s.tema === "escuro" ? "bg-noite text-white" : "bg-white text-marfim"}`}
          >
            <div className="relative z-10 max-w-[58%] md:max-w-[45%]">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] md:text-xs ${s.tema === "escuro" ? "text-ouro" : "text-ouro-escuro"}`}>Versátil</p>
              <h2 className="mt-1 text-[22px] font-bold leading-tight md:text-[40px]">{s.titulo}</h2>
              <p className={`mt-1.5 text-[12px] md:mt-3 md:text-[16px] ${s.tema === "escuro" ? "text-white/70" : "text-cinza"}`}>{s.sub}</p>
              <span className={`mt-3 inline-block rounded-[6px] px-4 py-2 text-[13px] font-semibold md:mt-5 md:px-6 md:py-3 md:text-[15px] ${s.tema === "escuro" ? "bg-ouro text-noite" : "bg-noite text-ouro-claro"}`}>
                {s.cta}
              </span>
            </div>
            <div className="absolute inset-y-0 right-0 flex w-[48%] items-center justify-end gap-2 pr-3 md:w-[52%] md:gap-4 md:pr-10">
              {s.fotos.slice(0, 3).map((f, k) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={f}
                  src={urlFoto(f, true)}
                  alt=""
                  className={`aspect-square rounded-[6px] bg-white object-contain p-1.5 shadow-lg ${k === 1 ? "w-[42%] md:w-[34%]" : "hidden w-[28%] sm:block md:w-[26%]"} ${k === 1 ? "" : "opacity-90"}`}
                />
              ))}
            </div>
          </Link>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {slides.map((s, k) => (
            <button key={s.titulo} onClick={() => setI(k)} aria-label={`Banner ${k + 1}`} className={`h-2 w-2 rounded-full ${k === i ? "bg-ouro" : "bg-white/60 ring-1 ring-black/10"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
