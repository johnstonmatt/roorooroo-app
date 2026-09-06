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
import { BrandLink, HomeNavActions } from "@/components/nav-auth";
import { DashboardHeader, HeaderTitle } from "@/components/dashboard-header";
import { SiteFooter } from "@/components/site-footer";

export default function HomePage() {
  return (
    <div>
      <DashboardHeader sticky>
        <BrandLink>
          <HeaderTitle
            emoji={<Emoji char="🐕" />}
            title="RooRooRoo"
            subtitle="Website Watcher"
            size="lg"
          />
        </BrandLink>
        <div className="flex items-center gap-3">
          <HomeNavActions />
        </div>
      </DashboardHeader>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="text-8xl mb-8 animate-bounce">
            <Emoji char="🐕" />
          </div>
          <h1 className="text-5xl font-bold text-foreground mb-6 text-balance">
            Your Faithful Website Watcher
          </h1>
          <p className="text-xl text-accent-foreground mb-8 text-pretty max-w-2xl mx-auto">
            Like a loyal pup watching out the window, RooRooRoo keeps an eye on
            your favorite websites and barks when something changes. Never miss
            important updates again!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              asChild
              className="text-lg px-8 py-3"
            >
              <Link href="/auth/signup">Start Watching Free</Link>
            </Button>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Badge
              variant="secondary"
              className="bg-orange-100 text-accent-foreground"
            >
              Free
            </Badge>
            <Badge
              variant="secondary"
              className="bg-orange-100 text-accent-foreground"
            >
              No Credit Card
            </Badge>
            <Badge
              variant="secondary"
              className="bg-orange-100 text-accent-foreground"
            >
              Setup in 2 Minutes
            </Badge>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Why Choose RooRooRoo?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Just like a faithful companion, we&#39;re always watching and ready
            to alert you
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="text-4xl mb-4">
                <Emoji char="👀" />
              </div>
              <CardTitle className="text-foreground">Always Watching</CardTitle>
              <CardDescription className="text-muted-foreground">
                Monitor websites 24/7 for specific content changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-accent-foreground space-y-2">
                <li>• Check every 5 minutes</li>
                <li>• Custom search patterns</li>
                <li>• Multiple websites</li>
                <li>• Reliable monitoring</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="text-4xl mb-4">
                <Emoji char="🔔" />
              </div>
              <CardTitle className="text-foreground">Instant Alerts</CardTitle>
              <CardDescription className="text-muted-foreground">
                Get notified the moment something changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-accent-foreground space-y-2">
                <li>• Email notifications</li>
                <li>• Webhook support</li>
                <li>• Custom messages</li>
                <li>• No delays</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="text-4xl mb-4">
                <Emoji char="🎯" />
              </div>
              <CardTitle className="text-foreground">Smart Matching</CardTitle>
              <CardDescription className="text-muted-foreground">
                Flexible pattern matching for any content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-accent-foreground space-y-2">
                <li>• Text contains</li>
                <li>• Absence detection</li>
                <li>• More coming soon!</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="bg-white/50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Perfect For
            </h2>
            <p className="text-xl text-muted-foreground">
              See how others use RooRooRoo to stay ahead
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <div className="text-center p-6 rounded-lg bg-white border">
              <div className="text-3xl mb-3">
                <Emoji char="🛒" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">E-commerce</h3>
              <p className="text-sm text-muted-foreground">
                Watch for &quot;Buy Now&quot; buttons, stock availability, or
                price changes
              </p>
            </div>

            <div className="text-center p-6 rounded-lg bg-white border">
              <div className="text-3xl mb-3">
                <Emoji char="💼" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Job Hunting
              </h3>
              <p className="text-sm text-muted-foreground">
                Monitor job boards for new postings matching your criteria
              </p>
            </div>

            <div className="text-center p-6 rounded-lg bg-white border">
              <div className="text-3xl mb-3">
                <Emoji char="📰" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                News & Updates
              </h3>
              <p className="text-sm text-muted-foreground">
                Stay informed about breaking news or company announcements
              </p>
            </div>

            <div className="text-center p-6 rounded-lg bg-white border">
              <div className="text-3xl mb-3">
                <Emoji char="🎫" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Event Tickets
              </h3>
              <p className="text-sm text-muted-foreground">
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
          <h2 className="text-4xl font-bold text-foreground mb-6">
            Ready to Start Watching?
          </h2>
          <p className="text-xl text-accent-foreground mb-8">
            Join 10s of users (optimistically) who trust RooRooRoo to keep watch
            over their important websites
          </p>
          <Button
            size="lg"
            asChild
            className="text-lg px-8 py-3"
          >
            <Link href="/auth/signup">Create Your Free Account</Link>
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required • Free • Setup in minutes
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
