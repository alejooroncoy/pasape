export type BlogPost = {
  slug: "mcp-para-organizadores" | "como-crear-un-evento";
  category: string;
  note: string;
  title: string;
  description: string;
  readingTime: string;
  publishedAt: string;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "mcp-para-organizadores",
    category: "Construyendo Pasape",
    note: "Una herramienta menos que abrir antes de que empiece la noche.",
    title: "Pasape MCP: organiza tus eventos desde tu asistente de IA",
    description:
      "Conecta Pasape a un cliente compatible con MCP para crear, editar y publicar eventos conversando.",
    readingTime: "4 min de lectura",
    publishedAt: "18 de julio de 2026",
  },
  {
    slug: "como-crear-un-evento",
    category: "Desde la operación",
    note: "Lo esencial para pasar de una idea a una puerta lista.",
    title: "Cómo crear y publicar tu primer evento en Pasape",
    description:
      "Una guía simple para configurar entradas, compartir tu evento y preparar el acceso con QR.",
    readingTime: "5 min de lectura",
    publishedAt: "18 de julio de 2026",
  },
];

export const getPost = (slug: string) => BLOG_POSTS.find((post) => post.slug === slug);
