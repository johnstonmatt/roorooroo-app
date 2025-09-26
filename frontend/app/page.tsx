import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Emoji } from "@/lib/emoji";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Header */}
      <header className="border-b border-orange-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">
              <Emoji char="🐕" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-orange-800">RooRooRoo</h1>
              <p className="text-xs text-orange-600">Website Watcher</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              asChild
              className="text-orange-700 hover:text-orange-800"
            >
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button
              asChild
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Link href="/auth/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="text-8xl mb-8 animate-bounce">
            <Emoji char="🐕" />
          </div>
          <h1 className="text-5xl font-bold text-orange-800 mb-6 text-balance">
            Your Faithful Website Watcher
          </h1>
          <p className="text-xl text-orange-700 mb-8 text-pretty max-w-2xl mx-auto">
            Like a loyal pup watching out the window, RooRooRoo keeps an eye on
            your favorite websites and barks when something changes. Never miss
            important updates again!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              asChild
              className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-3"
            >
              <Link href="/auth/signup">Start Watching Free</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50 bg-transparent"
            >
              See How It Works
            </Button>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-orange-600">
            <Badge
              variant="secondary"
              className="bg-orange-100 text-orange-700"
            >
              Free Forever
            </Badge>
            <Badge
              variant="secondary"
              className="bg-orange-100 text-orange-700"
            >
              No Credit Card
            </Badge>
            <Badge
              variant="secondary"
              className="bg-orange-100 text-orange-700"
            >
              Setup in 2 Minutes
            </Badge>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-orange-800 mb-4">
            Why Choose RooRooRoo?
          </h2>
          <p className="text-xl text-orange-600 max-w-2xl mx-auto">
            Just like a faithful companion, we're always watching and ready to
            alert you
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="border-orange-200 hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="text-4xl mb-4">
                <Emoji char="👀" />
              </div>
              <CardTitle className="text-orange-800">Always Watching</CardTitle>
              <CardDescription className="text-orange-600">
                Monitor websites 24/7 for specific content changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-orange-700 space-y-2">
                <li>• Check every 5 minutes</li>
                <li>• Custom search patterns</li>
                <li>• Multiple websites</li>
                <li>• Reliable monitoring</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-orange-200 hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="text-4xl mb-4">
                <Emoji char="🔔" />
              </div>
              <CardTitle className="text-orange-800">Instant Alerts</CardTitle>
              <CardDescription className="text-orange-600">
                Get notified the moment something changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-orange-700 space-y-2">
                <li>• Email notifications</li>
                <li>• Webhook support</li>
                <li>• Custom messages</li>
                <li>• No delays</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-orange-200 hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="text-4xl mb-4">
                <Emoji char="🎯" />
              </div>
              <CardTitle className="text-orange-800">Smart Matching</CardTitle>
              <CardDescription className="text-orange-600">
                Flexible pattern matching for any content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-orange-700 space-y-2">
                <li>• Text contains</li>
                <li>• Regular expressions</li>
                <li>• Absence detection</li>
                <li>• Case sensitive options</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="bg-white/50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-orange-800 mb-4">
              Perfect For
            </h2>
            <p className="text-xl text-orange-600">
              See how others use RooRooRoo to stay ahead
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <div className="text-center p-6 rounded-lg bg-white border border-orange-200">
              <div className="text-3xl mb-3">
                <Emoji char="🛒" />
              </div>
              <h3 className="font-semibold text-orange-800 mb-2">E-commerce</h3>
              <p className="text-sm text-orange-600">
                Watch for "Buy Now" buttons, stock availability, or price
                changes
              </p>
            </div>

            <div className="text-center p-6 rounded-lg bg-white border border-orange-200">
              <div className="text-3xl mb-3">
                <Emoji char="💼" />
              </div>
              <h3 className="font-semibold text-orange-800 mb-2">
                Job Hunting
              </h3>
              <p className="text-sm text-orange-600">
                Monitor job boards for new postings matching your criteria
              </p>
            </div>

            <div className="text-center p-6 rounded-lg bg-white border border-orange-200">
              <div className="text-3xl mb-3">
                <Emoji char="📰" />
              </div>
              <h3 className="font-semibold text-orange-800 mb-2">
                News & Updates
              </h3>
              <p className="text-sm text-orange-600">
                Stay informed about breaking news or company announcements
              </p>
            </div>

            <div className="text-center p-6 rounded-lg bg-white border border-orange-200">
              <div className="text-3xl mb-3">
                <Emoji char="🎫" />
              </div>
              <h3 className="font-semibold text-orange-800 mb-2">
                Event Tickets
              </h3>
              <p className="text-sm text-orange-600">
                Get alerted when tickets become available for sold-out events
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="text-6xl mb-6">
            <Emoji char="🐕‍🦺" />
          </div>
          <h2 className="text-4xl font-bold text-orange-800 mb-6">
            Ready to Start Watching?
          </h2>
          <p className="text-xl text-orange-700 mb-8">
            Join thousands of users who trust RooRooRoo to keep watch over their
            important websites
          </p>
          <Button
            size="lg"
            asChild
            className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-3"
          >
            <Link href="/auth/signup">Create Your Free Account</Link>
          </Button>
          <p className="text-sm text-orange-600 mt-4">
            No credit card required • Free forever • Setup in minutes
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-orange-200 bg-white/80 py-12">
        <div className="container mx-auto px-4">
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
              <Link href="/privacy" className="hover:text-orange-800">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-orange-800">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-orange-800">
                Contact
              </Link>
            </div>
          </div>
          <div className="text-center mt-8 pt-8 border-t border-orange-200">
            <p className="text-sm text-orange-600">
              © 2025 RooRooRoo. dedicated to Ollie <Emoji char="❤️" />
              <Emoji char="🐾" />
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
