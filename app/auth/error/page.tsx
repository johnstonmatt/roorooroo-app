import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🐕</div>
          <h1 className="text-3xl font-bold text-orange-800 mb-2">RooRooRoo</h1>
        </div>

        <Card className="border-red-200 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-red-700">Oops! Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="mb-6">
              <div className="text-4xl mb-4">😞</div>
              {params?.error ? (
                <p className="text-sm text-red-600 mb-4">Error: {params.error}</p>
              ) : (
                <p className="text-sm text-red-600 mb-4">An unexpected error occurred during authentication.</p>
              )}
            </div>
            <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white">
              <Link href="/auth/login">Try Again</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
