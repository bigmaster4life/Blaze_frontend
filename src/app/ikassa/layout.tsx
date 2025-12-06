export default function IkassaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#071524] text-white">
      {children}
    </div>
  );
}