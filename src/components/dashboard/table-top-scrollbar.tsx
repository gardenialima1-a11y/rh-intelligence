"use client";

import * as React from "react";

/**
 * Envolve uma <Table> (ou qualquer coisa que tenha um elemento com o
 * atributo data-scroll-region, que é como o componente Table marca sua div
 * de rolagem) e desenha uma segunda barra de rolagem horizontal já visível
 * no topo, sincronizada com a de baixo.
 *
 * Sem isso, quando a tabela é larga (muitas colunas) e alta (muitas linhas),
 * a barra de rolagem horizontal só aparece embaixo de tudo — obrigando a
 * pessoa a descer a página inteira antes de conseguir rolar pros lados.
 */
export function TableTopScrollbar({ children }: { children: React.ReactNode }) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const topBarRef = React.useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = React.useState(0);
  const [clientWidth, setClientWidth] = React.useState(0);
  const syncingFrom = React.useRef<"top" | "bottom" | null>(null);

  React.useEffect(() => {
    const region = wrapperRef.current?.querySelector<HTMLDivElement>("[data-scroll-region]");
    if (!region) return;

    const updateWidth = () => {
      setScrollWidth(region.scrollWidth);
      setClientWidth(region.clientWidth);
    };
    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(region);

    const onRegionScroll = () => {
      if (syncingFrom.current === "top") {
        syncingFrom.current = null;
        return;
      }
      if (topBarRef.current) {
        syncingFrom.current = "bottom";
        topBarRef.current.scrollLeft = region.scrollLeft;
      }
    };
    region.addEventListener("scroll", onRegionScroll);

    return () => {
      resizeObserver.disconnect();
      region.removeEventListener("scroll", onRegionScroll);
    };
  }, []);

  function handleTopScroll(e: React.UIEvent<HTMLDivElement>) {
    if (syncingFrom.current === "bottom") {
      syncingFrom.current = null;
      return;
    }
    const region = wrapperRef.current?.querySelector<HTMLDivElement>("[data-scroll-region]");
    if (region) {
      syncingFrom.current = "top";
      region.scrollLeft = e.currentTarget.scrollLeft;
    }
  }

  // Só mostra a barra de cima quando a tabela realmente é mais larga que o
  // espaço disponível (senão não haveria nada pra rolar).
  const isScrollable = scrollWidth > 0 && clientWidth > 0 && clientWidth < scrollWidth;

  return (
    <div>
      {isScrollable && (
        <div ref={topBarRef} onScroll={handleTopScroll} className="mb-1.5 overflow-x-auto overflow-y-hidden" style={{ height: 12 }}>
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>
      )}
      <div ref={wrapperRef}>{children}</div>
    </div>
  );
}
