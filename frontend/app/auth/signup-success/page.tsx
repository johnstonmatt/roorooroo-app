import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthBrand } from "@/components/auth-brand";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SignupSuccessPage() {
  return (
    <>
      <AuthBrand />
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-foreground">
            Welcome to the Pack!
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Check your email to confirm your account
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="mb-6">
            <div className="text-4xl mb-4">📧</div>
            <p className="text-accent-foreground mb-4">
              We&#39;ve sent you a confirmation email. Click the link in the
              email to activate your account and start watching websites!
            </p>
            <p className="text-sm text-muted-foreground">
              Don&#39;t see the email? Check your spam folder or wait a few
              minutes.
            </p>
          </div>
          <Button
            asChild
          >
            <Link href="/auth/login">Back to Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
