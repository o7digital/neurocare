import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleHelp,
  Printer,
  Search,
  X,
} from "lucide-react";
import guide from "../../content/admin-guide.es.json";

const searchable = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");

export default function UserGuide({
  onOpen,
}: {
  onOpen: (panel: string) => void;
}) {
  const [query, setQuery] = useState("");
  const search = searchable(query.trim());
  const sections = guide.sections.filter((section) =>
    searchable(
      [section.title, section.summary, ...section.steps, section.note].join(
        " ",
      ),
    ).includes(search),
  );
  const faqs = guide.faqs.filter((faq) =>
    searchable(`${faq.question} ${faq.answer}`).includes(search),
  );
  const jump = (id: string) => {
    const target = document.getElementById(`guide-${id}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  };
  const print = () => {
    setQuery("");
    requestAnimationFrame(() => window.print());
  };
  return (
    <div className="admin-guide" lang="es">
      <header className="guide-heading">
        <div>
          <span className="eyebrow">NEURO DIVERSA · AYUDA</span>
          <h1>{guide.title}</h1>
          <p>{guide.description}</p>
        </div>
        <button type="button" className="nd-button" onClick={print}>
          <Printer size={16} />
          Imprimir guía
        </button>
      </header>
      <section className="guide-start" aria-label="Accesos rápidos">
        <span className="guide-start-icon">
          <BookOpen size={25} />
        </span>
        <div>
          <h2>¿Qué quieres hacer hoy?</h2>
          <p>Elige una herramienta o consulta los pasos antes de empezar.</p>
        </div>
        <div className="guide-start-actions">
          <button
            type="button"
            className="nd-button primary"
            onClick={() => onOpen("site")}
          >
            Editar el sitio
            <ArrowRight size={14} />
          </button>
          <button
            type="button"
            className="nd-button"
            onClick={() => onOpen("inbox")}
          >
            Ver solicitudes
            <ArrowRight size={14} />
          </button>
        </div>
      </section>
      <div className="guide-search-bar">
        <label className="guide-search">
          <Search size={18} />
          <input
            aria-label="Buscar en la guía"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca: publicar, fotografías, pacientes…"
          />
          {query && (
            <button
              type="button"
              aria-label="Borrar búsqueda de la guía"
              onClick={() => setQuery("")}
            >
              <X size={15} />
            </button>
          )}
        </label>
        <span role="status">
          {search
            ? `${sections.length + faqs.length} resultado(s)`
            : "Paso a paso · En español"}
        </span>
      </div>
      {!sections.length && !faqs.length ? (
        <div className="guide-empty">
          <CircleHelp size={29} />
          <h2>No encontramos ese tema</h2>
          <p>Prueba con otra palabra, como «publicar», «Olivia» o «correo».</p>
          <button
            type="button"
            className="nd-button"
            onClick={() => setQuery("")}
          >
            Ver toda la guía
          </button>
        </div>
      ) : (
        <div className="guide-layout">
          <nav className="guide-index" aria-label="Temas de la guía">
            <span>EN ESTA GUÍA</span>
            {sections.map((section, index) => (
              <button
                type="button"
                key={section.id}
                onClick={() => jump(section.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {section.title}
              </button>
            ))}
            {faqs.length > 0 && (
              <button type="button" onClick={() => jump("dudas")}>
                <CircleHelp size={14} />
                Dudas frecuentes
              </button>
            )}
          </nav>
          <div className="guide-contents">
            {sections.map((section) => (
              <section
                key={section.id}
                id={`guide-${section.id}`}
                className="guide-section"
                aria-labelledby={`guide-title-${section.id}`}
                tabIndex={-1}
              >
                <div className="guide-section-heading">
                  <span className="guide-section-icon">
                    <Check size={17} />
                  </span>
                  <div>
                    <h2 id={`guide-title-${section.id}`}>{section.title}</h2>
                    <p>{section.summary}</p>
                  </div>
                </div>
                <ol>
                  {section.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <aside className="guide-note">
                  <BookOpen size={16} />
                  <p>{section.note}</p>
                </aside>
                <button
                  type="button"
                  className="guide-module-link"
                  onClick={() => onOpen(section.panel)}
                >
                  {section.action}
                  <ArrowRight size={15} />
                </button>
              </section>
            ))}
            {faqs.length > 0 && (
              <section
                className="guide-section guide-faqs"
                id="guide-dudas"
                tabIndex={-1}
                aria-labelledby="guide-title-dudas"
              >
                <div className="guide-section-heading">
                  <span className="guide-section-icon">
                    <CircleHelp size={18} />
                  </span>
                  <div>
                    <h2 id="guide-title-dudas">Dudas frecuentes</h2>
                    <p>Respuestas para continuar con tu trabajo.</p>
                  </div>
                </div>
                {faqs.map((faq) => (
                  <article key={faq.question}>
                    <h3>{faq.question}</h3>
                    <p>{faq.answer}</p>
                  </article>
                ))}
              </section>
            )}
          </div>
        </div>
      )}
      <footer className="guide-footer">
        <BookOpen size={14} />
        Guía de uso de Neuro Diversa · Disponible para todo el equipo.
      </footer>
    </div>
  );
}
