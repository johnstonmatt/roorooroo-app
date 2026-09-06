/** The inline failure banner every form in the app renders. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-3">
      <p className="text-sm text-red-600">{message}</p>
    </div>
  );
}
