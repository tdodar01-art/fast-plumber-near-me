import type { Metadata } from "next";
import { Mail, MapPin, Clock } from "lucide-react";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Fast Plumber Near Me. Questions about listings, verification, or partnerships? We're here to help.",
};

export default function ContactPage() {
  return (
    <>
      <section className="bg-primary text-white py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">Contact Us</h1>
          <p className="text-lg text-blue-200">
            Have questions? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Contact info */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Get in Touch</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Email</p>
                  <a
                    href="mailto:fastplumbernearme@gmail.com"
                    className="text-primary hover:text-primary-dark transition-colors"
                  >
                    fastplumbernearme@gmail.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Office</p>
                  <p className="text-gray-600">135 Erick St Unit F<br />Crystal Lake, IL 60014</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Hours</p>
                  <p className="text-gray-600">
                    Monday – Friday: 9 AM – 5 PM<br />
                    Weekend: By appointment
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 bg-gray-50 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-2">For Plumbers</h3>
              <p className="text-sm text-gray-600 mb-3">
                Want to get listed or upgrade to a premium listing? We&apos;d love to have you.
              </p>
              <a
                href="/add-your-business"
                className="text-primary hover:text-primary-dark font-semibold text-sm transition-colors"
              >
                Submit your business →
              </a>
            </div>
          </div>

          {/* Contact form */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Send a Message</h2>
            <ContactForm />
          </div>
        </div>
      </div>
    </>
  );
}
