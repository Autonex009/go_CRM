import { useEffect, useId, useRef, useState } from "react";

interface MermaidDiagramProps {
  /** Mermaid diagram source (e.g. a `flowchart LR ...` string). */
  chart: string;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
}

export function MermaidDiagram({ chart, className = "", onNodeClick }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const [error, setError] = useState<string | null>(null);

  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  useEffect(() => {
    let cancelled = false;
    const renderId = `mmd-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
    const isDark = document.documentElement.classList.contains("dark");

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "strict",
          flowchart: { curve: "basis", padding: 12 },
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        });

        const { svg } = await mermaid.render(renderId, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);

          const svgElement = containerRef.current.querySelector("svg");
          if (svgElement) {
            const nodes = svgElement.querySelectorAll(".node");
            nodes.forEach((node) => {
              const idAttr = node.getAttribute("id");
              if (idAttr) {
                const match = idAttr.match(/flowchart-([^-]+)-\d+/);
                if (match && match[1]) {
                  const nodeId = match[1];
                  if (onNodeClickRef.current) {
                    (node as HTMLElement).style.cursor = "pointer";
                    node.addEventListener("click", () => {
                      onNodeClickRef.current?.(nodeId);
                    });
                  }
                }
              }
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (error) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-xs text-muted-foreground">
        Could not render diagram.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex w-full justify-center overflow-x-auto [&_svg]:max-w-full ${className}`}
      aria-label="Pipeline diagram"
    />
  );
}
