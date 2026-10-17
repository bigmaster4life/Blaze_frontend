import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-white text-gray-900">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
