import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SignupSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🐕</div>
          <h1 className="text-3xl font-bold text-orange-800 mb-2">RooRooRoo</h1>
        </div>

        <Card className="border-orange-200 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-orange-800">
              Welcome to the Pack!
            </CardTitle>
            <CardDescription className="text-orange-600">
              Check your email to confirm your account
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="mb-6">
              <div className="text-4xl mb-4">📧</div>
              <p className="text-orange-700 mb-4">
                We&#39;ve sent you a confirmation email. Click the link in the
                email to activate your account and start watching websites!
              </p>
              <p className="text-sm text-orange-600">
                Don&#39;t see the email? Check your spam folder or wait a few
                minutes.
              </p>
            </div>
            <Button
              asChild
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Link href="/auth/login">Back to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
