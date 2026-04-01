import Link from "next/link";
import { ArrowRight, Clock, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { BLOG_POSTS } from "@/lib/blog-data";

export const metadata: Metadata = {
  title: "Plumbing Emergency Guide & Tips",
  description:
    "Expert guides on plumbing emergencies: what to do when a pipe bursts, emergency plumber costs, prevention tips, and more.",
};

export default function BlogIndex() {
  return (
    <>
      <section className="bg-primary text-white py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">
            Plumbing Emergency Guides
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            Expert advice for handling plumbing emergencies, finding reliable
            plumbers, and preventing costly water damage.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="space-y-6">
            {BLOG_POSTS.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block bg-white border border-gray-200 rounded-xl p-6 hover:border-primary hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {post.readTime}
                  </span>
                  <span>
                    {new Date(post.publishedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 group-hover:text-primary transition-colors mb-2">
                  {post.title}
                </h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-3">
                  {post.description}
                </p>
                <span className="inline-flex items-center gap-1 text-primary font-semibold text-sm">
                  Read Article <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
