import Link from "next/link";
import { Emoji } from "@/lib/emoji";
import StatusTag from "@/components/status-tag";

/**
 * The marketing footer. It ends the page on the same raised surface as the
 * header, and it renders the API status strip inside that surface -- so the
 * strip inherits the footer's background instead of having to guess at it.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-orange-200 bg-surface-raised">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <div className="text-2xl">
              <Emoji char="🐕" />
            </div>
            <div>
              <h3 className="font-bold text-orange-800">RooRooRoo</h3>
              <p className="text-xs text-orange-600">
                Your faithful website watcher
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-orange-600">
            <Link
              href="https://github.com/johnstonmatt/roorooroo-app"
              className="hover:text-orange-800"
            >
              GitHub
            </Link>
          </div>
        </div>
        <div className="text-center mt-8 pt-8 border-t border-orange-200">
          <p className="text-sm text-orange-600">
            © {`${new Date().getFullYear()}`} RooRooRoo - For Ollie{" "}
            <Emoji char="❤️" />
            <Emoji char="🐾" />
          </p>
        </div>
      </div>
      <StatusTag className="pb-4" />
    </footer>
  );
}
