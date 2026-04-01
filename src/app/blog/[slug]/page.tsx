import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Clock, ArrowLeft, ArrowRight } from "lucide-react";
import { getBlogPost, getAllBlogSlugs, BLOG_POSTS } from "@/lib/blog-data";
import CallToAction from "@/components/CallToAction";

export function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
    },
  };
}

function renderContent(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  function flushTable() {
    if (tableRows.length < 2) return;
    const headers = tableRows[0];
    const rows = tableRows.slice(2); // skip separator row
    elements.push(
      <div key={`table-${elements.length}`} className="overflow-x-auto my-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="text-left p-3 bg-gray-50 border border-gray-200 font-semibold text-gray-900">
                  {h.trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="p-3 border border-gray-200 text-gray-700">
                    {cell.trim()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table detection
    if (line.startsWith("|")) {
      inTable = true;
      const cells = line.split("|").filter(Boolean);
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      inTable = false;
      flushTable();
    }

    // Headings
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-xl sm:text-2xl font-bold text-gray-900 mt-8 mb-3">
          {line.replace("## ", "")}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-lg font-bold text-gray-900 mt-6 mb-2">
          {line.replace("### ", "")}
        </h3>
      );
    } else if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(
        <p key={i} className="font-semibold text-gray-900 mt-4 mb-1">
          {line.replace(/\*\*/g, "")}
        </p>
      );
    } else if (line.startsWith("- **")) {
      const match = line.match(/^- \*\*(.+?)\*\*\s*[—–-]?\s*(.*)/);
      if (match) {
        elements.push(
          <li key={i} className="ml-4 text-gray-700 leading-relaxed mb-1 list-disc">
            <strong>{match[1]}</strong> {match[2] ? `— ${match[2]}` : ""}
          </li>
        );
      }
    } else if (line.startsWith("- ")) {
      elements.push(
        <li key={i} className="ml-4 text-gray-700 leading-relaxed mb-1 list-disc">
          {line.replace("- ", "")}
        </li>
      );
    } else if (line.trim() === "") {
      // Skip blank lines
    } else {
      // Parse inline bold
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <p key={i} className="text-gray-700 leading-relaxed mb-3">
          {parts.map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j} className="text-gray-900">{part.replace(/\*\*/g, "")}</strong>
            ) : (
              part
            )
          )}
        </p>
      );
    }
  }

  if (inTable) flushTable();

  return elements;
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const currentIndex = BLOG_POSTS.findIndex((p) => p.slug === slug);
  const prevPost = currentIndex > 0 ? BLOG_POSTS[currentIndex - 1] : null;
  const nextPost = currentIndex < BLOG_POSTS.length - 1 ? BLOG_POSTS[currentIndex + 1] : null;

  // Article schema
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      "@type": "Organization",
      name: "Fast Plumber Near Me",
      url: "https://fastplumbernearme.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Fast Plumber Near Me",
      url: "https://fastplumbernearme.com",
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://fastplumbernearme.com" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://fastplumbernearme.com/blog" },
      { "@type": "ListItem", position: 3, name: post.title, item: `https://fastplumbernearme.com/blog/${slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <article className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-dark font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Articles
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight mb-3">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {post.readTime}
            </span>
            <span>
              Updated{" "}
              {new Date(post.updatedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </header>

        <div className="prose-content">{renderContent(post.content)}</div>

        {/* Post navigation */}
        <div className="border-t border-gray-200 mt-12 pt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {prevPost && (
            <Link
              href={`/blog/${prevPost.slug}`}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4 flex-shrink-0" />
              <span className="line-clamp-1">{prevPost.title}</span>
            </Link>
          )}
          {nextPost && (
            <Link
              href={`/blog/${nextPost.slug}`}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors sm:ml-auto sm:text-right"
            >
              <span className="line-clamp-1">{nextPost.title}</span>
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
            </Link>
          )}
        </div>
      </article>

      <CallToAction />
    </>
  );
}
