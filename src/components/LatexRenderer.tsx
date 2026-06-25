import { useEffect, useRef, useState } from "react";

interface LatexRendererProps {
  text: string;
  className?: string;
}

export default function LatexRenderer({ text, className = "" }: LatexRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isKatexLoaded, setIsKatexLoaded] = useState(false);

  useEffect(() => {
    // Check if KaTeX is available on window object
    const checkKatex = () => {
      // @ts-ignore
      if (window.katex) {
        setIsKatexLoaded(true);
      } else {
        setTimeout(checkKatex, 100);
      }
    };
    checkKatex();
  }, []);

  useEffect(() => {
    if (!isKatexLoaded || !containerRef.current) return;

    try {
      // @ts-ignore
      const katex = window.katex;
      if (!katex) return;

      const container = containerRef.current;
      container.innerHTML = ""; // Clear

      // Regex to match $$block$$ or $inline$ formulas
      // We search for $$...$$ first, then $...$
      const parts = text.split(/(\$\$.*?\$\$|\$.*?\$)/gs);

      parts.forEach((part) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          // Block formula
          const formula = part.slice(2, -2).trim();
          const span = document.createElement("div");
          span.className = "my-3 flex justify-center overflow-x-auto py-1";
          try {
            katex.render(formula, span, { displayMode: true, throwOnError: false });
          } catch (err) {
            span.textContent = part;
          }
          container.appendChild(span);
        } else if (part.startsWith("$") && part.endsWith("$")) {
          // Inline formula
          const formula = part.slice(1, -1).trim();
          const span = document.createElement("span");
          span.className = "inline-block px-0.5 max-w-full overflow-x-auto align-middle";
          try {
            katex.render(formula, span, { displayMode: false, throwOnError: false });
          } catch (err) {
            span.textContent = part;
          }
          container.appendChild(span);
        } else {
          // Plain text (replace line breaks with br tags)
          const textSpan = document.createElement("span");
          textSpan.className = "whitespace-pre-line";
          textSpan.innerHTML = part.replace(/\n/g, "<br/>");
          container.appendChild(textSpan);
        }
      });
    } catch (e) {
      console.error("Error rendering LaTeX:", e);
    }
  }, [text, isKatexLoaded]);

  // Fallback before KaTeX loads, render plain text
  if (!isKatexLoaded) {
    return (
      <div className={`whitespace-pre-line leading-relaxed ${className}`}>
        {text}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`latex-container leading-relaxed break-words ${className}`}
    />
  );
}
